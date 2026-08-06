// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useRef, useEffect } from "react";
import {
  SvgCanvas,
  type SvgCanvasHandle,
  type SvgDrawingContext,
  type SvgGradient,
} from "@/components/materials/runtime/svg-canvas";

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

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

function drawBox(
  ctx: SvgDrawingContext,
  s: number,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  fill: string,
  stroke: string,
  textColor: string,
  fontSize?: number,
) {
  roundRect(ctx, x, y, w, h, 5 * s);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5 * s;
  ctx.stroke();

  ctx.fillStyle = textColor;
  ctx.font = `bold ${Math.max(fontSize ?? 12 * s, 10)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + w / 2, y + h / 2);
}

function drawArrowDown(
  ctx: SvgDrawingContext,
  s: number,
  x: number,
  y1: number,
  y2: number,
  color: string,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(x, y1);
  ctx.lineTo(x, y2);
  ctx.stroke();
  const h = 5 * s;
  ctx.beginPath();
  ctx.moveTo(x, y2);
  ctx.lineTo(x - h * 0.5, y2 - h);
  ctx.moveTo(x, y2);
  ctx.lineTo(x + h * 0.5, y2 - h);
  ctx.stroke();
}

function drawScene(ctx: SvgDrawingContext, w: number): number {
  const s = w / 540;

  const halfW = w * 0.46;
  const leftX = w * 0.02;
  const rightX = w * 0.52;
  const topY = 32 * s;

  /* ── Section titles ── */
  ctx.font = `bold ${Math.max(13 * s, 11)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";

  ctx.fillStyle = "#228be6";
  ctx.fillText("위치 임베딩", leftX + halfW / 2, topY - 8 * s);

  ctx.fillStyle = "#e8590c";
  ctx.fillText("RoPE", rightX + halfW / 2, topY - 8 * s);

  /* ══════════════════════
     LEFT: Positional Embedding
     ══════════════════════ */
  const boxW = 80 * s;
  const boxH = 28 * s;
  const smallBoxW = 60 * s;

  const lCx = leftX + halfW / 2;

  /* Token embedding */
  drawBox(
    ctx,
    s,
    lCx - boxW / 2,
    topY,
    boxW,
    boxH,
    '"나" 임베딩',
    "#e7f5ff",
    "#228be6",
    "#1864ab",
    11 * s,
  );

  /* + sign */
  ctx.fillStyle = "#495057";
  ctx.font = `bold ${Math.max(16 * s, 14)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("+", lCx, topY + boxH + 10 * s);

  /* Position embedding */
  const posY = topY + boxH + 22 * s;
  drawBox(
    ctx,
    s,
    lCx - boxW / 2,
    posY,
    boxW,
    boxH,
    "1번 위치 벡터",
    "#dbe4ff",
    "#4c6ef5",
    "#364fc7",
    11 * s,
  );

  /* Arrow down */
  drawArrowDown(ctx, s, lCx, posY + boxH + 4 * s, posY + boxH + 24 * s, "#adb5bd");

  /* Result */
  const resultY = posY + boxH + 28 * s;
  drawBox(
    ctx,
    s,
    lCx - boxW / 2,
    resultY,
    boxW,
    boxH,
    "최종 벡터",
    "#e7f5ff",
    "#228be6",
    "#1864ab",
    11 * s,
  );

  /* Description */
  ctx.fillStyle = "#868e96";
  ctx.font = `${Math.max(10 * s, 9)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("위치마다 고유 벡터를 더한다", lCx, resultY + boxH + 8 * s);

  /* ══════════════════════
     RIGHT: RoPE
     ══════════════════════ */
  const rCx = rightX + halfW / 2;

  /* Token embedding */
  drawBox(
    ctx,
    s,
    rCx - boxW / 2,
    topY,
    boxW,
    boxH,
    '"나" 임베딩',
    "#fff4e6",
    "#e8590c",
    "#d9480f",
    11 * s,
  );

  /* Arrow down to rotation */
  drawArrowDown(ctx, s, rCx, topY + boxH + 4 * s, topY + boxH + 24 * s, "#adb5bd");

  /* Rotation visualization */
  const rotCenterY = topY + boxH + 24 * s + 44 * s;
  const rotR = 36 * s;

  /* Circle */
  ctx.strokeStyle = "#e8590c";
  ctx.lineWidth = 1.5 * s;
  ctx.setLineDash([3 * s, 3 * s]);
  ctx.beginPath();
  ctx.arc(rCx, rotCenterY, rotR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  /* Angles: original at 0 rad (horizontal right), each position adds θ */
  const theta = Math.PI / 5; /* 36 degrees per position */

  /* Position tick marks on circle */
  const posLabels = ["원본", "pos 1", "pos 2", "pos 3"];
  const posColors = ["#ced4da", "#e8590c", "#e8590c", "#e8590c"];
  for (let i = 0; i < posLabels.length; i++) {
    const a = theta * i;
    const innerR = rotR - 3 * s;
    const outerR = rotR + 3 * s;
    const labelR = rotR + 18 * s;

    /* tick */
    ctx.strokeStyle = posColors[i];
    ctx.lineWidth = (i === 0 ? 1 : 1.5) * s;
    ctx.beginPath();
    ctx.moveTo(rCx + innerR * Math.cos(a), rotCenterY - innerR * Math.sin(a));
    ctx.lineTo(rCx + outerR * Math.cos(a), rotCenterY - outerR * Math.sin(a));
    ctx.stroke();

    /* label */
    ctx.fillStyle = i === 0 ? "#adb5bd" : "#e8590c";
    ctx.font = `${Math.max(9 * s, 8)}px ${FONT}`;
    ctx.textAlign = a > Math.PI / 2 ? "right" : "left";
    ctx.textBaseline = "middle";
    ctx.fillText(posLabels[i], rCx + labelR * Math.cos(a), rotCenterY - labelR * Math.sin(a));
  }

  /* Original vector (gray dashed, at angle 0) */
  ctx.strokeStyle = "#ced4da";
  ctx.lineWidth = 1.5 * s;
  ctx.setLineDash([4 * s, 3 * s]);
  ctx.beginPath();
  ctx.moveTo(rCx, rotCenterY);
  ctx.lineTo(rCx + rotR * 0.8, rotCenterY);
  ctx.stroke();
  ctx.setLineDash([]);

  /* Rotated vector (orange arrow, at pos 1 = theta) */
  const rotAngle = theta;
  const vecLen = rotR * 0.8;
  const endX = rCx + vecLen * Math.cos(rotAngle);
  const endY = rotCenterY - vecLen * Math.sin(rotAngle);
  ctx.strokeStyle = "#e8590c";
  ctx.lineWidth = 2.5 * s;
  ctx.beginPath();
  ctx.moveTo(rCx, rotCenterY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  /* Arrowhead */
  const headLen = 6 * s;
  const arrowAngle = rotAngle;
  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(
    endX - headLen * Math.cos(arrowAngle - 0.35),
    endY + headLen * Math.sin(arrowAngle - 0.35),
  );
  ctx.moveTo(endX, endY);
  ctx.lineTo(
    endX - headLen * Math.cos(arrowAngle + 0.35),
    endY + headLen * Math.sin(arrowAngle + 0.35),
  );
  ctx.stroke();

  /* Rotation arc from 0 to theta */
  ctx.strokeStyle = "#fab005";
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.arc(rCx, rotCenterY, rotR * 0.4, 0, -rotAngle, true);
  ctx.stroke();

  /* θ label */
  const midAngle = rotAngle / 2;
  ctx.fillStyle = "#e67700";
  ctx.font = `bold ${Math.max(11 * s, 10)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    "θ",
    rCx + rotR * 0.28 * Math.cos(midAngle),
    rotCenterY - rotR * 0.28 * Math.sin(midAngle),
  );

  /* Description */
  ctx.fillStyle = "#868e96";
  ctx.font = `${Math.max(10 * s, 9)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("위치에 따라 Q·K 벡터를 회전시킨다", rCx, rotCenterY + rotR + 18 * s);

  /* ── Vertical dashed divider ── */
  ctx.strokeStyle = "#dee2e6";
  ctx.lineWidth = 1 * s;
  ctx.setLineDash([4 * s, 4 * s]);
  ctx.beginPath();
  ctx.moveTo(w * 0.5, topY - 16 * s);
  ctx.lineTo(w * 0.5, rotCenterY + rotR);
  ctx.stroke();
  ctx.setLineDash([]);

  return rotCenterY + rotR + 38 * s;
}

export const PositionEmbeddingDiagram = ({ caption }: { caption?: string }) => {
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
