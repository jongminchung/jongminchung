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

const DESKTOP_BASE_W = 640;
const DESKTOP_BASE_H = 280;

// Mobile layout metrics (fixed px)
const MOBILE_SECTION_H = 204;
const MOBILE_H = 12 + MOBILE_SECTION_H + 26 + 12 + MOBILE_SECTION_H + 24 + 20; // 502

const ANNOTATION = "기계가 재현을 가져간 순간";

interface BoxStyle {
  bg: string;
  border: string;
  title: string;
  sub: string;
}

const GRAY_BOX: BoxStyle = { bg: "#f8f9fa", border: "#adb5bd", title: "#495057", sub: "#868e96" };
const BLUE_BOX: BoxStyle = { bg: "#e7f5ff", border: "#228be6", title: "#1971c2", sub: "#228be6" };

interface LaneData {
  lane: string;
  event: string;
  left: { title: string; subtitle: string };
  right: { title: string; subtitle: string };
}

const PAINTING: LaneData = {
  lane: "회화",
  event: "1839 · 사진술",
  left: { title: "재현의 회화", subtitle: "“얼마나 닮게 그릴 것인가”" },
  right: { title: "인상주의 · 추상", subtitle: "“그림이란 무엇인가”" },
};

const CODE: LaneData = {
  lane: "코드",
  event: "2022~ · 생성형 AI",
  left: { title: "인지의 아름다움", subtitle: "“어떻게 읽힐 것인가”" },
  right: { title: "구조 · 실행 · 판단", subtitle: "“무엇을 만들 것인가”" },
};

// ── Helpers ──

function drawHArrowhead(ctx: SvgDrawingContext, x: number, y: number, dir: 1 | -1, size: number) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - dir * size, y - size * 0.6);
  ctx.lineTo(x - dir * size, y + size * 0.6);
  ctx.closePath();
  ctx.fill();
}

function drawVArrowhead(ctx: SvgDrawingContext, x: number, y: number, dir: 1 | -1, size: number) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - size * 0.6, y - dir * size);
  ctx.lineTo(x + size * 0.6, y - dir * size);
  ctx.closePath();
  ctx.fill();
}

function drawStateBox(
  ctx: SvgDrawingContext,
  x: number,
  y: number,
  w: number,
  h: number,
  style: BoxStyle,
  title: string,
  subtitle: string,
  titleFs: number,
  subFs: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fillStyle = style.bg;
  ctx.fill();
  ctx.strokeStyle = style.border;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = style.title;
  ctx.font = `600 ${titleFs}px ${FONT}`;
  ctx.fillText(title, cx, cy - h * 0.17);
  ctx.fillStyle = style.sub;
  ctx.font = `${subFs}px ${FONT}`;
  ctx.fillText(subtitle, cx, cy + h * 0.19);
}

function drawEventMarker(ctx: SvgDrawingContext, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = "#fa5252";
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.stroke();
}

