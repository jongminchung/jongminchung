// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useRef, useEffect } from "react";
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
import { useVisible } from "./useVisible";

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

type Lang = "ko" | "en";

const STRINGS = {
  ko: {
    process: "처리",
    drop: "버리기",
    merge: "합치기",
    skip: "생략하기",
    cache: "캐시",
    cacheHit: "캐시 ✓",
  },
  en: {
    process: "Process",
    drop: "Drop",
    merge: "Merge",
    skip: "Skip",
    cache: "Cache",
    cacheHit: "Cache ✓",
  },
} as const;

const CYCLE = 5.6; // 애니메이션 한 사이클(초)
const BLUE = "#228be6";
const YELLOW = "#fab005";
const GREEN = "#40c057";
const RED = "#fa5252";
const GRAY = "#adb5bd";

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
function seg(t: number, a: number, b: number): number {
  return clamp01((t - a) / (b - a));
}
function ease(p: number): number {
  return 1 - Math.pow(1 - p, 3);
}

function drawRoundRect(
  ctx: SvgDrawingContext,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  stroke?: string,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

// 작업 블록 하나
function drawItem(
  ctx: SvgDrawingContext,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha: number,
  label?: string,
) {
  if (alpha <= 0) return;
  ctx.globalAlpha = alpha;
  drawRoundRect(ctx, x - size / 2, y - size / 2, size, size, 4, color);
  if (label) {
    ctx.fillStyle = "#fff";
    ctx.font = `700 ${Math.max(size * 0.5, 8)}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x, y + 0.5);
  }
  ctx.globalAlpha = 1;
}

// 처리기 박스
function drawProcessor(
  ctx: SvgDrawingContext,
  x: number,
  y: number,
  w: number,
  h: number,
  pulse: number,
  fs: number,
  label: string,
) {
  ctx.globalAlpha = 1;
  drawRoundRect(
    ctx,
    x,
    y,
    w,
    h,
    6,
    pulse > 0 ? "#e7f5ff" : "#f8f9fa",
    pulse > 0 ? BLUE : "#dee2e6",
  );
  ctx.fillStyle = pulse > 0 ? "#1971c2" : "#868e96";
  ctx.font = `600 ${fs}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + w / 2, y + h / 2 + 0.5);
}

interface Props {
  caption?: string;
  locale?: Lang;
}

export const WorkEliminationDiagram = ({ caption, locale: lang = "ko" }: Props) => {
  const tr = STRINGS[lang];
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<SvgCanvasHandle>(null);
  const rafRef = useRef<number>(0);
  const { ref: rootRef, visible } = useVisible<HTMLElement>();

  useEffect(() => {
    if (!visible) return; // 화면 밖에서는 루프를 돌리지 않는다
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const animate = (time: number) => {
      const w = container.clientWidth;
      const dpr = window.devicePixelRatio || 1;
      const isMobile = w < 480;
      const s = w / (isMobile ? 380 : 640);
      const t = (time / 1000) % CYCLE;

      const labelW = isMobile ? 0 : 108 * s;
      const laneH = (isMobile ? 116 : 96) * s;
      const topPad = 6 * s;
      const h = topPad + laneH * 3 + 4 * s;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      const titleFs = Math.max(12.5 * s, 11);
      const subFs = Math.max(9.5 * s, 8.5);
      const procFs = Math.max(10.5 * s, 9.5);
      const size = Math.max(17 * s, 14); // 블록 크기
      const procW = 52 * s;
      const procH = 34 * s;
      const stageX0 = (isMobile ? 14 : labelW + 8) * (isMobile ? s : 1);
      const stageX1 = w - 14 * s;
      const procLeft = stageX1 - procW;

      const lanes: { title: string; sub: string }[] = [
        { title: tr.drop, sub: "load shedding" },
        { title: tr.merge, sub: "conflation" },
        { title: tr.skip, sub: "memoization" },
      ];

      lanes.forEach((lane, li) => {
        const laneTop = topPad + laneH * li;
        // 레인 구분선
        if (li > 0) {
          ctx.strokeStyle = "#f1f3f5";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(10 * s, laneTop);
          ctx.lineTo(w - 10 * s, laneTop);
          ctx.stroke();
        }

        const labelY = isMobile ? laneTop + 16 * s : laneTop + laneH / 2;
        const midY = isMobile ? laneTop + 22 * s + (laneH - 26 * s) / 2 : laneTop + laneH / 2;

        // 레인 제목
        ctx.textBaseline = "middle";
        if (isMobile) {
          ctx.textAlign = "left";
          ctx.fillStyle = "#495057";
          ctx.font = `700 ${titleFs}px ${FONT}`;
          ctx.fillText(lane.title, 14 * s, labelY);
          const tw = ctx.measureText(lane.title).width;
          ctx.fillStyle = GRAY;
          ctx.font = `400 ${subFs}px ${FONT}`;
          ctx.fillText(lane.sub, 14 * s + tw + 6 * s, labelY + 1);
        } else {
          ctx.textAlign = "left";
          ctx.fillStyle = "#495057";
          ctx.font = `700 ${titleFs}px ${FONT}`;
          ctx.fillText(lane.title, 14 * s, midY - 8 * s);
          ctx.fillStyle = GRAY;
          ctx.font = `400 ${subFs}px ${FONT}`;
          ctx.fillText(lane.sub, 14 * s, midY + 9 * s);
        }

        const travelX0 = stageX0 + size;
        let procPulse = 0;

        if (li === 0) {
          // ── 버리기: 큐가 가득 차면 밀린 항목이 떨어져 나간다 ──
          const spawnT = [0.2, 0.75, 1.3, 1.85, 2.4];
          const slot = [0, 0, 1, 2, 0]; // 대기 슬롯 (처리기에서 가까운 순)
          const consumeAt = [1.7, 2.8, -1, -1, 3.9]; // -1 = 버려짐
          const dropAt = [0, 0, 3.15, 3.45, 0];
          const queueX = (idx: number) => procLeft - 14 * s - idx * (size + 5 * s);

          spawnT.forEach((st, i) => {
            if (t < st) return;
            const arrive = st + 1.2;
            const p = ease(seg(t, st, arrive));
            let x = travelX0 + (queueX(slot[i]) - travelX0) * p;
            let y = midY;
            let alpha = 1;
            let color = BLUE;
            let dropped = false;

            if (consumeAt[i] > 0 && t >= consumeAt[i]) {
              // 처리기로 흡수
              const cp = seg(t, consumeAt[i], consumeAt[i] + 0.3);
              x = queueX(slot[i]) + (procLeft + procW / 2 - queueX(slot[i])) * ease(cp);
              alpha = 1 - cp;
              if (cp < 1) procPulse = 1;
            } else if (dropAt[i] > 0 && t >= dropAt[i]) {
              // 큐에서 떨어져 나감
              const dp = seg(t, dropAt[i], dropAt[i] + 0.55);
              x = queueX(slot[i]);
              y = midY + dp * dp * 34 * s;
              alpha = 1 - dp;
              color = GRAY;
              dropped = true;
            }
            drawItem(ctx, x, y, size, color, alpha);
            if (dropped && alpha > 0) {
              ctx.globalAlpha = alpha;
              ctx.strokeStyle = RED;
              ctx.lineWidth = 2;
              const r = size * 0.28;
              ctx.beginPath();
              ctx.moveTo(x - r, y - r);
              ctx.lineTo(x + r, y + r);
              ctx.moveTo(x + r, y - r);
              ctx.lineTo(x - r, y + r);
              ctx.stroke();
              ctx.globalAlpha = 1;
            }
          });
        } else if (li === 1) {
          // ── 합치기: 도착하는 값들이 하나로 병합되고 마지막 값만 처리된다 ──
          const spawnT = [0.3, 0.85, 1.4, 1.95, 2.5];
          const mergeX = procLeft - 30 * s;
          let mergedCount = 0;
          spawnT.forEach((st, i) => {
            const arrive = st + 1.1;
            if (t >= arrive) mergedCount = i + 1;
            if (t < st || t >= arrive) return;
            const p = ease(seg(t, st, arrive));
            const x = travelX0 + (mergeX - travelX0) * p;
            const alpha = p > 0.85 ? 1 - (p - 0.85) / 0.15 : 1;
            drawItem(ctx, x, midY, size, BLUE, alpha * 0.9);
          });
          if (mergedCount > 0) {
            // 병합 슬롯 — 마지막으로 도착한 값만 남는다
            let mx = mergeX;
            let alpha = 1;
            if (t >= 3.9) {
              const mp = ease(seg(t, 3.9, 4.3));
              mx = mergeX + (procLeft + procW / 2 - mergeX) * mp;
              alpha = 1 - seg(t, 4.15, 4.4);
              if (t < 4.4) procPulse = 1;
            }
            drawItem(ctx, mx, midY, size * 1.15, BLUE, alpha, String(mergedCount));
          }
        } else {
          // ── 생략하기: 같은 입력은 캐시가 있어 처리기를 건너뛴다 ──
          const spawnT = [0.2, 0.9, 1.6, 2.3, 3.0];
          const colors = [BLUE, YELLOW, BLUE, BLUE, GREEN];
          const labels = ["A", "B", "A", "A", "C"];
          const isSkip = [false, false, true, true, false];
          const gateX = procLeft - 10 * s;

          // 캐시 칩
          const chipW = 34 * s;
          const chipH = 16 * s;
          const chipX = procLeft + procW / 2 - chipW / 2;
          const chipY = midY - procH / 2 - chipH - 5 * s;
          let chipHot = 0;

          spawnT.forEach((st, i) => {
            if (t < st) return;
            const arrive = st + 1.0;
            const p = ease(seg(t, st, arrive));
            let x = travelX0 + (gateX - travelX0) * p;
            let y = midY;
            let alpha = 1;

            if (t >= arrive) {
              if (isSkip[i]) {
                // 캐시 적중 — 처리기 위로 넘어간다
                const sp = seg(t, arrive, arrive + 0.4);
                x = gateX + (stageX1 + size - gateX) * sp;
                y = midY - Math.sin(sp * Math.PI) * 22 * s;
                alpha = 1 - seg(t, arrive + 0.25, arrive + 0.4);
                if (sp > 0 && sp < 1) chipHot = 1;
              } else {
                // 처음 보는 입력 — 처리기를 통과한다
                const dwellEnd = arrive + 0.5;
                if (t < dwellEnd) {
                  const dp = seg(t, arrive, dwellEnd);
                  x = gateX + (procLeft + procW / 2 - gateX) * ease(dp);
                  alpha = 1 - dp * 0.7;
                  procPulse = 1;
                } else {
                  alpha = 0;
                }
              }
            }
            drawItem(ctx, x, y, size, colors[i], alpha, labels[i]);
          });

          drawRoundRect(
            ctx,
            chipX,
            chipY,
            chipW,
            chipH,
            8,
            chipHot ? "#ebfbee" : "#f8f9fa",
            chipHot ? GREEN : "#dee2e6",
          );
          ctx.fillStyle = chipHot ? "#2f9e44" : GRAY;
          ctx.font = `600 ${Math.max(8.5 * s, 8)}px ${FONT}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(
            chipHot ? tr.cacheHit : tr.cache,
            chipX + chipW / 2,
            chipY + chipH / 2 + 0.5,
          );
        }

        drawProcessor(ctx, procLeft, midY - procH / 2, procW, procH, procPulse, procFs, tr.process);
      });

      rafRef.current = scheduleMaterialFrame(animate);
    };

    rafRef.current = scheduleMaterialFrame(animate);
    return () => cancelMaterialFrame(rafRef.current);
  }, [visible, lang]);

  return (
    <figure ref={rootRef}>
      <div ref={containerRef}>
        <SvgCanvas ref={canvasRef} style={{ display: "block", width: "100%" }} />
      </div>
      {caption && <figcaption dangerouslySetInnerHTML={{ __html: caption }} />}
    </figure>
  );
};
