// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useEffect, useRef } from "react";
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

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = 'Menlo, Monaco, "Courier New", monospace';

function drawRoundRect(
  ctx: SvgDrawingContext,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string | null,
  stroke: string | null,
  lineWidth = 1.5,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

interface SceneArgs {
  ctx: SvgDrawingContext;
  w: number;
  t: number;
  scale: number;
}

const T1 = 1.0;
const T2 = 2.0;
const T3 = 3.0;
const T_REVEAL = 4.0;
const T_END = 6.0;
const CYCLE = 7.2;

function drawScene(args: SceneArgs): number {
  const { ctx, w, t, scale } = args;

  const phase: "idle" | "calling" | "reveal" | "pause" =
    t < T1 ? "idle" : t < T_REVEAL ? "calling" : t < T_END ? "reveal" : "pause";
  const callCount = t < T1 ? 0 : t < T2 ? 1 : t < T3 ? 2 : 3;

  const codeFs = Math.max(11 * scale, 10);
  const labelFs = Math.max(11 * scale, 10);
  const smallFs = Math.max(10 * scale, 9);
  const itemFs = Math.max(13 * scale, 11);

  let cy = 0;

  // ── 코드 박스 ──
  const codeBg = "#1e1f24";
  const codeLineH = codeFs + 5;
  const codePadV = 12;
  const codePadH = 14;
  const codeLines: Array<Array<[string, string]>> = [
    [
      ["def add_item(item, items=", "#dcdcdc"],
      ["[]", "#ff8787"],
      ["):", "#dcdcdc"],
    ],
    [["    items.append(item)", "#dcdcdc"]],
    [["    return items", "#dcdcdc"]],
  ];

  const codeBoxH = codeLines.length * codeLineH + codePadV * 2;
  drawRoundRect(ctx, 0, cy, w, codeBoxH, 8, codeBg, null);

  ctx.font = `${codeFs}px ${MONO}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  for (let i = 0; i < codeLines.length; i++) {
    let x = codePadH;
    const segments = codeLines[i];
    for (let s = 0; s < segments.length; s++) {
      ctx.fillStyle = segments[s][1];
      ctx.fillText(segments[s][0], x, cy + codePadV + i * codeLineH);
      x += ctx.measureText(segments[s][0]).width;
    }
  }
  cy += codeBoxH + 24;

  // ── 리스트 라벨 ──
  ctx.fillStyle = "#868e96";
  ctx.font = `500 ${smallFs}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("함수 정의 시점에 한 번 만들어진 같은 리스트", w / 2, cy);
  cy += smallFs + 10;

  // ── 리스트 박스 ──
  const listW = Math.min(w * 0.85, 420 * scale);
  const listX = (w - listW) / 2;
  const listH = 64 * scale;
  const listY = cy;

  const isReveal = phase === "reveal" || phase === "pause";
  const listBg = isReveal ? "#fff5f5" : "#fff9db";
  const listBorder = isReveal ? "#fa5252" : "#fab005";

  drawRoundRect(ctx, listX, listY, listW, listH, 12, listBg, listBorder, 2);

  // [ 와 ] 표시
  const bracketColor = isReveal ? "#fa5252" : "#fab005";
  ctx.fillStyle = bracketColor;
  ctx.font = `700 ${itemFs + 4}px ${MONO}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText("[", listX + 14, listY + listH / 2);
  ctx.textAlign = "right";
  ctx.fillText("]", listX + listW - 14, listY + listH / 2);

  // 항목들
  const items = ['"a"', '"b"', '"c"'];
  const itemW = 50 * scale;
  const itemH = 38 * scale;
  const itemGap = 14 * scale;
  const totalItemsW = callCount * itemW + Math.max(0, callCount - 1) * itemGap;
  const itemsStartX = listX + (listW - totalItemsW) / 2;

  for (let i = 0; i < callCount; i++) {
    const startT = i === 0 ? T1 : i === 1 ? T2 : T3;
    const dur = 0.35;
    const p = Math.min(Math.max((t - startT) / dur, 0), 1);
    // ease out
    const eased = 1 - Math.pow(1 - p, 3);
    const isLatest = i === callCount - 1;
    const alpha = isLatest ? eased : 1;
    const sc = isLatest ? 0.5 + 0.5 * eased : 1;

    const ix = itemsStartX + i * (itemW + itemGap);
    const iy = listY + (listH - itemH) / 2;
    const cxi = ix + itemW / 2;
    const cyi = iy + itemH / 2;

    ctx.globalAlpha = alpha;
    ctx.save();
    ctx.translate(cxi, cyi);
    ctx.scale(sc, sc);
    drawRoundRect(ctx, -itemW / 2, -itemH / 2, itemW, itemH, 6, "#fff", "#fd7e14", 1.5);
    ctx.fillStyle = "#fd7e14";
    ctx.font = `700 ${itemFs}px ${MONO}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(items[i], 0, 0);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  const listBottom = listY + listH;
  cy = listBottom + 36;

  // ── 시간축 ──
  const axisY = cy;
  const axisLeft = 30;
  const axisRight = w - 30;

  ctx.strokeStyle = "#dee2e6";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(axisLeft, axisY);
  ctx.lineTo(axisRight, axisY);
  ctx.stroke();

  ctx.fillStyle = "#dee2e6";
  ctx.beginPath();
  ctx.moveTo(axisRight, axisY);
  ctx.lineTo(axisRight - 8, axisY - 4);
  ctx.lineTo(axisRight - 8, axisY + 4);
  ctx.closePath();
  ctx.fill();

  // 시간축 라벨
  ctx.fillStyle = "#adb5bd";
  ctx.font = `500 ${smallFs}px ${FONT}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText("호출 순서 →", axisRight - 4, axisY - 6);

  const callCodes = ['add_item("a")', 'add_item("b")', 'add_item("c")'];
  const callXs: number[] = [];
  for (let i = 0; i < 3; i++) {
    const cxC = axisLeft + ((axisRight - axisLeft) / 3) * (i + 0.5);
    callXs.push(cxC);
  }

  // 호출에서 리스트로 가는 화살표 (활성 호출에 대해 표시)
  for (let i = 0; i < callCount; i++) {
    const startT = i === 0 ? T1 : i === 1 ? T2 : T3;
    const dur = 0.35;
    const p = Math.min(Math.max((t - startT) / dur, 0), 1);
    const isLatest = i === callCount - 1 && phase === "calling";
    const alpha = isLatest ? p : 0.25;
    const cxC = callXs[i];

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "#fd7e14";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cxC, axisY - 10);
    ctx.lineTo(cxC, listBottom + 6);
    ctx.stroke();
    ctx.setLineDash([]);

    // 화살표 머리 (위쪽)
    ctx.fillStyle = "#fd7e14";
    ctx.beginPath();
    ctx.moveTo(cxC, listBottom + 4);
    ctx.lineTo(cxC - 4, listBottom + 10);
    ctx.lineTo(cxC + 4, listBottom + 10);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // 호출 점들과 라벨
  for (let i = 0; i < 3; i++) {
    const cxC = callXs[i];
    const isActive = i < callCount;
    const isCurrent = i === callCount - 1 && phase === "calling";

    // 펄스
    if (isCurrent) {
      const startT = i === 0 ? T1 : i === 1 ? T2 : T3;
      const pulseT = ((t - startT) % 0.8) / 0.8;
      const pulseR = 6 + 10 * pulseT;
      const pulseAlpha = 0.5 * (1 - pulseT);
      ctx.globalAlpha = pulseAlpha;
      ctx.strokeStyle = "#fd7e14";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cxC, axisY, pulseR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // 점
    ctx.fillStyle = isActive ? "#fd7e14" : "#dee2e6";
    ctx.beginPath();
    ctx.arc(cxC, axisY, 6, 0, Math.PI * 2);
    ctx.fill();

    // 라벨
    ctx.fillStyle = isActive ? "#495057" : "#adb5bd";
    ctx.font = `${isActive ? "600" : "500"} ${smallFs}px ${MONO}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(callCodes[i], cxC, axisY + 12);
  }

  cy = axisY + 12 + smallFs + 22;

  // ── 메시지 ──
  const msgPadV = 12;
  const msgGap = 5;
  const msgBoxH = msgPadV * 2 + labelFs + msgGap + smallFs;

  if (isReveal) {
    const fadeIn = Math.min((t - T_REVEAL) / 0.5, 1);
    ctx.globalAlpha = fadeIn;
    const msg1 = '같은 리스트가 호출 사이에 공유되어 ["a", "b", "c"]가 누적된다';
    const msg2 = "기본 인자는 함수 정의 시점에 단 한 번만 평가되기 때문이다";

    drawRoundRect(ctx, 0, cy, w, msgBoxH, 8, "#fff5f5", "#fa5252", 1);
    ctx.fillStyle = "#c92a2a";
    ctx.font = `700 ${labelFs}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(msg1, w / 2, cy + msgPadV);

    ctx.fillStyle = "#868e96";
    ctx.font = `500 ${smallFs}px ${FONT}`;
    ctx.fillText(msg2, w / 2, cy + msgPadV + labelFs + msgGap);
    ctx.globalAlpha = 1;
  }
  cy += msgBoxH + 8;

  return cy;
}

interface Props {
  caption?: string;
}

export const MutableDefaultArgDiagram = ({ caption }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<SvgCanvasHandle>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const start = performance.now();
    let raf = 0;

    const draw = () => {
      const w = container.clientWidth;
      const dpr = window.devicePixelRatio || 1;
      const scale = Math.max(w / 540, 0.85);

      const codeFs = Math.max(11 * scale, 10);
      const labelFs = Math.max(11 * scale, 10);
      const smallFs = Math.max(10 * scale, 9);
      const codeLineH = codeFs + 5;
      const codeBoxH = 3 * codeLineH + 24;
      const listH = 64 * scale;
      const msgBoxH = 24 + labelFs + 5 + smallFs;

      const height =
        codeBoxH + 24 + smallFs + 10 + listH + 36 + smallFs + 12 + smallFs + 22 + msgBoxH + 8;

      canvas.width = w * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, height);

      const now = performance.now();
      const t = ((now - start) / 1000) % CYCLE;
      drawScene({ ctx, w, t, scale });

      raf = scheduleMaterialFrame(draw);
    };

    draw();
    const ro = new ResizeObserver(() => {});
    ro.observe(container);

    return () => {
      cancelMaterialFrame(raf);
      ro.disconnect();
    };
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
