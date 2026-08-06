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

interface Props {
  caption?: string;
}

interface Layer {
  lines: string[]; // 데스크톱(2줄 분할) 라벨
  label: string; // 모바일 한 줄 라벨
  hint: string;
}

const LAYERS: Layer[] = [
  { lines: ["메모리", "캐시"], label: "메모리 캐시", hint: "~0ms" },
  { lines: ["서비스", "워커"], label: "서비스 워커", hint: "~1ms" },
  { lines: ["HTTP 캐시", "(디스크)"], label: "HTTP 캐시 (디스크)", hint: "~1ms" },
  { lines: ["CDN", "엣지"], label: "CDN 엣지", hint: "~수십ms" },
  { lines: ["페이지·", "데이터 캐시"], label: "페이지·데이터 캐시", hint: "~수백ms" },
  { lines: ["DB"], label: "DB", hint: "~수백ms+" },
];

const PRIVATE_LABEL = "사설 캐시 — 사용자 1명의 것";
const SHARED_LABEL = "공유 캐시 — 모든 사용자가 공유";
const ORIGIN_LABEL = "원본 서버";

function drawRoundRect(
  ctx: SvgDrawingContext,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  stroke: string,
  lineWidth = 1,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function arrowH(ctx: SvgDrawingContext, x1: number, x2: number, y: number, lw: number) {
  const head = Math.max(5, lw * 4);
  ctx.strokeStyle = "#228be6";
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2 - head, y);
  ctx.stroke();
  ctx.fillStyle = "#228be6";
  ctx.beginPath();
  ctx.moveTo(x2, y);
  ctx.lineTo(x2 - head, y - head * 0.6);
  ctx.lineTo(x2 - head, y + head * 0.6);
  ctx.closePath();
  ctx.fill();
}

function arrowV(ctx: SvgDrawingContext, y1: number, y2: number, x: number, lw: number) {
  const head = Math.max(5, lw * 4);
  ctx.strokeStyle = "#228be6";
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x, y1);
  ctx.lineTo(x, y2 - head);
  ctx.stroke();
  ctx.fillStyle = "#228be6";
  ctx.beginPath();
  ctx.moveTo(x, y2);
  ctx.lineTo(x - head * 0.6, y2 - head);
  ctx.lineTo(x + head * 0.6, y2 - head);
  ctx.closePath();
  ctx.fill();
}

function drawLayerBox(
  ctx: SvgDrawingContext,
  x: number,
  y: number,
  w: number,
  h: number,
  lines: string[],
  fs: number,
  radius: number,
) {
  drawRoundRect(ctx, x, y, w, h, radius, "#fff", "#adb5bd", 1);
  ctx.font = `600 ${fs}px ${FONT}`;
  ctx.fillStyle = "#495057";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const cx = x + w / 2;
  const cy = y + h / 2;
  const lh = fs * 1.25;
  const startY = cy - ((lines.length - 1) * lh) / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, cx, startY + i * lh);
  });
}

