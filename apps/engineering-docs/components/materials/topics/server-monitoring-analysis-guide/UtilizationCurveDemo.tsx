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

// M/M/1 대기 곡선: W ∝ ρ/(1-ρ). 50% 기준 상대 배율로 표시한다.
// 50%→1x, 70%→2.3x, 80%→4x, 90%→9x, 95%→19x
const Y_MAX = 20; // 세로축 최대 배율 (95% = 19x가 화면 안에 들어오도록)
const CLIP_RHO = 0.95; // 곡선 클리핑 지점

// 마커 이동 타임라인 (ms): 이동 구간과 정지(값 읽기) 구간이 교대한다
const SEGMENTS: Array<{ t0: number; t1: number; from: number; to: number }> = [
  { t0: 0, t1: 1200, from: 0, to: 0.5 },
  { t0: 1200, t1: 2400, from: 0.5, to: 0.5 }, // 기준점 읽기
  { t0: 2400, t1: 3100, from: 0.5, to: 0.7 },
  { t0: 3100, t1: 4100, from: 0.7, to: 0.7 },
  { t0: 4100, t1: 4700, from: 0.7, to: 0.8 },
  { t0: 4700, t1: 5900, from: 0.8, to: 0.8 }, // 위험선 통과
  { t0: 5900, t1: 6600, from: 0.8, to: 0.9 },
  { t0: 6600, t1: 7600, from: 0.9, to: 0.9 },
  { t0: 7600, t1: 8200, from: 0.9, to: 0.95 },
  { t0: 8200, t1: 10400, from: 0.95, to: 0.95 }, // 결과를 보여주는 시간
];
const CYCLE = 10400;

const T_PASS_80 = 4700; // 80% 도달 시점
const T_REACH_90 = 6600; // 90% 도달 시점

