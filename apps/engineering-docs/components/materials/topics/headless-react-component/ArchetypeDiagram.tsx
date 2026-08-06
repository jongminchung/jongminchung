// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useEffect, useRef } from "react";
import {
  SvgCanvas,
  type SvgCanvasHandle,
  type SvgDrawingContext,
  type SvgGradient,
} from "@/components/materials/runtime/svg-canvas";

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

const CHIPS = [
  "Headless 코어 (동작·접근성)",
  "토큰 슬롯 (색·간격·글꼴의 자리)",
  "구조 규칙 (합성 API)",
];

const SERVICES = [
  { title: "서비스 A · 커머스", fill: "#fff9db", stroke: "#fab005", text: "#f08c00" },
  { title: "서비스 B · 어드민", fill: "#d3f9d8", stroke: "#40c057", text: "#2f9e44" },
  { title: "서비스 C · 커뮤니티", fill: "#f3f0ff", stroke: "#845ef7", text: "#7048e8" },
];

const SERVICE_LINES = ["스킨 + 토큰 값", "브랜드마다 다르다"];
const ARROW_LABEL = "동작은 물려받고 디자인만 채운다";

function drawRoundRect(
  ctx: SvgDrawingContext,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  stroke: string,
  lineWidth = 1.5,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function drawArrow(ctx: SvgDrawingContext, x1: number, y1: number, x2: number, y2: number) {
  const head = 7;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.strokeStyle = "#adb5bd";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2 - Math.cos(angle) * (head - 2), y2 - Math.sin(angle) * (head - 2));
  ctx.stroke();
  ctx.fillStyle = "#adb5bd";
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - Math.cos(angle - 0.45) * head, y2 - Math.sin(angle - 0.45) * head);
  ctx.lineTo(x2 - Math.cos(angle + 0.45) * head, y2 - Math.sin(angle + 0.45) * head);
  ctx.closePath();
  ctx.fill();
}

interface Props {
  caption?: string;
}

