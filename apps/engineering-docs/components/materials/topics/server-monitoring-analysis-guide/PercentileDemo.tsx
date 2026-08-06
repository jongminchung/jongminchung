// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useEffect, useRef } from "react";
import {
  cancelMaterialFrame,
  scheduleMaterialFrame,
} from "@/components/materials/runtime/scheduler";
import {
  SvgCanvas,
  type SvgCanvasHandle,
  type SvgDrawingContext,
  type SvgGradient,
} from "@/components/materials/runtime/svg-canvas";

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

// 시나리오 타임라인 (ms)
const T_DROP = 300; // 요청 도트 낙하 시작
const DROP_STAGGER = 58; // 도트 간 낙하 간격
const DROP_DUR = 500;
const T_MEAN = 3500; // 평균선 등장
const MEAN_DUR = 500;
const T_P50 = 4700;
const T_P95 = 5500;
const T_P99 = 6300;
const MARKER_DUR = 450;
const CYCLE = 9500;

// 응답 시간 분포: [ms, 요청 수]. 두 서버 모두 40건이고 평균은 100ms로 같다.
// 서버 A: 80~130ms에 몰린 종 모양. P50 100 / P95 115 / P99 130
const A_BARS: Array<[number, number]> = [
  [70, 1],
  [85, 8],
  [100, 22],
  [115, 8],
  [130, 1],
];
// 서버 B: 85%는 20~50ms로 빠르지만 15%가 400~900ms의 긴 꼬리.
// P50 22 / P95 470 / P99 850
const B_BARS: Array<[number, number]> = [
  [22, 21],
  [32, 9],
  [45, 4],
  [400, 1],
  [420, 1],
  [445, 1],
  [470, 1],
  [495, 1],
  [850, 1],
];

const X_MAX = 1000; // X축: 응답 시간 0~1000ms
const MAX_STACK = 22; // 가장 높은 막대의 도트 수 (두 차트 공통 Y 스케일)
const TAIL_MS = 400; // 이 값 이상이면 꼬리 구간

// 레이아웃 상수
const TITLE_H = 20;
const LABEL_ROW = 13;
const LABEL_ZONE = LABEL_ROW * 4 + 6; // 평균 + P50/P95/P99 라벨 4줄
const PLOT_H = 116;
const AXIS_H = 20;
const PANEL_H = TITLE_H + LABEL_ZONE + PLOT_H + AXIS_H;

interface Dot {
  ms: number;
  stack: number; // 같은 막대 안에서 아래에서부터 몇 번째인지
  order: number; // 낙하 순서
  tail: boolean;
}

// 막대들을 한 층씩 번갈아 채우는 순서로 도트를 만든다.
// 매 사이클 같은 순서라 항상 동일한 그림이 나온다.
function buildDots(bars: Array<[number, number]>): Dot[] {
  const dots: Dot[] = [];
  for (let layer = 0, added = true; added; layer++) {
    added = false;
    bars.forEach(([ms, n]) => {
      if (layer < n) {
        dots.push({ ms, stack: layer, order: dots.length, tail: ms >= TAIL_MS });
        added = true;
      }
    });
  }
  return dots;
}

const A_DOTS = buildDots(A_BARS);
const B_DOTS = buildDots(B_BARS);

// 퍼센타일 마커: [서버 A 값, 서버 B 값]
const PERCENTILES = [
  { name: "P50", t: T_P50, row: 1, line: "#40c057", text: "#2f9e44", values: [100, 22] },
  { name: "P95", t: T_P95, row: 2, line: "#fab005", text: "#f08c00", values: [115, 470] },
  { name: "P99", t: T_P99, row: 3, line: "#fa5252", text: "#e03131", values: [130, 850] },
];

function clamp01(t: number) {
  return Math.min(1, Math.max(0, t));
}
function easeOut(t: number) {
  return 1 - Math.pow(1 - clamp01(t), 3);
}

