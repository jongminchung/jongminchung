// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useEffect, useRef } from "react";
import {
  SvgCanvas,
  type SvgCanvasHandle,
  type SvgDrawingContext,
  type SvgGradient,
} from "#components/materials/runtime/svg-canvas";

// 16:10 썸네일 (3200×2000 PNG로 다운로드). 발행 전 임시 컴포넌트.
const W = 1600;
const H = 1000;
const SCALE = 2;

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

function rr(
  ctx: SvgDrawingContext,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill?: string | null,
  stroke?: string | null,
  lw = 3,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

// 분해된 조각(칩 그룹)으로 뻗어나가는 점선 커넥터
function drawConnector(
  ctx: SvgDrawingContext,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.setLineDash([2, 16]);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const nx = -(y2 - y1) * 0.18;
  const ny = (x2 - x1) * 0.18;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(mx + nx, my + ny, x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(x2, y2, 8, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

// 중앙 컴포넌트 카드: 와이어프레임 느낌의 버튼/스켈레톤 모형
function drawComponentCard(ctx: SvgDrawingContext, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.shadowColor = "rgba(30,50,80,0.2)";
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 14;
  rr(ctx, x, y, w, h, 22, "#ffffff");
  ctx.restore();
  rr(ctx, x, y, w, h, 22, null, "#343a40", 6);

  const pad = 34;
  const innerW = w - pad * 2;

  // 상단: 아바타 원 + 텍스트 스켈레톤 두 줄
  ctx.beginPath();
  ctx.arc(x + pad + 30, y + pad + 30, 30, 0, Math.PI * 2);
  ctx.fillStyle = "#dee2e6";
  ctx.fill();
  rr(ctx, x + pad + 80, y + pad + 8, innerW - 80, 22, 11, "#e9ecef");
  rr(ctx, x + pad + 80, y + pad + 42, (innerW - 80) * 0.62, 18, 9, "#f1f3f5");

  // 중단: 본문 스켈레톤 막대
  rr(ctx, x + pad, y + pad + 96, innerW, 18, 9, "#e9ecef");
  rr(ctx, x + pad, y + pad + 128, innerW * 0.8, 18, 9, "#e9ecef");

  // 하단: 와이어프레임 버튼 모형(점선 테두리 + 막대 + 작은 원)
  const btnH = 62;
  const btnY = y + h - pad - btnH;
  ctx.save();
  ctx.setLineDash([12, 9]);
  rr(ctx, x + pad, btnY, innerW * 0.56, btnH, 14, "rgba(231,245,255,0.6)", "#74c0fc", 5);
  ctx.setLineDash([]);
  rr(ctx, x + pad + 22, btnY + btnH / 2 - 9, innerW * 0.3, 18, 9, "#a5cff5");
  ctx.beginPath();
  ctx.arc(x + pad + innerW * 0.56 - 30, btnY + btnH / 2, 10, 0, Math.PI * 2);
  ctx.fillStyle = "#74c0fc";
  ctx.fill();
  ctx.restore();

  // 버튼 옆 보조 원 버튼 모형
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.arc(x + pad + innerW * 0.56 + 52, btnY + btnH / 2, 24, 0, Math.PI * 2);
  ctx.strokeStyle = "#ced4da";
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.restore();
}

// 칩 그룹: 컬러 라벨 칩 + 작은 흰색 칩들 (살짝 기울임)
interface ChipGroupColor {
  bg: string;
  accent: string;
}

function drawChipGroup(
  ctx: SvgDrawingContext,
  cx: number,
  cy: number,
  label: string,
  chips: string[],
  color: ChipGroupColor,
  angle: number,
) {
  const labelH = 62;
  const chipH = 50;
  const gap = 14;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // 라벨 칩
  ctx.font = `800 34px ${FONT}`;
  const labelW = ctx.measureText(label).width + 76;
  ctx.save();
  ctx.shadowColor = "rgba(30,50,80,0.15)";
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 8;
  rr(ctx, -labelW / 2, -labelH - gap / 2, labelW, labelH, labelH / 2, color.bg);
  ctx.restore();
  rr(ctx, -labelW / 2, -labelH - gap / 2, labelW, labelH, labelH / 2, null, color.accent, 5);
  ctx.fillStyle = color.accent;
  ctx.fillText(label, 0, -gap / 2 - labelH / 2 + 2);

  // 작은 칩들 (가로 나열)
  ctx.font = `700 27px ${FONT}`;
  const chipWs = chips.map((c) => ctx.measureText(c).width + 48);
  const totalW = chipWs.reduce((a, b) => a + b, 0) + gap * (chips.length - 1);
  let cxPos = -totalW / 2;
  for (let i = 0; i < chips.length; i++) {
    ctx.save();
    ctx.shadowColor = "rgba(30,50,80,0.1)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 5;
    rr(ctx, cxPos, gap / 2, chipWs[i], chipH, chipH / 2, "#ffffff");
    ctx.restore();
    rr(ctx, cxPos, gap / 2, chipWs[i], chipH, chipH / 2, null, color.accent, 3.5);
    ctx.fillStyle = "#495057";
    ctx.fillText(chips[i], cxPos + chipWs[i] / 2, gap / 2 + chipH / 2 + 2);
    cxPos += chipWs[i] + gap;
  }

  ctx.restore();
}

// 작은 상태 머신 장식: 점 3개를 화살표로 이은 것
function drawStateMachine(ctx: SvgDrawingContext, x: number, y: number) {
  const gap = 92;
  const r = 11;
  ctx.save();
  ctx.strokeStyle = "rgba(73,80,87,0.3)";
  ctx.fillStyle = "rgba(73,80,87,0.3)";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 0; i < 3; i++) {
    const px = x + i * gap;
    ctx.beginPath();
    ctx.arc(px, y, r, 0, Math.PI * 2);
    if (i === 0) {
      ctx.fill();
    } else {
      ctx.stroke();
    }
    if (i < 2) {
      // 화살표 몸통
      ctx.beginPath();
      ctx.moveTo(px + r + 8, y);
      ctx.lineTo(px + gap - r - 8, y);
      ctx.stroke();
      // 화살촉
      ctx.beginPath();
      ctx.moveTo(px + gap - r - 20, y - 8);
      ctx.lineTo(px + gap - r - 8, y);
      ctx.lineTo(px + gap - r - 20, y + 8);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function draw(ctx: SvgDrawingContext) {
  // 배경: 밝은 그라데이션
  const bg = ctx.createLinearGradient(0, 0, W * 0.5, H);
  bg.addColorStop(0, "#f8f9fa");
  bg.addColorStop(1, "#eef1f5");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 은은한 격자
  ctx.strokeStyle = "rgba(73,80,87,0.05)";
  ctx.lineWidth = 2;
  for (let gx = 80; gx < W; gx += 80) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, H);
    ctx.stroke();
  }
  for (let gy = 80; gy < H; gy += 80) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(W, gy);
    ctx.stroke();
  }

  // 타이틀
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  rr(ctx, 116, 220, 96, 14, 7, "#228be6");
  ctx.fillStyle = "#212529";
  ctx.font = `800 150px ${FONT}`;
  ctx.fillText("컴포넌트", 110, 390);
  ctx.fillText("기반 사고", 110, 560);
  ctx.fillStyle = "#495057";
  ctx.font = `700 60px ${FONT}`;
  ctx.fillText("React 컴포넌트 시리즈", 116, 670);

  // 중앙 컴포넌트 카드
  const cardX = 880,
    cardY = 330,
    cardW = 360,
    cardH = 300;
  drawComponentCard(ctx, cardX, cardY, cardW, cardH);

  // 커넥터: 카드 → 각 칩 그룹
  drawConnector(ctx, cardX + cardW + 6, cardY + 70, 1350, 235, "rgba(34,139,230,0.55)");
  drawConnector(ctx, cardX + cardW + 6, cardY + cardH - 60, 1350, 690, "rgba(64,192,87,0.6)");
  drawConnector(ctx, cardX + 120, cardY + cardH + 6, 950, 800, "rgba(132,94,247,0.55)");

  // 칩 그룹 3종: 뷰 / 데이터 / 로직
  drawChipGroup(
    ctx,
    1420,
    235,
    "뷰",
    ["요소", "스타일"],
    { bg: "#e7f5ff", accent: "#228be6" },
    0.05,
  );
  drawChipGroup(
    ctx,
    1420,
    700,
    "데이터",
    ["props", "상태"],
    { bg: "#d3f9d8", accent: "#40c057" },
    -0.05,
  );
  drawChipGroup(
    ctx,
    990,
    870,
    "로직",
    ["핸들러", "이펙트"],
    { bg: "#f3f0ff", accent: "#845ef7" },
    0.04,
  );

  // 여백 장식: 작은 상태 머신 (점 3개 + 화살표)
  drawStateMachine(ctx, 930, 200);
}

export const ThumbnailCanvas = () => {
  const canvasRef = useRef<SvgCanvasHandle>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = W * SCALE;
    canvas.height = H * SCALE;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(SCALE, SCALE);
    draw(ctx);
  }, []);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "thumbnail.png";
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  return (
    <div style={{ margin: "24px 0" }}>
      <SvgCanvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", borderRadius: 8, border: "1px solid #dee2e6" }}
      />
      <div style={{ textAlign: "center", marginTop: 8 }}>
        <button
          onClick={download}
          style={{
            fontFamily: FONT,
            fontSize: 13,
            padding: "8px 16px",
            borderRadius: 6,
            border: "1px solid #228be6",
            background: "#e7f5ff",
            color: "#228be6",
            cursor: "pointer",
          }}
        >
          썸네일 PNG 다운로드 (3200×2000)
        </button>
      </div>
    </div>
  );
};
