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

// 타임라인 (ms)
const T_DRAW = 7000; // 곡선이 왼쪽→오른쪽으로 그려지는 시간
const T_ALIGN = T_DRAW + 200; // 정렬 강조 시작
const ALIGN_GAP = 600; // 점선이 하나씩 강조되는 간격
const ALIGN_DUR = 350;
const CYCLE = 10000;

const P99_MAX = 600; // 위 트랙 눈금 상한 (ms)
const P99_BASE = 70; // 평상시 P99
const SPIKE_MS = 550; // 스파이크 정점
const STW_LABEL = "STW 480ms";

// GC(=스파이크) 발생 지점 — 시간축 진행률 0~1
const SPIKES = [0.22, 0.47, 0.72, 0.92];
const SPIKE_SD = 0.006; // 바늘 폭 (가우시안 표준편차)

// 힙 톱니 파라미터 (힙 한계=1.0 기준 비율)
const HEAP_BASE = 0.28;
const HEAP_TOP = 0.86;
const HEAP_BOUNDS = [0, ...SPIKES, 1];

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
function easeOut(t: number) {
  const x = clamp(t, 0, 1);
  return 1 - Math.pow(1 - x, 3);
}

// t: 0~1 → P99 응답 시간 (ms). 평온한 물결 + 좁은 바늘 스파이크
function p99At(t: number): number {
  let v =
    P99_BASE +
    5 * Math.sin(t * Math.PI * 2 * 2.3 + 0.7) +
    3 * Math.sin(t * Math.PI * 2 * 5.1 + 1.9);
  for (let i = 0; i < SPIKES.length; i++) {
    const d = (t - SPIKES[i]) / SPIKE_SD;
    v += (SPIKE_MS - P99_BASE) * Math.exp(-0.5 * d * d);
  }
  return clamp(v, 0, P99_MAX);
}

// t: 0~1 → 힙 사용량 (0~1). GC 지점마다 뚝 떨어지는 톱니
function heapAt(t: number): number {
  const x = clamp(t, 0, 1);
  let i = 0;
  for (let k = 0; k < HEAP_BOUNDS.length - 1; k++) {
    if (x >= HEAP_BOUNDS[k]) i = k;
  }
  i = clamp(i, 0, HEAP_BOUNDS.length - 2);
  const s0 = HEAP_BOUNDS[i];
  const s1 = HEAP_BOUNDS[i + 1];
  const phase = clamp((x - s0) / Math.max(1e-6, s1 - s0), 0, 1);
  return HEAP_BASE + (HEAP_TOP - HEAP_BASE) * phase + 0.012 * Math.sin(x * Math.PI * 2 * 13);
}

function wrapText(ctx: SvgDrawingContext, text: string, maxWidth: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function drawTrack(
  ctx: SvgDrawingContext,
  opts: {
    x: number;
    y: number;
    w: number;
    h: number;
    title: string;
    gridValues: number[];
    max: number;
    unit: string;
    fs: number;
  },
) {
  const { x, y, w, h, title, gridValues, max, unit, fs } = opts;

  // 트랙 제목
  ctx.font = `700 ${fs}px ${FONT}`;
  ctx.fillStyle = "#868e96";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(title, x, y - 7);

  // 배경
  ctx.fillStyle = "#f8f9fa";
  ctx.fillRect(x, y, w, h);

  // 눈금선 + 값 라벨
  gridValues.forEach((v) => {
    const gy = y + h * (1 - v / max);
    ctx.strokeStyle = "#dee2e6";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x + w, gy);
    ctx.stroke();

    ctx.font = `${Math.max(9, fs - 2)}px ${FONT}`;
    ctx.fillStyle = "#adb5bd";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(`${v}${unit}`, x - 6, gy);
  });

  // 외곽 테두리
  ctx.strokeStyle = "#adb5bd";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
}

