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

// 시나리오 타임라인 (ms)
const T_PAGE1 = 500; // 1페이지 읽기 시작
const T_INSERT = 2000; // 새 글 등록
const T_INSERT_DUR = 700;
const T_PAGE2 = 3200; // 2페이지 읽기 시작
const T_HOLD_END = 6400; // 결과를 보여주는 시간
const CYCLE = T_HOLD_END;

const SERVER_IDS = [12, 11, 10, 9, 8, 7]; // 최신순, id가 클수록 최신
const PAGE_SIZE = 3;

function clamp01(t: number) {
  return Math.min(1, Math.max(0, t));
}
function easeOut(t: number) {
  return 1 - Math.pow(1 - clamp01(t), 3);
}

function drawItem(
  ctx: SvgDrawingContext,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  opts: {
    fill?: string;
    stroke?: string;
    alpha?: number;
    badge?: string;
    badgeColor?: string;
    fs: number;
  },
) {
  const { fill = "#fff", stroke = "#dee2e6", alpha = 1, badge, badgeColor = "#fa5252", fs } = opts;
  if (alpha <= 0.01) return;
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 5);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = `${fs}px ${FONT}`;
  ctx.fillStyle = "#495057";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + 8, y + h / 2 + 0.5);

  if (badge) {
    ctx.font = `700 ${Math.max(9, fs - 2)}px ${FONT}`;
    const bw = ctx.measureText(badge).width + 10;
    const bx = x + w - bw - 6;
    ctx.beginPath();
    ctx.roundRect(bx, y + h / 2 - 8, bw, 16, 4);
    ctx.fillStyle = badgeColor === "#fa5252" ? "#ffe3e3" : "#d3f9d8";
    ctx.fill();
    ctx.fillStyle = badgeColor;
    ctx.textAlign = "center";
    ctx.fillText(badge, bx + bw / 2, y + h / 2 + 0.5);
    ctx.textAlign = "left";
  }
  ctx.globalAlpha = 1;
}

function colHeader(ctx: SvgDrawingContext, text: string, x: number, y: number, fs: number) {
  ctx.font = `700 ${fs}px ${FONT}`;
  ctx.fillStyle = "#868e96";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, x, y);
}

