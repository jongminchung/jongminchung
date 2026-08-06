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

// 사이클 타임라인 (ms)
const DRAW_DUR = 9000; // 곡선이 왼쪽→오른쪽으로 모두 그려지는 시간
const CYCLE = 11500; // 완성된 그래프를 잠시 유지한 뒤 리셋

// 데이터 시간축 (0~1 정규화)
const U_DEPLOY = 0.25; // 배포 시점
const U_DIVERGE = 0.42; // 갈림길이 눈에 보이는 시점
const U_BADGE_A = 0.58; // A 회복 추세 확인
const U_BADGE_B = 0.68; // B 악화 추세 판단
const U_ROLLBACK = 0.75; // B 롤백 시점

const Y_MAX = 350; // ms 스케일 상한

function clamp01(t: number) {
  return Math.min(1, Math.max(0, t));
}
function easeOut(t: number) {
  return 1 - Math.pow(1 - clamp01(t), 3);
}

// 결정론적 의사난수 노이즈 (-1 ~ 1)
function wiggle(u: number) {
  return Math.sin(u * 61) * 0.6 + Math.sin(u * 137 + 1.3) * 0.4;
}

// 시나리오 A(정상 워밍업): 80ms → 배포 직후 200ms → 서서히 90ms로 회복
function valueA(u: number): number {
  let base: number;
  if (u < U_DEPLOY) {
    base = 80;
  } else if (u < U_DEPLOY + 0.07) {
    base = 80 + 120 * easeOut((u - U_DEPLOY) / 0.07);
  } else if (u < 0.7) {
    base = 90 + 110 * Math.pow(1 - (u - 0.32) / 0.38, 1.6);
  } else {
    base = 90;
  }
  return base + wiggle(u) * (u < U_DEPLOY ? 2.5 : 5);
}

// 시나리오 B(롤백 신호): 80ms → 250ms로 상승 후 고착·악화(310ms) → 롤백 후 급회복
function valueB(u: number): number {
  let base: number;
  let amp = 2.5;
  if (u < U_DEPLOY) {
    base = 80;
  } else if (u < U_DEPLOY + 0.07) {
    base = 80 + 170 * easeOut((u - U_DEPLOY) / 0.07);
    amp = 6;
  } else if (u < U_ROLLBACK) {
    base = 250 + 60 * ((u - 0.32) / (U_ROLLBACK - 0.32));
    amp = 8;
  } else if (u < U_ROLLBACK + 0.1) {
    base = 310 - 230 * easeOut((u - U_ROLLBACK) / 0.1);
    amp = 4;
  } else {
    base = 80;
  }
  return base + wiggle(u) * amp;
}

function drawMarker(
  ctx: SvgDrawingContext,
  x: number,
  top: number,
  bottom: number,
  label: string,
  color: string,
  alpha: number,
  fs: number,
  chartRight: number,
) {
  if (alpha <= 0.01) return;
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, bottom);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = `700 ${fs}px ${FONT}`;
  const tw = ctx.measureText(label).width;
  const fitsRight = x + 5 + tw <= chartRight - 4;
  ctx.fillStyle = color;
  ctx.textAlign = fitsRight ? "left" : "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(label, fitsRight ? x + 5 : x - 5, top + fs);
  ctx.textAlign = "left";
  ctx.globalAlpha = 1;
}

function drawBadge(
  ctx: SvgDrawingContext,
  cx: number,
  y: number,
  text: string,
  fg: string,
  bg: string,
  alpha: number,
  fs: number,
) {
  if (alpha <= 0.01) return;
  ctx.globalAlpha = alpha;
  ctx.font = `700 ${fs}px ${FONT}`;
  const bw = ctx.measureText(text).width + 14;
  const bh = fs + 9;
  ctx.beginPath();
  ctx.roundRect(cx - bw / 2, y, bw, bh, 4);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = fg;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, y + bh / 2 + 0.5);
  ctx.textAlign = "left";
  ctx.globalAlpha = 1;
}

interface ChartSpec {
  title: string;
  value: (u: number) => number;
  isB: boolean;
}

