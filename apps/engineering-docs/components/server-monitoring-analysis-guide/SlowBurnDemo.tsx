import React, { useEffect, useRef } from "react";

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

// 타임라인 (ms)
const P1_END = 4500; // ① 4주치 곡선 그리기
const P2_END = 7500; // ② 1주차 곡선 오버레이 비교
const P3_END = 11000; // ③ 추세선 판독
const CYCLE = 12000; // 유지 후 리셋

const P99_MAX = 440; // 트랙 상한 (임계선 400 위에 여유)
const THRESHOLD = 400; // 알람 임계선 (ms)
const WEEKS = 4;

// 추세: 1주차 평균 180ms, 4주차 말 310ms (+72%)
const TREND_B = 130 / 0.875; // ≈148.57
const TREND_A = 180 - 0.125 * TREND_B; // ≈161.43
const W1_AVG = TREND_A + 0.125 * TREND_B; // 180
const W4_AVG = TREND_A + 0.875 * TREND_B; // ≈291.4

interface Step {
  caption: string;
  color: string;
}

const STEPS = [
  {
    caption: "① 4주 동안 알람은 한 번도 울리지 않았다 — 어제와 비교하면 늘 '정상'이었으니까",
    color: "#868e96",
  },
  {
    caption: "② 4주 전 같은 요일과 겹쳐보면 — 같은 트래픽에 응답만 72% 느려졌다",
    color: "#fa5252",
  },
  {
    caption:
      "③ 급락은 알람이 잡지만 침식은 비교가 잡는다 — 주간 비교(week-over-week)를 대시보드에 두라",
    color: "#1c7ed6",
  },
] as const satisfies readonly Step[];

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
// 사이클마다 같은 그림이 나오도록 사인 합성으로 결정적인 물결을 만든다
function wave(t: number, freq: number, phase: number) {
  return Math.sin(t * Math.PI * 2 * freq + phase);
}

// t: 0~1 (4주 시간축) → P99 (ms)
// 물결 주파수를 모두 4의 배수로 두어 "같은 요일"끼리 같은 위상이 되게 한다
function p99At(t: number): number {
  const trend = TREND_A + TREND_B * t;
  const texture = 25 * wave(t, 28, 0.15) + 7 * wave(t, 56, -0.4) + 4 * wave(t, 92, 0.5);
  return clamp(trend + texture, 0, P99_MAX);
}

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