// Vertical dashed line drawn in segments so it never crosses text labels
function drawDashedVertical(ctx: SvgDrawingContext, x: number, segments: Array<[number, number]>) {
  ctx.strokeStyle = "#fa5252";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.globalAlpha = 0.65;
  for (const [y1, y2] of segments) {
    if (y2 <= y1) continue;
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

// ── Horizontal layout (desktop) ──

function drawHorizontal(ctx: SvgDrawingContext, w: number): number {
  const s = w / DESKTOP_BASE_W;
  const h = DESKTOP_BASE_H * s;

  const eventX = 320 * s;
  const boxW = 186 * s;
  const boxH = 58 * s;
  const leftBoxX = 54 * s;
  const rightBoxX = 400 * s;
  const lane1Cy = 84 * s;
  const lane2Cy = 196 * s;
  const label1Y = 40 * s;
  const label2Y = 152 * s;
  const lineTop = 16 * s;
  const lineBottom = 242 * s;
  const annotY = 258 * s;

  const laneFs = Math.max(13 * s, 11);
  const titleFs = Math.max(13 * s, 11);
  const subFs = Math.max(10.5 * s, 9);
  const eventFs = Math.max(11 * s, 10);
  const annotFs = Math.max(10.5 * s, 9.5);
  const markerR = Math.max(5.5 * s, 4);
  const headSize = Math.max(6 * s, 5);

  // Dashed line through both event points, skipping the label areas
  const skip = eventFs * 0.8 + 3;
  drawDashedVertical(ctx, eventX, [
    [lineTop, label1Y - skip],
    [label1Y + skip, label2Y - skip],
    [label2Y + skip, lineBottom],
  ]);

  const lanes = [
    { data: PAINTING, cy: lane1Cy, labelY: label1Y },
    { data: CODE, cy: lane2Cy, labelY: label2Y },
  ];

  for (const { data, cy, labelY } of lanes) {
    // Lane label
    ctx.fillStyle = "#495057";
    ctx.font = `600 ${laneFs}px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(data.lane, 14 * s, cy);

    // Arrow from left box to right box, passing through the event point
    ctx.strokeStyle = "#adb5bd";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(leftBoxX + boxW + 8 * s, cy);
    ctx.lineTo(rightBoxX - 4 * s - headSize, cy);
    ctx.stroke();
    ctx.fillStyle = "#adb5bd";
    drawHArrowhead(ctx, rightBoxX - 4 * s, cy, 1, headSize);

    // State boxes
    drawStateBox(
      ctx,
      leftBoxX,
      cy - boxH / 2,
      boxW,
      boxH,
      GRAY_BOX,
      data.left.title,
      data.left.subtitle,
      titleFs,
      subFs,
    );
    drawStateBox(
      ctx,
      rightBoxX,
      cy - boxH / 2,
      boxW,
      boxH,
      BLUE_BOX,
      data.right.title,
      data.right.subtitle,
      titleFs,
      subFs,
    );

    // Event marker on the intersection + label above it
    drawEventMarker(ctx, eventX, cy, markerR);
    ctx.fillStyle = "#e03131";
    ctx.font = `600 ${eventFs}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(data.event, eventX, labelY);
  }

  // Annotation under the dashed line
  ctx.fillStyle = "#e03131";
  ctx.font = `600 ${annotFs}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(ANNOTATION, eventX, annotY);

  return h;
}

// ── Vertical layout (mobile) ──

function drawMobileSection(ctx: SvgDrawingContext, w: number, top: number, data: LaneData): number {
  const cx = w / 2;
  const boxW = w * 0.82;
  const boxX = (w - boxW) / 2;
  const boxH = 58;

  // Section label
  ctx.fillStyle = "#495057";
  ctx.font = `600 13px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(data.lane, cx, top + 10);

  const box1Y = top + 24;
  drawStateBox(
    ctx,
    boxX,
    box1Y,
    boxW,
    boxH,
    GRAY_BOX,
    data.left.title,
    data.left.subtitle,
    13,
    10.5,
  );

  // Down arrow with event marker
  const arrowTop = box1Y + boxH + 8;
  const arrowBottom = arrowTop + 42;
  ctx.strokeStyle = "#adb5bd";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, arrowTop);
  ctx.lineTo(cx, arrowBottom);
  ctx.stroke();
  ctx.fillStyle = "#adb5bd";
  drawVArrowhead(ctx, cx, arrowBottom + 6, 1, 6);

  const markerY = (arrowTop + arrowBottom) / 2;
  drawEventMarker(ctx, cx, markerY, 5);

  // Event label beside the arrow
  ctx.fillStyle = "#e03131";
  ctx.font = `600 11px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(data.event, cx + 14, markerY);

  const box2Y = arrowBottom + 14;
  drawStateBox(
    ctx,
    boxX,
    box2Y,
    boxW,
    boxH,
    BLUE_BOX,
    data.right.title,
    data.right.subtitle,
    13,
    10.5,
  );

  return top + MOBILE_SECTION_H;
}

function drawVertical(ctx: SvgDrawingContext, w: number): number {
  const s1Bottom = drawMobileSection(ctx, w, 12, PAINTING);

  // Divider between sections
  const dividerY = s1Bottom + 26;
  ctx.strokeStyle = "#dee2e6";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w * 0.16, dividerY);
  ctx.lineTo(w * 0.84, dividerY);
  ctx.stroke();

  const s2Bottom = drawMobileSection(ctx, w, dividerY + 12, CODE);

  // Annotation
  const annotY = s2Bottom + 24;
  ctx.fillStyle = "#e03131";
  ctx.font = `600 10px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(ANNOTATION, w / 2, annotY);

  return annotY + 20;
}

// ── Component ──

interface Props {
  caption?: string;
}

export const AestheticsMigrationDiagram = ({ caption }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<SvgCanvasHandle>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const draw = () => {
      const w = container.clientWidth;
      const dpr = window.devicePixelRatio || 1;
      const isMobile = w < 480;

      const ctx = canvas.getContext("2d")!;

      // Pre-compute height
      const h = isMobile ? MOBILE_H : DESKTOP_BASE_H * (w / DESKTOP_BASE_W);

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      if (isMobile) {
        drawVertical(ctx, w);
      } else {
        drawHorizontal(ctx, w);
      }
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
