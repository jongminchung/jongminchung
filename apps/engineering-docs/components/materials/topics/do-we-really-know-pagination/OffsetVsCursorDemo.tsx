// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useEffect, useRef } from "react";
import {
  cancelMaterialFrame,
  scheduleMaterialFrame,
} from "#components/materials/runtime/scheduler";
import {
  SvgCanvas,
  type SvgCanvasHandle,
  type SvgDrawingContext,
  type SvgGradient,
} from "#components/materials/runtime/svg-canvas";

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

const BLOCKS = 56; // 인덱스 항목 수
const TARGET_START = 40; // 원하는 페이지의 시작 위치 (OFFSET 40)
const PAGE = 5;
const SCAN_MS = 55; // 오프셋이 블록 하나를 읽는 시간
const CURSOR_HOP_MS = 350; // 커서의 B-Tree 탐색 한 걸음
const ANIM_MS = TARGET_START * SCAN_MS + PAGE * SCAN_MS + 300; // 오프셋 레인 완주 기준
const PAUSE_MS = 1800;
const CYCLE_MS = ANIM_MS + PAUSE_MS;

function easeOut(t: number) {
  return 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
}

function drawLane(
  ctx: SvgDrawingContext,
  w: number,
  y: number,
  laneH: number,
  label: string,
  sub: string,
  readCount: number,
  returned: number,
  cursorX: number | null,
  scanning: boolean,
) {
  const labelFs = Math.max(12, Math.min(13, w / 46));
  const pad = 8;
  const blockW = (w - pad * 2) / BLOCKS;
  const blockY = y + 34;
  const blockH = Math.min(26, laneH - 58);

  ctx.font = `700 ${labelFs}px ${FONT}`;
  ctx.fillStyle = "#495057";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(label, pad, y + 16);

  ctx.font = `${Math.max(10, labelFs - 2)}px ${FONT}`;
  ctx.fillStyle = "#868e96";
  ctx.fillText(sub, pad, y + 30);

  for (let i = 0; i < BLOCKS; i++) {
    const x = pad + i * blockW;
    let fill = "#f8f9fa";
    let stroke = "#dee2e6";

    if (i < readCount && i < TARGET_START) {
      fill = "#e9ecef"; // 읽고 버림
      stroke = "#ced4da";
    }
    if (i >= TARGET_START && i < TARGET_START + returned) {
      fill = "#40c057"; // 반환
      stroke = "#2f9e44";
    }
    if (scanning && i === readCount && i < TARGET_START) {
      fill = "#fa5252"; // 지금 읽는 중
      stroke = "#e03131";
    }

    ctx.beginPath();
    ctx.roundRect(x + 0.5, blockY, Math.max(1, blockW - 1.5), blockH, 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 0.75;
    ctx.stroke();
  }

  if (cursorX !== null) {
    const x = pad + cursorX * blockW + blockW / 2;
    ctx.beginPath();
    ctx.moveTo(x, blockY - 8);
    ctx.lineTo(x - 5, blockY - 16);
    ctx.lineTo(x + 5, blockY - 16);
    ctx.closePath();
    ctx.fillStyle = "#228be6";
    ctx.fill();
  }
}

export const OffsetVsCursorDemo = () => {
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
      const laneH = 88;
      const h = laneH * 2 + 10;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      // 완주 후 잠시 멈췄다가 처음부터 반복
      const elapsed = Math.min((now - start) % CYCLE_MS, ANIM_MS);

      // --- 오프셋 레인 ---
      const offsetRead = Math.min(TARGET_START, Math.floor(elapsed / SCAN_MS));
      const offsetScanDone = offsetRead >= TARGET_START;
      const offsetReturned = offsetScanDone
        ? Math.min(PAGE, Math.floor((elapsed - TARGET_START * SCAN_MS) / SCAN_MS) + 1)
        : 0;

      // --- 커서 레인: B-Tree 탐색처럼 세 번의 점프 후 도착 ---
      const hops = [0, 28, 38, TARGET_START];
      const hopIdx = Math.min(hops.length - 1, Math.floor(elapsed / CURSOR_HOP_MS));
      const hopT = easeOut((elapsed % CURSOR_HOP_MS) / CURSOR_HOP_MS);
      const cursorPos =
        hopIdx >= hops.length - 1
          ? TARGET_START
          : hops[hopIdx] + (hops[hopIdx + 1] - hops[hopIdx]) * hopT;
      const cursorArrived = elapsed >= CURSOR_HOP_MS * (hops.length - 1);
      const cursorReturned = cursorArrived
        ? Math.min(PAGE, Math.floor((elapsed - CURSOR_HOP_MS * (hops.length - 1)) / 90) + 1)
        : 0;

      drawLane(
        ctx,
        w,
        6,
        laneH,
        `오프셋 — 읽고 버린 행: ${offsetRead} / 반환: ${offsetReturned}건`,
        "LIMIT 5 OFFSET 40 · 앞의 40건을 전부 읽어야 한다",
        offsetRead,
        offsetReturned,
        null,
        !offsetScanDone,
      );

      drawLane(
        ctx,
        w,
        6 + laneH + 8,
        laneH,
        `커서 — 읽은 행: ${cursorReturned}건`,
        "WHERE (created_at, id) < 커서 · B-Tree 탐색으로 지점에 바로 도착한다",
        0,
        cursorReturned,
        cursorPos,
        false,
      );

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
      <div style={{ fontSize: 11, color: "#adb5bd", textAlign: "center", marginTop: 8 }}>
        같은 5건을 반환하지만 오프셋은 앞의 40건을 읽어서 버리고, 커서는 시작 지점으로 바로 이동한다
      </div>
    </div>
  );
};