export const ArchetypeDiagram = ({ caption }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<SvgCanvasHandle>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const draw = () => {
      const w = container.clientWidth;
      if (w <= 0) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const isMobile = w < 480;
      const s = w / 640;

      const pad = 12;
      const titleFs = Math.max(14 * s, 12);
      const chipFs = Math.max(11 * s, 10);
      const svcFs = Math.max(12.5 * s, 11);
      const smallFs = Math.max(10.5 * s, 10);
      const labelFs = Math.max(10.5 * s, 10);

      // --- 레이아웃 계산 (캔버스 크기를 정하기 전에 텍스트를 측정한다) ---
      const boxPadV = Math.max(12 * s, 10);
      const boxPadH = Math.max(12 * s, 10);
      const archX = pad;
      const archW = w - pad * 2;
      const chipH = chipFs + 14;
      const chipGap = 8;
      const titleChipGap = Math.max(10 * s, 8);

      ctx.font = `${chipFs}px ${FONT}`;
      const chipWs = CHIPS.map((t) => ctx.measureText(t).width + 24);
      const chipsRowW = chipWs.reduce((a, b) => a + b, 0) + chipGap * (CHIPS.length - 1);
      const chipsHorizontal = !isMobile && chipsRowW <= archW - boxPadH * 2;

      const chipsBlockH = chipsHorizontal ? chipH : CHIPS.length * chipH + (CHIPS.length - 1) * 6;
      const archH = boxPadV + titleFs + titleChipGap + chipsBlockH + boxPadV;
      const archTop = pad;
      const archBottom = archTop + archH;

      const svcPad = Math.max(12 * s, 10);
      const svcH = svcPad + svcFs + 8 + smallFs + 5 + smallFs + svcPad;

      let totalH: number;
      let svcTop = 0;
      const arrowZone = Math.max(52 * s, 46);
      const mobileSvcGap = 14;
      const mobileFirstGap = 34;
      const spineX = pad + 14;
      if (isMobile) {
        svcTop = archBottom + mobileFirstGap;
        totalH = svcTop + SERVICES.length * svcH + (SERVICES.length - 1) * mobileSvcGap + pad;
      } else {
        svcTop = archBottom + arrowZone;
        totalH = svcTop + svcH + pad;
      }

      canvas.width = w * dpr;
      canvas.height = totalH * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${totalH}px`;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      // --- 원형(Archetype) 박스 ---
      drawRoundRect(ctx, archX, archTop, archW, archH, 10, "#e7f5ff", "#228be6");
      ctx.font = `700 ${titleFs}px ${FONT}`;
      ctx.fillStyle = "#228be6";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("원형 (Archetype)", archX + archW / 2, archTop + boxPadV + titleFs / 2);

      const chipTop = archTop + boxPadV + titleFs + titleChipGap;
      ctx.font = `${chipFs}px ${FONT}`;
      if (chipsHorizontal) {
        let cx = archX + archW / 2 - chipsRowW / 2;
        CHIPS.forEach((text, i) => {
          drawRoundRect(ctx, cx, chipTop, chipWs[i], chipH, 6, "#fff", "#228be6", 1);
          ctx.fillStyle = "#495057";
          ctx.fillText(text, cx + chipWs[i] / 2, chipTop + chipH / 2 + 0.5);
          cx += chipWs[i] + chipGap;
        });
      } else {
        const cw = Math.min(archW - boxPadH * 2, Math.max(...chipWs));
        CHIPS.forEach((text, i) => {
          const cy = chipTop + i * (chipH + 6);
          drawRoundRect(ctx, archX + archW / 2 - cw / 2, cy, cw, chipH, 6, "#fff", "#228be6", 1);
          ctx.fillStyle = "#495057";
          ctx.fillText(text, archX + archW / 2, cy + chipH / 2 + 0.5);
        });
      }

      // --- 서비스 박스 위치 ---
      const svcRects: Array<{ x: number; y: number; w: number }> = [];
      if (isMobile) {
        const sx = pad + 34;
        const sw = w - pad - sx;
        SERVICES.forEach((_, i) => {
          svcRects.push({ x: sx, y: svcTop + i * (svcH + mobileSvcGap), w: sw });
        });
      } else {
        const colGap = Math.max(12, 16 * s);
        const colW = (w - pad * 2 - colGap * 2) / 3;
        SERVICES.forEach((_, i) => {
          svcRects.push({ x: pad + i * (colW + colGap), y: svcTop, w: colW });
        });
      }

      // --- 화살표 ---
      if (isMobile) {
        // 왼쪽 세로 줄기에서 각 서비스 박스로 갈라진다
        const lastMidY = svcRects[svcRects.length - 1].y + svcH / 2;
        ctx.strokeStyle = "#adb5bd";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(spineX, archBottom);
        ctx.lineTo(spineX, lastMidY);
        ctx.stroke();
        svcRects.forEach((r) => {
          drawArrow(ctx, spineX, r.y + svcH / 2, r.x - 3, r.y + svcH / 2);
        });
        ctx.font = `${labelFs}px ${FONT}`;
        ctx.fillStyle = "#868e96";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(ARROW_LABEL, spineX + 12, archBottom + 15);
      } else {
        // 원형 박스 가운데 아래에서 세 갈래로 갈라진다
        svcRects.forEach((r) => {
          drawArrow(ctx, w / 2, archBottom + 2, r.x + r.w / 2, svcTop - 3);
        });
        ctx.font = `${labelFs}px ${FONT}`;
        ctx.fillStyle = "#868e96";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(ARROW_LABEL, w - pad - 2, archBottom + 6 + labelFs / 2);
      }

      // --- 서비스 박스 ---
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      SERVICES.forEach((svc, i) => {
        const r = svcRects[i];
        drawRoundRect(ctx, r.x, r.y, r.w, svcH, 8, svc.fill, svc.stroke);
        const cx = r.x + r.w / 2;
        ctx.font = `700 ${svcFs}px ${FONT}`;
        ctx.fillStyle = svc.text;
        ctx.fillText(svc.title, cx, r.y + svcPad + svcFs / 2);
        ctx.font = `${smallFs}px ${FONT}`;
        ctx.fillStyle = "#868e96";
        const line1Y = r.y + svcPad + svcFs + 8 + smallFs / 2;
        ctx.fillText(SERVICE_LINES[0], cx, line1Y);
        ctx.fillText(SERVICE_LINES[1], cx, line1Y + smallFs + 5);
      });
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  return (
    <figure>
      <div ref={containerRef}>
        <SvgCanvas ref={canvasRef} style={{ display: "block", width: "100%" }} />
      </div>
      {caption && <figcaption dangerouslySetInnerHTML={{ __html: caption }} />}
    </figure>
  );
};
