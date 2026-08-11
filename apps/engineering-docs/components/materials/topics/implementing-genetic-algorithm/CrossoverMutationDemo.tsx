// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  cancelMaterialFrame,
  scheduleMaterialFrame,
} from "#components/materials/runtime/scheduler";
import {
  SvgCanvas,
  type SvgCanvasHandle,
  type SvgDrawingContext,
  type SvgGradient,
} from "#components/materials/runtime/svg-canvas";

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

const GENES = 20; // 실제는 43개지만 시각화를 위해 20칸으로 단순화

// 시나리오 타임라인 (ms)
const T_SHOW = 400; // 부모 배열 등장
const T_CROSS = 1300; // 교차 시작
const T_CROSS_DUR = 2000; // 교차 진행 시간
const T_MUT = T_CROSS + T_CROSS_DUR + 400; // 변이 시작
const T_MUT_DUR = 1400; // 변이 진행 시간
const T_HOLD_END = T_MUT + T_MUT_DUR + 1300; // 완성 후 멈춤
const CYCLE = T_HOLD_END;

const MUT_COUNT = 3; // 변이 칸 수

// 결정적 난수 (mulberry32)
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp01(t: number) {
  return Math.min(1, Math.max(0, t));
}
function easeOut(t: number) {
  return 1 - Math.pow(1 - clamp01(t), 3);
}

// 값(0~1)에 따라 파랑/보라 계열 그라데이션 색을 만든다
function geneColor(value: number, hue: "A" | "B") {
  const v = clamp01(value);
  if (hue === "A") {
    // 연한 #e7f5ff -> 진한 #228be6
    const r = Math.round(231 + (34 - 231) * v);
    const g = Math.round(245 + (139 - 245) * v);
    const b = Math.round(255 + (230 - 255) * v);
    return `rgb(${r},${g},${b})`;
  }
  // 연한 #f3f0ff -> 진한 #845ef7
  const r = Math.round(243 + (132 - 243) * v);
  const g = Math.round(240 + (94 - 240) * v);
  const b = Math.round(255 + (247 - 255) * v);
  return `rgb(${r},${g},${b})`;
}

interface CycleData {
  parentA: number[];
  parentB: number[];
  cutPoint: number; // 한 점 교차 절단 지점
  pick: ("A" | "B")[]; // 균등 교차: 각 칸 부모 선택
  mutIdx: number[]; // 변이 칸 인덱스
  mutVal: number[]; // 변이 새 값
}

function buildCycle(cycleIndex: number, uniform: boolean): CycleData {
  const rnd = mulberry32(cycleIndex * 2654435761 + (uniform ? 7 : 13));
  const parentA = Array.from({ length: GENES }, () => rnd());
  const parentB = Array.from({ length: GENES }, () => rnd());
  const cutPoint = 2 + Math.floor(rnd() * (GENES - 4)); // 양 끝을 피한 절단점
  const pick = Array.from({ length: GENES }, () => (rnd() < 0.5 ? "A" : "B")) as ("A" | "B")[];

  // 변이 위치: 중복 없이 MUT_COUNT개 고른다
  const mutIdx: number[] = [];
  while (mutIdx.length < MUT_COUNT) {
    const idx = Math.floor(rnd() * GENES);
    if (!mutIdx.includes(idx)) mutIdx.push(idx);
  }
  const mutVal = mutIdx.map(() => rnd());
  return { parentA, parentB, cutPoint, pick, mutIdx, mutVal };
}

