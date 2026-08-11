// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useRef, useEffect } from "react";
import {
  SvgCanvas,
  type SvgCanvasHandle,
  type SvgDrawingContext,
  type SvgGradient,
} from "#components/materials/runtime/svg-canvas";

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

interface Config {
  nEmbd: number;
  label: string;
  totalParams: string;
}

const CONFIGS: Config[] = [
  { nEmbd: 768, label: "HamsterLM", totalParams: "~88M" },
  { nEmbd: 1024, label: "n_embd ×1.33", totalParams: "~155M" },
  { nEmbd: 1536, label: "n_embd ×2", totalParams: "~346M" },
];

function roundRect(ctx: SvgDrawingContext, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawScene(ctx: SvgDrawingContext, w: number): number {
  const s = w / 540;

  /* Base square size for n_embd = 768 */
  const maxEmbd = 1536;
  const baseSquareMax = 150 * s; /* size of the largest square */

  const cols = CONFIGS.length;
  const colW = w / cols;

  /* Top: title */
  const titleY = 28 * s;
  ctx.fillStyle = "#495057";
  ctx.font = `bold ${13 * s}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("블록 내부 행렬 하나의 크기 (n_embd × n_embd)", w / 2, titleY);

  /* Squares centered in each column, bottom-aligned */
  const squareBaseline = 220 * s; /* y where bottom of all squares aligns */

  for (let i = 0; i < CONFIGS.length; i++) {
    const c = CONFIGS[i];
    const cx = colW * (i + 0.5);

    const sideLen = baseSquareMax * (c.nEmbd / maxEmbd);
    const sqX = cx - sideLen / 2;
    const sqY = squareBaseline - sideLen;

    /* Draw grid (cells to give "matrix" feel) */
    const gridN = Math.max(4, Math.round(c.nEmbd / 128)); /* more cells for larger n_embd */

    /* background */
    roundRect(ctx, sqX, sqY, sideLen, sideLen, 4 * s);
    ctx.fillStyle = "#e7f5ff";
    ctx.fill();
    ctx.strokeStyle = "#228be6";
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();

    /* grid lines */
    ctx.strokeStyle = "rgba(34, 139, 230, 0.25)";
    ctx.lineWidth = 0.5 * s;
    for (let g = 1; g < gridN; g++) {
      const t = (g / gridN) * sideLen;
      ctx.beginPath();
      ctx.moveTo(sqX + t, sqY);
      ctx.lineTo(sqX + t, sqY + sideLen);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sqX, sqY + t);
      ctx.lineTo(sqX + sideLen, sqY + t);
      ctx.stroke();
    }

    /* side length annotation */
    ctx.fillStyle = "#1864ab";
    ctx.font = `${11 * s}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`${c.nEmbd}`, cx, squareBaseline + 8 * s);

    /* label below */
    ctx.fillStyle = "#495057";
    ctx.font = `bold ${12 * s}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`n_embd = ${c.nEmbd}`, cx, squareBaseline + 28 * s);

    ctx.fillStyle = "#868e96";
    ctx.font = `${10 * s}px ${FONT}`;
    ctx.fillText(c.label, cx, squareBaseline + 46 * s);

    /* Area ratio label */
    const areaRatio = (c.nEmbd / 768) * (c.nEmbd / 768);
    ctx.fillStyle = "#e67700";
    ctx.font = `bold ${11 * s}px ${FONT}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    if (i === 0) {
      ctx.fillText("면적 ×1", cx, sqY - 12 * s);
    } else {
      ctx.fillText(`면적 ×${areaRatio.toFixed(areaRatio >= 4 ? 0 : 2)}`, cx, sqY - 12 * s);
    }
  }

  /* Separator */
  const sepY = squareBaseline + 72 * s;
  ctx.strokeStyle = "#dee2e6";
  ctx.lineWidth = 1 * s;
  ctx.setLineDash([4 * s, 4 * s]);
  ctx.beginPath();
  ctx.moveTo(w * 0.1, sepY);
  ctx.lineTo(w * 0.9, sepY);
  ctx.stroke();
  ctx.setLineDash([]);

  /* Explanation in the middle */
  const explainY = sepY + 22 * s;
  ctx.fillStyle = "#495057";
  ctx.font = `${12 * s}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    "블록 하나 = 이런 행렬이 여러 개 · 블록을 12개 쌓으면 총 파라미터:",
    w / 2,
    explainY,
  );

  /* Total param counts */
  const totalY = explainY + 36 * s;
  for (let i = 0; i < CONFIGS.length; i++) {
    const c = CONFIGS[i];
    const cx = colW * (i + 0.5);

    /* Total pill */
    const pillW = 100 * s;
    const pillH = 36 * s;
    roundRect(ctx, cx - pillW / 2, totalY - pillH / 2, pillW, pillH, 8 * s);
    ctx.fillStyle = "#fff4e6";
    ctx.fill();
    ctx.strokeStyle = "#e8590c";
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();

    ctx.fillStyle = "#d9480f";
    ctx.font = `bold ${15 * s}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(c.totalParams, cx, totalY);
  }

  return totalY + 40 * s;
}

export const ParameterScaleDiagram = ({ caption }: { caption?: string }) => {
  const canvasRef = useRef<SvgCanvasHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = container.clientWidth;
      const ctx = canvas.getContext("2d")!;

      canvas.width = w * dpr;
      canvas.height = 600 * dpr;
      ctx.scale(dpr, dpr);
      const h = drawScene(ctx, w);

      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
      drawScene(ctx, w);
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  return (
    <figure ref={containerRef} style={{ margin: "2rem 0" }}>
      <SvgCanvas ref={canvasRef} />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
};
