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
const MONO = "SFMono-Regular, ui-monospace, monospace";

const COLORS = {
  primary: "#228be6",
  primaryBg: "#e7f5ff",
  bg: "#f8f9fa",
  border: "#dee2e6",
  borderDark: "#adb5bd",
  text: "#495057",
  textLight: "#868e96",
  textFaint: "#adb5bd",
  white: "#ffffff",
};

interface Props {
  caption?: string;
}

interface Seg {
  text: string;
  color: string;
  fs: number;
  weight?: number;
  mono?: boolean;
}

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
  dashed = false,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  if (dashed) ctx.setLineDash([4, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
}

// 여러 폰트/색 조각을 한 줄로 그린다. maxW를 넘으면 비율대로 축소.
function drawSegs(
  ctx: SvgDrawingContext,
  segs: Seg[],
  x: number,
  y: number,
  align: "left" | "center",
  maxW?: number,
) {
  const fontOf = (seg: Seg, scale: number) =>
    `${seg.weight ?? 400} ${seg.fs * scale}px ${seg.mono ? MONO : FONT}`;
  const measure = (scale: number) =>
    segs.reduce((sum, seg) => {
      ctx.font = fontOf(seg, scale);
      return sum + ctx.measureText(seg.text).width;
    }, 0);

  let scale = 1;
  if (maxW) {
    const total = measure(1);
    if (total > maxW) scale = maxW / total;
  }

  let sx = align === "center" ? x - measure(scale) / 2 : x;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (const seg of segs) {
    ctx.font = fontOf(seg, scale);
    ctx.fillStyle = seg.color;
    ctx.fillText(seg.text, sx, y);
    sx += ctx.measureText(seg.text).width;
  }
}

function drawHArrow(ctx: SvgDrawingContext, x1: number, x2: number, y: number, s: number) {
  ctx.strokeStyle = COLORS.borderDark;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  const size = Math.max(5 * s, 4);
  ctx.fillStyle = COLORS.borderDark;
  ctx.beginPath();
  ctx.moveTo(x2 + 1, y);
  ctx.lineTo(x2 - size, y - size * 0.6);
  ctx.lineTo(x2 - size, y + size * 0.6);
  ctx.closePath();
  ctx.fill();
}

function drawVArrow(ctx: SvgDrawingContext, x: number, y1: number, y2: number, s: number) {
  ctx.strokeStyle = COLORS.borderDark;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y1);
  ctx.lineTo(x, y2);
  ctx.stroke();
  const size = Math.max(5 * s, 4);
  ctx.fillStyle = COLORS.borderDark;
  ctx.beginPath();
  ctx.moveTo(x, y2 + 1);
  ctx.lineTo(x - size * 0.6, y2 - size);
  ctx.lineTo(x + size * 0.6, y2 - size);
  ctx.closePath();
  ctx.fill();
}

