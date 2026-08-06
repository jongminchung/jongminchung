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

const PAD = 16;
const BASE_W = 640;

interface Props {
  caption?: string;
}

interface ChipSpec {
  label: string;
  fill: string;
  stroke: string;
}

// 동작(파랑)과 디자인(노랑) 칩이 서로 섞여 있도록 번갈아 배치
const MIXED_CHIPS: ChipSpec[] = [
  { label: "상태 관리", fill: "#e7f5ff", stroke: "#228be6" },
  { label: "색상", fill: "#fff9db", stroke: "#fab005" },
  { label: "키보드 처리", fill: "#e7f5ff", stroke: "#228be6" },
  { label: "여백·모서리", fill: "#fff9db", stroke: "#fab005" },
  { label: "ARIA 속성", fill: "#e7f5ff", stroke: "#228be6" },
  { label: "글꼴", fill: "#fff9db", stroke: "#fab005" },
];

const CORE_CHIPS: ChipSpec[] = [
  { label: "상태 관리", fill: "#fff", stroke: "#228be6" },
  { label: "키보드 처리", fill: "#fff", stroke: "#228be6" },
  { label: "ARIA 속성", fill: "#fff", stroke: "#228be6" },
];

const SKINS = [
  { label: "스킨 A", fill: "#fff9db", stroke: "#fab005" },
  { label: "스킨 B", fill: "#d3f9d8", stroke: "#40c057" },
  { label: "스킨 C", fill: "#f3f0ff", stroke: "#845ef7" },
];

