import React, { useEffect, useRef } from "react";

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

// 반복 타임라인 (ms): 7초 동안 곡선을 그리고 3초 유지한 뒤 리셋
const T_DRAW = 7000;
const T_HOLD = 3000;
const CYCLE = T_DRAW + T_HOLD;

const FAIL_T = 0.4; // 장애 시작 지점 (시간축 진행률)
const ERR_MAX = 55; // 에러율 트랙 상한 (%)
const P99_MAX = 200; // P99 트랙 상한 (ms)

const DOT_N = 10; // 요청 스트림 도트 개수
const DOT_TRAVEL = 2600; // 도트 하나가 스트림을 가로지르는 시간 (ms)

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
function smoothstep(t: number) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}
// 사이클마다 같은 그림이 나오도록 사인 합성으로 결정적인 물결을 만든다
function wave(t: number, freq: number, phase: number) {
  return Math.sin(t * Math.PI * 2 * freq + phase);
}

// t: 0~1 (시간축 진행률) → 에러율 (%)
function errAt(t: number): number {
  // 평소에는 0.1% 부근 바닥
  const calm = clamp(0.1 + 0.06 * wave(t, 5.2, 1.3), 0.04, 0.2);
  // 장애 시작 후 45~50%로 치솟는다
  const jump = smoothstep((t - FAIL_T) / 0.07);
  const stormy = 47.5 + 2.2 * wave(t, 4.6, 0.7);
  return calm + (stormy - calm) * jump;
}

// t: 0~1 → P99 응답 시간 (ms)
function p99At(t: number): number {
  // 평소에는 140ms 안팎에서 안정
  const normal = 140 + 4 * wave(t, 4.2, 2.1) + 2 * wave(t, 9.1, 0.5);
  // 장애 시작 후 오히려 75ms로 내려가 "좋아 보인다"
  const drop = smoothstep((t - FAIL_T) / 0.09);
  const survivor = 75 + 2.5 * wave(t, 5.6, 1.0);
  return normal + (survivor - normal) * drop;
}

function drawTrack(
  ctx: CanvasRenderingContext2D,
  opts: {
    x: number;
    y: number;
    w: number;
    h: number;
    title: string;
    gridValues: number[];
    max: number;
    unit: string;
    fs: number;
  },
) {
  const { x, y, w, h, title, gridValues, max, unit, fs } = opts;

  // 트랙 제목
  ctx.font = `700 ${fs}px ${FONT}`;
  ctx.fillStyle = "#868e96";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(title, x, y - 7);

  // 배경
  ctx.fillStyle = "#f8f9fa";
  ctx.fillRect(x, y, w, h);

  // 눈금선 + 값 라벨
  gridValues.forEach((v) => {
    const gy = y + h * (1 - v / max);
    ctx.strokeStyle = "#dee2e6";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x + w, gy);
    ctx.stroke();

    ctx.font = `${Math.max(9, fs - 2)}px ${FONT}`;
    ctx.fillStyle = "#adb5bd";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(`${v}${unit}`, x - 6, gy);
  });

  // 외곽 테두리
  ctx.strokeStyle = "#adb5bd";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
}

function drawCurve(
  ctx: CanvasRenderingContext2D,
  opts: {
    x: number;
    y: number;
    w: number;
    h: number;
    max: number;
    progress: number; // 0~1, 왼쪽→오른쪽 진행률
    valueAt: (t: number) => number;
    color: string;
  },
) {
  const { x, y, w, h, max, progress, valueAt, color } = opts;
  if (progress <= 0) return;

  const endPx = w * progress;
  const toY = (v: number) => y + h * (1 - clamp(v, 0, max) / max);
  const endT = endPx / w;

  // 곡선 아래 옅은 면 채우기
  ctx.beginPath();
  for (let px = 0; px <= endPx; px += 2) {
    const cy = toY(valueAt(px / w));
    if (px === 0) ctx.moveTo(x, cy);
    else ctx.lineTo(x + px, cy);
  }
  ctx.lineTo(x + endPx, toY(valueAt(endT)));
  ctx.save();
  ctx.lineTo(x + endPx, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();

  // 곡선 본체
  ctx.beginPath();
  for (let px = 0; px <= endPx; px += 2) {
    const cy = toY(valueAt(px / w));
    if (px === 0) ctx.moveTo(x, cy);
    else ctx.lineTo(x + px, cy);
  }
  ctx.lineTo(x + endPx, toY(valueAt(endT)));
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.stroke();
}

// 캡션을 폭에 맞게 단어 단위로 줄바꿈한다
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  maxLines: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  words.forEach((word) => {
    const trial = cur ? `${cur} ${word}` : word;
    if (!cur || ctx.measureText(trial).width <= maxW) cur = trial;
    else {
      lines.push(cur);
      cur = word;
    }
  });
  if (cur) lines.push(cur);
  return lines.slice(0, maxLines);
}