// 사용자 요청 말풍선. tail: 꼬리 방향
function drawBubble(
  ctx: SvgDrawingContext,
  x: number,
  y: number,
  w: number,
  h: number,
  s: number,
  tail: "right" | "bottom",
) {
  const labelFs = Math.max(11 * s, 10);
  drawRoundRect(ctx, x, y, w, h, 10 * s, COLORS.bg, COLORS.borderDark);

  // 꼬리
  ctx.fillStyle = COLORS.bg;
  ctx.strokeStyle = COLORS.borderDark;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (tail === "right") {
    const cy = y + h / 2;
    ctx.moveTo(x + w - 1, cy - 5 * s);
    ctx.lineTo(x + w + 7 * s, cy);
    ctx.lineTo(x + w - 1, cy + 5 * s);
  } else {
    const cx = x + w / 2;
    ctx.moveTo(cx - 5 * s, y + h - 1);
    ctx.lineTo(cx, y + h + 7 * s);
    ctx.lineTo(cx + 5 * s, y + h - 1);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const maxW = w - 16 * s;
  drawSegs(
    ctx,
    [{ text: "이 diff로", color: COLORS.text, fs: labelFs, weight: 600 }],
    x + w / 2,
    y + h / 2 - 8 * s,
    "center",
    maxW,
  );
  drawSegs(
    ctx,
    [{ text: "커밋 메시지 써줘", color: COLORS.text, fs: labelFs, weight: 600 }],
    x + w / 2,
    y + h / 2 + 8 * s,
    "center",
    maxW,
  );
}

// 컨텍스트 창 컨테이너를 그리고, 전체 높이와 스킬 목차 블록의 세로 중심을 돌려준다.
function drawContextWindow(
  ctx: SvgDrawingContext,
  x: number,
  y: number,
  cw: number,
  s: number,
): { h: number; tocCy: number } {
  const titleFs = Math.max(12 * s, 10);
  const labelFs = Math.max(11 * s, 10);
  const smallFs = Math.max(10 * s, 10);

  const pad = 14 * s;
  const innerX = x + pad;
  const innerW = cw - pad * 2;

  const sysH = 32 * s;
  const gap1 = 10 * s;
  const tocPad = 8 * s;
  const tocTitleH = 18 * s;
  const rowH = 22 * s;
  const rowGap = 4 * s;
  const tocH = tocPad + tocTitleH + rowH * 3 + rowGap * 2 + tocPad;
  const gap2 = 20 * s;
  const loadedH = 32 * s;

  const blocksY = y + 30 * s;
  const tocY = blocksY + sysH + gap1;
  const loadedY = tocY + tocH + gap2;
  const contH = 30 * s + sysH + gap1 + tocH + gap2 + loadedH + pad;

  // 컨테이너
  drawRoundRect(ctx, x, y, cw, contH, 10 * s, COLORS.bg, COLORS.border);
  drawSegs(
    ctx,
    [{ text: "에이전트 컨텍스트 창", color: COLORS.text, fs: titleFs, weight: 700 }],
    x + cw / 2,
    y + 16 * s,
    "center",
    innerW,
  );

  // 1. 시스템 프롬프트
  drawRoundRect(ctx, innerX, blocksY, innerW, sysH, 6 * s, COLORS.white, COLORS.border, 1);
  drawSegs(
    ctx,
    [
      { text: "시스템 프롬프트", color: COLORS.text, fs: labelFs, weight: 600 },
      { text: "  항상 상주", color: COLORS.textLight, fs: smallFs },
    ],
    innerX + innerW / 2,
    blocksY + sysH / 2,
    "center",
    innerW - 16 * s,
  );

  // 2. 스킬 목차
  drawRoundRect(ctx, innerX, tocY, innerW, tocH, 6 * s, COLORS.white, COLORS.border, 1);
  drawSegs(
    ctx,
    [
      { text: "스킬 목차", color: COLORS.text, fs: labelFs, weight: 600 },
      { text: " — 항상 상주 (~80 tokens)", color: COLORS.textLight, fs: smallFs },
    ],
    innerX + tocPad + 4 * s,
    tocY + tocPad + tocTitleH / 2,
    "left",
    innerW - tocPad * 2 - 8 * s,
  );

  const rows = [
    { name: "commit-message", desc: " — 커밋 메시지를 쓸 때", active: true },
    { name: "api-error-convention", desc: " — 에러 응답을 다룰 때", active: false },
    { name: "db-migration", desc: " — 마이그레이션을 만들 때", active: false },
  ];

  const rowX = innerX + tocPad;
  const rowW = innerW - tocPad * 2;
  let highlightCy = 0;

  rows.forEach((row, i) => {
    const ry = tocY + tocPad + tocTitleH + i * (rowH + rowGap);
    const rcy = ry + rowH / 2;
    if (row.active) {
      drawRoundRect(ctx, rowX, ry, rowW, rowH, 4 * s, COLORS.primaryBg, COLORS.primary, 1.5);
      highlightCy = rcy;
      // ● 매치 표시
      ctx.fillStyle = COLORS.primary;
      ctx.beginPath();
      ctx.arc(rowX + 10 * s, rcy, Math.max(3 * s, 2.5), 0, Math.PI * 2);
      ctx.fill();
    } else {
      drawRoundRect(ctx, rowX, ry, rowW, rowH, 4 * s, COLORS.bg, COLORS.border, 1);
    }
    const tx = rowX + (row.active ? 18 * s : 10 * s);
    drawSegs(
      ctx,
      [
        {
          text: row.name,
          mono: true,
          fs: smallFs,
          weight: 600,
          color: row.active ? COLORS.primary : COLORS.textLight,
        },
        { text: row.desc, fs: smallFs, color: row.active ? COLORS.text : COLORS.textFaint },
      ],
      tx,
      rcy,
      "left",
      rowX + rowW - tx - 8 * s,
    );
  });

  // 3. 본문 로드됨 블록
  drawRoundRect(
    ctx,
    innerX,
    loadedY,
    innerW,
    loadedH,
    6 * s,
    COLORS.primaryBg,
    COLORS.primary,
    1.5,
  );
  drawSegs(
    ctx,
    [
      { text: "commit-message", mono: true, fs: labelFs, weight: 600, color: COLORS.primary },
      { text: " 본문 로드됨", fs: labelFs, weight: 600, color: COLORS.primary },
      { text: " (~450 tokens)", fs: smallFs, color: COLORS.textLight },
    ],
    innerX + innerW / 2,
    loadedY + loadedH / 2,
    "center",
    innerW - 16 * s,
  );

  // 하이라이트 행 → 본문 블록 연결선 (오른쪽 꺾은선)
  const elbowX = innerX + innerW + 7 * s;
  const loadedCy = loadedY + loadedH / 2;
  ctx.strokeStyle = COLORS.primary;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(rowX + rowW, highlightCy);
  ctx.lineTo(elbowX, highlightCy);
  ctx.lineTo(elbowX, loadedCy);
  ctx.lineTo(innerX + innerW + 2, loadedCy);
  ctx.stroke();
  const ah = Math.max(4.5 * s, 4);
  ctx.fillStyle = COLORS.primary;
  ctx.beginPath();
  ctx.moveTo(innerX + innerW - 1, loadedCy);
  ctx.lineTo(innerX + innerW + ah, loadedCy - ah * 0.6);
  ctx.lineTo(innerX + innerW + ah, loadedCy + ah * 0.6);
  ctx.closePath();
  ctx.fill();

  return { h: contH, tocCy: tocY + tocH / 2 };
}

// 로드되지 않은 스킬 본문 블록 (컨텍스트 창 바깥)
function drawUnloadedBlock(
  ctx: SvgDrawingContext,
  x: number,
  y: number,
  w: number,
  h: number,
  s: number,
  name: string,
) {
  const smallFs = Math.max(10 * s, 10);
  drawRoundRect(ctx, x, y, w, h, 6 * s, COLORS.bg, COLORS.borderDark, 1, true);
  drawSegs(
    ctx,
    [
      { text: name, mono: true, fs: smallFs, weight: 600, color: COLORS.textFaint },
      { text: " 본문", fs: smallFs, color: COLORS.textFaint },
    ],
    x + w / 2,
    y + h / 2 - 8 * s,
    "center",
    w - 12 * s,
  );
  drawSegs(
    ctx,
    [{ text: "로드되지 않음 · 토큰 0", fs: smallFs, color: COLORS.textFaint }],
    x + w / 2,
    y + h / 2 + 8 * s,
    "center",
    w - 12 * s,
  );
}

function drawHorizontal(ctx: SvgDrawingContext, w: number): number {
  const s = w / 640;
  const smallFs = Math.max(10 * s, 10);
  const margin = 16 * s;

  const bubbleW = 150 * s;
  const bubbleH = 56 * s;
  const contX = margin + bubbleW + 44 * s;
  const contW = w - contX - margin;
  const contY = 12 * s;

  // 컨텍스트 창
  const { h: contH, tocCy } = drawContextWindow(ctx, contX, contY, contW, s);

  // 말풍선 (스킬 목차 블록 높이에 맞춰 정렬)
  const bubbleY = tocCy - bubbleH / 2;
  drawBubble(ctx, margin, bubbleY, bubbleW, bubbleH, s, "right");
  drawSegs(
    ctx,
    [{ text: "사용자 요청", fs: smallFs, color: COLORS.textLight }],
    margin + bubbleW / 2,
    bubbleY + bubbleH + 12 * s,
    "center",
    bubbleW,
  );

  // 말풍선 → 컨텍스트 창 화살표
  drawHArrow(ctx, margin + bubbleW + 10 * s, contX - 3 * s, bubbleY + bubbleH / 2, s);

  // 컨텍스트 창 바깥: 로드되지 않은 본문들
  const unY = contY + contH + 16 * s;
  const unH = 46 * s;
  const unGap = 12 * s;
  const unW = (contW - unGap) / 2;
  drawUnloadedBlock(ctx, contX, unY, unW, unH, s, "api-error-convention");
  drawUnloadedBlock(ctx, contX + unW + unGap, unY, unW, unH, s, "db-migration");

  return unY + unH + 16 * s;
}

function drawVertical(ctx: SvgDrawingContext, w: number): number {
  const s = w / 420;
  const smallFs = Math.max(10 * s, 10);
  const margin = 14 * s;
  const contW = w - margin * 2;
  const cx = w / 2;

  let y = 10 * s;

  // 말풍선
  const bubbleW = Math.min(210 * s, contW);
  const bubbleH = 52 * s;
  drawBubble(ctx, cx - bubbleW / 2, y, bubbleW, bubbleH, s, "bottom");
  drawSegs(
    ctx,
    [{ text: "사용자 요청", fs: smallFs, color: COLORS.textLight }],
    cx,
    y + bubbleH + 16 * s,
    "center",
    contW,
  );
  y += bubbleH + 24 * s;

  // ↓ 화살표
  drawVArrow(ctx, cx, y, y + 22 * s, s);
  y += 30 * s;

  // 컨텍스트 창
  const { h: contH } = drawContextWindow(ctx, margin, y, contW, s);
  y += contH + 14 * s;

  // 컨텍스트 창 바깥: 로드되지 않은 본문들 (세로 배치)
  const unH = 42 * s;
  drawUnloadedBlock(ctx, margin, y, contW, unH, s, "api-error-convention");
  y += unH + 8 * s;
  drawUnloadedBlock(ctx, margin, y, contW, unH, s, "db-migration");
  y += unH;

  return y + 14 * s;
}

function draw(ctx: SvgDrawingContext, w: number): number {
  return w < 480 ? drawVertical(ctx, w) : drawHorizontal(ctx, w);
}

export const ProgressiveDisclosureDiagram = ({ caption }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<SvgCanvasHandle>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const render = () => {
      const w = container.clientWidth;
      const dpr = window.devicePixelRatio || 1;
      const ctx = canvas.getContext("2d")!;

      canvas.width = 1;
      canvas.height = 1;
      const h = draw(ctx, w);

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);
      draw(ctx, w);
    };

    render();
    const observer = new ResizeObserver(render);
    observer.observe(container);
    return () => observer.disconnect();
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