// ── 데스크톱: 좌→우 가로 흐름 ─────────────────────────────
// 기준 너비 640. 모든 좌표는 base 단위 × s.
function drawHorizontal(ctx: SvgDrawingContext, w: number): number {
  const s = w / 640;
  const u = (n: number) => n * s;
  const H = u(134);

  const zoneY = u(8);
  const zoneH = u(118);
  const boxY = u(52);
  const boxW = u(72);
  const boxH = u(48);
  const arrowY = u(76);
  const lw = Math.max(1.2, 1.5 * s);

  // 그룹(존) 박스
  drawRoundRect(ctx, u(50), zoneY, u(272), zoneH, u(8), "#e7f5ff", "#a5d8ff", 1); // 브라우저(사설)
  drawRoundRect(ctx, u(346), zoneY, u(288), zoneH, u(8), "#fff9db", "#ffe066", 1); // CDN+원본(공유)
  // 원본 서버 그룹
  drawRoundRect(ctx, u(446), u(32), u(180), u(88), u(6), "rgba(255,255,255,0.65)", "#adb5bd", 1);

  // 존 라벨
  const zoneFs = Math.max(11 * s, 9);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 ${zoneFs}px ${FONT}`;
  ctx.fillStyle = "#1971c2";
  ctx.fillText(PRIVATE_LABEL, u(60), u(25));
  ctx.fillStyle = "#e67700";
  ctx.fillText(SHARED_LABEL, u(356), u(25));
  ctx.font = `700 ${Math.max(10 * s, 8.5)}px ${FONT}`;
  ctx.fillStyle = "#868e96";
  ctx.fillText(ORIGIN_LABEL, u(454), u(46));

  // 요청 경로 화살표 (박스보다 먼저 그려 경계를 깔끔하게)
  const arrows: Array<[number, number]> = [
    [10, 56], // 요청 → 메모리 캐시
    [132, 148],
    [224, 240],
    [324, 352], // 브라우저 → CDN
    [428, 452], // CDN → 원본 서버
    [528, 544],
  ];
  arrows.forEach(([x1, x2]) => arrowH(ctx, u(x1), u(x2), arrowY, lw));

  // "요청" 라벨
  ctx.font = `700 ${Math.max(11 * s, 9.5)}px ${FONT}`;
  ctx.fillStyle = "#228be6";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("요청", u(8), u(66));

  // 계층 박스 + 속도 힌트
  const boxXs = [58, 150, 242, 354, 454, 546];
  const boxFs = Math.max(10.5 * s, 9);
  const hintFs = Math.max(9.5 * s, 8.5);
  LAYERS.forEach((layer, i) => {
    const x = u(boxXs[i]);
    drawLayerBox(ctx, x, boxY, boxW, boxH, layer.lines, boxFs, u(6));
    ctx.font = `${hintFs}px ${FONT}`;
    ctx.fillStyle = "#868e96";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(layer.hint, x + boxW / 2, u(116));
  });

  return H;
}

// ── 모바일: 위→아래 세로 흐름 ─────────────────────────────
function drawVertical(ctx: SvgDrawingContext, w: number): number {
  const H = 544;
  const pad = 12;
  const boxW = Math.min(180, w - 140);
  const hintW = 70;
  const bx = Math.max(30, (w - (boxW + 8 + hintW)) / 2);
  const cx = bx + boxW / 2;
  const boxH = 40;
  const lw = 1.5;

  // 그룹(존) 박스
  drawRoundRect(ctx, pad, 42, w - pad * 2, 216, 8, "#e7f5ff", "#a5d8ff", 1); // 브라우저(사설)
  drawRoundRect(ctx, pad, 284, w - pad * 2, 248, 8, "#fff9db", "#ffe066", 1); // CDN+원본(공유)
  drawRoundRect(
    ctx,
    pad + 10,
    376,
    w - pad * 2 - 20,
    144,
    6,
    "rgba(255,255,255,0.65)",
    "#adb5bd",
    1,
  );

  // 존 라벨
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 11px ${FONT}`;
  ctx.fillStyle = "#1971c2";
  ctx.fillText(PRIVATE_LABEL, pad + 10, 60);
  ctx.fillStyle = "#e67700";
  ctx.fillText(SHARED_LABEL, pad + 10, 302);
  ctx.font = `700 10px ${FONT}`;
  ctx.fillStyle = "#868e96";
  ctx.fillText(ORIGIN_LABEL, pad + 20, 392);

  // "요청" 라벨 + 진입 화살표
  ctx.font = `700 11px ${FONT}`;
  ctx.fillStyle = "#228be6";
  ctx.textAlign = "center";
  ctx.fillText("요청", cx, 14);
  arrowV(ctx, 20, 38, cx, lw);

  // 박스 y 좌표: 브라우저 3개 → CDN → 원본 2개
  const boxYs = [70, 138, 206, 312, 400, 468];
  // 박스 사이 화살표
  const vArrows: Array<[number, number]> = [
    [112, 136],
    [180, 204],
    [248, 282], // 브라우저 존 → 공유 존
    [354, 372], // CDN → 원본 서버 그룹
    [442, 466],
  ];
  vArrows.forEach(([y1, y2]) => arrowV(ctx, y1, y2, cx, lw));

  // 계층 박스 + 속도 힌트 (오른쪽)
  LAYERS.forEach((layer, i) => {
    const y = boxYs[i];
    drawLayerBox(ctx, bx, y, boxW, boxH, [layer.label], 11, 6);
    ctx.font = `10px ${FONT}`;
    ctx.fillStyle = "#868e96";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(layer.hint, bx + boxW + 8, y + boxH / 2);
  });

  return H;
}

export const CacheLayersDiagram = ({ caption }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<SvgCanvasHandle>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const draw = () => {
      const w = container.clientWidth;
      if (w <= 0) return;
      const dpr = window.devicePixelRatio || 1;
      const isMobile = w < 480;

      // 높이는 레이아웃 공식으로 먼저 확정한다 (잘림/과잉 여백 방지)
      const h = isMobile ? 544 : (134 * w) / 640;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d")!;
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