export const SurvivorshipDemo = () => {
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
      const progress = Math.min(1, e / T_DRAW);
      const failing = progress >= FAIL_T;
      const failA = clamp((progress - FAIL_T) / 0.04, 0, 1); // 장애 관련 요소 페이드 인

      const fs = Math.max(10, Math.min(12, w / 46));
      const pad = 8;
      const axisW = Math.max(34, fs * 3.2);
      const trackH = Math.max(56, Math.min(84, w * 0.15));
      const streamH = Math.max(58, Math.min(78, w * 0.13));

      const plotX = pad + axisW;
      const plotW = w - plotX - pad;
      const t1Y = pad + 22;
      const streamTop = t1Y + trackH + 24;
      const t2Y = streamTop + streamH + 28;
      const capTop = t2Y + trackH + 14;
      const capLines = isMobile ? 3 : 2;
      const h = capTop + capLines * (fs + 5) + 4;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      // --- 두 트랙 ---
      drawTrack(ctx, {
        x: plotX,
        y: t1Y,
        w: plotW,
        h: trackH,
        title: "에러율",
        gridValues: [0, 25, 50],
        max: ERR_MAX,
        unit: "%",
        fs,
      });
      drawTrack(ctx, {
        x: plotX,
        y: t2Y,
        w: plotW,
        h: trackH,
        title: "P99 응답 시간",
        gridValues: [0, 100, 200],
        max: P99_MAX,
        unit: "",
        fs,
      });
      // 아래 트랙 단위 표기
      ctx.font = `${Math.max(9, fs - 2)}px ${FONT}`;
      ctx.fillStyle = "#adb5bd";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("(ms)", plotX + plotW - ctx.measureText("(ms)").width, t2Y - 7);

      const markerX = plotX + plotW * FAIL_T;
      const cursorX = plotX + plotW * progress;

      // --- P99가 "좋아 보이는" 구간: 초록이 아니라 빨간 경고 배경 ---
      if (failA > 0) {
        ctx.globalAlpha = failA;
        ctx.fillStyle = "#fff5f5";
        ctx.fillRect(markerX, t2Y + 1, Math.max(0, cursorX - markerX), trackH - 2);
        ctx.globalAlpha = 1;

        const labelA = clamp((progress - 0.56) / 0.08, 0, 1);
        if (labelA > 0) {
          ctx.globalAlpha = labelA;
          ctx.font = `700 ${Math.max(10, fs - 1)}px ${FONT}`;
          const txt = "좋아진 게 아니다";
          const tw = ctx.measureText(txt).width;
          const lx = clamp(
            (markerX + cursorX) / 2,
            markerX + tw / 2 + 4,
            plotX + plotW - tw / 2 - 4,
          );
          ctx.fillStyle = "#fa5252";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(txt, lx, t2Y + trackH * 0.3);
          ctx.globalAlpha = 1;
        }
      }

      // --- 곡선 ---
      drawCurve(ctx, {
        x: plotX,
        y: t1Y,
        w: plotW,
        h: trackH,
        max: ERR_MAX,
        progress,
        valueAt: errAt,
        color: "#fa5252",
      });
      drawCurve(ctx, {
        x: plotX,
        y: t2Y,
        w: plotW,
        h: trackH,
        max: P99_MAX,
        progress,
        valueAt: p99At,
        color: "#845ef7",
      });

      // --- 장애 시작 마커 (세로 점선) ---
      if (failA > 0) {
        ctx.globalAlpha = failA;
        ctx.strokeStyle = "#fa5252";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        [t1Y, t2Y].forEach((ty) => {
          ctx.beginPath();
          ctx.moveTo(markerX, ty);
          ctx.lineTo(markerX, ty + trackH);
          ctx.stroke();
        });
        ctx.setLineDash([]);

        ctx.font = `700 ${Math.max(9, fs - 2)}px ${FONT}`;
        ctx.fillStyle = "#fa5252";
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillText("DB 커넥션 거부 시작", markerX, t1Y - 7);
        ctx.globalAlpha = 1;
      }

      // --- 진행 커서 + 현재 값 ---
      const errNow = errAt(progress);
      const p99Now = p99At(progress);
      const errY = t1Y + trackH * (1 - errNow / ERR_MAX);
      const p99Y = t2Y + trackH * (1 - p99Now / P99_MAX);

      if (progress < 1) {
        ctx.strokeStyle = "#adb5bd";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        [t1Y, t2Y].forEach((ty) => {
          ctx.beginPath();
          ctx.moveTo(cursorX, ty);
          ctx.lineTo(cursorX, ty + trackH);
          ctx.stroke();
        });
        ctx.setLineDash([]);
      }

      const drawDot = (dy: number, trackTop: number, color: string, label: string) => {
        ctx.beginPath();
        ctx.arc(cursorX, dy, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = `700 ${Math.max(9, fs - 1)}px ${FONT}`;
        const nearRight = cursorX > plotX + plotW - ctx.measureText(label).width - 12;
        // 값이 트랙 상단에 붙으면 라벨을 점 아래로 내린다
        const labelY = dy - 10 < trackTop + 6 ? dy + 12 : dy - 10;
        ctx.textAlign = nearRight ? "right" : "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle = color;
        ctx.fillText(label, cursorX + (nearRight ? -8 : 8), labelY);
      };
      const errLabel = errNow < 1 ? `${errNow.toFixed(1)}%` : `${Math.round(errNow)}%`;
      drawDot(errY, t1Y, "#fa5252", errLabel);
      drawDot(p99Y, t2Y, "#845ef7", `${Math.round(p99Now)}ms`);

      // --- 보조 시각화: 요청 도트 스트림이 갈라진다 ---
      const sfs = Math.max(9, fs - 2);
      ctx.font = `700 ${fs}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("요청 스트림", plotX, streamTop - 7);

      const baseY = streamTop + streamH * 0.62; // 정상 처리 경로
      const exitY = streamTop + streamH * 0.1; // 실패 이탈 경로 끝
      const splitX = plotX + plotW * 0.32;
      const exitEndX = splitX + plotW * 0.16;

      // 정상 처리 경로 가이드
      ctx.strokeStyle = "#dee2e6";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plotX, baseY);
      ctx.lineTo(plotX + plotW, baseY);
      ctx.stroke();

      ctx.font = `${sfs}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.textAlign = "right";
      ctx.fillText("요청", plotX - 6, baseY + 3);

      ctx.fillStyle = "#228be6";
      ctx.textAlign = "right";
      ctx.fillText("정상 처리 — 지연 분포에 남음", plotX + plotW, baseY - 8);

      if (failA > 0) {
        ctx.globalAlpha = failA;
        // 실패 이탈 경로 가이드
        ctx.strokeStyle = "#fa5252";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(splitX, baseY);
        ctx.lineTo(exitEndX, exitY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = `${sfs}px ${FONT}`;
        ctx.fillStyle = "#fa5252";
        ctx.textAlign = "left";
        ctx.fillText("3ms 실패 — 즉시 이탈", exitEndX + 6, exitY + 3);

        // 핵심 라벨
        const keyA = clamp((progress - 0.46) / 0.08, 0, 1);
        ctx.globalAlpha = failA * keyA;
        ctx.font = `700 ${Math.max(10, fs - 1)}px ${FONT}`;
        ctx.fillStyle = "#fa5252";
        ctx.textAlign = "center";
        ctx.fillText("P99가 보는 것은 이 절반뿐", (splitX + plotX + plotW) / 2, baseY + fs + 8);
        ctx.globalAlpha = 1;
      }

      // 도트: 짝수 번째는 장애 중에 빨간 실패 경로로 이탈한다
      for (let i = 0; i < DOT_N; i++) {
        const ph = ((now - start) / DOT_TRAVEL + i / DOT_N) % 1;
        const dx = plotX + ph * plotW * 0.96;
        const isFail = failing && i % 2 === 0;

        let dy = baseY;
        let alpha = clamp(ph / 0.05, 0, 1) * clamp((0.98 - ph) / 0.05, 0, 1);

        if (isFail && dx > splitX) {
          const d = (dx - splitX) / (exitEndX - splitX);
          if (d >= 1) continue; // 지연 분포 밖으로 사라졌다
          dy = baseY + (exitY - baseY) * smoothstep(d);
          alpha *= 1 - d * d;
        }
        if (alpha <= 0.02) continue;

        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(dx, dy, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = isFail ? "#fa5252" : "#228be6";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // --- 하단 단계 캡션 ---
      let caption = "① 평소: 에러율 0.1%, P99 140ms";
      let capColor = "#868e96";
      if (progress >= 0.62) {
        caption =
          "③ P99가 75ms로 '개선' — 빠르게 죽은 요청은 통계에서 빠졌다. 분모가 줄었을 뿐이다";
        capColor = "#fa5252";
      } else if (failing) {
        caption = "② 요청 절반이 밀리초 만에 거부된다 — 에러율 급등";
        capColor = "#fa5252";
      }
      ctx.font = `700 ${Math.max(10, fs - 1)}px ${FONT}`;
      ctx.fillStyle = capColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      wrapLines(ctx, caption, w - pad * 2, capLines).forEach((line, k) => {
        ctx.fillText(line, w / 2, capTop + fs + k * (fs + 5));
      });
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
