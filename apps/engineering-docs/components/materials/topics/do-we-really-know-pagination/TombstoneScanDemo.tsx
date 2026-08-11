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

const CELLS = 60;
const TARGET = 5; // LIMIT 5
// 살아있는 행의 위치 (결정적 패턴 — 뒤쪽에 몰려 있어 앞의 툼스톤을 헤치고 가야 한다)
const LIVE = new Set([9, 23, 34, 47, 55]);
const SCAN_MS = 70;
const PAUSE_MS = 2200;
const CYCLE = CELLS * SCAN_MS + PAUSE_MS;

export const TombstoneScanDemo = () => {
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

      // 5건을 다 찾으면 스캔이 멈춘다
      const lastLive = Math.max(...Array.from(LIVE));
      const scanLimit = lastLive + 1;
      const scanned = Math.min(scanLimit, Math.floor(e / SCAN_MS));
      let found = 0;
      for (let i = 0; i < scanned; i++) if (LIVE.has(i)) found++;

      const pad = 8;
      const rowCells = w < 480 ? 20 : 30;
      const rows = Math.ceil(CELLS / rowCells);
      const cellW = (w - pad * 2) / rowCells;
      const cellH = Math.min(26, Math.max(18, cellW));
      const fs = Math.max(10, Math.min(12, w / 46));
      const topY = 30;
      const h = topY + rows * (cellH + 6) + 30;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      // 상단 카운터
      ctx.font = `700 ${Math.max(11, fs + 1)}px ${FONT}`;
      ctx.fillStyle = "#495057";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(`SELECT … LIMIT ${TARGET}`, pad, 18);
      ctx.textAlign = "right";
      ctx.fillStyle = found >= TARGET ? "#2f9e44" : "#e03131";
      ctx.fillText(`읽은 항목 ${scanned} / 살아있는 행 ${found}`, w - pad, 18);
      ctx.textAlign = "left";

      for (let i = 0; i < CELLS; i++) {
        const row = Math.floor(i / rowCells);
        const col = i % rowCells;
        const x = pad + col * cellW;
        const y = topY + row * (cellH + 6);

        const isLive = LIVE.has(i);
        const isScanned = i < scanned;
        const isCurrent = i === scanned && scanned < scanLimit;

        let fill = "#f8f9fa";
        let stroke = "#dee2e6";
        if (isLive) {
          fill = isScanned ? "#40c057" : "#d3f9d8";
          stroke = "#2f9e44";
        } else if (isCurrent) {
          fill = "#fa5252";
          stroke = "#e03131";
        } else if (isScanned) {
          fill = "#e9ecef";
          stroke = "#ced4da";
        }

        ctx.beginPath();
        ctx.roundRect(x + 1, y, cellW - 2, cellH, 3);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 0.75;
        ctx.stroke();

        // 툼스톤 표식
        if (!isLive) {
          ctx.strokeStyle = isScanned || isCurrent ? "#adb5bd" : "#ced4da";
          ctx.lineWidth = 1;
          const cx = x + cellW / 2;
          const cy = y + cellH / 2;
          const r = Math.min(4, cellW / 5);
          ctx.beginPath();
          ctx.moveTo(cx - r, cy - r);
          ctx.lineTo(cx + r, cy + r);
          ctx.moveTo(cx + r, cy - r);
          ctx.lineTo(cx - r, cy + r);
          ctx.stroke();
        }
      }

      ctx.font = `${fs}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.textAlign = "center";
      ctx.fillText(
        found >= TARGET
          ? `결과는 ${TARGET}건인데 ${scanned}개 항목을 읽었다 — ✕ 표시가 툼스톤이다`
          : "살아있는 행(초록)을 찾으려면 툼스톤(✕)도 전부 읽고 건너뛰어야 한다",
        w / 2,
        h - 8,
      );
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
