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

// 시나리오 타임라인 (ms)
const DRAW_DUR = 8000; // 곡선이 왼쪽→오른쪽으로 그려지는 시간
const T_TREND = 3000; // 최저점 연결선 등장
const TREND_DUR = 600;
const CYCLE = 9500; // 곡선 완성 후 잠시 결과를 보여주고 리셋

// 그래프 파라미터 — 값은 힙 한계(=1.0) 기준 비율, x는 0~1 진행률
const TOOTH = 0.14; // 톱니 하나의 주기
const VMAX = 1.18; // 그래프 세로축 최대값 (힙 한계 위 여백)
const NORMAL_BASE = 0.35;
const NORMAL_RISE = 0.4;
const LEAK_BASE = 0.3;
const LEAK_STEP = 0.09; // GC마다 최저점이 이만큼씩 상승
const LEAK_RISE = 0.4;
const OOM_TOOTH = 4; // 이 톱니의 상승 중에 힙 한계에 닿는다
const OOM_X = OOM_TOOTH * TOOTH + ((1 - (LEAK_BASE + LEAK_STEP * OOM_TOOTH)) / LEAK_RISE) * TOOTH;
const RESTART_X = OOM_X + 0.025; // 프로세스 재시작 지점
const T_OOM = OOM_X * DRAW_DUR;

function clamp01(t: number) {
  return Math.min(1, Math.max(0, t));
}
function easeOut(t: number) {
  return 1 - Math.pow(1 - clamp01(t), 3);
}

// 정상 프로세스: 톱니가 반복되고 GC 후 최저점은 항상 NORMAL_BASE로 돌아온다
function memNormal(x: number) {
  const i = Math.floor(x / TOOTH);
  const phase = (x - i * TOOTH) / TOOTH;
  return NORMAL_BASE + NORMAL_RISE * phase;
}

// 누수 프로세스: 톱니마다 최저점이 올라가다 힙 한계에 닿으면 죽고, 재시작 후 다시 누수
function memLeak(x: number) {
  if (x < OOM_X) {
    const i = Math.floor(x / TOOTH);
    const phase = (x - i * TOOTH) / TOOTH;
    return Math.min(LEAK_BASE + LEAK_STEP * i + LEAK_RISE * phase, 1);
  }
  if (x < RESTART_X) return 0.02; // 강제 종료 직후
  const lx = x - RESTART_X;
  const i = Math.floor(lx / TOOTH);
  const phase = (lx - i * TOOTH) / TOOTH;
  return 0.12 + LEAK_STEP * i + 0.35 * phase; // 재시작해도 최저점은 다시 우상향
}

