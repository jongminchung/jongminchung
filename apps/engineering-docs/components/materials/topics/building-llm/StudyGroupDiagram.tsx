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

interface Student {
  name: string;
  specialty: string;
  color: string;
  colorLight: string;
}

const STUDENTS: Student[] = [
  { name: "A", specialty: "영어", color: "#228be6", colorLight: "#e7f5ff" },
  { name: "B", specialty: "미적분", color: "#40c057", colorLight: "#ebfbee" },
  { name: "C", specialty: "통계", color: "#fab005", colorLight: "#fff9db" },
];

function drawScene(ctx: SvgDrawingContext, w: number): number {
  const s = w / 540;

  /* Layout: 3 students in a row, with arrows between them */
  const cardW = 120 * s;
  const cardH = 62 * s;
  const cardSpacing = 40 * s;
  const totalW = 3 * cardW + 2 * cardSpacing;
  const startX = (w - totalW) / 2;
  const topY = 20 * s;

  const centers: { x: number; y: number }[] = [];

  /* Draw student cards */
  for (let i = 0; i < STUDENTS.length; i++) {
    const st = STUDENTS[i];
    const cx = startX + i * (cardW + cardSpacing) + cardW / 2;
    const cy = topY + cardH / 2;
    centers.push({ x: cx, y: cy });

    /* Card background */
    roundRect(ctx, cx - cardW / 2, topY, cardW, cardH, 8 * s);
    ctx.fillStyle = st.colorLight;
    ctx.fill();
    ctx.strokeStyle = st.color;
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();

    /* Student name circle */
    const circleR = 12 * s;
    const circleY = topY + cardH / 2 - 6 * s;
    ctx.beginPath();
    ctx.arc(cx, circleY, circleR, 0, Math.PI * 2);
    ctx.fillStyle = st.color;
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.max(14 * s, 11)}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(st.name, cx, circleY);

    /* Specialty tag */
    ctx.fillStyle = st.color;
    ctx.font = `${Math.max(11 * s, 9)}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`전문: ${st.specialty}`, cx, circleY + circleR + 4 * s);
  }

  /* Draw A's question and arrows */
  const questionY = topY + cardH + 28 * s;

  /* Speech bubble from A */
  const bubbleW = Math.max(200 * s, 130);
  const bubbleH = 28 * s;
  const bubbleX = centers[0].x - 10 * s;
  const bubbleY = questionY;

  roundRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 6 * s);
  ctx.fillStyle = "#f1f3f5";
  ctx.fill();
  ctx.strokeStyle = "#ced4da";
  ctx.lineWidth = 1 * s;
  ctx.stroke();

  ctx.fillStyle = "#495057";
  ctx.font = `${Math.max(11 * s, 9)}px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText('A: "미적분을 어떻게 풀지?"', bubbleX + 10 * s, bubbleY + bubbleH / 2);

  /* Arrow from bubble to B (strong) and C (weak) */
  const arrowStartY = bubbleY + bubbleH + 12 * s;
  const arrowRow = arrowStartY + 10 * s;

  /* B row: strong connection */
  const bRowY = arrowRow;
  const bBoxW = Math.max(100 * s, 80);
  const bBoxX = centers[1].x - bBoxW / 2;
  const bBoxH = 32 * s;

  /* curved arrow from A area to B box */
  ctx.strokeStyle = "#40c057";
  ctx.lineWidth = 2.5 * s;
  ctx.beginPath();
  ctx.moveTo(centers[0].x + 20 * s, bubbleY + bubbleH);
  ctx.quadraticCurveTo(centers[0].x + 40 * s, bRowY + bBoxH / 2, bBoxX - 4 * s, bRowY + bBoxH / 2);
  ctx.stroke();
  /* arrowhead */
  ctx.beginPath();
  ctx.moveTo(bBoxX - 4 * s, bRowY + bBoxH / 2);
  ctx.lineTo(bBoxX - 10 * s, bRowY + bBoxH / 2 - 4 * s);
  ctx.moveTo(bBoxX - 4 * s, bRowY + bBoxH / 2);
  ctx.lineTo(bBoxX - 10 * s, bRowY + bBoxH / 2 + 4 * s);
  ctx.stroke();

  roundRect(ctx, bBoxX, bRowY, bBoxW, bBoxH, 6 * s);
  ctx.fillStyle = "#ebfbee";
  ctx.fill();
  ctx.strokeStyle = "#40c057";
  ctx.lineWidth = 2 * s;
  ctx.stroke();

  ctx.fillStyle = "#2b8a3e";
  ctx.font = `bold ${Math.max(12 * s, 9)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("B의 노트 → 80%", bBoxX + bBoxW / 2, bRowY + bBoxH / 2);

  /* C row: weak connection */
  const cRowY = bRowY + bBoxH + 12 * s;
  const cBoxW = Math.max(100 * s, 80);
  const cBoxX = centers[2].x - cBoxW / 2;
  const cBoxH = 32 * s;

  ctx.strokeStyle = "#fab005";
  ctx.lineWidth = 1 * s;
  ctx.setLineDash([4 * s, 4 * s]);
  ctx.beginPath();
  ctx.moveTo(centers[0].x + 30 * s, bubbleY + bubbleH);
  ctx.quadraticCurveTo(centers[0].x + 60 * s, cRowY + cBoxH / 2, cBoxX - 4 * s, cRowY + cBoxH / 2);
  ctx.stroke();
  ctx.setLineDash([]);
  /* arrowhead */
  ctx.strokeStyle = "#fab005";
  ctx.lineWidth = 1 * s;
  ctx.beginPath();
  ctx.moveTo(cBoxX - 4 * s, cRowY + cBoxH / 2);
  ctx.lineTo(cBoxX - 10 * s, cRowY + cBoxH / 2 - 4 * s);
  ctx.moveTo(cBoxX - 4 * s, cRowY + cBoxH / 2);
  ctx.lineTo(cBoxX - 10 * s, cRowY + cBoxH / 2 + 4 * s);
  ctx.stroke();

  roundRect(ctx, cBoxX, cRowY, cBoxW, cBoxH, 6 * s);
  ctx.fillStyle = "#fff9db";
  ctx.fill();
  ctx.strokeStyle = "#fab005";
  ctx.lineWidth = 1.5 * s;
  ctx.stroke();

  ctx.fillStyle = "#e67700";
  ctx.font = `bold ${Math.max(12 * s, 9)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("C의 노트 → 20%", cBoxX + cBoxW / 2, cRowY + cBoxH / 2);

  /* Result: A's updated knowledge */
  const resultY = cRowY + cBoxH + 20 * s;
  const resultW = 180 * s;
  const resultH = 32 * s;
  const resultX = (w - resultW) / 2;

  /* Merge arrows */
  ctx.strokeStyle = "#228be6";
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(bBoxX + bBoxW / 2, bRowY + bBoxH);
  ctx.quadraticCurveTo(bBoxX + bBoxW / 2, resultY - 4 * s, resultX + resultW / 2, resultY - 4 * s);
  ctx.stroke();

  ctx.strokeStyle = "#fab005";
  ctx.lineWidth = 1 * s;
  ctx.beginPath();
  ctx.moveTo(cBoxX + cBoxW / 2, cRowY + cBoxH);
  ctx.quadraticCurveTo(cBoxX + cBoxW / 2, resultY - 4 * s, resultX + resultW / 2, resultY - 4 * s);
  ctx.stroke();

  /* arrowhead on result */
  ctx.strokeStyle = "#7950f2";
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(resultX + resultW / 2, resultY - 4 * s);
  ctx.lineTo(resultX + resultW / 2, resultY);
  ctx.stroke();

  roundRect(ctx, resultX, resultY, resultW, resultH, 6 * s);
  ctx.fillStyle = "#f3f0ff";
  ctx.fill();
  ctx.strokeStyle = "#7950f2";
  ctx.lineWidth = 1.5 * s;
  ctx.stroke();

  ctx.fillStyle = "#5f3dc4";
  ctx.font = `bold ${Math.max(12 * s, 9)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("A의 보강된 지식", resultX + resultW / 2, resultY + resultH / 2);

  return resultY + resultH + 16 * s;
}

export const StudyGroupDiagram = ({ caption }: { caption?: string }) => {
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
