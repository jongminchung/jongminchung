// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  SvgCanvas,
  type SvgCanvasHandle,
  type SvgDrawingContext,
  type SvgGradient,
} from "#components/materials/runtime/svg-canvas";

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

/* ── colour palette ── */
const BLUE_BG = "#e7f5ff";
const BLUE_BD = "#228be6";
const GREEN_BG = "#ebfbee";
const GREEN_BD = "#40c057";
const YELLOW_BG = "#fff9db";
const YELLOW_BD = "#fab005";
const RED_BG = "#fff5f5";
const RED_BD = "#fa5252";
const TEXT_MAIN = "#495057";
const TEXT_SEC = "#868e96";

/* ── hit region for tooltip ── */
interface HitBox {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  tip: string;
}

/* ── drawing helpers ── */
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

function drawArrow(
  ctx: SvgDrawingContext,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  s: number,
  color = "#adb5bd",
) {
  const headLen = 6 * s;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // arrowhead (pointing upward for vertical arrows)
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLen * Math.cos(angle - Math.PI / 6),
    y2 - headLen * Math.sin(angle - Math.PI / 6),
  );
  ctx.lineTo(
    x2 - headLen * Math.cos(angle + Math.PI / 6),
    y2 - headLen * Math.sin(angle + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawScene(ctx: SvgDrawingContext, w: number, hitBoxes: HitBox[]): number {
  hitBoxes.length = 0; // reset

  const s = w / 540;
  const titleFs = Math.max(13 * s, 11);
  const labelFs = Math.max(11 * s, 10);
  const smallFs = Math.max(9 * s, 8);
  const r = 6 * s;

  const centerX = w / 2;
  const boxW = Math.min(220 * s, w * 0.42);
  const boxH = 30 * s;
  const gap = 14 * s;
  const arrowGap = 6 * s;

  let curY = 20 * s;

  /* helper: draw a single labelled block, register hitbox, return bottom y */
  const block = (
    label: string,
    tip: string,
    bg: string,
    bd: string,
    textColor: string,
    bw = boxW,
    bh = boxH,
  ) => {
    const bx = centerX - bw / 2;
    drawRoundRect(ctx, bx, curY, bw, bh, r, bg, bd, 1.2);
    ctx.fillStyle = textColor;
    ctx.font = `bold ${labelFs}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, centerX, curY + bh / 2);
    hitBoxes.push({ x: bx, y: curY, w: bw, h: bh, label, tip });
    const bottom = curY + bh;
    curY = bottom + gap;
    return bottom;
  };

  const arrow = (fromBottom: number) => {
    drawArrow(ctx, centerX, curY - arrowGap * 0.3, centerX, fromBottom + arrowGap * 0.3, s);
  };

  /* ── 1. 다음 토큰 확률 (top label) ── */
  ctx.fillStyle = TEXT_MAIN;
  ctx.font = `bold ${titleFs}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("다음 토큰 확률", centerX, curY + boxH / 2);
  const topLabelBottom = curY + boxH;
  curY += boxH + gap;

  /* ── 2. Linear (출력 헤드) ── */
  let bottom = block(
    "Linear (출력 헤드)",
    "임베딩 차원에서 어휘 크기로 변환하여 각 토큰의 점수(logits)를 계산합니다. 여기에 softmax를 적용하면 다음 토큰 확률 분포가 됩니다.",
    RED_BG,
    RED_BD,
    "#c92a2a",
  );
  // Linear 상단 → 다음 토큰 확률 하단 화살표 (위 방향)
  drawArrow(
    ctx,
    centerX,
    bottom - boxH - arrowGap * 0.3,
    centerX,
    topLabelBottom + arrowGap * 0.3,
    s,
  );
  arrow(bottom);

  /* ── 3. Final RMSNorm ── */
  bottom = block(
    "RMSNorm",
    "최종 정규화 단계로, Transformer 블록의 출력을 안정화합니다. RMSNorm은 평균을 빼지 않고 RMS로만 정규화합니다.",
    YELLOW_BG,
    YELLOW_BD,
    "#e67700",
  );
  arrow(bottom);

  /* ── 4. N× Transformer Block (big container) ── */
  const tbOuterW = Math.min(320 * s, w * 0.62);
  const tbOuterX = centerX - tbOuterW / 2;
  const tbPad = 12 * s;
  const innerBoxW = tbOuterW - tbPad * 2;
  const innerBoxH = 26 * s;
  const innerGap = 10 * s;

  // Pre-calculate inner height
  // 6 inner rows: +res, MLP, RMSNorm, +res, Attn, RMSNorm  →  6*innerBoxH + 5*innerGap + label area
  const labelArea = 22 * s;
  const innerContentH = labelArea + 6 * innerBoxH + 5 * innerGap;
  const tbOuterH = innerContentH + tbPad * 2;

  // Draw outer container (dashed border for the repeated block)
  ctx.strokeStyle = "#adb5bd";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5 * s, 4 * s]);
  ctx.beginPath();
  ctx.roundRect(tbOuterX, curY, tbOuterW, tbOuterH, 8 * s);
  ctx.stroke();
  ctx.setLineDash([]);

  // "N× Transformer Block" label at top inside
  ctx.fillStyle = TEXT_SEC;
  ctx.font = `bold ${labelFs}px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText("N× Transformer Block", tbOuterX + tbPad, curY + labelArea / 2 + 4 * s);

  hitBoxes.push({
    x: tbOuterX,
    y: curY,
    w: tbOuterW,
    h: tbOuterH,
    label: "N× Transformer Block",
    tip: "Transformer 블록이 N번 반복됩니다. 각 블록은 Self-Attention과 MLP로 구성됩니다.",
  });

  const tbContainerTop = curY;
  let iy = curY + labelArea + tbPad;

  const innerBlock = (
    label: string,
    tip: string,
    bg: string,
    bd: string,
    textColor: string,
    bh = innerBoxH,
  ) => {
    const bx = tbOuterX + tbPad;
    drawRoundRect(ctx, bx, iy, innerBoxW, bh, r, bg, bd, 1.2);
    ctx.fillStyle = textColor;
    ctx.font = `bold ${Math.max(10 * s, 9)}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, centerX, iy + bh / 2);
    hitBoxes.push({ x: bx, y: iy, w: innerBoxW, h: bh, label, tip });
    const bot = iy + bh;
    iy += bh + innerGap;
    return bot;
  };

  const innerArrow = (fromBot: number) => {
    drawArrow(ctx, centerX, iy - arrowGap * 0.2, centerX, fromBot + arrowGap * 0.2, s);
  };

  // 데이터는 아래→위로 흐르므로 위에서부터 역순으로 그린다
  // (아래→위 읽기: RMSNorm → Attn → +res → RMSNorm → MLP → +res)
  // Sub-block 1 (최상단): + (Residual Connection)
  let ib = innerBlock(
    "+ (Residual)",
    "잔차 연결로 MLP의 입력을 출력에 더합니다.",
    "#f8f9fa",
    "#adb5bd",
    TEXT_MAIN,
  );
  innerArrow(ib);

  // Sub-block 2: MLP (SwiGLU)
  ib = innerBlock(
    "MLP (SwiGLU)",
    "SwiGLU 게이트 구조로 비선형 변환을 수행합니다. 세 개의 선형 레이어와 SiLU 활성화를 사용합니다.",
    GREEN_BG,
    GREEN_BD,
    "#2b8a3e",
  );
  innerArrow(ib);

  // Sub-block 3: RMSNorm
  ib = innerBlock(
    "RMSNorm",
    "두 번째 RMSNorm입니다. MLP 이전에 적용됩니다.",
    YELLOW_BG,
    YELLOW_BD,
    "#e67700",
  );
  innerArrow(ib);

  // Sub-block 4: + (Residual Connection)
  ib = innerBlock(
    "+ (Residual)",
    "잔차 연결로 입력을 출력에 더합니다. 기울기 소실을 방지합니다.",
    "#f8f9fa",
    "#adb5bd",
    TEXT_MAIN,
  );
  innerArrow(ib);

  // Sub-block 5: CausalSelfAttention
  ib = innerBlock(
    "CausalSelfAttention",
    "Query, Key, Value를 사용한 인과적 어텐션입니다. 미래 토큰을 마스킹합니다.",
    BLUE_BG,
    BLUE_BD,
    "#1971c2",
  );
  innerArrow(ib);

  // Sub-block 6 (최하단): RMSNorm
  ib = innerBlock(
    "RMSNorm",
    "입력을 RMS(제곱평균제곱근)로 나누어 정규화합니다. Pre-Norm 방식으로 학습을 안정화합니다.",
    YELLOW_BG,
    YELLOW_BD,
    "#e67700",
  );

  curY = tbContainerTop + tbOuterH + gap;
  arrow(tbContainerTop + tbOuterH);

  /* ── 5. Dropout ── */
  bottom = block(
    "Dropout",
    "과적합을 방지하기 위해 학습 시 일부 뉴런의 출력을 무작위로 0으로 만듭니다.",
    "#f8f9fa",
    "#adb5bd",
    TEXT_MAIN,
  );
  arrow(bottom);

  /* ── 6. Token Embedding ── */
  bottom = block(
    "Token Embedding",
    "토큰 id를 벡터로 변환합니다. 위치 정보는 RoPE가 Attention 내부에서 처리하므로 별도의 위치 임베딩이 없습니다.",
    BLUE_BG,
    BLUE_BD,
    "#1971c2",
  );
  arrow(bottom);

  /* ── 7. 입력 토큰 (bottom) ── */
  const inputBoxW = boxW;
  const inputBoxX = centerX - inputBoxW / 2;
  drawRoundRect(ctx, inputBoxX, curY, inputBoxW, boxH, r, "#f8f9fa", "#adb5bd", 1.2);
  ctx.fillStyle = TEXT_MAIN;
  ctx.font = `bold ${labelFs}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("입력 토큰", centerX, curY + boxH / 2);
  hitBoxes.push({
    x: inputBoxX,
    y: curY,
    w: inputBoxW,
    h: boxH,
    label: "입력 토큰",
    tip: "모델에 입력되는 텍스트를 토크나이저가 토큰 단위로 분할한 것입니다.",
  });

  curY += boxH + 10 * s;

  return curY;
}

interface TooltipState {
  x: number;
  y: number;
  tip: string;
}

export const TransformerBlockDiagram = ({ caption }: { caption?: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<SvgCanvasHandle>(null);
  const hitBoxesRef = useRef<HitBox[]>([]);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const draw = () => {
      const w = container.clientWidth;
      if (w === 0) return;
      const dpr = window.devicePixelRatio || 1;
      const ctx = canvas.getContext("2d")!;
      const hitBoxes: HitBox[] = [];

      // 높이 사전 계산 (drawScene의 레이아웃과 동일)
      const s = w / 540;
      const boxH = 30 * s;
      const gap = 14 * s;
      const innerBoxH = 26 * s;
      const innerGap = 10 * s;
      const tbPad = 12 * s;
      const labelArea = 22 * s;
      const innerContentH = labelArea + 6 * innerBoxH + 5 * innerGap;
      const tbOuterH = innerContentH + tbPad * 2;
      // 구성: 상단여백 + 텍스트행 + 출력헤드 + RMSNorm + TB블록 + Dropout + 임베딩행 + 입력행 + 하단여백
      const h =
        20 * s +
        (boxH + gap) +
        (boxH + gap) * 2 +
        (tbOuterH + gap) +
        (boxH + gap) +
        (boxH + gap) +
        (boxH + 10 * s);

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);
      drawScene(ctx, w, hitBoxes);
      hitBoxesRef.current = hitBoxes;
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<SvgCanvasHandle>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Check hit boxes in reverse order (topmost drawn last)
    const boxes = hitBoxesRef.current;
    for (let i = boxes.length - 1; i >= 0; i--) {
      const b = boxes[i];
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
        setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, tip: b.tip });
        canvas.style.cursor = "pointer";
        return;
      }
    }
    setTooltip(null);
    canvas.style.cursor = "default";
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
    if (canvasRef.current) canvasRef.current.style.cursor = "default";
  }, []);

  return (
    <figure>
      <div ref={containerRef} style={{ position: "relative" }}>
        <SvgCanvas
          ref={canvasRef}
          style={{ display: "block", width: "100%" }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
        {tooltip && (
          <div
            style={{
              position: "absolute",
              left: tooltip.x,
              top: tooltip.y - 40,
              transform: "translateX(-50%)",
              background: "#343a40",
              color: "#fff",
              padding: "6px 12px",
              borderRadius: 6,
              fontSize: 12,
              fontFamily: FONT,
              lineHeight: 1.5,
              maxWidth: 260,
              pointerEvents: "none",
              whiteSpace: "pre-wrap",
              zIndex: 10,
              boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
            }}
          >
            {tooltip.tip}
          </div>
        )}
      </div>
      {caption && <figcaption dangerouslySetInnerHTML={{ __html: caption }} />}
    </figure>
  );
};
