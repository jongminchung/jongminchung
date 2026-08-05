import React, { useEffect, useRef } from "react";

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

// 시나리오 타임라인 (ms)
const DRAW_DUR = 8000; // 그래프가 왼쪽→오른쪽으로 그려지는 시간
const HOLD = 3200; // 완성 화면 유지
const CYCLE = DRAW_DUR + HOLD;

// 그래프 파라미터 — 값은 힙 한계(=1.0) 기준 비율, x는 0~1 진행률
const VMAX = 1.14; // 세로축 최대값 (힙 한계 위 여백)
const TOOTH = 0.15;
const BASE = 0.3;
const RISE = 0.33;
const XS1 = 0.6; // 첫 계단 시작 (14:32:05)
const XS1_END = 0.615;
const V1 = 0.62;
const XS2 = 0.68; // 두 번째 계단
const XS2_END = 0.695;
const V2 = 0.87;

// 시간축: 14:31:50 ~ 14:32:15 (25초)
const T0 = 110; // 14:31:50 = 기준(14:30:00)에서 110초
const SPAN = 25;

function clamp01(t: number) {
  return Math.min(1, Math.max(0, t));
}
function easeOut(t: number) {
  return 1 - Math.pow(1 - clamp01(t), 3);
}
function fmtClock(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `14:${String(30 + m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// x(0~1) → 힙 사용량(힙 한계 대비 비율)
function heapAt(x: number) {
  if (x < XS1) {
    const i = Math.floor(x / TOOTH);
    const phase = (x - i * TOOTH) / TOOTH;
    return BASE + RISE * phase;
  }
  if (x < XS1_END) return BASE + (V1 - BASE) * easeOut((x - XS1) / (XS1_END - XS1));
  if (x < XS2) return V1 + 0.008 * Math.sin((x - XS1_END) * 180);
  if (x < XS2_END) return V1 + (V2 - V1) * easeOut((x - XS2) / (XS2_END - XS2));
  return V2 + ((x - XS2_END) / (1 - XS2_END)) * 0.04 + 0.006 * Math.sin(x * 220);
}

// 액세스 로그 (t: 등장 진행률) — 타임스탬프는 시간축과 정확히 일치한다
const LOGS = [
  { t: 0.08, text: "GET /api/products 200 · 12ms", culprit: false },
  { t: 0.24, text: "GET /api/cart 200 · 9ms", culprit: false },
  { t: 0.4, text: "POST /api/orders 201 · 24ms", culprit: false },
  { t: 0.52, text: "GET /api/products 200 · 11ms", culprit: false },
  { t: XS1, text: "GET /api/orders/export?range=all 200 · 8,412ms", culprit: true },
  { t: 0.8, text: "GET /api/cart 200 · 10ms", culprit: false },
];

export const MemorySpikeDemo = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let raf = 0;
    const start = performance.now();

    const render = (now: number) => {
      const w = container.clientWidth;
      const dpr = window.devicePixelRatio || 1;
      const isMobile = w < 480;

      const e = Math.max(0, (now - start) % CYCLE);
      const progress = Math.min(1, e / DRAW_DUR);

      const fs = Math.max(10, Math.min(12, w / 46));
      const sfs = Math.max(9, fs - 2);
      const pad = 8;
      const axisW = Math.max(34, fs * 3.2);
      const plotX = pad + axisW;
      const plotW = w - plotX - pad;

      const trackY = pad + fs + 14;
      const trackH = Math.max(110, Math.min(150, w * 0.24));
      const trackBottom = trackY + trackH;

      const logTitleY = trackBottom + 34;
      const logLineH = Math.max(16, sfs + 8);
      const logY = logTitleY + 8;
      const logH = LOGS.length * logLineH + 14;
      const captionY = logY + logH + 14;
      const h = captionY + fs + 10;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      const valY = (v: number) => trackY + trackH * (1 - v / VMAX);

      // ===== (a) 힙 사용량 트랙 =====
      ctx.font = `700 ${fs}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("힙 사용량", plotX, trackY - 8);

      ctx.fillStyle = "#f8f9fa";
      ctx.fillRect(plotX, trackY, plotW, trackH);

      // 힙 한계 점선 (v = 1.0)
      const limitY = valY(1);
      ctx.strokeStyle = "#fa5252";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(plotX, limitY);
      ctx.lineTo(plotX + plotW, limitY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = `700 ${sfs}px ${FONT}`;
      ctx.fillStyle = "#fa5252";
      ctx.fillText("힙 한계", plotX + 6, limitY - 5);

      ctx.strokeStyle = "#adb5bd";
      ctx.lineWidth = 1;
      ctx.strokeRect(plotX, trackY, plotW, trackH);

      // 시간축 라벨
      ctx.font = `${sfs}px ${FONT}`;
      ctx.fillStyle = "#adb5bd";
      ctx.textAlign = "left";
      ctx.fillText(fmtClock(T0), plotX, trackBottom + 13);
      ctx.textAlign = "right";
      ctx.fillText(fmtClock(T0 + SPAN), plotX + plotW, trackBottom + 13);
      ctx.textAlign = "left";

      // 곡선 (계단 전 파랑, 계단 후 빨강)
      const drawSeg = (x0: number, x1: number, color: string) => {
        if (progress <= x0) return;
        const end = Math.min(progress, x1);
        ctx.beginPath();
        let first = true;
        for (let x = x0; x <= end; x += 0.002) {
          const px = plotX + x * plotW;
          const py = valY(heapAt(x));
          if (first) {
            ctx.moveTo(px, py);
            first = false;
          } else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineJoin = "round";
        ctx.stroke();
      };
      drawSeg(0, XS1, "#228be6");
      drawSeg(XS1, 1, "#fa5252");

      // 계단 시각 세로 점선 + 시각 라벨 (계단 이후 페이드 인)
      const stepA = clamp01((progress - XS1) / 0.08);
      if (stepA > 0) {
        const sx = plotX + XS1 * plotW;
        ctx.globalAlpha = stepA;
        ctx.strokeStyle = "#fa5252";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(sx, trackY);
        ctx.lineTo(sx, logY + logH);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = `700 ${sfs}px ${FONT}`;
        ctx.fillStyle = "#fa5252";
        ctx.textAlign = "center";
        ctx.fillText(fmtClock(T0 + SPAN * XS1), sx, trackY - 8);
        ctx.textAlign = "left";
        ctx.globalAlpha = 1;
      }

      // 진행 커서 + 현재 값
      const cx = plotX + progress * plotW;
      const cv = heapAt(progress);
      const cy = valY(cv);
      ctx.beginPath();
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = progress < XS1 ? "#228be6" : "#fa5252";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      const vLabel = `${Math.round(cv * 100)}%`;
      ctx.font = `700 ${sfs}px ${FONT}`;
      const nearRight = cx > plotX + plotW - ctx.measureText(vLabel).width - 12;
      ctx.textAlign = nearRight ? "right" : "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = progress < XS1 ? "#228be6" : "#fa5252";
      ctx.fillText(vLabel, cx + (nearRight ? -8 : 8), Math.max(cy - 10, trackY + 8));
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";

      // ===== (b) 액세스 로그 =====
      ctx.font = `700 ${fs}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.fillText("액세스 로그", plotX, logTitleY);

      ctx.fillStyle = "#f8f9fa";
      ctx.fillRect(plotX, logY, plotW, logH);
      ctx.strokeStyle = "#dee2e6";
      ctx.lineWidth = 1;
      ctx.strokeRect(plotX, logY, plotW, logH);

      LOGS.forEach((log, i) => {
        if (progress < log.t) return;
        const a = clamp01((progress - log.t) / 0.03);
        const ly = logY + 8 + i * logLineH;
        ctx.globalAlpha = a;

        if (log.culprit) {
          ctx.fillStyle = "#fff5f5";
          ctx.fillRect(plotX + 1, ly - 2, plotW - 2, logLineH);
        }
        const stamp = fmtClock(T0 + SPAN * log.t);
        const body = isMobile && log.culprit ? "GET /api/orders/export?range=all …" : log.text;
        ctx.font = `${log.culprit ? 700 : 400} ${sfs}px ${FONT}`;
        ctx.fillStyle = log.culprit ? "#fa5252" : "#adb5bd";
        ctx.textBaseline = "middle";
        ctx.fillText(`${stamp}  ${body}`, plotX + 10, ly + logLineH / 2 - 1);
        ctx.textBaseline = "alphabetic";
        ctx.globalAlpha = 1;
      });

      // ===== 하단 캡션 =====
      let caption = "① 평소의 톱니 — GC가 만드는 정상 리듬";
      if (progress >= 0.78) {
        caption = "③ 같은 시각의 액세스 로그에서 범인 요청이 보인다";
      } else if (progress >= XS1) {
        caption = `② ${fmtClock(T0 + SPAN * XS1)}, 메모리가 계단으로 뛰어오른다`;
      }
      ctx.font = `${Math.max(10, fs - 1)}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.textAlign = "center";
      ctx.fillText(caption, w / 2, captionY + fs * 0.4);
      ctx.textAlign = "left";

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
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
        <canvas ref={canvasRef} style={{ display: "block", width: "100%" }} />
      </div>
    </div>
  );
};
