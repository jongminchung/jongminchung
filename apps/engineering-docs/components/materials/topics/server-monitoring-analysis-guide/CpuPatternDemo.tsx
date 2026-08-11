// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useEffect, useRef } from "react";
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

// 타임라인 (ms): 세 패널이 동시에 그려진다
const T_DRAW = 4000; // 곡선을 그리는 시간
const T_HOLD = 3000; // 완성된 그림을 보여주는 시간
const CYCLE = T_DRAW + T_HOLD;

const P99_MAX = 1000; // P99 트랙 눈금 상한 (ms)
const REVEAL_P = 0.6; // 판독 캡션이 페이드 인되는 진행률

interface Scenario {
  title: string;
  reading: string;
  color: string; // 판독 라벨·배지 텍스트 색
  badgeBg: string; // 배지 배경
}

const SCENARIOS: Scenario[] = [
  {
    title: "① 건강한 상태",
    reading: "CPU가 부하를 따라 움직이고 응답도 안정",
    color: "#2f9e44",
    badgeBg: "#d3f9d8",
  },
  {
    title: "② CPU는 노는데 느리다",
    reading: "I/O 대기, 락, 풀 고갈일 수 있음",
    color: "#f08c00",
    badgeBg: "#fff9db",
  },
  {
    title: "③ 100%에 붙었다",
    reading: "연산 병목이거나 무한 루프",
    color: "#fa5252",
    badgeBg: "#fff5f5",
  },
];

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
function smoothstep(t: number) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}
// 사이클마다 같은 그림이 나오도록 사인 합성으로 결정적인 물결을 만든다
function wave(t: number, freq: number, phase: number) {
  return Math.sin(t * Math.PI * 2 * freq + phase);
}

// t: 0~1 (시간축 진행률) → CPU 사용률 (%)
function cpuAt(scenario: number, t: number): number {
  if (scenario === 0) {
    // 트래픽을 따라 35~65% 사이에서 완만하게 물결친다
    return clamp(50 + 11 * wave(t, 1.6, 0.5) + 4 * wave(t, 4.3, 1.7), 35, 65);
  }
  if (scenario === 1) {
    // 20~30%에서 낮고 평평하다
    return clamp(25 + 3 * wave(t, 2.8, 0.3) + 1.5 * wave(t, 6.5, 1.1), 20, 30);
  }
  // 급상승 후 100%에 붙어 톱질 없는 직선이 된다
  const base = 45 + 6 * wave(t, 3, 0.8);
  const ramp = smoothstep((t - 0.2) / 0.15);
  return clamp(base + (100 - base) * ramp, 0, 100);
}