export const PageShiftDemo = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<SvgCanvasHandle>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let raf = 0;
    const start = performance.now();

    const render = (now: number) => {
      const w = container.clientWidth;
      const dpr = window.devicePixelRatio || 1;
      const e = (now - start) % CYCLE;

      const pad = 8;
      const gap = Math.max(10, w * 0.025);
      const colW = (w - pad * 2 - gap * 2) / 3;
      const fs = Math.max(11, Math.min(13, colW / 11));
      const itemH = Math.max(24, Math.min(30, colW / 5.5));
      const itemGap = 6;
      const headerY = 18;
      const listTop = headerY + 12;
      const rows = SERVER_IDS.length + 1; // 새 글 포함
      const captionH = 34;
      const h = listTop + rows * (itemH + itemGap) + captionH;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      const serverX = pad;
      const offsetX = pad + colW + gap;
      const cursorX = pad + (colW + gap) * 2;

      colHeader(ctx, "서버의 목록 (최신순)", serverX, headerY, fs - 1);
      colHeader(ctx, "오프셋으로 읽은 화면", offsetX, headerY, fs - 1);
      colHeader(ctx, "커서로 읽은 화면", cursorX, headerY, fs - 1);

      const insertP = easeOut((e - T_INSERT) / T_INSERT_DUR);
      const rowY = (visualIndex: number) => listTop + visualIndex * (itemH + itemGap);

      // --- 서버 목록 ---
      // 새 글(글 13): 위에서 내려오며 등장
      drawItem(ctx, serverX, rowY(0) - (1 - insertP) * 8, colW, itemH, "새 글 13", {
        fill: "#fff9db",
        stroke: "#fab005",
        alpha: insertP,
        fs,
      });
      // 기존 글: 새 글이 들어오면 한 칸씩 밀려 내려간다
      SERVER_IDS.forEach((id, i) => {
        const y = rowY(i + insertP);
        const inPage1 = i < PAGE_SIZE && e >= T_PAGE1 && e < T_INSERT;
        drawItem(ctx, serverX, y, colW, itemH, `글 ${id}`, {
          fill: inPage1 ? "#e7f5ff" : "#fff",
          stroke: inPage1 ? "#228be6" : "#dee2e6",
          fs,
        });
      });

      // 2페이지 읽기 시점의 창 표시
      if (e >= T_PAGE2 - 300) {
        // 오프셋 창: "위치 3~5번째"라는 고정 위치 (새 글 포함해서 센다)
        const wy1 = rowY(PAGE_SIZE);
        const wy2 = rowY(PAGE_SIZE + PAGE_SIZE - 1) + itemH;
        ctx.strokeStyle = "#fa5252";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(serverX - 3, wy1 - 3, colW + 6, wy2 - wy1 + 6);
        ctx.setLineDash([]);
        ctx.font = `700 ${Math.max(9, fs - 3)}px ${FONT}`;
        ctx.fillStyle = "#fa5252";
        ctx.fillText('OFFSET 3: 항상 "4~6번째"', serverX + 2, wy2 + 13);
      }
      if (e >= T_PAGE1 + 900) {
        // 커서 책갈피: 글 10 "다음"이라는 지점. 데이터가 밀려도 함께 움직인다
        const bookmarkY = rowY(2 + insertP) + itemH + itemGap / 2;
        ctx.strokeStyle = "#40c057";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(serverX - 3, bookmarkY);
        ctx.lineTo(serverX + colW + 3, bookmarkY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = `700 ${Math.max(9, fs - 3)}px ${FONT}`;
        ctx.fillStyle = "#2f9e44";
        ctx.textAlign = "right";
        ctx.fillText("책갈피: 글 10 다음", serverX + colW, bookmarkY - 4);
        ctx.textAlign = "left";
      }

      // --- 화면 목록 (1페이지: 글 12, 11, 10 공통) ---
      const page1 = [12, 11, 10];
      page1.forEach((id, k) => {
        const a = easeOut((e - (T_PAGE1 + k * 250)) / 300);
        drawItem(ctx, offsetX, rowY(k), colW, itemH, `글 ${id}`, { alpha: a, fs });
        drawItem(ctx, cursorX, rowY(k), colW, itemH, `글 ${id}`, { alpha: a, fs });
      });

      // 2페이지: 오프셋은 밀려 내려온 글 10을 다시 읽는다
      const offsetPage2: Array<[number, boolean]> = [
        [10, true],
        [9, false],
        [8, false],
      ];
      offsetPage2.forEach(([id, dup], k) => {
        const a = easeOut((e - (T_PAGE2 + k * 300)) / 300);
        drawItem(ctx, offsetX, rowY(3 + k), colW, itemH, `글 ${id}`, {
          alpha: a,
          fill: dup ? "#fff5f5" : "#fff",
          stroke: dup ? "#fa5252" : "#dee2e6",
          badge: dup ? "중복!" : undefined,
          fs,
        });
      });

      // 2페이지: 커서는 책갈피 다음부터 읽는다
      [9, 8, 7].forEach((id, k) => {
        const a = easeOut((e - (T_PAGE2 + k * 300)) / 300);
        drawItem(ctx, cursorX, rowY(3 + k), colW, itemH, `글 ${id}`, {
          alpha: a,
          badge: k === 2 ? "누락 없음" : undefined,
          badgeColor: "#2f9e44",
          fs,
        });
      });

      // --- 하단 단계 설명 ---
      let caption = "① 두 방식 모두 1페이지(글 12~10)를 읽는다";
      if (e >= T_PAGE2) {
        caption =
          "③ 2페이지: 오프셋은 밀려 내려온 글 10을 다시 읽고, 커서는 책갈피 다음부터 읽는다";
      } else if (e >= T_INSERT) {
        caption = "② 읽는 사이에 새 글이 등록되어 목록이 한 칸씩 밀린다";
      }
      ctx.font = `${Math.max(10, fs - 1)}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.textAlign = "center";
      ctx.fillText(caption, w / 2, h - 10);
      ctx.textAlign = "left";

      raf = scheduleMaterialFrame(render);
    };

    raf = scheduleMaterialFrame(render);
    return () => cancelMaterialFrame(raf);
  }, []);

  return (
    <div
      style={{
        border: "1px solid #dee2e6",
        borderRadius: 8,
        padding: 20,
        margin: "24px 0",
        background: "#fff",
        fontFamily: FONT,
      }}
    >
      <div ref={containerRef}>
        <SvgCanvas ref={canvasRef} style={{ display: "block", width: "100%" }} />
      </div>
    </div>
  );
};