// GC 직후 최저점 좌표 목록 (그려진 범위 안에서)
function troughs(kind: "normal" | "leak", xEnd: number) {
  const pts: Array<[number, number]> = [];
  for (let i = 1; i * TOOTH <= xEnd; i++) {
    const x = i * TOOTH;
    if (kind === "leak" && x >= OOM_X) break;
    pts.push([x, kind === "normal" ? NORMAL_BASE : LEAK_BASE + LEAK_STEP * i]);
  }
  return pts;
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

interface PanelOpts {
  title: string;
  kind: "normal" | "leak";
  xEnd: number;
  e: number;
  fs: number;
}

function drawPanel(
  ctx: SvgDrawingContext,
  px: number,
  py: number,
  pw: number,
  ph: number,
  { title, kind, xEnd, e, fs }: PanelOpts,
) {
  // 제목
  ctx.font = `700 ${fs}px ${FONT}`;
  ctx.fillStyle = kind === "normal" ? "#2f9e44" : "#fa5252";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(title, px + 2, py + fs);

  // 그래프 영역
  const gy = py + fs + 8;
  const gh = ph - fs - 8;
  ctx.beginPath();
  ctx.roundRect(px, gy, pw, gh, 6);
  ctx.fillStyle = "#f8f9fa";
  ctx.fill();
  ctx.strokeStyle = "#dee2e6";
  ctx.lineWidth = 1;
  ctx.stroke();

  const plotX = px + 10;
  const plotW = pw - 20;
  const plotBottom = gy + gh - 8;
  const plotH = gh - 16;
  const X = (x: number) => plotX + x * plotW;
  const Y = (v: number) => plotBottom - (v / VMAX) * plotH;

  // 힙 한계 점선
  ctx.strokeStyle = "#adb5bd";
  ctx.lineWidth = 1.2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(plotX, Y(1));
  ctx.lineTo(plotX + plotW, Y(1));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = `${Math.max(9, fs - 3)}px ${FONT}`;
  ctx.fillStyle = "#868e96";
  ctx.fillText("힙 한계", plotX + 2, Y(1) - 4);

  // 메모리 곡선 (실시간처럼 왼쪽→오른쪽)
  const mem = kind === "normal" ? memNormal : memLeak;
  const n = Math.max(200, Math.round(plotW * 2));
  ctx.beginPath();
  for (let k = 0; k <= n; k++) {
    const x = (k / n) * xEnd;
    const cx = X(x);
    const cy = Y(mem(x));
    if (k === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  }
  ctx.strokeStyle = "#228be6";
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.lineTo(X(xEnd), plotBottom);
  ctx.lineTo(plotX, plotBottom);
  ctx.closePath();
  ctx.fillStyle = "rgba(34, 139, 230, 0.08)";
  ctx.fill();

  // 정상 그래프: 첫 번째 뚝 떨어지는 지점에 GC 표시
  if (kind === "normal" && xEnd >= TOOTH) {
    ctx.font = `700 ${Math.max(9, fs - 3)}px ${FONT}`;
    ctx.fillStyle = "#868e96";
    ctx.fillText("GC ↓", X(TOOTH) + 3, Y(0.58));
  }

  // 최저점 연결선 (②에서 등장, 이후 곡선을 따라 연장)
  const pts = troughs(kind, xEnd);
  const trendP = easeOut((e - T_TREND) / TREND_DUR);
  if (trendP > 0 && pts.length >= 2) {
    const color = kind === "normal" ? "#40c057" : "#fa5252";
    const [x0, v0] = pts[0];
    const [x1, v1] = pts[pts.length - 1];
    const ex = x0 + (x1 - x0) * trendP;
    const ev = v0 + (v1 - v0) * trendP;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(X(x0), Y(v0));
    ctx.lineTo(X(ex), Y(ev));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = trendP;
    pts.forEach(([x, v]) => {
      ctx.beginPath();
      ctx.arc(X(x), Y(v), 2.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });
    // 판정 라벨
    ctx.font = `700 ${Math.max(9, fs - 2)}px ${FONT}`;
    ctx.textAlign = "center";
    if (kind === "normal") {
      ctx.fillStyle = "#2f9e44";
      ctx.fillText("GC 후 최저점: 수평 = 건강", px + pw / 2, Y(NORMAL_BASE) + fs + 6);
    } else {
      ctx.fillStyle = "#fa5252";
      ctx.fillText("최저점이 계속 상승 = 누수", X(0.3), Y(0.08));
    }
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  }

  // OOM 연출 (누수 그래프)
  if (kind === "leak" && e >= T_OOM) {
    // 그래프 영역이 빨갛게 번쩍
    const flash = (e - T_OOM) / 600;
    if (flash < 1) {
      ctx.globalAlpha = 0.28 * (1 - flash);
      ctx.beginPath();
      ctx.roundRect(px, gy, pw, gh, 6);
      ctx.fillStyle = "#fa5252";
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // 재시작 라벨
    if (xEnd >= RESTART_X + 0.04) {
      ctx.globalAlpha = easeOut((e - T_OOM - 500) / 400);
      ctx.font = `700 ${Math.max(9, fs - 2)}px ${FONT}`;
      ctx.fillStyle = "#495057";
      ctx.textAlign = "center";
      ctx.fillText("재시작", X(RESTART_X + 0.09), Y(0.72));
      ctx.textAlign = "left";
      ctx.globalAlpha = 1;
    }
    // OOM 배지
    const pop = easeOut((e - T_OOM) / 350);
    const label = "OOM — 프로세스 강제 종료";
    ctx.font = `700 ${Math.max(10, fs - 1)}px ${FONT}`;
    const bw = ctx.measureText(label).width + 20;
    const bh = fs + 12;
    const bx = px + pw / 2 - bw / 2;
    const by = gy + gh * 0.3 - bh / 2 + (1 - pop) * 6;
    ctx.globalAlpha = pop;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, bh / 2);
    ctx.fillStyle = "#fa5252";
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, bx + bw / 2, by + bh / 2 + 0.5);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.globalAlpha = 1;
  }
}

export const MemoryLeakDemo = () => {
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
      const xEnd = Math.min(e / DRAW_DUR, 1);

      const isMobile = w < 480;
      const pad = 4;
      const gap = Math.max(14, w * 0.03);
      const fs = Math.max(11, Math.min(13, w / 46));
      const panelW = isMobile ? w - pad * 2 : (w - pad * 2 - gap) / 2;
      const panelH = isMobile
        ? Math.max(130, Math.min(160, w * 0.36))
        : Math.max(150, Math.min(190, w * 0.29));
      const captionH = isMobile ? 44 : 32;
      const h = pad + (isMobile ? panelH * 2 + gap : panelH) + captionH;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      drawPanel(ctx, pad, pad, panelW, panelH, {
        title: "정상 (GC 톱니)",
        kind: "normal",
        xEnd,
        e,
        fs,
      });
      drawPanel(
        ctx,
        isMobile ? pad : pad + panelW + gap,
        isMobile ? pad + panelH + gap : pad,
        panelW,
        panelH,
        { title: "메모리 누수", kind: "leak", xEnd, e, fs },
      );

      // --- 하단 단계 설명 ---
      let caption = "① 두 그래프 모두 톱니를 그린다";
      if (e >= T_OOM) {
        caption = "③ 최저점이 우상향하면 누수";
      } else if (e >= T_TREND) {
        caption = "② 봐야 할 것은 GC 직후의 최저점";
      }
      ctx.font = `${Math.max(10, fs - 1)}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.textAlign = "center";
      const lines = wrapText(ctx, caption, w - 16);
      lines.forEach((line, i) => {
        ctx.fillText(line, w / 2, h - 10 - (lines.length - 1 - i) * (fs + 3));
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
