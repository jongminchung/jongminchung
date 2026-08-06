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
const MONO = "SFMono-Regular, Menlo, Consolas, monospace";

const TYPE_COLORS: Record<string, string> = {
  fix: "#fa5252",
  feat: "#228be6",
  perf: "#fab005",
  refactor: "#845ef7",
  test: "#40c057",
  docs: "#868e96",
  chore: "#adb5bd",
};

type RowKind = "decided" | "shadowed" | "normal";

const ROWS: Array<{ question: string; type: string; kind: RowKind }> = [
  { question: "사용자가 겪던 잘못된 동작이 사라지는가?", type: "fix", kind: "decided" },
  { question: "사용자에게 보이는 동작이 새로 생기는가?", type: "feat", kind: "normal" },
  { question: "측정 가능한 성능 개선이 목적인가?", type: "perf", kind: "normal" },
  { question: "동작은 같고 코드 구조만 바뀌는가?", type: "refactor", kind: "shadowed" },
  { question: "테스트만 바뀌는가?", type: "test", kind: "normal" },
  { question: "문서만 바뀌는가?", type: "docs", kind: "normal" },
  { question: "어디에도 해당하지 않는가?", type: "chore", kind: "normal" },
];

interface Props {
  caption?: string;
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
  dash?: number[],
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  if (dash) ctx.setLineDash(dash);
  ctx.stroke();
  if (dash) ctx.setLineDash([]);
}

function drawVArrow(
  ctx: SvgDrawingContext,
  x: number,
  y1: number,
  y2: number,
  color: string,
  s: number,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y1);
  ctx.lineTo(x, y2);
  ctx.stroke();
  const size = 5 * s;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y2 + 1);
  ctx.lineTo(x - size * 0.6, y2 - size);
  ctx.lineTo(x + size * 0.6, y2 - size);
  ctx.closePath();
  ctx.fill();
}

// measureText 기반 줄바꿈. 현재 ctx.font 기준으로 maxW를 넘지 않게 나눈다.
function wrapText(ctx: SvgDrawingContext, text: string, maxW: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const cand = cur ? `${cur} ${word}` : word;
    if (!cur || ctx.measureText(cand).width <= maxW) {
      cur = cand;
    } else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// 알약형 뱃지. 그린 너비를 반환한다.
function drawPill(
  ctx: SvgDrawingContext,
  x: number,
  cy: number,
  text: string,
  bg: string,
  fg: string,
  fs: number,
  s: number,
  mono: boolean,
): number {
  ctx.font = `700 ${fs}px ${mono ? MONO : FONT}`;
  const padX = 7 * s;
  const w = ctx.measureText(text).width + padX * 2;
  const h = fs + 8 * s;
  drawRoundRect(ctx, x, cy - h / 2, w, h, 4 * s, bg, bg, 1);
  ctx.fillStyle = fg;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + padX, cy + 0.5);
  return w;
}

function measurePill(
  ctx: SvgDrawingContext,
  text: string,
  fs: number,
  s: number,
  mono: boolean,
): number {
  ctx.font = `700 ${fs}px ${mono ? MONO : FONT}`;
  return ctx.measureText(text).width + 14 * s;
}