function drawCurve(
  ctx: SvgDrawingContext,
  opts: {
    x: number;
    y: number;
    w: number;
    h: number;
    max: number;
    progress: number;
    valueAt: (t: number) => number;
    color: string;
  },
) {
  const { x, y, w, h, max, progress, valueAt, color } = opts;
  if (progress <= 0) return;

  const endPx = w * progress;
  const toY = (v: number) => y + h * (1 - clamp(v, 0, max) / max);

  // 곡선 아래 옅은 면 채우기 (바늘 스파이크를 놓치지 않게 1px 간격 샘플링)
  ctx.save();
  ctx.beginPath();
  for (let px = 0; px <= endPx; px += 1) {
    const t = px / w;
    const cy = toY(valueAt(t));
    if (px === 0) ctx.moveTo(x, cy);
    else ctx.lineTo(x + px, cy);
  }
  ctx.lineTo(x + endPx, toY(valueAt(endPx / w)));
  ctx.lineTo(x + endPx, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();

  // 곡선 본체
  ctx.beginPath();
  for (let px = 0; px <= endPx; px += 1) {
    const t = px / w;
    const cy = toY(valueAt(t));
    if (px === 0) ctx.moveTo(x, cy);
    else ctx.lineTo(x + px, cy);
  }
  ctx.lineTo(x + endPx, toY(valueAt(endPx / w)));
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.stroke();
}

export const GcPauseDemo = () => {
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
      const isMobile = w < 480;

      const e = Math.max(0, (now - start) % CYCLE);
      const progress = Math.min(1, e / T_DRAW);

      const fs = Math.max(10, Math.min(12, w / 46));
      const pad = 8;
      const axisW = Math.max(34, fs * 3.4);
      const trackH = Math.max(64, Math.min(96, w * 0.17));
      const trackGap = 30; // 아래 트랙 제목이 들어갈 간격
      const captionH = fs * 2 + 22;

      const plotX = pad + axisW;
      const plotW = w - plotX - pad;
      const t1Y = pad + fs + 12;
      const t2Y = t1Y + trackH + trackGap;
      const h = t2Y + trackH + captionH + 10;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      const X = (t: number) => plotX + plotW * t;

      // --- 두 트랙 ---
      drawTrack(ctx, {
        x: plotX,
        y: t1Y,
        w: plotW,
        h: trackH,
        title: "P99 응답 시간",
        gridValues: [0, 300, 600],
        max: P99_MAX,
        unit: "",
        fs,
      });
      drawTrack(ctx, {
        x: plotX,
        y: t2Y,
        w: plotW,
        h: trackH,
        title: "힙 사용량 + GC 이벤트",
        gridValues: [],
        max: 1,
        unit: "",
        fs,
      });
      // 위 트랙 단위 표기
      ctx.font = `${Math.max(9, fs - 2)}px ${FONT}`;
      ctx.fillStyle = "#adb5bd";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("(ms)", plotX + plotW - ctx.measureText("(ms)").width, t1Y - 7);

      // --- 정렬 점선 (지나간 스파이크마다 옅게, 정렬 단계에서 하나씩 강조) ---
      SPIKES.forEach((s, i) => {
        if (progress < s) return;
        const sx = X(s);
        const hp = easeOut((e - (T_ALIGN + i * ALIGN_GAP)) / ALIGN_DUR);

        // 강조 배경 밴드
        if (hp > 0) {
          ctx.globalAlpha = 0.5 * hp;
          ctx.fillStyle = "#fff9db";
          ctx.fillRect(sx - 6, t1Y, 12, t2Y + trackH - t1Y);
          ctx.globalAlpha = 1;
        }

        // 두 트랙을 관통하는 회색 세로 점선
        ctx.globalAlpha = hp > 0 ? 0.9 : 0.45;
        ctx.strokeStyle = hp > 0 ? "#495057" : "#adb5bd";
        ctx.lineWidth = hp > 0 ? 1.6 : 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(sx, t1Y);
        ctx.lineTo(sx, t2Y + trackH);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      });

      // --- 곡선 (왼쪽→오른쪽 진행) ---
      drawCurve(ctx, {
        x: plotX,
        y: t1Y,
        w: plotW,
        h: trackH,
        max: P99_MAX,
        progress,
        valueAt: p99At,
        color: "#845ef7",
      });
      drawCurve(ctx, {
        x: plotX,
        y: t2Y,
        w: plotW,
        h: trackH,
        max: 1,
        progress,
        valueAt: heapAt,
        color: "#228be6",
      });

      // --- GC 마커 (톱니가 떨어지는 지점의 빨간 세로선 + STW 라벨) ---
      const stwFs = Math.max(9, fs - 2);
      SPIKES.forEach((s) => {
        const appearA = clamp((e - s * T_DRAW) / 300, 0, 1);
        if (appearA <= 0) return;
        const sx = X(s);

        ctx.globalAlpha = appearA;
        ctx.strokeStyle = "#fa5252";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sx, t2Y);
        ctx.lineTo(sx, t2Y + trackH);
        ctx.stroke();

        // GC 삼각형 표식 (트랙 하단)
        ctx.beginPath();
        ctx.moveTo(sx - 4, t2Y + trackH);
        ctx.lineTo(sx + 4, t2Y + trackH);
        ctx.lineTo(sx, t2Y + trackH - 6);
        ctx.closePath();
        ctx.fillStyle = "#fa5252";
        ctx.fill();

        // STW 라벨 — 마커 오른쪽 위 (오른쪽 끝은 왼쪽으로 붙인다)
        ctx.font = `700 ${stwFs}px ${FONT}`;
        const labelW = ctx.measureText(STW_LABEL).width;
        const onLeft = sx + 5 + labelW > plotX + plotW - 2;
        ctx.textAlign = onLeft ? "right" : "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#fa5252";
        ctx.fillText(STW_LABEL, sx + (onLeft ? -5 : 5), t2Y + trackH * 0.28);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.globalAlpha = 1;
      });

      // --- 정렬 강조 점 (스파이크 정점 ↔ GC 지점) ---
      SPIKES.forEach((s, i) => {
        const hp = easeOut((e - (T_ALIGN + i * ALIGN_GAP)) / ALIGN_DUR);
        if (hp <= 0) return;
        const sx = X(s);
        const spikeY = t1Y + trackH * (1 - SPIKE_MS / P99_MAX);
        const gcY = t2Y + trackH * (1 - HEAP_BASE);

        ctx.globalAlpha = hp;
        [
          { y: spikeY, color: "#845ef7" },
          { y: gcY, color: "#fa5252" },
        ].forEach(({ y, color }) => {
          ctx.beginPath();
          ctx.arc(sx, y, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        });
        ctx.globalAlpha = 1;
      });

      // --- 진행 커서 + 현재 값 ---
      if (progress < 1) {
        const cx = plotX + plotW * progress;
        const p99Now = p99At(progress);
        const heapNow = heapAt(progress);
        const p99Y = t1Y + trackH * (1 - clamp(p99Now, 0, P99_MAX) / P99_MAX);
        const heapY = t2Y + trackH * (1 - clamp(heapNow, 0, 1));

        ctx.strokeStyle = "#adb5bd";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(cx, t1Y);
        ctx.lineTo(cx, t2Y + trackH);
        ctx.stroke();
        ctx.setLineDash([]);

        const drawDot = (dy: number, trackTop: number, color: string, label: string) => {
          ctx.beginPath();
          ctx.arc(cx, dy, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.font = `700 ${Math.max(9, fs - 1)}px ${FONT}`;
          const nearRight = cx > plotX + plotW - ctx.measureText(label).width - 12;
          const labelY = dy - 10 < trackTop + 6 ? dy + 12 : dy - 10;
          ctx.textAlign = nearRight ? "right" : "left";
          ctx.textBaseline = "middle";
          ctx.fillStyle = color;
          ctx.fillText(label, cx + (nearRight ? -8 : 8), labelY);
          ctx.textAlign = "left";
          ctx.textBaseline = "alphabetic";
        };
        drawDot(p99Y, t1Y, "#845ef7", `${Math.round(p99Now)}ms`);
        drawDot(heapY, t2Y, "#228be6", `힙 ${Math.round(heapNow * 100)}%`);
      }

      // --- 하단 단계 캡션 ---
      let caption = "① P99에만 주기적으로 바늘 스파이크 — 트래픽·CPU·에러는 전부 평온하다";
      if (e >= T_ALIGN) {
        caption =
          "③ 스파이크가 주기적이면 코드가 아니라 런타임을 의심하라 — GC 로그와 겹쳐 읽으면 확정된다";
      } else if (e >= SPIKES[1] * T_DRAW + 300) {
        caption =
          "② 아래에 힙 그래프를 겹치면: 스파이크마다 GC가 있다 — 세상이 멈추는 시간(stop-the-world)";
      }
      ctx.font = `${Math.max(10, fs - 1)}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.textAlign = "center";
      const lines = wrapText(ctx, caption, w - 16);
      lines.forEach((line, i) => {
        ctx.fillText(line, w / 2, h - 8 - (lines.length - 1 - i) * (fs + 3));
      });
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
