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

// 반복 타임라인 (ms): 8초 동안 곡선을 그리고 3초 유지한 뒤 리셋
const T_DRAW = 8000;
const T_HOLD = 3000;
const CYCLE = T_DRAW + T_HOLD;

const EXPIRE_T = 0.4; // 인기 키 TTL 만료 지점 (시간축 진행률)
const HIT_MAX = 100; // 히트율 트랙 상한 (%)
const QPS_MAX = 5000; // QPS 트랙 상한

const DOT_N = 14; // 요청 흐름 도트 개수
const DOT_TRAVEL = 1500; // 도트 하나가 흐름을 가로지르는 시간 (ms)

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

// t: 0~1 → 미스 강도 (0: 전부 히트, 1: 전부 미스)
// 만료 순간 수직으로 치솟고, 캐시 재적재와 함께 서서히 가라앉는다
function missAt(t: number): number {
  const rise = smoothstep((t - EXPIRE_T) / 0.02);
  const recover = smoothstep((t - 0.5) / 0.24);
  return rise * (1 - recover);
}

// t: 0~1 → 캐시 히트율 (%)
function hitAt(t: number): number {
  // 평소에는 97% 부근에서 안정
  const calm = clamp(97 + 0.8 * wave(t, 5.1, 1.3), 95.8, 98.2);
  // 만료 순간 0% 근처로 낙하
  const low = clamp(2 + 1.2 * wave(t, 8.2, 0.5), 0.5, 4);
  return calm + (low - calm) * missAt(t);
}

// t: 0~1 → DB QPS
function qpsAt(t: number): number {
  // 평소에는 100 안팎 — 캐시 뒤에서 한가하다
  const base = clamp(100 + 22 * wave(t, 4.6, 0.9), 60, 145);
  // 만료 순간 4.8k로 수직 스파이크 (히트율 낙하와 정확히 같은 시각)
  const peak = 4800 + 70 * wave(t, 9.3, 0.3);
  return clamp(base + (peak - base) * missAt(t), 0, QPS_MAX);
}