function draw(ctx: SvgDrawingContext, w: number): number {
  const s = w / 640;
  const titleFs = Math.max(12 * s, 10);
  const qFs = Math.max(12 * s, 10);
  const badgeFs = Math.max(11 * s, 10);
  const smallFs = Math.max(10 * s, 10);
  const headerFs = Math.max(11 * s, 10);

  const pad = 2;
  const numW = 24 * s;
  const rowX = pad + numW + 6 * s;
  const rowW = w - rowX - pad;
  const rowPadX = 10 * s;
  const lineH = qFs * 1.4;
  const cx = w / 2;

  ctx.textBaseline = "middle";

  let y = 4 * s;

  // ── 상단: 입력 diff 박스 ──
  ctx.font = `700 ${smallFs}px ${FONT}`;
  ctx.fillStyle = "#868e96";
  ctx.textAlign = "center";
  ctx.fillText("입력 diff", cx, y + smallFs / 2);
  y += smallFs + 8 * s;

  const diffTitle = "버그 수정 + 함수 추출 리팩터링이 섞인 diff";
  const tags: Array<{ text: string; fg: string; bg: string }> = [
    { text: "잘못된 동작이 사라짐", fg: "#fa5252", bg: "#fff5f5" },
    { text: "코드 구조가 바뀜", fg: "#845ef7", bg: "#f3f0ff" },
  ];
  const boxPadX = 14 * s;
  const boxPadY = 10 * s;
  const maxInnerW = w - pad * 2 - boxPadX * 2;

  ctx.font = `600 ${titleFs}px ${FONT}`;
  const titleLines = wrapText(ctx, diffTitle, maxInnerW);
  const titleBlockW = Math.max(...titleLines.map((l) => ctx.measureText(l).width));

  const tagH = smallFs + 8 * s;
  const tagPadX = 8 * s;
  ctx.font = `600 ${smallFs}px ${FONT}`;
  const tagWs = tags.map((t) => ctx.measureText(t.text).width + tagPadX * 2);
  const tagGap = 8 * s;
  const tagsRowW = tagWs[0] + tagWs[1] + tagGap;
  const stackTags = tagsRowW > maxInnerW;
  const tagsBlockW = stackTags ? Math.max(...tagWs) : tagsRowW;
  const tagsBlockH = stackTags ? tagH * 2 + 4 * s : tagH;

  const innerW = Math.min(Math.max(titleBlockW, tagsBlockW), maxInnerW);
  const boxW = innerW + boxPadX * 2;
  const boxH = boxPadY * 2 + titleLines.length * lineH + 6 * s + tagsBlockH;
  const boxX = cx - boxW / 2;

  drawRoundRect(ctx, boxX, y, boxW, boxH, 6 * s, "#f8f9fa", "#adb5bd");
  ctx.fillStyle = "#495057";
  ctx.font = `600 ${titleFs}px ${FONT}`;
  ctx.textAlign = "center";
  titleLines.forEach((line, i) => {
    ctx.fillText(line, cx, y + boxPadY + i * lineH + lineH / 2);
  });

  let tagY = y + boxPadY + titleLines.length * lineH + 6 * s + tagH / 2;
  if (stackTags) {
    tags.forEach((tag, i) => {
      const tx = cx - tagWs[i] / 2;
      const tcy = tagY + i * (tagH + 4 * s);
      drawRoundRect(ctx, tx, tcy - tagH / 2, tagWs[i], tagH, 4 * s, tag.bg, tag.fg, 1);
      ctx.fillStyle = tag.fg;
      ctx.font = `600 ${smallFs}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillText(tag.text, tx + tagWs[i] / 2, tcy + 0.5);
    });
  } else {
    let tx = cx - tagsRowW / 2;
    tags.forEach((tag, i) => {
      drawRoundRect(ctx, tx, tagY - tagH / 2, tagWs[i], tagH, 4 * s, tag.bg, tag.fg, 1);
      ctx.fillStyle = tag.fg;
      ctx.font = `600 ${smallFs}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillText(tag.text, tx + tagWs[i] / 2, tagY + 0.5);
      tx += tagWs[i] + tagGap;
    });
  }
  y += boxH;

  // ── 화살표: diff → 사다리 ──
  const arrowLen = 20 * s;
  drawVArrow(ctx, cx, y + 2, y + arrowLen, "#adb5bd", s);
  y += arrowLen + 8 * s;

  // ── 사다리 헤더 ──
  ctx.font = `700 ${headerFs}px ${FONT}`;
  ctx.fillStyle = "#868e96";
  ctx.textAlign = "left";
  ctx.fillText("위에서부터 검사해서 처음 걸리는 단이 타입을 결정한다", rowX, y + headerFs / 2);
  y += headerFs + 10 * s;

  // ── 사다리 7단 ──
  const rowGap = 14 * s;
  const numCx = pad + numW / 2;

  for (let i = 0; i < ROWS.length; i++) {
    const row = ROWS[i];
    const color = TYPE_COLORS[row.type];

    // 우측 요소 폭 계산 (타입 뱃지 + 부가 라벨)
    const badgeW = measurePill(ctx, row.type, badgeFs, s, true);
    let extraW = 0;
    if (row.kind === "decided") {
      extraW = measurePill(ctx, "여기서 결정!", smallFs, s, false) + 6 * s;
    } else if (row.kind === "shadowed") {
      ctx.font = `700 ${smallFs}px ${FONT}`;
      extraW = ctx.measureText("걸리지만 순서에서 밀림").width + 6 * s;
    }

    // 질문 영역 폭: 넘치면 wrapText가 여러 줄로 나눈다
    const availQ = Math.max(rowW - rowPadX * 2 - badgeW - extraW - 8 * s, 60 * s);
    ctx.font = `${row.kind === "decided" ? 600 : 400} ${qFs}px ${FONT}`;
    const qLines = wrapText(ctx, row.question, availQ);
    const badgeH = badgeFs + 8 * s;
    const rowH = Math.max(qLines.length * lineH, badgeH) + 14 * s;
    const rowCy = y + rowH / 2;

    // 검사 순서 번호
    ctx.font = `700 ${badgeFs}px ${FONT}`;
    ctx.fillStyle = row.kind === "decided" ? "#495057" : "#adb5bd";
    ctx.textAlign = "center";
    ctx.fillText(String(i + 1), numCx, rowCy);

    // 단 박스
    if (row.kind === "decided") {
      drawRoundRect(ctx, rowX, y, rowW, rowH, 6 * s, "#ebfbee", "#40c057", 2);
    } else if (row.kind === "shadowed") {
      ctx.globalAlpha = 0.8;
      drawRoundRect(ctx, rowX, y, rowW, rowH, 6 * s, "#fff9db", "#fab005", 1.5, [5 * s, 4 * s]);
    } else {
      drawRoundRect(ctx, rowX, y, rowW, rowH, 6 * s, "#f8f9fa", "#dee2e6");
    }

    // 질문 텍스트
    ctx.fillStyle =
      row.kind === "decided" ? "#495057" : row.kind === "shadowed" ? "#495057" : "#868e96";
    ctx.font = `${row.kind === "decided" ? 600 : 400} ${qFs}px ${FONT}`;
    ctx.textAlign = "left";
    const qTop = rowCy - (qLines.length * lineH) / 2;
    qLines.forEach((line, k) => {
      ctx.fillText(line, rowX + rowPadX, qTop + k * lineH + lineH / 2);
    });

    // 타입 뱃지 (+ 부가 라벨)
    const badgeX = rowX + rowW - rowPadX - badgeW - extraW;
    if (row.kind === "normal") ctx.globalAlpha = 0.45;
    drawPill(ctx, badgeX, rowCy, row.type, color, "#fff", badgeFs, s, true);
    if (row.kind === "normal") ctx.globalAlpha = 1;

    if (row.kind === "decided") {
      drawPill(
        ctx,
        badgeX + badgeW + 6 * s,
        rowCy,
        "여기서 결정!",
        "#40c057",
        "#fff",
        smallFs,
        s,
        false,
      );
    } else if (row.kind === "shadowed") {
      ctx.fillStyle = "#f08c00";
      ctx.font = `700 ${smallFs}px ${FONT}`;
      ctx.textAlign = "left";
      ctx.fillText("걸리지만 순서에서 밀림", badgeX + badgeW + 6 * s, rowCy + 0.5);
      ctx.globalAlpha = 1;
    }

    y += rowH;

    // 1단 아래: 결정 결과
    if (row.kind === "decided") {
      const resultFs = Math.max(12 * s, 10);
      const resultBadgeFs = Math.max(12 * s, 10);
      const resultH = resultBadgeFs + 8 * s + 10 * s;
      const resultCy = y + resultH / 2 + 2 * s;
      const label = "→ 이 커밋의 타입은";
      const rBadgeW = measurePill(ctx, "fix:", resultBadgeFs, s, true);
      ctx.font = `600 ${resultFs}px ${FONT}`;
      const labelW = ctx.measureText(label).width;
      const rBadgeX = rowX + rowW - rowPadX - rBadgeW;
      ctx.fillStyle = "#495057";
      ctx.textAlign = "left";
      ctx.fillText(label, rBadgeX - 8 * s - labelW, resultCy);
      drawPill(ctx, rBadgeX, resultCy, "fix:", "#fa5252", "#fff", resultBadgeFs, s, true);
      y += resultH;
    }

    // 다음 단으로 내려가는 화살표
    if (i < ROWS.length - 1) {
      drawVArrow(ctx, numCx, y + 2, y + rowGap - 2, "#adb5bd", s);
      y += rowGap;
    }
  }

  // ── 하단 주석 ──
  y += 14 * s;
  ctx.font = `${smallFs}px ${FONT}`;
  ctx.fillStyle = "#adb5bd";
  ctx.textAlign = "center";
  ctx.fillText(
    "성격이 여러 개 섞여 있어도 타입은 위에서 먼저 걸린 하나로 정해진다",
    cx,
    y + smallFs / 2,
  );
  y += smallFs + 10 * s;

  return y;
}

export const LadderDiagram = ({ caption }: Props) => {
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