// t: 0~1 → P99 응답 시간 (ms)
function p99At(scenario: number, t: number, cpu: number): number {
  if (scenario === 0) {
    // CPU에 비례해 50~80ms에서 살짝 출렁인다
    return clamp(65 + (cpu - 50) * 0.6 + 4 * wave(t, 5.2, 2.0), 50, 80);
  }
  if (scenario === 1) {
    // 어느 시점부터 급상승해 고공행진
    const jump = smoothstep((t - 0.35) / 0.2);
    return clamp(80 + 820 * jump + 45 * wave(t, 7, 0.4) * jump, 50, P99_MAX);
  }
  // CPU 고착과 함께 폭증
  const jump = smoothstep((t - 0.22) / 0.18);
  return clamp(70 + 870 * jump + 20 * wave(t, 8, 1.2) * jump, 50, P99_MAX);
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
  ctx.font = `700 ${Math.max(9, fs - 1)}px ${FONT}`;
  ctx.fillStyle = "#868e96";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(title, x, y - 6);

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

    ctx.font = `${Math.max(8.5, fs - 2.5)}px ${FONT}`;
    ctx.fillStyle = "#adb5bd";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(`${v}${unit}`, x - 5, gy);
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
    progress: number; // 0~1, 왼쪽→오른쪽 진행률
    valueAt: (t: number) => number;
    color: string;
  },
) {
  const { x, y, w, h, max, progress, valueAt, color } = opts;
  if (progress <= 0) return;

  const endPx = w * progress;
  const endT = endPx / w;
  const toY = (v: number) => y + h * (1 - clamp(v, 0, max) / max);

  const trace = () => {
    ctx.beginPath();
    for (let px = 0; px <= endPx; px += 2) {
      const cy = toY(valueAt(px / w));
      if (px === 0) ctx.moveTo(x, cy);
      else ctx.lineTo(x + px, cy);
    }
    ctx.lineTo(x + endPx, toY(valueAt(endT)));
  };

  // 곡선 아래 옅은 면 채우기
  trace();
  ctx.save();
  ctx.lineTo(x + endPx, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();

  // 곡선 본체
  trace();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.stroke();
}

// 판독 캡션을 패널 폭에 맞춰 최대 세 줄로 나눈다
function wrapReading(ctx: SvgDrawingContext, text: string, maxW: number): string[] {
  if (ctx.measureText(text).width <= maxW) return [text];

  const sep = text.indexOf(" — ");
  const chunks = sep >= 0 ? [text.slice(0, sep), `— ${text.slice(sep + 3)}`] : [text];

  const lines: string[] = [];
  for (const chunk of chunks) {
    if (ctx.measureText(chunk).width <= maxW) {
      lines.push(chunk);
      continue;
    }
    const words = chunk.split(" ");
    let line = "";
    for (const word of words) {
      const cand = line ? `${line} ${word}` : word;
      if (ctx.measureText(cand).width > maxW && line) {
        lines.push(line);
        line = word;
      } else {
        line = cand;
      }
    }
    if (line) lines.push(line);
  }
  return lines.slice(0, 3);
}

export const CpuPatternDemo = () => {
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
      const progress = Math.min(1, e / T_DRAW);

      // --- 레이아웃: 세 패널을 세로로 쌓는다 ---
      const cols = 1;
      const rows = SCENARIOS.length;
      const pad = 8;
      const gapX = 18;
      const gapY = 22;
      const panelW = (w - pad * 2 - gapX * (cols - 1)) / cols;

      const fs = Math.max(9.5, Math.min(12, panelW / 22));
      const axisW = Math.max(28, fs * 2.6);
      const badgeH = 22;
      const plotW = panelW - axisW;
      const trackH = Math.max(56, Math.min(76, panelW * 0.14));
      const trackGap = 24; // 아래 트랙 제목이 들어갈 간격
      const captionLineH = fs + 3;
      const captionLines = panelW > 520 ? 1 : 3;
      const captionH = captionLineH * captionLines + 4;

      const track1Off = badgeH + 8 + 14; // 배지 + 트랙 제목 공간
      const track2Off = track1Off + trackH + trackGap;
      const panelH = track2Off + trackH + 14 + captionH;
      const h = pad + rows * panelH + (rows - 1) * gapY + pad;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      SCENARIOS.forEach((sc, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const px0 = pad + col * (panelW + gapX);
        const py0 = pad + row * (panelH + gapY);

        const plotX = px0 + axisW;
        const t1Y = py0 + track1Off;
        const t2Y = py0 + track2Off;
        const captionTop = t2Y + trackH + 14;

        // --- 시나리오 제목 배지 (사이클 시작 시 페이드 인) ---
        const badgeA = Math.min(1, e / 300);
        ctx.globalAlpha = badgeA;
        ctx.font = `700 ${fs}px ${FONT}`;
        const badgeW = ctx.measureText(sc.title).width + 20;
        ctx.beginPath();
        ctx.roundRect(px0, py0, badgeW, badgeH, 12);
        ctx.fillStyle = sc.badgeBg;
        ctx.fill();
        ctx.fillStyle = sc.color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(sc.title, px0 + badgeW / 2, py0 + badgeH / 2 + 0.5);
        ctx.globalAlpha = 1;

        // --- 두 트랙 ---
        drawTrack(ctx, {
          x: plotX,
          y: t1Y,
          w: plotW,
          h: trackH,
          title: "CPU 사용률",
          gridValues: [0, 50, 100],
          max: 100,
          unit: "%",
          fs,
        });
        drawTrack(ctx, {
          x: plotX,
          y: t2Y,
          w: plotW,
          h: trackH,
          title: "P99 응답 시간(ms)",
          gridValues: [0, 500, 1000],
          max: P99_MAX,
          unit: "",
          fs,
        });

        // --- 곡선 (왼쪽→오른쪽 진행) ---
        const cpuOf = (t: number) => cpuAt(i, t);
        const p99Of = (t: number) => p99At(i, t, cpuAt(i, t));
        drawCurve(ctx, {
          x: plotX,
          y: t1Y,
          w: plotW,
          h: trackH,
          max: 100,
          progress,
          valueAt: cpuOf,
          color: "#228be6",
        });
        drawCurve(ctx, {
          x: plotX,
          y: t2Y,
          w: plotW,
          h: trackH,
          max: P99_MAX,
          progress,
          valueAt: p99Of,
          color: "#845ef7",
        });

        // --- 진행 커서 + 현재 값 ---
        const cx = plotX + plotW * progress;
        const cpuNow = cpuOf(progress);
        const p99Now = p99Of(progress);
        const cpuY = t1Y + trackH * (1 - cpuNow / 100);
        const p99Y = t2Y + trackH * (1 - p99Now / P99_MAX);

        if (progress < 1) {
          ctx.strokeStyle = "#adb5bd";
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(cx, t1Y);
          ctx.lineTo(cx, t2Y + trackH);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        const drawDot = (dy: number, trackTop: number, color: string, label: string) => {
          ctx.beginPath();
          ctx.arc(cx, dy, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.font = `700 ${Math.max(8.5, fs - 1.5)}px ${FONT}`;
          const nearRight = cx > plotX + plotW - ctx.measureText(label).width - 12;
          // 값이 트랙 상단에 붙으면 라벨을 점 아래로 내린다
          const labelY = dy - 10 < trackTop + 6 ? dy + 12 : dy - 10;
          ctx.textAlign = nearRight ? "right" : "left";
          ctx.textBaseline = "middle";
          ctx.fillStyle = color;
          ctx.fillText(label, cx + (nearRight ? -8 : 8), labelY);
        };
        drawDot(cpuY, t1Y, "#228be6", `${Math.round(cpuNow)}%`);
        drawDot(p99Y, t2Y, "#845ef7", `${Math.round(p99Now)}ms`);

        // --- 패널 하단 캡션: 판독 요지 (패턴이 드러난 뒤 페이드 인) ---
        const readA = clamp((progress - REVEAL_P) / 0.1, 0, 1);
        if (readA > 0) {
          ctx.font = `700 ${Math.max(9.5, fs - 1)}px ${FONT}`;
          ctx.globalAlpha = readA;
          ctx.fillStyle = sc.color;
          ctx.textAlign = "center";
          ctx.textBaseline = "alphabetic";
          const lines = wrapReading(ctx, sc.reading, panelW - 4);
          lines.forEach((line, li) => {
            ctx.fillText(line, px0 + panelW / 2, captionTop + fs + li * captionLineH);
          });
          ctx.globalAlpha = 1;
        }
        ctx.textAlign = "left";
      });

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
