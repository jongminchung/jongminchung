import React, { useEffect, useRef } from "react";

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

// 사이클 타임라인 (ms)
const P1_END = 3500; // ① 곡선 리플레이
const P2_END = 7000; // ② 마커 4개
const P3_END = 10000; // ③ 브래킷 2개
const CYCLE = 12500; // 유지 후 리셋

const Y_MAX = 720; // 트랙 상한 (눈금 600 위 여유)
const THRESHOLD = 300; // 알람 임계선 (ms)
const TOTAL_MIN = 90; // X축: 02:00 ~ 03:30

// 사건 시각 (02:00 기준 경과 분)
const M_TRACE = 14; // 02:14 첫 흔적
const M_ALARM = 32; // 02:32 알람 발화
const M_ACT = 35; // 02:35 대응 시작
const M_RECOVER = 64; // 03:04 복구

const PLATEAU_FREQ = (Math.PI * 2) / (M_RECOVER - 45); // 고원부가 복구 직전 550으로 되돌아오게

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
function clamp01(t: number) {
  return clamp(t, 0, 1);
}
function easeOut(t: number) {
  return 1 - Math.pow(1 - clamp01(t), 3);
}
// 결정론적 물결 (-1 ~ 1)
function wiggle(m: number) {
  return Math.sin(m * 1.7) * 0.6 + Math.sin(m * 3.3 + 1.1) * 0.4;
}

// m: 02:00 기준 경과 분 → P99 (ms). 장애 하나의 일대기.
function p99At(m: number): number {
  const wig = wiggle(m);
  let v: number;
  if (m < M_TRACE) {
    v = 70 + wig * 5; // 평온한 물결
  } else if (m < 30) {
    const q = (m - M_TRACE) / 16;
    v = 70 + 110 * q * q + wig * 6; // 전조: 70 → 180으로 서서히
  } else if (m < M_ALARM) {
    const q = (m - 30) / 2;
    v = 180 + 120 * Math.pow(q, 1.4) + wig * 7; // 02:32에 정확히 300 돌파
  } else if (m < 45) {
    const q = (m - M_ALARM) / 13;
    v = 300 + 250 * (1 - (1 - q) * (1 - q)) + wig * 12; // 550까지 급증
  } else if (m < M_RECOVER) {
    v = 535 + 15 * Math.cos((m - 45) * PLATEAU_FREQ) + wig * 10; // 고원부
  } else if (m < M_RECOVER + 0.7) {
    const q = (m - M_RECOVER) / 0.7;
    v = 550 * (1 - q) + 75 * q + wig * 3; // 03:04 수직 급락
  } else {
    v = 75 + wig * 4; // 회복
  }
  return clamp(v, 0, Y_MAX);
}

interface Marker {
  m: number;
  label: string;
  line: string;
  text: string;
  align: "left" | "right";
  row: number;
  at: number; // 등장 시각 (사이클 ms)
}

const MARKERS = [
  {
    m: M_TRACE,
    label: "02:14 첫 흔적",
    line: "#fab005",
    text: "#e67700",
    align: "left",
    row: 0,
    at: 3500,
  },
  {
    m: M_ALARM,
    label: "02:32 알람 발화",
    line: "#fa5252",
    text: "#fa5252",
    align: "right",
    row: 1,
    at: 4300,
  },
  {
    m: M_ACT,
    label: "02:35 대응 시작",
    line: "#845ef7",
    text: "#845ef7",
    align: "left",
    row: 1,
    at: 5100,
  },
  {
    m: M_RECOVER,
    label: "03:04 복구",
    line: "#40c057",
    text: "#2f9e44",
    align: "left",
    row: 0,
    at: 5900,
  },
] as const satisfies readonly Marker[];

interface Step {
  caption: string;
  color: string;
}

const STEPS = [
  { caption: "① 복구가 끝났다 — 이제 그래프를 되감아 타임라인을 재구성한다", color: "#868e96" },
  { caption: "② 네 개의 시각을 찍는다 — 첫 흔적, 알람, 대응 시작, 복구", color: "#495057" },
  {
    caption:
      "③ 포스트모템의 질문은 이 두 간격이다 — 어떻게 하면 다음엔 더 빨리 알고, 더 빨리 끝내나",
    color: "#1c7ed6",
  },
] as const satisfies readonly Step[];

// 판독 캡션을 최대 두 줄로 나눈다
function wrapCaption(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  if (ctx.measureText(text).width <= maxW) return [text];
  const sep = text.indexOf(" — ");
  if (sep >= 0) {
    const l1 = text.slice(0, sep);
    const l2 = `— ${text.slice(sep + 3)}`;
    if (ctx.measureText(l1).width <= maxW && ctx.measureText(l2).width <= maxW) return [l1, l2];
  }
  const words = text.split(" ");
  let line1 = "";
  let i = 0;
  for (; i < words.length; i++) {
    const word = words[i];
    if (word === undefined) break;
    const cand = line1 ? `${line1} ${word}` : word;
    if (ctx.measureText(cand).width > maxW && line1) break;
    line1 = cand;
  }
  return [line1, words.slice(i).join(" ")];
}

