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

const FOLLOWERS = 5;
const SLOTS = 3; // 각 타임라인 캐시의 칸 수
const T_POST = 400; // 글 작성
const T_FANOUT = 1000; // 팔로워 캐시로 복사 시작
const FANOUT_DUR = 900;
const T_READ = 2600; // 한 팔로워가 자기 캐시를 읽음
const T_HOLD_END = 4600;
const CYCLE = T_HOLD_END;

function clamp01(t: number) {
  return Math.min(1, Math.max(0, t));
}
function easeOut(t: number) {
  return 1 - Math.pow(1 - clamp01(t), 3);
}

export const FanoutDemo = () => {
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

      const s = Math.max(0.6, Math.min(1, w / 640));
      const fs = Math.max(10, 12 * s);

      // 캐시 스택 크기를 먼저 계산하고, 캔버스 높이는 콘텐츠에 맞춘다
      const slotH = Math.max(7, 9 * s);
      const cacheH = SLOTS * (slotH + 3) + 20;
      const cacheGap = 8;
      const h = 10 + FOLLOWERS * cacheH + (FOLLOWERS - 1) * cacheGap + 26;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      // 작성자 박스 (좌측 중앙)
      const authorW = Math.min(110, w * 0.18);
      const authorH = 46;
      const authorX = 12;
      const authorY = h / 2 - authorH / 2 - 10;
      const posted = e >= T_POST;

      ctx.beginPath();
      ctx.roundRect(authorX, authorY, authorW, authorH, 8);
      ctx.fillStyle = posted ? "#e7f5ff" : "#f8f9fa";
      ctx.fill();
      ctx.strokeStyle = posted ? "#228be6" : "#adb5bd";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = `700 ${fs}px ${FONT}`;
      ctx.fillStyle = "#495057";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("작성자", authorX + authorW / 2, authorY + 19);
      ctx.font = `${Math.max(9, fs - 2)}px ${FONT}`;
      ctx.fillStyle = posted ? "#1971c2" : "#adb5bd";
      ctx.fillText(posted ? "새 글 작성!" : "…", authorX + authorW / 2, authorY + 36);

      // 팔로워 타임라인 캐시 (우측에 세로로)
      const cacheW = Math.min(170, w * 0.3);
      const cacheX = w - cacheW - 12;
      const gapY = cacheGap;

      const fanP = easeOut((e - T_FANOUT) / FANOUT_DUR);
      const arrived = e >= T_FANOUT + FANOUT_DUR;
      const readerIdx = 2; // 읽기를 시연할 팔로워
      const reading = e >= T_READ;

      for (let i = 0; i < FOLLOWERS; i++) {
        const cy = 5 + i * (cacheH + gapY);

        // 복사되어 날아가는 글 (점)
        if (e >= T_FANOUT && !arrived) {
          const fromX = authorX + authorW;
          const fromY = authorY + authorH / 2;
          const toX = cacheX;
          const toY = cy + 16 + slotH / 2;
          const x = fromX + (toX - fromX) * fanP;
          const y = fromY + (toY - fromY) * fanP;
          ctx.beginPath();
          ctx.arc(x, y, Math.max(3, 4 * s), 0, Math.PI * 2);
          ctx.fillStyle = "#228be6";
          ctx.fill();
        }

        // 캐시 박스
        const isReader = i === readerIdx && reading;
        ctx.beginPath();
        ctx.roundRect(cacheX, cy, cacheW, cacheH, 6);
        ctx.fillStyle = isReader ? "#fff9db" : "#f8f9fa";
        ctx.fill();
        ctx.strokeStyle = isReader ? "#fab005" : "#dee2e6";
        ctx.lineWidth = 1.25;
        ctx.stroke();

        ctx.font = `${Math.max(9, fs - 2)}px ${FONT}`;
        ctx.fillStyle = "#868e96";
        ctx.textAlign = "left";
        ctx.fillText(`팔로워 ${i + 1}의 타임라인 캐시`, cacheX + 8, cy + 13);

        // 슬롯: 맨 위 칸에 새 글이 꽂힌다
        for (let k = 0; k < SLOTS; k++) {
          const sy = cy + 18 + k * (slotH + 3);
          const isNew = k === 0 && arrived;
          ctx.beginPath();
          ctx.roundRect(cacheX + 8, sy, cacheW - 16, slotH, 2);
          ctx.fillStyle = isNew ? "#228be6" : "#e9ecef";
          ctx.fill();
        }
      }

      // 읽기 화살표: 자기 캐시 → 화면 (범위 조회 한 번)
      if (reading) {
        const cy = 5 + readerIdx * (cacheH + gapY) + cacheH / 2;
        const rx = cacheX - 8;
        const labelX = cacheX - Math.min(150, w * 0.24);
        ctx.strokeStyle = "#f08c00";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(labelX + 4, cy);
        ctx.lineTo(rx - 8, cy);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(rx, cy);
        ctx.lineTo(rx - 9, cy - 5);
        ctx.lineTo(rx - 9, cy + 5);
        ctx.closePath();
        ctx.fillStyle = "#f08c00";
        ctx.fill();
        ctx.font = `700 ${Math.max(9, fs - 2)}px ${FONT}`;
        ctx.fillStyle = "#e8590c";
        ctx.textAlign = "right";
        ctx.fillText("읽기 = 범위 조회 한 번", labelX, cy - 8);
        ctx.textAlign = "left";
      }

      // 하단 설명
      let caption = "글이 작성되면…";
      if (reading)
        caption =
          "읽기는 미리 정렬된 자기 캐시를 자르기만 하면 된다 — 페이지네이션이 공짜에 가깝다";
      else if (e >= T_FANOUT)
        caption = `쓰기 시점에 팔로워 ${FOLLOWERS}명의 캐시에 글 ID를 복사한다 (쓰기 증폭)`;
      ctx.font = `${Math.max(10, fs - 1)}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.textAlign = "center";
      ctx.fillText(caption, w / 2, h - 8);
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