function drawCell(
  ctx: SvgDrawingContext,
  x: number,
  y: number,
  size: number,
  fill: string,
  opts: { alpha?: number; stroke?: string; lineWidth?: number } = {},
) {
  const { alpha = 1, stroke = "#dee2e6", lineWidth = 1 } = opts;
  if (alpha <= 0.01) return;
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 3);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function rowLabel(
  ctx: SvgDrawingContext,
  text: string,
  x: number,
  y: number,
  fs: number,
  color: string,
) {
  ctx.font = `700 ${fs}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, x, y);
}

export const CrossoverMutationDemo = () => {
  const [uniform, setUniform] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<SvgCanvasHandle>(null);
  const uniformRef = useRef(uniform);
  uniformRef.current = uniform;

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let raf = 0;
    const start = performance.now();

    const render = (now: number) => {
      const isUniform = uniformRef.current;
      const w = container.clientWidth;
      const dpr = window.devicePixelRatio || 1;
      const elapsed = Math.max(0, now - start);
      const e = elapsed % CYCLE;
      const cycleIndex = Math.floor(elapsed / CYCLE);
      const data = buildCycle(cycleIndex, isUniform);

      const mobile = w < 480;
      const pad = 8;
      const fs = mobile ? 11 : 13;

      // 한 줄에 배열이 들어가도록 칸 크기 계산
      const cols = GENES;
      const cellGap = mobile ? 1.5 : 2;
      const usableW = w - pad * 2;
      const cellSize = (usableW - cellGap * (cols - 1)) / cols;

      const labelH = fs + 8;
      const rowGap = mobile ? 22 : 26;
      const rowBlock = labelH + cellSize + rowGap;

      const topPad = 6;
      const captionH = 40;
      const h = topPad + rowBlock * 3 + captionH;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      const cellX = (i: number) => pad + i * (cellSize + cellGap);
      const rowLabelY = (row: number) => topPad + row * rowBlock + fs;
      const rowCellY = (row: number) => topPad + row * rowBlock + labelH;

      const yA = rowCellY(0);
      const yB = rowCellY(1);
      const yChild = rowCellY(2);

      // --- 부모 A ---
      const showP = easeOut((e - T_SHOW) / 500);
      rowLabel(ctx, "부모 A", pad, rowLabelY(0) - 1, fs, "#1971c2");
      data.parentA.forEach((v, i) => {
        drawCell(ctx, cellX(i), yA, cellSize, geneColor(v, "A"), { alpha: showP });
      });

      // --- 부모 B ---
      rowLabel(ctx, "부모 B", pad, rowLabelY(1) - 1, fs, "#7048e8");
      data.parentB.forEach((v, i) => {
        drawCell(ctx, cellX(i), yB, cellSize, geneColor(v, "B"), { alpha: showP });
      });

      // --- 자식 ---
      rowLabel(ctx, "자식", pad, rowLabelY(2) - 1, fs, "#495057");

      // 각 칸이 어느 부모에서 오는지
      const fromA = (i: number) => (isUniform ? data.pick[i] === "A" : i < data.cutPoint);

      // 교차 진행률 (칸별 순차 등장)
      const crossElapsed = e - T_CROSS;
      data.parentA.forEach((_, i) => {
        const fa = fromA(i);
        const srcVal = fa ? data.parentA[i] : data.parentB[i];
        const hue: "A" | "B" = fa ? "A" : "B";
        const srcY = fa ? yA : yB;

        // 칸마다 순차적으로 "내려온다"
        const perCellDelay = (T_CROSS_DUR - 500) / cols;
        const cellStart = i * perCellDelay;
        const p = easeOut((crossElapsed - cellStart) / 500);
        if (p <= 0) return;

        // 변이 여부 확인
        const mIdx = data.mutIdx.indexOf(i);
        const isMut = mIdx >= 0;
        const mutStart = T_MUT + data.mutIdx.indexOf(i) * 220;
        const mutP = isMut ? clamp01((e - mutStart) / 400) : 0;
        const mutDone = isMut && e >= mutStart;

        // 값: 변이 완료되면 새 값으로
        const val = mutDone ? data.mutVal[mIdx] : srcVal;
        // 변이는 부모 색을 유지하되 값만 흔들린다
        const fill = geneColor(val, hue);

        // 내려오는 애니메이션: srcY에서 yChild로
        const y = srcY + (yChild - srcY) * p;

        // 펄스 테두리 (변이 반짝임)
        let stroke = "#dee2e6";
        let lineWidth = 1;
        if (isMut && e >= mutStart && e < mutStart + 900) {
          const pulse = 0.5 + 0.5 * Math.sin(((e - mutStart) / 900) * Math.PI * 3);
          stroke = "#fa5252";
          lineWidth = 1 + pulse * 2;
        } else if (mutDone) {
          stroke = "#fa5252";
          lineWidth = 1.5;
        }

        drawCell(ctx, cellX(i), y, cellSize, fill, { alpha: p, stroke, lineWidth });

        // 변이 완료 칸에 별 표시
        if (mutDone && mutP > 0.3) {
          ctx.globalAlpha = clamp01((mutP - 0.3) / 0.4);
          ctx.font = `700 ${Math.max(8, cellSize * 0.6)}px ${FONT}`;
          ctx.fillStyle = "#fa5252";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("✦", cellX(i) + cellSize / 2, yChild + cellSize / 2 + 1);
          ctx.globalAlpha = 1;
        }
      });

      // 한 점 교차: 세로 절단선
      if (!isUniform && crossElapsed > -300) {
        const lineX = cellX(data.cutPoint) - cellGap / 2;
        const lineA = clamp01((crossElapsed + 300) / 500);
        ctx.globalAlpha = lineA;
        ctx.strokeStyle = "#fa5252";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(lineX, yA - 4);
        ctx.lineTo(lineX, yChild + cellSize + 4);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      // --- 하단 설명 ---
      let caption: string;
      const inMutation = e >= T_MUT && e < T_HOLD_END - 400;
      if (inMutation) {
        caption = "변이: 몇 칸을 무작위로 흔들어 새로운 값을 만든다";
      } else if (isUniform) {
        caption = "칸마다 동전을 던져 A와 B 중 하나를 고른다";
      } else {
        caption = "한 지점을 잘라 앞은 A, 뒤는 B에서 가져온다";
      }
      ctx.font = `${Math.max(11, fs - 1)}px ${FONT}`;
      ctx.fillStyle = inMutation ? "#e03131" : "#868e96";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(caption, w / 2, h - 12);
      ctx.textAlign = "left";

      raf = scheduleMaterialFrame(render);
    };

    raf = scheduleMaterialFrame(render);
    return () => cancelMaterialFrame(raf);
  }, []);

  const toggleBtn = (active: boolean, label: string, onClick: () => void) => (
    <button
      onClick={onClick}
      style={{
        padding: "6px 14px",
        fontSize: 13,
        fontFamily: FONT,
        cursor: "pointer",
        border: `1px solid ${active ? "#228be6" : "#dee2e6"}`,
        borderRadius: 6,
        background: active ? "#e7f5ff" : "#f8f9fa",
        color: active ? "#1971c2" : "#495057",
        fontWeight: active ? 700 : 400,
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        border: "1px solid #dee2e6",
        borderRadius: 8,
        padding: 20,
        margin: "24px 0",
        background: "#fff",
        fontFamily: FONT,
      }}
    >
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {toggleBtn(!uniform, "한 점 교차", () => setUniform(false))}
        {toggleBtn(uniform, "균등 교차", () => setUniform(true))}
      </div>
      <div ref={containerRef}>
        <SvgCanvas ref={canvasRef} style={{ display: "block", width: "100%" }} />
      </div>
    </div>
  );
};
