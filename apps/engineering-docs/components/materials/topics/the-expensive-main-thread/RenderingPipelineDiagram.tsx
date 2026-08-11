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

// 파이프라인 단계: [한글, 영문, 메인스레드 여부]
const STAGES: [string, string, boolean][] = [
  ["rAF", "JavaScript", true],
  ["스타일", "Style", true],
  ["레이아웃", "Layout", true],
  ["페인트", "Paint", true],
  ["합성", "Composite", false],
];

type Lang = "ko" | "en";

const STRINGS: Record<
  Lang,
  {
    stages: [string, string][];
    mainThread: string;
    compositorThread: string;
    mainTag: string;
    compositorTag: string;
  }
> = {
  ko: {
    stages: STAGES.map(([title, sub]) => [title, sub]),
    mainThread: "메인 스레드",
    compositorThread: "컴포지터 스레드",
    mainTag: "메인",
    compositorTag: "컴포지터",
  },
  en: {
    stages: [
      ["rAF", "JavaScript"],
      ["Style", ""],
      ["Layout", ""],
      ["Paint", ""],
      ["Composite", ""],
    ],
    mainThread: "Main thread",
    compositorThread: "Compositor thread",
    mainTag: "Main",
    compositorTag: "Compositor",
  },
};

type Strings = (typeof STRINGS)[Lang];

function drawArrow(ctx: SvgDrawingContext, x1: number, y1: number, x2: number, y2: number) {
  ctx.strokeStyle = "#adb5bd";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const a = 5;
  ctx.beginPath();
  ctx.fillStyle = "#adb5bd";
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - a * Math.cos(ang - 0.5), y2 - a * Math.sin(ang - 0.5));
  ctx.lineTo(x2 - a * Math.cos(ang + 0.5), y2 - a * Math.sin(ang + 0.5));
  ctx.closePath();
  ctx.fill();
}

function drawHorizontal(ctx: SvgDrawingContext, w: number, t: Strings): number {
  const s = w / 620;
  const titleFs = Math.max(13 * s, 11);
  const subFs = Math.max(9.5 * s, 8.5);
  const bracketFs = Math.max(11 * s, 10);

  const n = STAGES.length;
  const gap = 12 * s;
  const boxH = 56 * s;
  const boxY = 42 * s;
  const totalGap = gap * (n - 1);
  const boxW = (w - 8 * s - totalGap) / n;
  const startX = 4 * s;

  t.stages.forEach(([title, sub], i) => {
    const main = STAGES[i][2];
    const x = startX + i * (boxW + gap);
    const fill = main ? "#e7f5ff" : "#ebfbee";
    const stroke = main ? "#228be6" : "#40c057";
    const txt = main ? "#1971c2" : "#2f9e44";
    drawRoundRect(ctx, x, boxY, boxW, boxH, 10, fill, stroke, 1.8);
    ctx.fillStyle = txt;
    ctx.font = `700 ${titleFs}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(title, x + boxW / 2, boxY + boxH * (sub ? 0.38 : 0.5));
    if (sub) {
      ctx.fillStyle = main ? "#74c0fc" : "#69db7c";
      ctx.font = `${subFs}px ${FONT}`;
      ctx.fillText(sub, x + boxW / 2, boxY + boxH * 0.72);
    }

    if (i < n - 1) {
      const ax = x + boxW;
      drawArrow(ctx, ax + 1, boxY + boxH / 2, ax + gap - 1, boxY + boxH / 2);
    }
  });

  // ── 그룹 브래킷 ──
  const brY = boxY + boxH + 14 * s;
  const mainCount = STAGES.filter(([, , m]) => m).length;
  const mainLeft = startX;
  const mainRight = startX + mainCount * boxW + (mainCount - 1) * gap;
  const compLeft = startX + mainCount * (boxW + gap);
  const compRight = compLeft + boxW;

  const bracket = (l: number, r: number, color: string, label: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(l, brY);
    ctx.lineTo(l, brY + 6 * s);
    ctx.lineTo(r, brY + 6 * s);
    ctx.lineTo(r, brY);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = `600 ${bracketFs}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(label, (l + r) / 2, brY + 11 * s);
  };
  bracket(mainLeft, mainRight, "#228be6", t.mainThread);
  bracket(compLeft, compRight, "#40c057", t.compositorThread);

  return brY + 32 * s;
}

function drawVertical(ctx: SvgDrawingContext, w: number, t: Strings): number {
  const titleFs = 13;
  const subFs = 10;
  const tagFs = 10;

  // 박스 열과 오른쪽 태그를 합친 전체 폭 기준으로 가운데 정렬한다
  ctx.font = `600 ${tagFs}px ${FONT}`;
  const tagW = Math.max(ctx.measureText(t.mainTag).width, ctx.measureText(t.compositorTag).width);
  const tagGap = 12;
  const boxW = w * 0.62;
  const boxX = (w - (boxW + tagGap + tagW)) / 2;
  const boxH = 46;
  const gapY = 30;
  let y = 8;

  t.stages.forEach(([title, sub], i) => {
    const main = STAGES[i][2];
    const fill = main ? "#e7f5ff" : "#ebfbee";
    const stroke = main ? "#228be6" : "#40c057";
    const txt = main ? "#1971c2" : "#2f9e44";
    drawRoundRect(ctx, boxX, y, boxW, boxH, 10, fill, stroke, 1.8);
    ctx.fillStyle = txt;
    ctx.font = `700 ${titleFs}px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`${title}`, boxX + 16, y + boxH / 2 - (sub ? 8 : 0));
    if (sub) {
      ctx.fillStyle = main ? "#74c0fc" : "#69db7c";
      ctx.font = `${subFs}px ${FONT}`;
      ctx.fillText(sub, boxX + 16, y + boxH / 2 + 9);
    }

    // 오른쪽 태그
    ctx.fillStyle = main ? "#228be6" : "#40c057";
    ctx.font = `600 ${tagFs}px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(main ? t.mainTag : t.compositorTag, boxX + boxW + tagGap, y + boxH / 2);

    if (i < t.stages.length - 1) {
      const cx = boxX + boxW / 2;
      drawArrow(ctx, cx, y + boxH + 3, cx, y + boxH + gapY - 3);
    }
    y += boxH + gapY;
  });

  return y - gapY + boxH + 8;
}

interface Props {
  caption?: string;
  locale?: Lang;
}

export const RenderingPipelineDiagram = ({ caption, locale: lang = "ko" }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<SvgCanvasHandle>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const t = STRINGS[lang];

    const draw = () => {
      const w = container.clientWidth;
      const dpr = window.devicePixelRatio || 1;
      const isMobile = w < 480;
      const ctx = canvas.getContext("2d")!;

      let probeH = isMobile ? 420 : 150 * (w / 620);
      canvas.width = w * dpr;
      canvas.height = probeH * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${probeH}px`;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);
      const h = isMobile ? drawVertical(ctx, w, t) : drawHorizontal(ctx, w, t);
      ctx.restore();

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);
      if (isMobile) drawVertical(ctx, w, t);
      else drawHorizontal(ctx, w, t);
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(container);
    return () => ro.disconnect();
  }, [lang]);

  return (
    <figure>
      <div ref={containerRef}>
        <SvgCanvas ref={canvasRef} style={{ display: "block", width: "100%" }} />
      </div>
      {caption && <figcaption dangerouslySetInnerHTML={{ __html: caption }} />}
    </figure>
  );
};