// 라벨이 차트 밖으로 나가지 않게 좌우로 밀어 넣는다
function labelAt(
  ctx: SvgDrawingContext,
  text: string,
  px: number,
  py: number,
  ox: number,
  cw: number,
) {
  const tw = ctx.measureText(text).width;
  const lx = Math.min(Math.max(px, ox), ox + cw - tw);
  ctx.fillText(text, lx, py);
}

function drawPanel(
  ctx: SvgDrawingContext,
  e: number,
  ox: number,
  oy: number,
  cw: number,
  fs: number,
  server: "A" | "B",
) {
  const baseY = oy + TITLE_H + LABEL_ZONE + PLOT_H;
  const x = (ms: number) => ox + (ms / X_MAX) * cw;
  const rowCY = (row: number) => oy + TITLE_H + 8 + row * LABEL_ROW;
  const dots = server === "A" ? A_DOTS : B_DOTS;
  const smallFs = Math.max(9, fs - 2);

  // 제목
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.font = `700 ${fs + 1}px ${FONT}`;
  ctx.fillStyle = "#495057";
  ctx.fillText(`서버 ${server}`, ox, oy + 13);
  ctx.font = `${smallFs}px ${FONT}`;
  ctx.fillStyle = "#adb5bd";
  ctx.textAlign = "right";
  ctx.fillText("요청 40건 · 세로: 요청 수", ox + cw, oy + 13);
  ctx.textAlign = "left";

  // 꼬리 구간 강조 (서버 B, P99 등장 시점부터)
  const tailP = easeOut((e - T_P99) / MARKER_DUR);
  if (server === "B" && tailP > 0) {
    ctx.globalAlpha = tailP;
    ctx.fillStyle = "#fff5f5";
    ctx.fillRect(x(TAIL_MS - 15), rowCY(3) + 7, x(875) - x(TAIL_MS - 15), baseY - rowCY(3) - 7);
    ctx.font = `700 ${smallFs}px ${FONT}`;
    ctx.fillStyle = "#e03131";
    ctx.textAlign = "center";
    ctx.fillText("긴 꼬리 (요청의 15%)", x(630), baseY - 44);
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  }

  // X축 (응답 시간 0~1000ms)
  ctx.strokeStyle = "#adb5bd";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ox, baseY);
  ctx.lineTo(ox + cw, baseY);
  ctx.stroke();
  ctx.font = `${smallFs}px ${FONT}`;
  ctx.fillStyle = "#adb5bd";
  [0, 500, 1000].forEach((ms) => {
    const tx = x(ms);
    ctx.beginPath();
    ctx.moveTo(tx, baseY);
    ctx.lineTo(tx, baseY + 4);
    ctx.stroke();
    ctx.textAlign = ms === 0 ? "left" : ms === X_MAX ? "right" : "center";
    ctx.fillText(ms === X_MAX ? "1000ms" : String(ms), tx, baseY + 15);
  });
  ctx.textAlign = "left";

  // 요청 도트: 위에서 떨어지며 막대로 쌓인다
  const spacing = Math.min(5.4, (PLOT_H - 12) / MAX_STACK);
  const r = Math.max(2.2, Math.min(2.8, cw / 110));
  const startY = oy + TITLE_H + 10;
  dots.forEach((d) => {
    const p = easeOut((e - T_DROP - d.order * DROP_STAGGER) / DROP_DUR);
    if (p <= 0) return;
    const targetY = baseY - 3 - d.stack * spacing;
    const y = startY + (targetY - startY) * p;
    const alpha = Math.min(1, p * 2);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x(d.ms), y, r, 0, Math.PI * 2);
    ctx.fillStyle = "#228be6";
    ctx.fill();
    if (d.tail && tailP > 0) {
      // 꼬리 도트는 빨간색으로 물든다
      ctx.globalAlpha = alpha * tailP;
      ctx.fillStyle = "#fa5252";
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });

  // 평균선: 두 서버 모두 정확히 같은 위치(100ms)
  const meanP = easeOut((e - T_MEAN) / MEAN_DUR);
  if (meanP > 0) {
    const mx = x(100);
    const topY = rowCY(0) + 7;
    ctx.globalAlpha = Math.min(1, meanP * 1.5);
    ctx.strokeStyle = "#228be6";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(mx, topY);
    ctx.lineTo(mx, topY + (baseY - topY) * meanP);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = `700 ${smallFs}px ${FONT}`;
    ctx.fillStyle = "#1971c2";
    ctx.textBaseline = "middle";
    labelAt(ctx, "평균 100ms", mx + 4, rowCY(0), ox, cw);
    ctx.textBaseline = "alphabetic";
    ctx.globalAlpha = 1;
  }

  // P50 → P95 → P99 마커가 순차적으로 등장한다
  PERCENTILES.forEach((pc) => {
    const p = easeOut((e - pc.t) / MARKER_DUR);
    if (p <= 0) return;
    const v = pc.values[server === "A" ? 0 : 1];
    const mx = x(v);
    const topY = rowCY(pc.row) + 7;
    ctx.globalAlpha = Math.min(1, p * 1.5);
    ctx.strokeStyle = pc.line;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mx, topY);
    ctx.lineTo(mx, topY + (baseY - topY) * p);
    ctx.stroke();
    ctx.font = `700 ${smallFs}px ${FONT}`;
    ctx.fillStyle = pc.text;
    ctx.textBaseline = "middle";
    labelAt(ctx, `${pc.name} ${v}ms`, mx + 4, rowCY(pc.row), ox, cw);
    ctx.textBaseline = "alphabetic";
    ctx.globalAlpha = 1;
  });
}

