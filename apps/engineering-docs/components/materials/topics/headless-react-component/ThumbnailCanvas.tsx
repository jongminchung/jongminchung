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

function chevron(
  ctx: SvgDrawingContext,
  cx: number,
  cy: number,
  size: number,
  color: string,
  lw: number,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx - size, cy - size * 0.5);
  ctx.lineTo(cx, cy + size * 0.5);
  ctx.lineTo(cx + size, cy - size * 0.5);
  ctx.stroke();
}

// 와이어프레임 셀렉트: 점선 테두리, 회색 — "뼈대(로직)만 있는 컴포넌트"
function drawWireframeSelect(ctx: SvgDrawingContext, x: number, y: number, w: number) {
  const trigH = 96;
  const rowH = 84;
  const rowGap = 14;
  const listPad = 20;
  const listY = y + trigH + 22;
  const listH = listPad * 2 + rowH * 3 + rowGap * 2;

  ctx.save();
  ctx.setLineDash([14, 10]);

  // 트리거 버튼
  rr(ctx, x, y, w, trigH, 18, "rgba(255,255,255,0.75)", "#adb5bd", 5);
  ctx.setLineDash([]);
  rr(ctx, x + 30, y + trigH / 2 - 13, w * 0.5, 26, 13, "#dee2e6");
  chevron(ctx, x + w - 52, y + trigH / 2 - 2, 16, "#adb5bd", 6);
  ctx.setLineDash([14, 10]);

  // 옵션 목록 컨테이너
  rr(ctx, x, listY, w, listH, 18, "rgba(255,255,255,0.75)", "#adb5bd", 5);

  ctx.setLineDash([]);
  for (let i = 0; i < 3; i++) {
    const ry = listY + listPad + i * (rowH + rowGap);
    ctx.setLineDash([10, 8]);
    rr(ctx, x + listPad, ry, w - listPad * 2, rowH, 14, null, "#ced4da", 4);
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(x + listPad + 42, ry + rowH / 2, 13, 0, Math.PI * 2);
    ctx.fillStyle = "#dee2e6";
    ctx.fill();
    rr(
      ctx,
      x + listPad + 74,
      ry + rowH / 2 - 11,
      (w - listPad * 2) * (0.42 + (i % 2) * 0.14),
      22,
      11,
      "#e9ecef",
    );
  }

  ctx.restore();
  return { bottom: listY + listH };
}

// 컬러 스킨 셀렉트: 같은 구조에 색만 입힌 작은 버전 — "스킨을 갈아끼운다"
interface Skin {
  border: string;
  trigBg: string;
  bar: string;
  selectedBg: string;
  selectedBar: string;
}

function drawSkinnedSelect(
  ctx: SvgDrawingContext,
  cx: number,
  cy: number,
  w: number,
  skin: Skin,
  angle: number,
) {
  const trigH = 58;
  const rowH = 46;
  const rowGap = 8;
  const listPad = 12;
  const listH = listPad * 2 + rowH * 3 + rowGap * 2;
  const totalH = trigH + 14 + listH;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  const x = -w / 2;
  const y = -totalH / 2;

  ctx.save();
  ctx.shadowColor = "rgba(30,50,80,0.18)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 12;
  rr(ctx, x, y, w, trigH, 12, skin.trigBg);
  rr(ctx, x, y + trigH + 14, w, listH, 12, "#ffffff");
  ctx.restore();

  // 트리거
  rr(ctx, x, y, w, trigH, 12, null, skin.border, 4);
  rr(ctx, x + 18, y + trigH / 2 - 8, w * 0.46, 16, 8, skin.bar);
  chevron(ctx, x + w - 32, y + trigH / 2 - 1, 10, skin.border, 4);

  // 옵션 목록
  const listY = y + trigH + 14;
  rr(ctx, x, listY, w, listH, 12, null, skin.border, 4);
  for (let i = 0; i < 3; i++) {
    const ry = listY + listPad + i * (rowH + rowGap);
    if (i === 0) {
      rr(ctx, x + listPad, ry, w - listPad * 2, rowH, 9, skin.selectedBg);
      rr(
        ctx,
        x + listPad + 16,
        ry + rowH / 2 - 7,
        (w - listPad * 2) * 0.5,
        14,
        7,
        skin.selectedBar,
      );
    } else {
      rr(
        ctx,
        x + listPad + 16,
        ry + rowH / 2 - 7,
        (w - listPad * 2) * (0.42 + i * 0.1),
        14,
        7,
        "#e9ecef",
      );
    }
  }

  ctx.restore();
}

// 와이어프레임 → 스킨으로 이어지는 점선 커넥터
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
  rr(ctx, 116, 300, 96, 14, 7, "#228be6");
  ctx.fillStyle = "#212529";
  ctx.font = `800 150px ${FONT}`;
  ctx.fillText("Headless", 110, 470);
  ctx.fillStyle = "#495057";
  ctx.font = `700 78px ${FONT}`;
  ctx.fillText("React 컴포넌트", 116, 580);

  // 중앙 와이어프레임 셀렉트 (로직/뼈대)
  const wfX = 810,
    wfY = 190,
    wfW = 430;
  const wf = drawWireframeSelect(ctx, wfX, wfY, wfW);

  // 커넥터: 와이어프레임 → 각 스킨
  drawConnector(ctx, wfX + wfW + 6, wfY + 60, 1298, 250, "rgba(34,139,230,0.55)");
  drawConnector(ctx, wfX + wfW + 6, wfY + 330, 1288, 620, "rgba(250,176,5,0.6)");
  drawConnector(ctx, wfX + 60, wf.bottom + 6, 560, 760, "rgba(132,94,247,0.55)");

  // 컬러 스킨 셀렉트 3종
  const blue: Skin = {
    border: "#228be6",
    trigBg: "#e7f5ff",
    bar: "#a5cff5",
    selectedBg: "#228be6",
    selectedBar: "rgba(255,255,255,0.85)",
  };
  const yellow: Skin = {
    border: "#fab005",
    trigBg: "#fff9db",
    bar: "#ffe066",
    selectedBg: "#fab005",
    selectedBar: "rgba(255,255,255,0.9)",
  };
  const purple: Skin = {
    border: "#845ef7",
    trigBg: "#f3f0ff",
    bar: "#d0bfff",
    selectedBg: "#845ef7",
    selectedBar: "rgba(255,255,255,0.85)",
  };

  drawSkinnedSelect(ctx, 1420, 320, 240, blue, 0.06);
  drawSkinnedSelect(ctx, 1408, 730, 240, yellow, -0.05);
  drawSkinnedSelect(ctx, 430, 800, 240, purple, 0.05);
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