function drawBox(
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

interface ChipPos {
  x: number;
  y: number;
  w: number;
  chip: ChipSpec;
}

// 칩을 innerW 안에서 흐르듯 배치한다. zigzag면 홀수 줄에 들여쓰기를 줘서
// 격자가 아니라 서로 어긋나게 붙은 느낌을 낸다. 반환 좌표는 (0,0) 기준.
function flowChips(
  ctx: SvgDrawingContext,
  chips: ChipSpec[],
  innerW: number,
  fs: number,
  zigzag: boolean,
): { pos: ChipPos[]; chipH: number; height: number } {
  const chipH = fs + 13;
  const gapX = 7;
  const gapY = 8;
  const indent = zigzag ? 16 : 0;

  ctx.font = `600 ${fs}px ${FONT}`;
  const pos: ChipPos[] = [];
  let row = 0;
  let cx = 0;
  let cy = 0;
  for (const chip of chips) {
    const cw = Math.ceil(ctx.measureText(chip.label).width) + 18;
    const rowStart = row % 2 === 1 ? indent : 0;
    if (cx > rowStart && cx + cw > innerW) {
      row += 1;
      cx = row % 2 === 1 ? indent : 0;
      if (cx + cw > innerW) cx = 0;
      cy += chipH + gapY;
    }
    pos.push({ x: cx, y: cy, w: cw, chip });
    cx += cw + gapX;
  }
  return { pos, chipH, height: cy + chipH };
}

function drawChip(
  ctx: SvgDrawingContext,
  x: number,
  y: number,
  w: number,
  h: number,
  chip: ChipSpec,
  fs: number,
) {
  drawBox(ctx, x, y, w, h, 5, chip.fill, chip.stroke, 1.2);
  ctx.font = `600 ${fs}px ${FONT}`;
  ctx.fillStyle = "#495057";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(chip.label, x + w / 2, y + h / 2 + 0.5);
}

// 텍스트가 maxW를 넘지 않도록 폰트 크기를 줄여서 맞춘다
function fitFontSize(
  ctx: SvgDrawingContext,
  text: string,
  fs: number,
  maxW: number,
  weight = "",
): number {
  let size = fs;
  ctx.font = `${weight ? `${weight} ` : ""}${size}px ${FONT}`;
  while (size > 8.5 && ctx.measureText(text).width > maxW) {
    size -= 0.5;
    ctx.font = `${weight ? `${weight} ` : ""}${size}px ${FONT}`;
  }
  return size;
}

function drawDoubleArrow(ctx: SvgDrawingContext, x: number, y1: number, y2: number, color: string) {
  const a = 5;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(x, y1 + a + 1);
  ctx.lineTo(x, y2 - a - 1);
  ctx.stroke();
  // 위쪽 삼각형
  ctx.beginPath();
  ctx.moveTo(x, y1);
  ctx.lineTo(x - a, y1 + a + 2);
  ctx.lineTo(x + a, y1 + a + 2);
  ctx.closePath();
  ctx.fill();
  // 아래쪽 삼각형
  ctx.beginPath();
  ctx.moveTo(x, y2);
  ctx.lineTo(x - a, y2 - a - 2);
  ctx.lineTo(x + a, y2 - a - 2);
  ctx.closePath();
  ctx.fill();
}

// 왼쪽: 스타일이 결합된 컴포넌트. render=false면 높이만 계산한다.
function drawCoupledPanel(
  ctx: SvgDrawingContext,
  x: number,
  y: number,
  pw: number,
  s: number,
  render: boolean,
): number {
  const titleFs = Math.max(13 * s, 12);
  const chipFs = Math.max(11 * s, 10);
  const noteFs = Math.max(11 * s, 10);
  const boxPad = 14;

  let cy = y;
  if (render) {
    ctx.font = `700 ${titleFs}px ${FONT}`;
    ctx.fillStyle = "#495057";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("스타일이 결합된 컴포넌트", x + pw / 2, cy + titleFs / 2);
  }
  cy += titleFs + 14;

  const flow = flowChips(ctx, MIXED_CHIPS, pw - boxPad * 2, chipFs, true);
  const boxH = flow.height + boxPad * 2;
  if (render) {
    drawBox(ctx, x, cy, pw, boxH, 8, "#f8f9fa", "#adb5bd");
    for (const p of flow.pos) {
      drawChip(ctx, x + boxPad + p.x, cy + boxPad + p.y, p.w, flow.chipH, p.chip, chipFs);
    }
  }
  cy += boxH + 16;

  if (render) {
    const fs = fitFontSize(ctx, "한 덩어리 — 화면만 바꿀 수 없다", noteFs, pw - 8, "600");
    ctx.font = `600 ${fs}px ${FONT}`;
    ctx.fillStyle = "#fa5252";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("한 덩어리 — 화면만 바꿀 수 없다", x + pw / 2, cy + noteFs / 2);
  }
  cy += noteFs;
  return cy - y;
}

// 오른쪽: Headless 컴포넌트. render=false면 높이만 계산한다.
function drawHeadlessPanel(
  ctx: SvgDrawingContext,
  x: number,
  y: number,
  pw: number,
  s: number,
  render: boolean,
): number {
  const titleFs = Math.max(13 * s, 12);
  const chipFs = Math.max(11 * s, 10);
  const subFs = Math.max(10 * s, 10);
  const noteFs = Math.max(11 * s, 10);
  const skinGap = 10;

  let cy = y;
  if (render) {
    ctx.font = `700 ${titleFs}px ${FONT}`;
    ctx.fillStyle = "#495057";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Headless 컴포넌트", x + pw / 2, cy + titleFs / 2);
  }
  cy += titleFs + 14;

  // 위층: 스킨 3개
  const skinW = (pw - skinGap * 2) / 3;
  const skinH = chipFs + subFs + 22;
  if (render) {
    SKINS.forEach((skin, i) => {
      const sx = x + i * (skinW + skinGap);
      drawBox(ctx, sx, cy, skinW, skinH, 7, skin.fill, skin.stroke);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `700 ${chipFs}px ${FONT}`;
      ctx.fillStyle = "#495057";
      ctx.fillText(skin.label, sx + skinW / 2, cy + 8 + chipFs / 2);
      const sf = fitFontSize(ctx, "색·여백·글꼴", subFs, skinW - 8);
      ctx.font = `${sf}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.fillText("색·여백·글꼴", sx + skinW / 2, cy + skinH - 8 - subFs / 2);
    });
  }
  cy += skinH;

  // 스킨 층과 동작 층 사이: 위아래 화살표 + 라벨
  const arrowH = 36;
  if (render) {
    const ax = x + pw * 0.3;
    drawDoubleArrow(ctx, ax, cy + 5, cy + arrowH - 5, "#40c057");
    const labelFs = fitFontSize(
      ctx,
      "갈아끼울 수 있다",
      Math.max(10 * s, 10),
      pw - pw * 0.3 - 16,
      "700",
    );
    ctx.font = `700 ${labelFs}px ${FONT}`;
    ctx.fillStyle = "#40c057";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("갈아끼울 수 있다", ax + 11, cy + arrowH / 2);
  }
  cy += arrowH;

  // 아래층: 동작 층 (Headless 코어)
  const corePad = 12;
  const coreTitleFs = Math.max(11 * s, 10);
  const flow = flowChips(ctx, CORE_CHIPS, pw - corePad * 2, chipFs, false);
  const coreH = corePad + coreTitleFs + 10 + flow.height + corePad;
  if (render) {
    drawBox(ctx, x, cy, pw, coreH, 8, "#e7f5ff", "#228be6");
    ctx.font = `700 ${coreTitleFs}px ${FONT}`;
    ctx.fillStyle = "#1971c2";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("동작 층 (Headless 코어)", x + pw / 2, cy + corePad + coreTitleFs / 2);

    // 줄 단위로 가운데 정렬해서 칩을 그린다
    const chipTop = cy + corePad + coreTitleFs + 10;
    const rows = new Map<number, ChipPos[]>();
    for (const p of flow.pos) {
      const row = rows.get(p.y) ?? [];
      row.push(p);
      rows.set(p.y, row);
    }
    const innerW = pw - corePad * 2;
    rows.forEach((row) => {
      const minX = Math.min(...row.map((p) => p.x));
      const maxX = Math.max(...row.map((p) => p.x + p.w));
      const shift = (innerW - (maxX - minX)) / 2 - minX;
      for (const p of row) {
        drawChip(ctx, x + corePad + p.x + shift, chipTop + p.y, p.w, flow.chipH, p.chip, chipFs);
      }
    });
  }
  cy += coreH + 16;

  if (render) {
    const fs = fitFontSize(ctx, "동작은 그대로, 스킨만 바꾼다", noteFs, pw - 8, "600");
    ctx.font = `600 ${fs}px ${FONT}`;
    ctx.fillStyle = "#228be6";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("동작은 그대로, 스킨만 바꾼다", x + pw / 2, cy + noteFs / 2);
  }
  cy += noteFs;
  return cy - y;
}

// 전체를 그리고(또는 높이만 계산하고) 캔버스 높이를 반환한다
function drawAll(ctx: SvgDrawingContext, w: number, render: boolean): number {
  const s = w / BASE_W;
  const isMobile = w < 480;

  if (isMobile) {
    const pw = w - PAD * 2;
    const gap = 28;
    const h1 = drawCoupledPanel(ctx, PAD, PAD, pw, s, false);
    if (render) {
      drawCoupledPanel(ctx, PAD, PAD, pw, s, true);
      drawHeadlessPanel(ctx, PAD, PAD + h1 + gap, pw, s, true);
    }
    const h2 = drawHeadlessPanel(ctx, PAD, PAD + h1 + gap, pw, s, false);
    return PAD * 2 + h1 + gap + h2;
  }

  const gap = Math.max(24 * s, 20);
  const pw = (w - PAD * 2 - gap) / 2;
  const h1 = drawCoupledPanel(ctx, PAD, PAD, pw, s, false);
  const h2 = drawHeadlessPanel(ctx, PAD + pw + gap, PAD, pw, s, false);
  const maxH = Math.max(h1, h2);
  if (render) {
    // 짧은 쪽 패널은 세로 가운데에 오도록 맞춘다
    drawCoupledPanel(ctx, PAD, PAD + (maxH - h1) / 2, pw, s, true);
    drawHeadlessPanel(ctx, PAD + pw + gap, PAD + (maxH - h2) / 2, pw, s, true);
  }
  return PAD * 2 + maxH;
}

export const HeadlessAnatomyDiagram = ({ caption }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<SvgCanvasHandle>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const w = container.clientWidth;
      if (w <= 0) return;
      const dpr = window.devicePixelRatio || 1;

      const h = drawAll(ctx, w, false);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);
      drawAll(ctx, w, true);
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