function drawChart(
  ctx: SvgDrawingContext,
  cx0: number,
  cy0: number,
  cw: number,
  ch: number,
  spec: ChartSpec,
  p: number, // 곡선이 그려진 진행도 (0~1)
  fs: number,
) {
  const titleH = fs + 10;
  const padL = fs * 3.8; // y축 라벨 공간 ("300ms"가 잘리지 않는 폭)
  const padR = 6;
  const padT = 6;
  const padB = 8;
  const px0 = cx0 + padL;
  const py0 = cy0 + titleH + padT;
  const pw = cw - padL - padR;
  const ph = ch - titleH - padT - padB;
  const xOf = (u: number) => px0 + u * pw;
  const yOf = (v: number) => py0 + ph - (Math.min(v, Y_MAX) / Y_MAX) * ph;

  // 제목
  ctx.font = `700 ${fs}px ${FONT}`;
  ctx.fillStyle = "#495057";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(spec.title, cx0, cy0 + fs);

  // 플롯 영역
  ctx.fillStyle = "#f8f9fa";
  ctx.fillRect(px0, py0, pw, ph);
  ctx.strokeStyle = "#dee2e6";
  ctx.lineWidth = 1;
  ctx.strokeRect(px0, py0, pw, ph);

  // 그리드 + y축 라벨 (100/200/300ms)
  const labelFs = Math.max(9, fs - 3);
  [100, 200, 300].forEach((v) => {
    const y = yOf(v);
    ctx.strokeStyle = "#dee2e6";
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(px0, y);
    ctx.lineTo(px0 + pw, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = `${labelFs}px ${FONT}`;
    ctx.fillStyle = "#adb5bd";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(`${v}ms`, px0 - 4, y);
    ctx.textAlign = "left";
  });

  // 배포 마커 (보라 점선) — 곡선이 배포 시점을 지나면 나타나 계속 남는다
  drawMarker(
    ctx,
    xOf(U_DEPLOY),
    py0,
    py0 + ph,
    "배포 v2",
    "#845ef7",
    easeOut((p - U_DEPLOY) / 0.04),
    labelFs,
    px0 + pw,
  );

  // B: 롤백 마커 (빨강 점선)
  if (spec.isB) {
    drawMarker(
      ctx,
      xOf(U_ROLLBACK),
      py0,
      py0 + ph,
      "롤백",
      "#fa5252",
      easeOut((p - U_ROLLBACK) / 0.04),
      labelFs,
      px0 + pw,
    );
  }

  // P99 곡선: u=0 → u=p 까지만 그린다
  const uEnd = clamp01(p);
  ctx.strokeStyle = "#228be6";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.beginPath();
  const steps = Math.max(2, Math.ceil(uEnd * 220));
  for (let i = 0; i <= steps; i++) {
    const u = (i / steps) * uEnd;
    const x = xOf(u);
    const y = yOf(spec.value(u));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // 곡선 머리의 점
  if (p < 1) {
    ctx.beginPath();
    ctx.arc(xOf(uEnd), yOf(spec.value(uEnd)), 3, 0, Math.PI * 2);
    ctx.fillStyle = "#228be6";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // 판단 배지
  const badgeFs = Math.max(9, fs - 3);
  if (spec.isB) {
    drawBadge(
      ctx,
      px0 + pw / 2,
      py0 + 5,
      "악화 추세 — 롤백",
      "#fa5252",
      "#fff5f5",
      easeOut((p - U_BADGE_B) / 0.05),
      badgeFs,
    );
  } else {
    drawBadge(
      ctx,
      px0 + pw / 2,
      py0 + 5,
      "회복 추세 — 워밍업, 지켜본다",
      "#2f9e44",
      "#d3f9d8",
      easeOut((p - U_BADGE_A) / 0.05),
      badgeFs,
    );
  }

  // x축 안내
  ctx.font = `${labelFs}px ${FONT}`;
  ctx.fillStyle = "#adb5bd";
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("시간 →", px0 + pw, py0 + ph - 4);
  ctx.textAlign = "left";
}

export const DeployDemo = () => {
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
      const p = clamp01(e / DRAW_DUR);

      const s = w / 640;
      const fs = Math.max(11, Math.min(13, 13 * s));
      const gap = Math.max(14, w * 0.03);
      const chartW = isMobile ? w : (w - gap) / 2;
      const chartH = isMobile
        ? Math.max(130, Math.min(160, w * 0.34))
        : Math.max(140, Math.min(180, chartW * 0.58));
      const captionH = isMobile ? 46 : 34;
      const h = isMobile ? chartH * 2 + gap + captionH : chartH + captionH;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      const chartA: ChartSpec = { title: "시나리오 A", value: valueA, isB: false };
      const chartB: ChartSpec = { title: "시나리오 B", value: valueB, isB: true };
      if (isMobile) {
        drawChart(ctx, 0, 0, chartW, chartH, chartA, p, fs);
        drawChart(ctx, 0, chartH + gap, chartW, chartH, chartB, p, fs);
      } else {
        drawChart(ctx, 0, 0, chartW, chartH, chartA, p, fs);
        drawChart(ctx, chartW + gap, 0, chartW, chartH, chartB, p, fs);
      }

      // --- 하단 단계 설명 ---
      let caption = "① 배포 전: 두 시나리오 모두 안정 — 배포 마커는 그래프에 반드시 남겨라";
      if (p >= U_ROLLBACK) {
        caption = "④ B는 롤백 후 빠르게 회복한다 — 판단 기준은 수치가 아니라 방향이다";
      } else if (p >= U_DIVERGE) {
        caption = "③ 갈림길: A는 우하향(회복), B는 고착·악화 — 방향이 나쁘면 고민하지 말고 롤백";
      } else if (p >= U_DEPLOY) {
        caption =
          '② 배포 직후의 출렁임은 흔하다(캐시 콜드, JIT, 커넥션 재수립) — 질문은 "방향"이다';
      }
      const capFs = Math.max(10, fs - 1);
      ctx.font = `${capFs}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      if (ctx.measureText(caption).width > w - 8 && caption.includes(" — ")) {
        // 좁은 화면에서는 ' — ' 기준으로 두 줄로 나눈다
        const idx = caption.indexOf(" — ");
        ctx.fillText(caption.slice(0, idx), w / 2, h - 10 - capFs - 3);
        ctx.fillText(caption.slice(idx + 3), w / 2, h - 10);
      } else {
        ctx.fillText(caption, w / 2, h - 10);
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