function clamp01(t: number) {
  return Math.min(1, Math.max(0, t));
}
function easeInOut(t: number) {
  const p = clamp01(t);
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

// 현재 시각의 마커 위치(사용률 ρ)
function rhoAt(e: number) {
  for (const seg of SEGMENTS) {
    if (e < seg.t1) {
      const p = easeInOut((e - seg.t0) / (seg.t1 - seg.t0));
      return seg.from + (seg.to - seg.from) * p;
    }
  }
  return CLIP_RHO;
}

// 50% 기준 상대 대기 배율: (ρ/(1-ρ)) / (0.5/0.5) = ρ/(1-ρ)
function waitOf(rho: number) {
  return rho / (1 - rho);
}

function fmtWait(v: number) {
  const r = Math.round(v * 10) / 10;
  return r % 1 === 0 ? String(r) : r.toFixed(1);
}

function wrapLines(ctx: SvgDrawingContext, text: string, maxW: number): string[] {
  if (ctx.measureText(text).width <= maxW) return [text];
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export const UtilizationCurveDemo = () => {
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
      const s = w / 640;
      const isMobile = w < 480;

      const tickFs = Math.max(9, 11 * s);
      const labelFs = Math.max(10, 12 * s);
      const captionFs = Math.max(10, 12 * s);

      const padL = Math.max(34, 40 * s);
      const padR = Math.max(14, 20 * s);
      const padT = Math.max(32, 36 * s);
      const plotH = Math.max(190, Math.min(300, w * 0.42));
      const axisH = 24;
      const captionH = isMobile ? 46 : 34;
      const h = padT + plotH + axisH + captionH;
      const plotW = w - padL - padR;
      const yBottom = padT + plotH;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      const X = (rho: number) => padL + rho * plotW;
      const Y = (v: number) => yBottom - (Math.min(v, Y_MAX) / Y_MAX) * plotH;

      const rho = rhoAt(e);
      const passed80 = e >= T_PASS_80;
      const inDanger = rho >= 0.88;

      // --- 80~100% 위험 구간 배경 ---
      ctx.fillStyle = "#fff5f5";
      ctx.fillRect(X(0.8), padT, X(1) - X(0.8), plotH);

      // --- 가로 눈금선 (1x는 기준선으로 점선) ---
      ctx.textBaseline = "middle";
      ctx.textAlign = "right";
      [1, 5, 10, 15].forEach((v) => {
        const y = Y(v);
        ctx.strokeStyle = v === 1 ? "#dee2e6" : "#f1f3f5";
        ctx.lineWidth = 1;
        if (v === 1) ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(w - padR, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = `${tickFs}px ${FONT}`;
        ctx.fillStyle = "#adb5bd";
        ctx.fillText(`${v}x`, padL - 6, y);
      });

      // --- 축 ---
      ctx.strokeStyle = "#adb5bd";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, padT - 6);
      ctx.lineTo(padL, yBottom);
      ctx.lineTo(w - padR, yBottom);
      ctx.stroke();

      // --- 세로축 제목 ---
      ctx.font = `700 ${tickFs}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("평균 대기 시간 (50% 대비)", 4, padT - 14);

      // --- 가로축 눈금 ---
      const ticks = isMobile ? [0, 0.5, 0.8, 1] : [0, 0.5, 0.7, 0.8, 0.9, 1];
      ctx.textAlign = "center";
      ticks.forEach((t) => {
        const x = X(t);
        ctx.strokeStyle = "#adb5bd";
        ctx.beginPath();
        ctx.moveTo(x, yBottom);
        ctx.lineTo(x, yBottom + 4);
        ctx.stroke();
        const is80 = t === 0.8;
        ctx.font = `${is80 ? 700 : 400} ${tickFs}px ${FONT}`;
        ctx.fillStyle = is80 ? "#f08c00" : "#868e96";
        ctx.fillText(`${Math.round(t * 100)}%`, x, yBottom + 16);
      });
      ctx.font = `700 ${tickFs}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.textAlign = "right";
      ctx.fillText("사용률", w - padR, yBottom + 16 + tickFs + 2);

      // --- 위험선 80% (통과하면 강조된다) ---
      ctx.globalAlpha = passed80 ? 1 : 0.65;
      ctx.strokeStyle = "#fab005";
      ctx.lineWidth = passed80 ? 2.2 : 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(X(0.8), padT - 4);
      ctx.lineTo(X(0.8), yBottom);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = `700 ${Math.max(10, (passed80 ? 12.5 : 11.5) * s)}px ${FONT}`;
      ctx.fillStyle = "#f08c00";
      ctx.textAlign = "center";
      ctx.fillText("위험선 80%", X(0.8), padT - 14);
      ctx.globalAlpha = 1;

      // --- 대기 곡선: 왼쪽부터 마커 위치까지 그린다 ---
      const drawCurve = (fromRho: number, toRho: number, color: string, lw: number) => {
        if (toRho <= fromRho) return;
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.beginPath();
        for (let r = fromRho; r <= toRho + 1e-6; r += 0.004) {
          const rr = Math.min(r, toRho);
          const x = X(rr);
          const y = Y(waitOf(rr));
          if (r === fromRho) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };
      // 80% 이전은 파랑, 넘어서면 빨강으로 가팔라지는 구간을 강조
      drawCurve(0, Math.min(rho, 0.8), "#228be6", 2.5);
      drawCurve(0.8, Math.min(rho, CLIP_RHO), "#fa5252", 3);

      // --- 곡선 끝(95% 클리핑 지점): 위로 뻗는 화살표 ---
      if (rho >= CLIP_RHO - 0.001) {
        const ax = X(CLIP_RHO);
        const ay = Y(waitOf(CLIP_RHO));
        const tipY = ay - Math.max(12, 16 * s);
        ctx.strokeStyle = "#fa5252";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + 2, tipY + 5);
        ctx.stroke();
        ctx.fillStyle = "#fa5252";
        ctx.beginPath();
        ctx.moveTo(ax + 2.5, tipY - 3);
        ctx.lineTo(ax - 3.5, tipY + 7);
        ctx.lineTo(ax + 8, tipY + 6);
        ctx.closePath();
        ctx.fill();
      }

      // --- 마커와 현재 값 ---
      const mx = X(rho);
      const my = Y(waitOf(rho));
      const markerColor = inDanger ? "#fa5252" : "#228be6";
      ctx.beginPath();
      ctx.arc(mx, my, Math.max(5, 6 * s), 0, Math.PI * 2);
      ctx.fillStyle = markerColor;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();

      if (e >= 700) {
        const pct = Math.round(rho * 100);
        const valueFs = Math.max(13, (inDanger ? 17 : 15) * s);
        const label = `사용률 ${pct}% → 대기 ${fmtWait(waitOf(rho))}x`;
        ctx.font = `700 ${valueFs}px ${FONT}`;
        const onRight = mx > padL + plotW * 0.55;
        ctx.textAlign = onRight ? "right" : "left";
        ctx.textBaseline = "middle";
        const lx = onRight ? mx - 16 : mx + 16;
        const ly = Math.max(my - 4, padT + valueFs);
        ctx.fillStyle = markerColor;
        ctx.fillText(label, lx, ly);
        // 50% 정지 구간에서는 기준점임을 표시
        if (e >= 1200 && e < 2400) {
          ctx.font = `${Math.max(10, 11.5 * s)}px ${FONT}`;
          ctx.fillStyle = "#868e96";
          ctx.fillText("(기준점)", lx, ly + valueFs + 2);
        }
        ctx.textBaseline = "alphabetic";
      }

      // --- 하단 단계 설명 ---
      let caption = "① 마커가 곡선을 따라 움직인다 — 사용률 50%의 대기 시간이 기준점(1x)이다";
      if (e >= T_REACH_90) {
        caption = "③ 95%에서 대기는 50% 때의 19배 — 100% 가동은 목표가 아니라 사고다";
      } else if (e >= T_PASS_80) {
        caption = "② 80%를 넘는 순간 대기가 급격히 늘기 시작한다";
      }
      ctx.font = `${captionFs}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.textAlign = "center";
      const lines = wrapLines(ctx, caption, w - 16);
      lines.forEach((line, i) => {
        ctx.fillText(line, w / 2, h - 8 - (lines.length - 1 - i) * (captionFs + 4));
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