export const PercentileDemo = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<SvgCanvasHandle>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let raf = 0;
    const start = performance.now();

    const render = (now: number) => {
      const w = container.clientWidth;
      const dpr = window.devicePixelRatio || 1;
      const e = Math.max(0, (now - start) % CYCLE);

      const isMobile = w < 480;
      const pad = 8;
      const gap = isMobile ? 0 : Math.max(20, w * 0.04);
      const cw = isMobile ? w - pad * 2 : (w - pad * 2 - gap) / 2;
      const fs = Math.max(10, Math.min(12.5, cw / 26));
      const vGap = 18;
      const captionH = 38;
      const h = pad + (isMobile ? PANEL_H * 2 + vGap : PANEL_H) + captionH;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      drawPanel(ctx, e, pad, pad, cw, fs, "A");
      if (isMobile) {
        drawPanel(ctx, e, pad, pad + PANEL_H + vGap, cw, fs, "B");
      } else {
        drawPanel(ctx, e, pad + cw + gap, pad, cw, fs, "B");
      }

      // --- 하단 단계 설명 ---
      let caption = "① 요청 40건이 쌓여 두 서버의 응답 시간 분포가 만들어진다";
      if (e >= T_P50) {
        caption = "③ 평균은 같지만 P99는 6배 차이(130ms vs 850ms) — 평균은 꼬리를 숨긴다";
      } else if (e >= T_MEAN) {
        caption = "② 평균 응답 시간은 둘 다 100ms — 평균만 보면 두 서버는 똑같다";
      }
      ctx.font = `${Math.max(10, fs - 1)}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      if (ctx.measureText(caption).width > w - 20 && caption.includes(" — ")) {
        const [line1, line2] = caption.split(" — ");
        ctx.fillText(line1, w / 2, h - 22);
        ctx.fillText(line2, w / 2, h - 8);
      } else {
        ctx.fillText(caption, w / 2, h - 12);
      }
      ctx.textAlign = "left";

      raf = scheduleMaterialFrame(render);
    };

    raf = scheduleMaterialFrame(render);
    return () => cancelMaterialFrame(raf);
  }, []);

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
      <div ref={containerRef}>
        <SvgCanvas ref={canvasRef} style={{ display: "block", width: "100%" }} />
      </div>
    </div>
  );
};