function drawTrack(
  ctx: SvgDrawingContext,
  opts: {
    x: number;
    y: number;
    w: number;
    h: number;
    title: string;
    grid: { v: number; label: string }[];
    max: number;
    fs: number;
  },
) {
  const { x, y, w, h, title, grid, max, fs } = opts;

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
  grid.forEach((g) => {
    const gy = y + h * (1 - g.v / max);
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
    ctx.fillText(g.label, x - 6, gy);
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
  const toY = (v: number) => y + h * (1 - clamp(v, 0, max) / max);
  const endT = endPx / w;

  // 곡선 아래 옅은 면 채우기
  ctx.beginPath();
  for (let px = 0; px <= endPx; px += 2) {
    const cy = toY(valueAt(px / w));
    if (px === 0) ctx.moveTo(x, cy);
    else ctx.lineTo(x + px, cy);
  }
  ctx.lineTo(x + endPx, toY(valueAt(endT)));
  ctx.save();
  ctx.lineTo(x + endPx, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();

  // 곡선 본체
  ctx.beginPath();
  for (let px = 0; px <= endPx; px += 2) {
    const cy = toY(valueAt(px / w));
    if (px === 0) ctx.moveTo(x, cy);
    else ctx.lineTo(x + px, cy);
  }
  ctx.lineTo(x + endPx, toY(valueAt(endT)));
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.stroke();
}

// 캡션을 폭에 맞게 단어 단위로 줄바꿈한다
function wrapLines(ctx: SvgDrawingContext, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  words.forEach((word) => {
    const trial = cur ? `${cur} ${word}` : word;
    if (!cur || ctx.measureText(trial).width <= maxW) cur = trial;
    else {
      lines.push(cur);
      cur = word;
    }
  });
  if (cur) lines.push(cur);
  return lines.slice(0, maxLines);
}

export const CacheStampedeDemo = () => {
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

      // rAF 첫 타임스탬프가 start보다 이를 수 있으므로 음수 방어
      const e = Math.max(0, (now - start) % CYCLE);
      const progress = Math.min(1, e / T_DRAW);
      const m = missAt(progress); // 현재 미스 강도 0~1
      const expA = clamp((progress - EXPIRE_T) / 0.03, 0, 1); // 만료 요소 페이드 인

      const fs = Math.max(10, Math.min(12, w / 46));
      const pad = 8;
      const axisW = Math.max(34, fs * 3.2);
      const trackH = Math.max(56, Math.min(82, w * 0.14));
      const stripH = Math.max(76, Math.min(96, w * 0.16));

      const plotX = pad + axisW;
      const plotW = w - plotX - pad;
      const t1Y = pad + 22;
      const stripTop = t1Y + trackH + 26;
      const t2Y = stripTop + stripH + 28;
      const capTop = t2Y + trackH + 14;
      const capLines = isMobile ? 3 : 2;
      const h = capTop + capLines * (fs + 5) + 4;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      // --- 두 트랙 ---
      drawTrack(ctx, {
        x: plotX,
        y: t1Y,
        w: plotW,
        h: trackH,
        title: "캐시 히트율",
        grid: [
          { v: 0, label: "0%" },
          { v: 50, label: "50%" },
          { v: 100, label: "100%" },
        ],
        max: HIT_MAX,
        fs,
      });
      drawTrack(ctx, {
        x: plotX,
        y: t2Y,
        w: plotW,
        h: trackH,
        title: "DB QPS",
        grid: [
          { v: 0, label: "0" },
          { v: 2500, label: "2.5k" },
          { v: 5000, label: "5k" },
        ],
        max: QPS_MAX,
        fs,
      });

      const markerX = plotX + plotW * EXPIRE_T;
      const cursorX = plotX + plotW * progress;

      // --- 곡선 ---
      drawCurve(ctx, {
        x: plotX,
        y: t1Y,
        w: plotW,
        h: trackH,
        max: HIT_MAX,
        progress,
        valueAt: hitAt,
        color: "#40c057",
      });
      drawCurve(ctx, {
        x: plotX,
        y: t2Y,
        w: plotW,
        h: trackH,
        max: QPS_MAX,
        progress,
        valueAt: qpsAt,
        color: "#845ef7",
      });

      // --- TTL 만료 마커: 두 트랙과 요청 흐름을 관통하는 세로 점선 ---
      if (expA > 0) {
        ctx.globalAlpha = expA;
        ctx.strokeStyle = "#fab005";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(markerX, t1Y);
        ctx.lineTo(markerX, t2Y + trackH);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = `700 ${Math.max(9, fs - 2)}px ${FONT}`;
        ctx.fillStyle = "#f08c00";
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillText("인기 키 TTL 만료", markerX, t1Y - 7);
        ctx.globalAlpha = 1;
      }

      // --- 진행 커서 + 현재 값 ---
      const hitNow = hitAt(progress);
      const qpsNow = qpsAt(progress);
      const hitY = t1Y + trackH * (1 - hitNow / HIT_MAX);
      const qpsY = t2Y + trackH * (1 - qpsNow / QPS_MAX);

      if (progress < 1) {
        ctx.strokeStyle = "#adb5bd";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        [t1Y, t2Y].forEach((ty) => {
          ctx.beginPath();
          ctx.moveTo(cursorX, ty);
          ctx.lineTo(cursorX, ty + trackH);
          ctx.stroke();
        });
        ctx.setLineDash([]);
      }

      const drawValueDot = (dy: number, trackTop: number, color: string, label: string) => {
        ctx.beginPath();
        ctx.arc(cursorX, dy, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = `700 ${Math.max(9, fs - 1)}px ${FONT}`;
        const nearRight = cursorX > plotX + plotW - ctx.measureText(label).width - 12;
        // 값이 트랙 상단에 붙으면 라벨을 점 아래로 내린다
        const labelY = dy - 10 < trackTop + 6 ? dy + 12 : dy - 10;
        ctx.textAlign = nearRight ? "right" : "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle = color;
        ctx.fillText(label, cursorX + (nearRight ? -8 : 8), labelY);
      };
      const hitLabel = hitNow < 10 ? `${hitNow.toFixed(1)}%` : `${Math.round(hitNow)}%`;
      const qpsLabel = Math.round(qpsNow).toLocaleString("en-US");
      drawValueDot(hitY, t1Y, "#40c057", hitLabel);
      drawValueDot(qpsY, t2Y, "#845ef7", qpsLabel);

      // --- 보조 시각화: 요청 흐름 ---
      const sfs = Math.max(9, fs - 2);
      ctx.font = `700 ${fs}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("요청 흐름", plotX, stripTop - 7);

      const flowY = stripTop + stripH * 0.28; // 정상 응답 경로
      const dbY = stripTop + stripH * 0.74; // DB 우회 경로 끝
      const cacheX = plotX + plotW * 0.38;
      const dbX = plotX + plotW * 0.72;
      const endX = plotX + plotW * 0.97;

      // 정상 응답 경로 가이드
      ctx.strokeStyle = "#dee2e6";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plotX, flowY);
      ctx.lineTo(endX, flowY);
      ctx.stroke();

      ctx.font = `${sfs}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText("요청", plotX - 6, flowY);

      // 평소 흐름 라벨 (미스 중에는 흐려진다)
      ctx.globalAlpha = 1 - m * 0.8;
      ctx.fillStyle = "#228be6";
      ctx.textAlign = "right";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("빠른 응답", endX, flowY - 8);
      ctx.globalAlpha = 1;

      // DB 우회 경로 가이드 (굵은 빨간 흐름)
      if (m > 0.02) {
        ctx.globalAlpha = m;
        ctx.strokeStyle = "#fa5252";
        ctx.lineWidth = 1 + 2 * m;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        for (let k = 0; k <= 20; k++) {
          const d = k / 20;
          const gx = cacheX + (dbX - cacheX) * d;
          const gy = flowY + (dbY - flowY) * smoothstep(d);
          if (k === 0) ctx.moveTo(gx, gy);
          else ctx.lineTo(gx, gy);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      // 요청 도트: 미스 강도에 따라 캐시 뒤 경로가 DB로 굽는다
      const phC = (cacheX - plotX) / (endX - plotX); // 캐시 통과 지점의 진행률
      for (let i = 0; i < DOT_N; i++) {
        const ph = (e / DOT_TRAVEL + i / DOT_N) % 1;

        // 정상 경로 위치
        const nx = plotX + ph * (endX - plotX);
        const ny = flowY;
        const na = clamp(ph / 0.05, 0, 1) * clamp((0.98 - ph) / 0.06, 0, 1);

        // 미스 경로 위치 (캐시 이후 DB로 우회, DB에 흡수)
        let mx = nx;
        let my = ny;
        let ma = na;
        if (ph > phC) {
          const d = clamp((ph - phC) / (1 - phC) / 0.85, 0, 1);
          mx = cacheX + (dbX - cacheX) * d;
          my = flowY + (dbY - flowY) * smoothstep(d);
          ma = na * (1 - d * d * 0.9);
        }

        const dx = nx + (mx - nx) * m;
        const dy = ny + (my - ny) * m;
        const alpha = na + (ma - na) * m;
        if (alpha <= 0.02) continue;

        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(dx, dy, 3.5 + 1.2 * m, 0, Math.PI * 2);
        ctx.fillStyle = m > 0.5 ? "#fa5252" : "#228be6";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // 캐시 박스: 평소 HIT(파랑) → 만료 후 MISS(빨강)
      const boxFs = Math.max(10, fs - 1);
      const cbW = Math.max(52, boxFs * 4.6);
      const cbH = Math.max(24, boxFs * 2.1);
      ctx.beginPath();
      ctx.roundRect(cacheX - cbW / 2, flowY - cbH / 2, cbW, cbH, 6);
      ctx.fillStyle = m > 0.5 ? "#fff5f5" : "#e7f5ff";
      ctx.fill();
      ctx.strokeStyle = m > 0.5 ? "#fa5252" : "#228be6";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = `700 ${boxFs}px ${FONT}`;
      ctx.fillStyle = m > 0.5 ? "#fa5252" : "#228be6";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(m > 0.5 ? "MISS" : "캐시 HIT", cacheX, flowY + 0.5);

      // DB 박스: 미스 중 빨갛게 부푼다 (사이클 시간 기반 결정적 맥동)
      const pulse = 1 + m * (0.16 + 0.08 * Math.sin(e * 0.02));
      const dbW = Math.max(44, boxFs * 3.4) * pulse;
      const dbH = Math.max(24, boxFs * 2.1) * pulse;
      ctx.beginPath();
      ctx.roundRect(dbX - dbW / 2, dbY - dbH / 2, dbW, dbH, 6);
      ctx.fillStyle = m > 0.3 ? "#fff5f5" : "#f8f9fa";
      ctx.fill();
      ctx.strokeStyle = m > 0.3 ? "#fa5252" : "#adb5bd";
      ctx.lineWidth = 1.5 + m;
      ctx.stroke();
      ctx.font = `700 ${boxFs}px ${FONT}`;
      ctx.fillStyle = m > 0.3 ? "#fa5252" : "#868e96";
      ctx.fillText("DB", dbX, dbY + 0.5);

      // DB 과부하 라벨
      if (m > 0.05) {
        ctx.globalAlpha = clamp(m / 0.5, 0, 1);
        ctx.font = `700 ${sfs}px ${FONT}`;
        const dbTxt = "같은 쿼리 × 동시 요청 전부";
        const tw = ctx.measureText(dbTxt).width;
        const lx = clamp(dbX, plotX + tw / 2 + 4, plotX + plotW - tw / 2 - 4);
        ctx.fillStyle = "#fa5252";
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(dbTxt, lx, dbY + dbH / 2 + sfs + 4);
        ctx.globalAlpha = 1;
      }

      // --- 하단 단계 캡션 ---
      let caption = "① 평소: 히트율 97% — DB는 캐시 뒤에서 한가하다";
      let capColor = "#868e96";
      if (progress >= 0.74) {
        caption = "④ 한 명만 다시 계산하게 하라 — 잠금, 조기 갱신, TTL 지터가 해법이다";
        capColor = "#2f9e44";
      } else if (progress >= 0.46) {
        caption = "③ 전원이 같은 쿼리를 들고 DB로 몰린다 — DB QPS 100 → 4,800";
        capColor = "#fa5252";
      } else if (progress >= EXPIRE_T) {
        caption = "② 인기 키의 TTL이 만료되는 순간, 그 키를 찾던 동시 요청 전부가 미스";
        capColor = "#f08c00";
      }
      ctx.font = `700 ${Math.max(10, fs - 1)}px ${FONT}`;
      ctx.fillStyle = capColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      wrapLines(ctx, caption, w - pad * 2, capLines).forEach((line, k) => {
        ctx.fillText(line, w / 2, capTop + fs + k * (fs + 5));
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
