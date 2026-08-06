// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useEffect, useRef, useState } from "react";
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
const MONO = '"SF Mono", Menlo, "Roboto Mono", "Courier New", monospace';

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

function drawArrowhead(
  ctx: SvgDrawingContext,
  x: number,
  y: number,
  angle: number,
  size: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - size * Math.cos(angle - Math.PI / 6), y - size * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x - size * Math.cos(angle + Math.PI / 6), y - size * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

interface PanelArgs {
  ctx: SvgDrawingContext;
  x: number;
  y: number;
  w: number;
  phase: number;
  isCorrect: boolean;
  scale: number;
}

// phase semantics:
// 0       : idle
// 0~0.20  : 에러 발생 (db.findUser 빨갛게)
// 0.20~0.70: 화살표가 위로 전파
// 0.70~1  : 결과 표시

function drawPanel(args: PanelArgs): number {
  const { ctx, x, y, w, phase, isCorrect, scale } = args;
  const titleFs = Math.max(13 * scale, 12);
  const codeFs = Math.max(11 * scale, 10);
  const labelFs = Math.max(11 * scale, 10);
  const smallFs = Math.max(10 * scale, 9);
  const stackFs = Math.max(11 * scale, 10);

  let cy = y;

  // ── 제목 ──
  ctx.fillStyle = isCorrect ? "#37b24d" : "#f03e3e";
  ctx.font = `700 ${titleFs}px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(isCorrect ? "return await db.findUser(id)" : "return db.findUser(id)", x, cy);
  cy += titleFs + 4;

  // 보조 라벨
  ctx.fillStyle = "#868e96";
  ctx.font = `500 ${smallFs}px ${FONT}`;
  ctx.fillText(isCorrect ? "✓ 올바른 코드" : "✗ await가 빠진 코드", x, cy);
  cy += smallFs + 12;

  // ── 코드 박스 ──
  const codeBg = "#1e1f24";
  const codeLineH = codeFs + 5;
  const codePadV = 12;
  const codePadH = 14;
  const codeLines: Array<[string, string]> = isCorrect
    ? [
        ["async function getUser(id) {", "#dcdcdc"],
        ["  try {", "#dcdcdc"],
        ["    return await db.findUser(id);", "#69db7c"],
        ["  } catch (e) { log(e); }", "#dcdcdc"],
        ["}", "#dcdcdc"],
      ]
    : [
        ["async function getUser(id) {", "#dcdcdc"],
        ["  try {", "#dcdcdc"],
        ["    return db.findUser(id);", "#ff8787"],
        ["  } catch (e) { log(e); }", "#5c5f66"],
        ["}", "#dcdcdc"],
      ];

  const codeBoxH = codeLines.length * codeLineH + codePadV * 2;
  drawRoundRect(ctx, x, cy, w, codeBoxH, 8, codeBg, null);

  ctx.font = `${codeFs}px ${MONO}`;
  ctx.textBaseline = "top";
  for (let i = 0; i < codeLines.length; i++) {
    ctx.fillStyle = codeLines[i][1];
    ctx.fillText(codeLines[i][0], x + codePadH, cy + codePadV + i * codeLineH);
  }
  cy += codeBoxH + 22;

  // ── 콜 스택 라벨 ──
  ctx.fillStyle = "#868e96";
  ctx.font = `600 ${smallFs}px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("호출 스택", x, cy);
  cy += smallFs + 8;

  // ── 콜 스택 박스 (3단) ──
  const boxH = 40 * scale;
  const boxGap = 10 * scale;
  const arrowChannel = 26 * scale; // 우측 화살표 영역
  const stackW = w - arrowChannel;

  const stackItems = [
    { label: "caller", accent: "#495057", y: cy },
    { label: "getUser (try/catch)", accent: "#228be6", y: cy + boxH + boxGap },
    { label: "db.findUser", accent: "#fd7e14", y: cy + 2 * (boxH + boxGap) },
  ];

  for (let i = 0; i < stackItems.length; i++) {
    const item = stackItems[i];
    const isErrorSite = i === 2;
    const isMiddle = i === 1;

    let fill = "#ffffff";
    let stroke = "#dee2e6";
    let textColor = item.accent;
    let alpha = 1;

    // 오른쪽 패널: getUser 프레임은 await 없이 return하면서 이미 사라짐
    if (!isCorrect && isMiddle) {
      const fadeOut = Math.min(phase * 2.5, 1);
      alpha = 1 - 0.65 * fadeOut;
    }

    if (isErrorSite && phase > 0) {
      const intensity = Math.min(phase / 0.2, 1);
      fill = `rgb(${255}, ${245 - 5 * intensity}, ${245 - 5 * intensity})`;
      stroke = "#fa5252";
      textColor = "#c92a2a";
    }

    if (isCorrect && isMiddle && phase > 0.6) {
      const catchT = Math.min((phase - 0.6) / 0.25, 1);
      const g = Math.round(245 - 5 * catchT);
      fill = `rgb(232, ${g}, 232)`;
      stroke = "#37b24d";
      textColor = "#2b8a3e";
    }

    ctx.globalAlpha = alpha;
    drawRoundRect(ctx, x, item.y, stackW, boxH, 8, fill, stroke);

    ctx.fillStyle = textColor;
    ctx.font = `600 ${stackFs}px ${MONO}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(item.label, x + 14, item.y + boxH / 2);

    // 오른쪽 패널, getUser가 흐릿하면 "← 이미 return됨" 라벨
    if (!isCorrect && isMiddle && phase > 0.3) {
      ctx.globalAlpha = Math.min((phase - 0.3) / 0.2, 1);
      ctx.fillStyle = "#868e96";
      ctx.font = `500 ${smallFs}px ${FONT}`;
      ctx.textAlign = "right";
      ctx.fillText("이미 return됨", x + stackW - 12, item.y + boxH / 2);
    }

    ctx.globalAlpha = 1;
  }

  const stackBottom = cy + 3 * boxH + 2 * boxGap;

  // ── 에러 흐름 화살표 ──
  // db.findUser 우측 채널 → 위로
  if (phase > 0.15) {
    const arrowX = x + stackW + arrowChannel / 2;
    const startY = stackItems[2].y + boxH / 2;
    // 정상: getUser의 catch까지 (i=1의 중앙)
    // 실수: caller까지 (i=0의 중앙)
    const endY = isCorrect ? stackItems[1].y + boxH / 2 : stackItems[0].y + boxH / 2;
    const progress = Math.min((phase - 0.15) / 0.5, 1);
    const currentY = startY + (endY - startY) * progress;

    // 수직선
    ctx.strokeStyle = "#fa5252";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(arrowX, startY);
    ctx.lineTo(arrowX, currentY);
    ctx.stroke();

    // 진행이 끝나면 박스 안으로 들어가는 가로 화살표
    if (progress >= 1) {
      ctx.beginPath();
      ctx.moveTo(arrowX, currentY);
      ctx.lineTo(x + stackW + 4, currentY);
      ctx.stroke();
      drawArrowhead(ctx, x + stackW + 2, currentY, Math.PI, 7, "#fa5252");
    }

    // 시작점 (db.findUser 위) 작은 동그라미
    ctx.fillStyle = "#fa5252";
    ctx.beginPath();
    ctx.arc(arrowX, startY, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  cy = stackBottom + 18;

  // ── 결과 라벨 ──
  const resultY = cy;
  if (phase > 0.75) {
    const opacity = Math.min((phase - 0.75) / 0.2, 1);
    ctx.globalAlpha = opacity;

    const mainText = isCorrect ? "→ catch 블록이 에러를 받음" : "→ Unhandled Rejection";
    const subText = isCorrect
      ? "스택 트레이스에 getUser 프레임이 보존됨"
      : "스택에서 getUser 프레임이 사라짐";
    const mainColor = isCorrect ? "#2b8a3e" : "#c92a2a";

    // 메인 결과
    const badgeBg = isCorrect ? "#d3f9d8" : "#ffe3e3";
    const badgeBorder = isCorrect ? "#8ce99a" : "#ffa8a8";
    const badgeH = labelFs + 16;
    drawRoundRect(ctx, x, resultY, w, badgeH, 6, badgeBg, badgeBorder, 1);

    ctx.fillStyle = mainColor;
    ctx.font = `700 ${labelFs}px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(mainText, x + 12, resultY + badgeH / 2);

    cy += badgeH + 6;

    // 보조 설명
    ctx.fillStyle = "#868e96";
    ctx.font = `${smallFs}px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(subText, x + 2, cy);
    cy += smallFs + 4;

    ctx.globalAlpha = 1;
  } else {
    // idle/early phase에서도 자리 확보
    cy += labelFs + 16 + 6 + smallFs + 4;
  }

  return cy - y;
}

export const AwaitlessReturnDiagram = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<SvgCanvasHandle>(null);
  const phaseRef = useRef(0);
  const playingRef = useRef(false);
  const startTimeRef = useRef(0);
  const rafRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const calcPanelHeight = (scale: number) => {
    const titleFs = Math.max(13 * scale, 12);
    const codeFs = Math.max(11 * scale, 10);
    const labelFs = Math.max(11 * scale, 10);
    const smallFs = Math.max(10 * scale, 9);
    const codeLineH = codeFs + 5;
    const codeBoxH = 5 * codeLineH + 24;
    const boxH = 40 * scale;
    const boxGap = 10 * scale;
    const stackH = 3 * boxH + 2 * boxGap;
    return (
      titleFs +
      4 +
      smallFs +
      12 +
      codeBoxH +
      22 +
      smallFs +
      8 +
      stackH +
      18 +
      labelFs +
      16 +
      6 +
      smallFs +
      4
    );
  };

  const draw = () => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const w = container.clientWidth;
    const dpr = window.devicePixelRatio || 1;
    const isMobile = w < 560;
    const phase = phaseRef.current;

    let height: number;
    let scale: number;

    if (isMobile) {
      scale = Math.max(w / 460, 0.85);
      const panelH = calcPanelHeight(scale);
      height = panelH * 2 + 32;
    } else {
      const gap = 24;
      const panelW = (w - gap) / 2;
      scale = panelW / 320;
      height = calcPanelHeight(scale);
    }

    canvas.width = w * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, height);

    if (isMobile) {
      const h1 = drawPanel({ ctx, x: 0, y: 0, w, phase, isCorrect: true, scale });
      drawPanel({ ctx, x: 0, y: h1 + 32, w, phase, isCorrect: false, scale });
    } else {
      const gap = 24;
      const panelW = (w - gap) / 2;
      drawPanel({ ctx, x: 0, y: 0, w: panelW, phase, isCorrect: true, scale });
      drawPanel({ ctx, x: panelW + gap, y: 0, w: panelW, phase, isCorrect: false, scale });
    }
  };

  useEffect(() => {
    draw();
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(draw);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const tick = (now: number) => {
    if (!playingRef.current) return;
    if (startTimeRef.current === 0) startTimeRef.current = now;
    const elapsed = (now - startTimeRef.current) / 1000;
    const DURATION = 2.6;
    const HOLD = 1.4;
    const TOTAL = DURATION + HOLD;

    if (elapsed < DURATION) {
      // ease-out
      const p = elapsed / DURATION;
      phaseRef.current = 1 - Math.pow(1 - p, 2);
    } else if (elapsed < TOTAL) {
      phaseRef.current = 1;
    } else {
      phaseRef.current = 0;
      playingRef.current = false;
      startTimeRef.current = 0;
      setIsPlaying(false);
      draw();
      return;
    }

    draw();
    rafRef.current = scheduleMaterialFrame(tick);
  };

  const handlePlay = () => {
    if (playingRef.current) return;
    playingRef.current = true;
    startTimeRef.current = 0;
    phaseRef.current = 0;
    setIsPlaying(true);
    rafRef.current = scheduleMaterialFrame(tick);
  };

  useEffect(() => {
    return () => cancelMaterialFrame(rafRef.current);
  }, []);

  return (
    <div
      style={{
        border: "1px solid #dee2e6",
        borderRadius: 8,
        padding: 20,
        margin: "24px 0",
        background: "#fff",
      }}
    >
      <div ref={containerRef}>
        <SvgCanvas ref={canvasRef} style={{ display: "block", width: "100%" }} />
      </div>
      <div style={{ textAlign: "center", marginTop: 16 }}>
        <button
          onClick={handlePlay}
          disabled={isPlaying}
          style={{
            padding: "10px 22px",
            borderRadius: 6,
            border: "none",
            background: isPlaying ? "#adb5bd" : "#fa5252",
            color: "#fff",
            fontSize: 13,
            fontFamily: FONT,
            cursor: isPlaying ? "default" : "pointer",
            fontWeight: 600,
            transition: "background 0.15s",
          }}
        >
          {isPlaying ? "진행 중..." : "에러 발생 ▶"}
        </button>
      </div>
    </div>
  );
};