export const SlowBurnDemo = () => {
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
      const stepIdx = Math.min(2, e < P1_END ? 0 : e < P2_END ? 1 : 2);
      const p1 = clamp(e / P1_END, 0, 1); // 곡선 그리기 진행률
      const p2 = clamp((e - P1_END) / 1400, 0, 1); // 오버레이 진행률
      const p3 = clamp((e - P2_END) / 1600, 0, 1); // 추세선 진행률
      const step = STEPS[stepIdx] ?? STEPS[0];

      const fs = Math.max(10, Math.min(12, w / 46));
      const pad = 8;
      const axisW = Math.max(34, fs * 3.2);
      const badgeH = 24;
      const trackH = Math.max(130, Math.min(180, w * 0.32));

      const plotX = pad + axisW;
      const plotW = w - plotX - pad;
      const trackY = pad + badgeH + 22;
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

      const toX = (t: number) => plotX + plotW * clamp(t, 0, 1);
      const toY = (v: number) => trackY + trackH * (1 - clamp(v, 0, P99_MAX) / P99_MAX);

      // --- 상단: 트랙 제목(좌) + "알람: 0건" 배지(우) ---
      ctx.font = `700 ${fs}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("P99 응답 시간 (4주)", plotX, trackY - 7);

      const badgeA = Math.min(1, e / 400);
      const badgeText = "알람: 0건";
      ctx.globalAlpha = badgeA;
      ctx.font = `700 ${fs}px ${FONT}`;
      const badgeW = ctx.measureText(badgeText).width + 20;
      const badgeX = w - pad - badgeW;
      ctx.beginPath();
      ctx.roundRect(badgeX, pad, badgeW, badgeH, 12);
      ctx.fillStyle = "#f1f3f5";
      ctx.fill();
      ctx.strokeStyle = "#dee2e6";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "#868e96";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(badgeText, badgeX + badgeW / 2, pad + badgeH / 2 + 0.5);
      ctx.globalAlpha = 1;

      // --- 트랙 배경 + 눈금 ---
      ctx.fillStyle = "#f8f9fa";
      ctx.fillRect(plotX, trackY, plotW, trackH);

      // 세로 눈금(주 단위) + 주차 라벨
      for (let wk = 1; wk < WEEKS; wk++) {
        const gx = toX(wk / WEEKS);
        ctx.strokeStyle = "#e9ecef";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(gx, trackY);
        ctx.lineTo(gx, trackBottom);
        ctx.stroke();
      }
      ctx.font = `${Math.max(9, fs - 2)}px ${FONT}`;
      ctx.fillStyle = "#adb5bd";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      for (let wk = 0; wk < WEEKS; wk++) {
        ctx.fillText(`${wk + 1}주차`, toX((wk + 0.5) / WEEKS), trackBottom + 14);
      }

      // 가로 눈금 (0 / 200 / 400)
      [0, 200, 400].forEach((v) => {
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
      });
      // 단위 표기
      ctx.font = `${Math.max(9, fs - 2)}px ${FONT}`;
      ctx.fillStyle = "#adb5bd";
      ctx.textAlign = "right";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("(ms)", plotX + plotW, trackY - 7);

      ctx.strokeStyle = "#adb5bd";
      ctx.lineWidth = 1;
      ctx.strokeRect(plotX, trackY, plotW, trackH);

      // --- 알람 임계선 (400ms, 빨간 점선) ---
      const thY = toY(THRESHOLD);
      ctx.strokeStyle = "#fa5252";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(plotX, thY);
      ctx.lineTo(plotX + plotW, thY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = `700 ${Math.max(9, fs - 2)}px ${FONT}`;
      ctx.fillStyle = "#fa5252";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("알람 임계선 400ms", plotX + 6, thY - 5);

      // --- ① P99 곡선 (왼쪽→오른쪽 진행) ---
      const endPx = plotW * p1;
      const traceCurve = () => {
        ctx.beginPath();
        for (let px = 0; px <= endPx; px += 2) {
          const cy = toY(p99At(px / plotW));
          if (px === 0) ctx.moveTo(plotX, cy);
          else ctx.lineTo(plotX + px, cy);
        }
        ctx.lineTo(plotX + endPx, toY(p99At(endPx / plotW)));
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

      // 진행 커서 + 현재 값 (①에서만)
      if (p1 < 1) {
        const cx = plotX + endPx;
        const vNow = p99At(p1);
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
      }

      // --- ② 1주차 곡선을 4주차 위에 오버레이 (같은 요일 정렬) ---
      if (p2 > 0) {
        const oStart = 0.75; // 4주차 시작
        const oEnd = oStart + 0.25 * p2;
        const stepT = 2 / plotW;

        // 두 곡선 사이 간격을 옅은 빨강으로 채운다
        ctx.beginPath();
        for (let t = oStart; t <= oEnd; t += stepT) {
          const x = toX(t);
          const y = toY(p99At(t)); // 이번 주(위)
          if (t === oStart) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        for (let t = oEnd; t >= oStart; t -= stepT) {
          ctx.lineTo(toX(t), toY(p99At(t - 0.75))); // 4주 전(아래)
        }
        ctx.closePath();
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = "#fa5252";
        ctx.fill();
        ctx.globalAlpha = 1;

        // 4주 전(1주차) 곡선 — 반투명 초록
        ctx.beginPath();
        for (let t = oStart; t <= oEnd; t += stepT) {
          const x = toX(t);
          const y = toY(p99At(t - 0.75));
          if (t === oStart) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = "#40c057";
        ctx.lineWidth = 2;
        ctx.lineJoin = "round";
        ctx.stroke();
        ctx.globalAlpha = 1;

        // 초록 곡선 범례
        const legendA = clamp((p2 - 0.25) / 0.25, 0, 1);
        if (legendA > 0) {
          ctx.globalAlpha = legendA;
          ctx.font = `700 ${Math.max(9, fs - 2)}px ${FONT}`;
          ctx.fillStyle = "#2f9e44";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          const ly = toY(p99At(0.02)) + 14;
          ctx.fillText("1주차 곡선(복제)", toX(0.755), ly);
          ctx.globalAlpha = 1;
        }

        // 증가폭 라벨
        const labelA = clamp((p2 - 0.8) / 0.2, 0, 1);
        if (labelA > 0) {
          const text = "+72% (180ms → 310ms)";
          ctx.font = `700 ${Math.max(10, fs - 1)}px ${FONT}`;
          const tw = ctx.measureText(text).width;
          const lx = Math.min(toX(0.875), plotX + plotW - tw / 2 - 6);
          ctx.globalAlpha = labelA;
          ctx.fillStyle = "#fa5252";
          ctx.textAlign = "center";
          ctx.textBaseline = "alphabetic";
          ctx.fillText(text, lx, toY(THRESHOLD) + fs + 8);
          ctx.globalAlpha = 1;
        }
      }

      // --- ③ 추세선 + 외삽 마커 ---
      if (p3 > 0) {
        // 1주차 평균 → 4주차 평균을 잇고 오른쪽 끝까지 연장
        const t0 = 0.125;
        const slope = (W4_AVG - W1_AVG) / 0.75;
        const trendAt = (t: number) => W1_AVG + slope * (t - t0);
        const tCur = t0 + (1 - t0) * p3;

        ctx.strokeStyle = "#e03131";
        ctx.lineWidth = 2;
        ctx.setLineDash([7, 5]);
        ctx.beginPath();
        ctx.moveTo(toX(t0), toY(trendAt(t0)));
        ctx.lineTo(toX(tCur), toY(trendAt(tCur)));
        ctx.stroke();
        ctx.setLineDash([]);

        // 연장선이 화면 밖(6주차 지점)에서 임계선과 만난다는 마커
        const markA = clamp((p3 - 0.75) / 0.25, 0, 1);
        if (markA > 0) {
          ctx.globalAlpha = markA;

          // 진행 방향 화살촉 (플롯 오른쪽 끝, 임계선을 향해 나간다)
          const exitX = toX(1);
          const exitY = toY(trendAt(1));
          const ang = Math.atan2(toY(trendAt(1)) - toY(trendAt(0.9)), toX(1) - toX(0.9));
          ctx.beginPath();
          ctx.moveTo(exitX, exitY);
          ctx.lineTo(exitX - 9 * Math.cos(ang - 0.4), exitY - 9 * Math.sin(ang - 0.4));
          ctx.lineTo(exitX - 9 * Math.cos(ang + 0.4), exitY - 9 * Math.sin(ang + 0.4));
          ctx.closePath();
          ctx.fillStyle = "#e03131";
          ctx.fill();

          const markText = "이대로면 6주차에 임계선";
          ctx.font = `700 ${Math.max(10, fs - 1)}px ${FONT}`;
          const mw = ctx.measureText(markText).width + 16;
          const mh = badgeH - 4;
          const mx = plotX + plotW - mw - 6;
          const my = (thY + exitY) / 2 - mh / 2;
          ctx.beginPath();
          ctx.roundRect(mx, my, mw, mh, 10);
          ctx.fillStyle = "#fff5f5";
          ctx.fill();
          ctx.strokeStyle = "#fa5252";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = "#e03131";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(markText, mx + mw / 2, my + mh / 2 + 0.5);

          ctx.globalAlpha = 1;
        }
      }

      // --- 하단 캡션: 단계별 판독 ---
      const stepStart = stepIdx === 0 ? 0 : stepIdx === 1 ? P1_END : P2_END;
      const capA = clamp((e - stepStart) / 400, 0, 1);
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