// 치수선(브래킷): 가로선 + 양끝 아래 방향 틱 + 중앙 라벨
function drawBracket(
  ctx: CanvasRenderingContext2D,
  x1: number,
  x2: number,
  y: number,
  line: string,
  text: string,
  label: string,
  p: number, // 0~1 진행도
  fs: number,
) {
  if (p <= 0.01) return;
  const lineP = clamp01(p / 0.65);
  const xEnd = x1 + (x2 - x1) * easeOut(lineP);

  ctx.strokeStyle = line;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(xEnd, y);
  ctx.stroke();

  // 시작 틱
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x1, y + 5);
  ctx.stroke();
  // 끝 틱 (선이 다 그려진 뒤)
  if (lineP >= 1) {
    ctx.beginPath();
    ctx.moveTo(x2, y);
    ctx.lineTo(x2, y + 5);
    ctx.stroke();
  }

  const labelA = clamp01((p - 0.65) / 0.35);
  if (labelA > 0) {
    ctx.globalAlpha = labelA;
    ctx.font = `700 ${fs}px ${FONT}`;
    ctx.fillStyle = text;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(label, (x1 + x2) / 2, y - 5);
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  }
}

export const PostmortemDemo = () => {
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

      // rAF의 첫 타임스탬프가 start보다 이를 수 있으므로 음수를 방어한다
      const e = Math.max(0, (now - start) % CYCLE);
      const stepIdx = clamp(e < P1_END ? 0 : e < P2_END ? 1 : 2, 0, STEPS.length - 1);
      const p1 = clamp01(e / P1_END); // ① 곡선 리플레이 진행률
      const step = STEPS[stepIdx] ?? STEPS[0];

      const fs = Math.max(10, Math.min(12, w / 46));
      const pad = 8;
      const axisW = Math.max(34, fs * 3.2);
      const trackH = Math.max(150, Math.min(190, w * 0.34));

      const plotX = pad + axisW;
      const plotW = w - plotX - pad;
      // 상단: 제목 줄 + 브래킷 밴드(치수선 자리)
      const bracketLabelY = pad + fs + 6 + fs; // 브래킷 라벨 baseline
      const bracketLineY = bracketLabelY + 6;
      const trackY = bracketLineY + 10;
      const trackBottom = trackY + trackH;
      const captionTop = trackBottom + 24;
      const h = captionTop + fs * 2 + 12;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      const toX = (m: number) => plotX + plotW * clamp01(m / TOTAL_MIN);
      const toY = (v: number) => trackY + trackH * (1 - clamp(v, 0, Y_MAX) / Y_MAX);

      // --- 제목 + 단위 ---
      ctx.font = `700 ${fs}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("P99 응답 시간", plotX, pad + fs);

      ctx.font = `${Math.max(9, fs - 2)}px ${FONT}`;
      ctx.fillStyle = "#adb5bd";
      ctx.textAlign = "right";
      ctx.fillText("(ms)", plotX + plotW, trackY - 6);

      // --- 트랙 배경 ---
      ctx.fillStyle = "#f8f9fa";
      ctx.fillRect(plotX, trackY, plotW, trackH);

      // ② 전조 구간(02:14~02:32) 노란 배경 강조 — 첫 마커와 함께 나타나 유지된다
      const bandA = easeOut((e - MARKERS[0].at) / 400);
      if (bandA > 0) {
        ctx.globalAlpha = bandA;
        ctx.fillStyle = "#fff9db";
        ctx.fillRect(toX(M_TRACE), trackY, toX(M_ALARM) - toX(M_TRACE), trackH);
        ctx.globalAlpha = 1;
      }

      // 세로 눈금(30분 간격) + 시각 라벨
      for (let m = 30; m < TOTAL_MIN; m += 30) {
        const gx = toX(m);
        ctx.strokeStyle = "#e9ecef";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(gx, trackY);
        ctx.lineTo(gx, trackBottom);
        ctx.stroke();
      }
      ctx.font = `${Math.max(9, fs - 2)}px ${FONT}`;
      ctx.fillStyle = "#adb5bd";
      ctx.textBaseline = "alphabetic";
      ["02:00", "02:30", "03:00", "03:30"].forEach((label, i) => {
        const gx = toX(i * 30);
        ctx.textAlign = i === 0 ? "left" : i === 3 ? "right" : "center";
        ctx.fillText(label, gx, trackBottom + 14);
      });
      ctx.textAlign = "left";

      // 가로 눈금 (0 / 300 / 600)
      [0, 300, 600].forEach((v) => {
        const gy = toY(v);
        ctx.strokeStyle = "#dee2e6";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(plotX, gy);
        ctx.lineTo(plotX + plotW, gy);
        ctx.stroke();

        ctx.font = `${Math.max(9, fs - 2)}px ${FONT}`;
        ctx.fillStyle = "#adb5bd";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(`${v}`, plotX - 6, gy);
        ctx.textAlign = "left";
      });

      ctx.strokeStyle = "#adb5bd";
      ctx.lineWidth = 1;
      ctx.strokeRect(plotX, trackY, plotW, trackH);

      // --- 알람 임계선 (300ms, 회색 점선) ---
      const thY = toY(THRESHOLD);
      ctx.strokeStyle = "#868e96";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(plotX, thY);
      ctx.lineTo(plotX + plotW, thY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = `700 ${Math.max(9, fs - 2)}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("알람 임계선 300ms", plotX + 6, thY - 5);

      // --- ① P99 곡선 리플레이 (왼쪽→오른쪽) ---
      const endPx = plotW * p1;
      const traceCurve = () => {
        ctx.beginPath();
        for (let px = 0; px <= endPx; px += 2) {
          const cy = toY(p99At((px / plotW) * TOTAL_MIN));
          if (px === 0) ctx.moveTo(plotX, cy);
          else ctx.lineTo(plotX + px, cy);
        }
        ctx.lineTo(plotX + endPx, toY(p99At((endPx / plotW) * TOTAL_MIN)));
      };

      if (p1 > 0) {
        // 곡선 아래 옅은 면 채우기
        traceCurve();
        ctx.save();
        ctx.lineTo(plotX + endPx, trackBottom);
        ctx.lineTo(plotX, trackBottom);
        ctx.closePath();
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = "#228be6";
        ctx.fill();
        ctx.restore();

        // 곡선 본체
        traceCurve();
        ctx.strokeStyle = "#228be6";
        ctx.lineWidth = 2;
        ctx.lineJoin = "round";
        ctx.stroke();
      }

      // 리플레이 커서 + 현재 값 (①에서만)
      if (p1 < 1) {
        const cx = plotX + endPx;
        const vNow = p99At(p1 * TOTAL_MIN);
        const dotY = toY(vNow);

        ctx.strokeStyle = "#adb5bd";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(cx, trackY);
        ctx.lineTo(cx, trackBottom);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(cx, dotY, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = "#228be6";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const dotLabel = `${Math.round(vNow)}ms`;
        ctx.font = `700 ${Math.max(9, fs - 1)}px ${FONT}`;
        const nearRight = cx > plotX + plotW - ctx.measureText(dotLabel).width - 12;
        ctx.textAlign = nearRight ? "right" : "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#228be6";
        ctx.fillText(dotLabel, cx + (nearRight ? -8 : 8), dotY - 10);
        ctx.textAlign = "left";
      }

      // --- ② 세로 마커 4개: 0.8초 간격으로 찍힌다 ---
      const markerFs = Math.max(9, fs - 2);
      MARKERS.forEach((mk) => {
        const a = easeOut((e - mk.at) / 350);
        if (a <= 0.01) return;
        const mx = toX(mk.m);
        ctx.globalAlpha = a;
        ctx.strokeStyle = mk.line;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(mx, trackY);
        ctx.lineTo(mx, trackBottom);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = `700 ${markerFs}px ${FONT}`;
        ctx.fillStyle = mk.text;
        ctx.textAlign = mk.align;
        ctx.textBaseline = "alphabetic";
        const ly = trackY + markerFs + 5 + mk.row * (markerFs + 5);
        ctx.fillText(mk.label, mk.align === "left" ? mx + 5 : mx - 5, ly);
        ctx.textAlign = "left";
        ctx.globalAlpha = 1;
      });

      // ② 보조 라벨: 첫 마커와 함께 밴드 위(브래킷 자리)에 떴다가 ③에서 브래킷에 자리를 내준다
      const subA = clamp01((e - MARKERS[0].at - 150) / 400) * (1 - clamp01((e - 6800) / 400));
      if (subA > 0.01) {
        ctx.globalAlpha = subA;
        ctx.font = `700 ${Math.max(9, fs - 1)}px ${FONT}`;
        ctx.fillStyle = "#e67700";
        ctx.textBaseline = "alphabetic";
        ctx.fillText("전조는 알람보다 18분 먼저 와 있었다", toX(M_TRACE), bracketLabelY);
        ctx.globalAlpha = 1;
      }

      // --- ③ 가로 브래킷(치수선) 두 개 ---
      drawBracket(
        ctx,
        toX(M_TRACE),
        toX(M_ALARM),
        bracketLineY,
        "#fab005",
        "#e67700",
        "감지 공백 18분",
        clamp01((e - P2_END) / 900),
        markerFs,
      );
      drawBracket(
        ctx,
        toX(M_ALARM),
        toX(M_RECOVER),
        bracketLineY,
        "#228be6",
        "#1c7ed6",
        "대응 시간 32분",
        clamp01((e - P2_END - 900) / 1000),
        markerFs,
      );

      // --- 하단 캡션: 단계별 판독 ---
      const stepStart = stepIdx === 0 ? 0 : stepIdx === 1 ? P1_END : P2_END;
      const capA = clamp01((e - stepStart) / 400);
      ctx.font = `700 ${Math.max(10, fs - 1)}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.globalAlpha = capA;
      ctx.fillStyle = step.color;
      const lines = wrapCaption(ctx, step.caption, w - pad * 2);
      lines.forEach((line, i) => {
        ctx.fillText(line, w / 2, captionTop + fs + i * (fs + 4));
      });
      ctx.globalAlpha = 1;
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
