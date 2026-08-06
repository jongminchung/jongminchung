// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useEffect, useRef } from "react";
import {
  SvgCanvas,
  type SvgCanvasHandle,
  type SvgDrawingContext,
  type SvgGradient,
} from "@/components/materials/runtime/svg-canvas";

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

function badge(ctx: SvgDrawingContext, cx: number, cy: number, label: string, fill: string) {
  const w = 148,
    h = 60;
  ctx.save();
  ctx.shadowColor = "rgba(30,50,80,0.22)";
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 8;
  rr(ctx, cx - w / 2, cy - h / 2, w, h, h / 2, fill);
  ctx.restore();
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 34px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, cx, cy + 2);
}

function arrow(
  ctx: SvgDrawingContext,
  x1: number,
  x2: number,
  y: number,
  color: string,
  dashed = false,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  if (dashed) ctx.setLineDash([18, 20]);
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2 - 26, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x2, y);
  ctx.lineTo(x2 - 30, y - 18);
  ctx.lineTo(x2 - 30, y + 18);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function draw(ctx: SvgDrawingContext) {
  // 배경: 라이트 그라데이션
  const bg = ctx.createLinearGradient(0, 0, W * 0.4, H);
  bg.addColorStop(0, "#f8f9fa");
  bg.addColorStop(1, "#e7f5ff");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 제목: "프론트엔드 캐싱 전략" ("캐싱"만 파랑)
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.font = `800 96px ${FONT}`;
  const parts: Array<{ text: string; color: string }> = [
    { text: "프론트엔드 ", color: "#212529" },
    { text: "캐싱", color: "#228be6" },
    { text: " 전략", color: "#212529" },
  ];
  const titleW = parts.reduce((a, p) => a + ctx.measureText(p.text).width, 0);
  let tx = (W - titleW) / 2;
  const titleY = 190;
  for (const p of parts) {
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, tx, titleY);
    tx += ctx.measureText(p.text).width;
  }

  // 카드 레이아웃: 브라우저 → CDN → 서버
  const cardW = 360,
    cardH = 400,
    cardY = 340;
  const gap = 140;
  const startX = (W - (cardW * 3 + gap * 2)) / 2;
  const bx = startX; // 브라우저
  const cx = startX + cardW + gap; // CDN
  const sx = startX + (cardW + gap) * 2; // 서버
  const midY = cardY + cardH / 2;

  // 화살표 (카드 뒤에 먼저): 브라우저→CDN 실선 파랑, CDN→서버 점선 회색(도달 안 함)
  arrow(ctx, bx + cardW - 20, cx + 30, midY, "#228be6");
  arrow(ctx, cx + cardW - 20, sx + 30, midY, "#adb5bd", true);

  const cardShadow = (fn: () => void) => {
    ctx.save();
    ctx.shadowColor = "rgba(30,50,80,0.14)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 16;
    fn();
    ctx.restore();
  };

  // --- 브라우저 카드 (캐시 MISS) ---
  cardShadow(() => rr(ctx, bx, cardY, cardW, cardH, 26, "#ffffff"));
  // 윈도우 크롬
  rr(ctx, bx, cardY, cardW, 78, 26, "#f1f3f5");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(bx, cardY + 52, cardW, 26);
  const dotColors = ["#fa5252", "#fab005", "#40c057"];
  dotColors.forEach((c, i) => {
    ctx.beginPath();
    ctx.arc(bx + 42 + i * 40, cardY + 39, 11, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();
  });
  rr(ctx, bx + 160, cardY + 24, cardW - 190, 30, 15, "#e9ecef");
  // 본문 스켈레톤
  rr(ctx, bx + 36, cardY + 110, cardW - 72, 110, 14, "#e7f5ff");
  rr(ctx, bx + 36, cardY + 244, cardW - 72, 22, 11, "#e9ecef");
  rr(ctx, bx + 36, cardY + 284, cardW - 130, 22, 11, "#e9ecef");
  rr(ctx, bx + 36, cardY + 324, cardW - 180, 22, 11, "#e9ecef");
  badge(ctx, bx + cardW - 40, cardY + 4, "MISS", "#fa5252");

  // --- CDN 카드 (캐시 HIT, 강조) ---
  // 뒤에 겹친 엣지 노드 카드들
  rr(ctx, cx + 34, cardY - 34, cardW, cardH, 26, "#d0ebff");
  rr(ctx, cx + 17, cardY - 17, cardW, cardH, 26, "#e7f5ff", "#a5d8ff", 3);
  cardShadow(() => rr(ctx, cx, cardY, cardW, cardH, 26, "#ffffff"));
  rr(ctx, cx, cardY, cardW, cardH, 26, null, "#228be6", 6);
  // 라벨
  ctx.fillStyle = "#228be6";
  ctx.font = `800 52px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("CDN", cx + cardW / 2, cardY + 92);
  // 캐시된 응답 카드
  rr(ctx, cx + 36, cardY + 128, cardW - 72, 120, 14, "#e7f5ff", "#74c0fc", 3);
  rr(ctx, cx + 60, cardY + 154, cardW - 200, 20, 10, "#a5d8ff");
  rr(ctx, cx + 60, cardY + 190, cardW - 150, 20, 10, "#a5d8ff");
  // 신선도 게이지 (max-age)
  const gx = cx + 36,
    gy = cardY + 296,
    gw = cardW - 72,
    gh = 30;
  rr(ctx, gx, gy, gw, gh, 15, "#e9ecef");
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(gx, gy, gw, gh, 15);
  ctx.clip();
  ctx.fillStyle = "#40c057";
  ctx.fillRect(gx, gy, gw * 0.66, gh);
  ctx.fillStyle = "#fab005";
  ctx.fillRect(gx + gw * 0.66, gy, gw * 0.16, gh);
  ctx.restore();
  ctx.fillStyle = "#868e96";
  ctx.font = `600 26px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText("max-age", gx, gy + gh + 40);
  badge(ctx, cx + cardW - 40, cardY + 4, "HIT", "#40c057");

  // --- 서버 카드 (도달하지 않음, 묽은 톤) ---
  cardShadow(() => rr(ctx, sx, cardY, cardW, cardH, 26, "#ffffff"));
  // DB 실린더
  const dbX = sx + cardW / 2,
    dbW = 180,
    dbTop = cardY + 96,
    dbH = 190,
    ery = 26;
  ctx.fillStyle = "#dee2e6";
  ctx.beginPath();
  ctx.ellipse(dbX, dbTop + dbH, dbW / 2, ery, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(dbX - dbW / 2, dbTop, dbW, dbH);
  ctx.fillStyle = "#ced4da";
  ctx.beginPath();
  ctx.ellipse(dbX, dbTop, dbW / 2, ery, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#adb5bd";
  ctx.lineWidth = 3;
  for (const dy of [64, 128]) {
    ctx.beginPath();
    ctx.ellipse(dbX, dbTop + dy, dbW / 2, ery, 0, 0, Math.PI);
    ctx.stroke();
  }
  ctx.fillStyle = "#868e96";
  ctx.font = `700 40px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("서버", dbX, cardY + cardH - 44);

  // 카드 하단 라벨 (브라우저)
  ctx.fillStyle = "#495057";
  ctx.font = `700 40px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("브라우저", bx + cardW / 2, cardY + cardH + 76);
  ctx.fillStyle = "#228be6";
  ctx.fillText("CDN 캐시", cx + cardW / 2, cardY + cardH + 76);
  ctx.fillStyle = "#adb5bd";
  ctx.fillText("오리진", sx + cardW / 2, cardY + cardH + 76);
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
            fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
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
