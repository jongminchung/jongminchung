import React, { useEffect, useRef } from "react";

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

// 타임라인 (ms)
const N_PERIODS = 7; // 화면에 보여줄 CFS 주기 수
const LOW_PERIODS = 3; // 앞 3개 주기는 부하 낮음
const T_PERIOD = 1200; // 주기 하나가 채워지는 실제 시간
const FILL_MS = N_PERIODS * T_PERIOD;
const HOLD_MS = 2600; // ④ 완성 화면을 잠시 유지
const CYCLE = FILL_MS + HOLD_MS;

// limit 500m(0.5코어) → 100ms 주기당 quota 50ms
const QUOTA_MS = 50;
const LOW_RUN_MS = 25; // 부하 낮을 때 실제 사용량
const P99_MAX = 300;

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
function smoothstep(t: number) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

// u: 0~N_PERIODS (주기 단위 가상 시간) → P99 응답 시간 (ms)
// 스로틀이 시작되는 주기마다 계단식으로 오르고, 스로틀 구간에서 스파이크가 튄다
function p99At(u: number): number {
  const wob = 3 * Math.sin(u * Math.PI * 3.1) + 2 * Math.sin(u * Math.PI * 7.3);
  const levels = [62, 140, 195, 235, 262] as const; // 스로틀 주기를 지날 때마다의 기준선
  if (u < LOW_PERIODS) return clamp(levels[0] + wob, 40, P99_MAX);
  const i = Math.min(Math.floor(u), N_PERIODS - 1);
  const k = i - LOW_PERIODS; // 몇 번째 스로틀 주기인가 (0~3)
  const f = clamp(u - i, 0, 1); // 주기 내 진행률 (0.5부터 스로틀)
  const from = levels[k];
  const to = levels[k + 1];
  if (from === undefined || to === undefined) return clamp(levels[0] + wob, 40, P99_MAX);
  const rise = smoothstep((f - 0.5) / 0.4);
  const spike = f > 0.5 ? 26 * Math.exp(-Math.pow((f - 0.76) / 0.1, 2)) : 0;
  return clamp(from + (to - from) * rise + spike + wob, 40, P99_MAX);
}

// 빨간 빗금(강제 정지 구간)
function drawHatch(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  if (w <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = "#fff5f5";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#fa5252";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let d = -h; d < w; d += 5) {
    ctx.moveTo(x + d, y + h);
    ctx.lineTo(x + d + h, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  text: string,
  bg: string,
  color: string,
  fs: number,
  alpha = 1,
): number {
  if (alpha <= 0.01) return 0;
  ctx.globalAlpha = alpha;
  ctx.font = `700 ${fs}px ${FONT}`;
  const bw = ctx.measureText(text).width + 18;
  ctx.beginPath();
  ctx.roundRect(x, y, bw, h, h / 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + bw / 2, y + h / 2 + 0.5);
  ctx.textAlign = "left";
  ctx.globalAlpha = 1;
  return bw;
}

export const ThrottlingDemo = () => {
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
      // u: 주기 단위 가상 시간 (0~N_PERIODS). FILL 이후는 완성 화면 유지
      const u = Math.min(e, FILL_MS) / T_PERIOD;

      const fs = Math.max(10, Math.min(12, w / 46));
      const sfs = Math.max(9, fs - 2);
      const pad = 8;
      const axisW = Math.max(34, fs * 3.4);
      const plotX = pad + axisW;
      const plotW = w - plotX - pad;

      const titleBaseY = pad + fs + 2;
      const labelRowY = titleBaseY + 14; // 범례·"60ms 강제 대기" 라벨 줄
      const cellsY = titleBaseY + 24;
      const cellH = Math.max(36, Math.min(48, w * 0.085));
      const trackY = cellsY + cellH + 46;
      const trackH = Math.max(64, Math.min(90, w * 0.16));
      const barY = trackY + trackH + 14;
      const barH = 24;
      const captionH = isMobile ? fs * 2 + 24 : fs + 20;
      const h = barY + barH + captionH + 6;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      // ===== (a) CFS 주기 확대 =====
      ctx.font = `700 ${fs}px ${FONT}`;
      ctx.fillStyle = "#495057";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("CFS 주기 확대 (100ms 단위)", plotX, titleBaseY);

      ctx.font = `${sfs}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.textAlign = "right";
      ctx.fillText("limit 500m → quota 50ms/주기", plotX + plotW, titleBaseY);
      ctx.textAlign = "left";

      // 범례 (셀 위 왼쪽)
      let lx = plotX;
      ctx.fillStyle = "#228be6";
      ctx.fillRect(lx, labelRowY - 8, 10, 10);
      lx += 14;
      ctx.font = `${sfs}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.textBaseline = "middle";
      ctx.fillText("실행", lx, labelRowY - 2.5);
      lx += ctx.measureText("실행").width + 10;
      drawHatch(ctx, lx, labelRowY - 8, 10, 10);
      ctx.strokeStyle = "#fa5252";
      ctx.lineWidth = 1;
      ctx.strokeRect(lx, labelRowY - 8, 10, 10);
      lx += 14;
      ctx.fillStyle = "#868e96";
      ctx.fillText("스로틀(강제 정지)", lx, labelRowY - 2.5);

      const cellGap = 4;
      const cellW = (plotW - cellGap * (N_PERIODS - 1)) / N_PERIODS;
      const cellX = (i: number) => plotX + i * (cellW + cellGap);

      for (let i = 0; i < N_PERIODS; i++) {
        const cx0 = cellX(i);
        ctx.fillStyle = "#f8f9fa";
        ctx.fillRect(cx0, cellsY, cellW, cellH);

        const f = clamp(u - i, 0, 1) * 100; // 주기 내 경과(ms)
        const runMs = i < LOW_PERIODS ? LOW_RUN_MS : QUOTA_MS;
        const runW = (Math.min(f, runMs) / 100) * cellW;
        if (runW > 0) {
          ctx.fillStyle = "#228be6";
          ctx.fillRect(cx0, cellsY, runW, cellH);
        }
        if (i >= LOW_PERIODS && f > QUOTA_MS) {
          const tx = cx0 + (QUOTA_MS / 100) * cellW;
          const tw = ((Math.min(f, 100) - QUOTA_MS) / 100) * cellW;
          drawHatch(ctx, tx, cellsY, tw, cellH);
        }

        // quota(40ms) 위치 점선
        const qx = cx0 + (QUOTA_MS / 100) * cellW;
        ctx.strokeStyle = "#adb5bd";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(qx, cellsY);
        ctx.lineTo(qx, cellsY + cellH);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = "#dee2e6";
        ctx.lineWidth = 1;
        ctx.strokeRect(cx0, cellsY, cellW, cellH);
      }

      // "60ms 강제 대기" — 빗금 구간 위 (스로틀 시작 후 페이드 인)
      const throttleA = clamp((u - (LOW_PERIODS + 0.55)) / 0.35, 0, 1);
      if (throttleA > 0) {
        ctx.globalAlpha = throttleA;
        ctx.font = `700 ${sfs}px ${FONT}`;
        ctx.fillStyle = "#fa5252";
        ctx.textAlign = "center";
        const groupCx =
          cellX(LOW_PERIODS) +
          (cellW * (N_PERIODS - LOW_PERIODS) + cellGap * (N_PERIODS - LOW_PERIODS - 1)) / 2;
        ctx.fillText("50ms 강제 대기", groupCx, labelRowY - 2.5);
        ctx.textAlign = "left";
        ctx.globalAlpha = 1;
      }

      // 셀 아래 구간 라벨
      const groupY = cellsY + cellH + 14;
      ctx.font = `${sfs}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#868e96";
      const lowCx = plotX + (cellW * LOW_PERIODS + cellGap * (LOW_PERIODS - 1)) / 2;
      ctx.fillText("부하 낮음 · 25ms만 사용", lowCx, groupY);
      const highA = clamp((u - LOW_PERIODS) / 0.4, 0, 1);
      if (highA > 0) {
        ctx.globalAlpha = highA;
        ctx.fillStyle = "#495057";
        ctx.font = `700 ${sfs}px ${FONT}`;
        const highCx =
          cellX(LOW_PERIODS) +
          (cellW * (N_PERIODS - LOW_PERIODS) + cellGap * (N_PERIODS - LOW_PERIODS - 1)) / 2;
        ctx.fillText("부하 증가 · 50ms 조기 소진", highCx, groupY);
        ctx.globalAlpha = 1;
      }
      ctx.textAlign = "left";

      // ===== (b) P99 응답 시간 트랙 =====
      ctx.font = `700 ${fs}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.fillText("P99 응답 시간", plotX, trackY - 7);
      ctx.font = `${sfs}px ${FONT}`;
      ctx.fillStyle = "#adb5bd";
      ctx.fillText("(ms)", plotX + plotW - ctx.measureText("(ms)").width, trackY - 7);

      ctx.fillStyle = "#f8f9fa";
      ctx.fillRect(plotX, trackY, plotW, trackH);

      // 스로틀 구간 음영 (지나간 구간만)
      for (let i = LOW_PERIODS; i < N_PERIODS; i++) {
        const s0 = i + QUOTA_MS / 100;
        const s1 = Math.min(u, i + 1);
        if (s1 <= s0) continue;
        const sx = plotX + (s0 / N_PERIODS) * plotW;
        const sw = ((s1 - s0) / N_PERIODS) * plotW;
        ctx.fillStyle = "#fff5f5";
        ctx.fillRect(sx, trackY, sw, trackH);
      }

      // 주기 경계선
      for (let i = 1; i < N_PERIODS; i++) {
        const gx = plotX + (i / N_PERIODS) * plotW;
        ctx.strokeStyle = "#e9ecef";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(gx, trackY);
        ctx.lineTo(gx, trackY + trackH);
        ctx.stroke();
      }

      // 눈금선 + 값 라벨
      [0, 100, 200, 300].forEach((v) => {
        const gy = trackY + trackH * (1 - v / P99_MAX);
        ctx.strokeStyle = "#dee2e6";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(plotX, gy);
        ctx.lineTo(plotX + plotW, gy);
        ctx.stroke();
        ctx.font = `${sfs}px ${FONT}`;
        ctx.fillStyle = "#adb5bd";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(`${v}`, plotX - 6, gy);
      });
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";

      ctx.strokeStyle = "#adb5bd";
      ctx.lineWidth = 1;
      ctx.strokeRect(plotX, trackY, plotW, trackH);

      // 곡선 (a와 시간 동기화)
      const toY = (v: number) => trackY + trackH * (1 - clamp(v, 0, P99_MAX) / P99_MAX);
      const endPx = (u / N_PERIODS) * plotW;
      if (endPx > 0) {
        ctx.beginPath();
        for (let px = 0; px <= endPx; px += 2) {
          const cy = toY(p99At((px / plotW) * N_PERIODS));
          if (px === 0) ctx.moveTo(plotX, cy);
          else ctx.lineTo(plotX + px, cy);
        }
        ctx.lineTo(plotX + endPx, toY(p99At(u)));
        ctx.strokeStyle = "#845ef7";
        ctx.lineWidth = 2;
        ctx.lineJoin = "round";
        ctx.stroke();
      }

      // 진행 커서 + 현재 값
      const cx = plotX + endPx;
      const p99Now = p99At(u);
      const dotY = toY(p99Now);
      if (u < N_PERIODS) {
        ctx.strokeStyle = "#adb5bd";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(cx, cellsY);
        ctx.lineTo(cx, trackY + trackH);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.beginPath();
      ctx.arc(cx, dotY, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#845ef7";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const valLabel = `${Math.round(p99Now)}ms`;
      ctx.font = `700 ${Math.max(9, fs - 1)}px ${FONT}`;
      const nearRight = cx > plotX + plotW - ctx.measureText(valLabel).width - 12;
      const labelY = dotY - 10 < trackY + 6 ? dotY + 12 : dotY - 10;
      ctx.textAlign = nearRight ? "right" : "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#845ef7";
      ctx.fillText(valLabel, cx + (nearRight ? -8 : 8), labelY);
      ctx.textAlign = "left";

      // ===== (c) 고정 정보 바 =====
      const greenW = drawBadge(
        ctx,
        plotX,
        barY,
        barH,
        "CPU 사용률 그래프: 이상 없음",
        "#d3f9d8",
        "#2f9e44",
        sfs,
      );
      drawBadge(
        ctx,
        plotX + greenW + 8,
        barY,
        barH,
        "컨테이너 스로틀 발생 ↑",
        "#ffe3e3",
        "#fa5252",
        sfs,
        throttleA,
      );

      // ===== 하단 단계 캡션 =====
      let caption = "① 부하가 낮을 땐 주기당 할당량(50ms) 안에서 끝난다";
      if (u >= 5.4) {
        caption = "③ 사용률 그래프는 평온한데 P99만 튄다";
      } else if (u >= LOW_PERIODS + 0.5) {
        caption = "② 부하가 늘자 50ms를 조기 소진";
      }

      const captionY = barY + barH + 12;
      ctx.font = `${Math.max(10, fs - 1)}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      if (ctx.measureText(caption).width <= w - pad * 2) {
        ctx.fillText(caption, w / 2, captionY + fs);
      } else {
        // 좁은 화면에서는 " — " 기준으로 두 줄로 나눈다
        const sep = caption.indexOf(" — ");
        const line1 = sep >= 0 ? caption.slice(0, sep) : caption;
        const line2 = sep >= 0 ? `— ${caption.slice(sep + 3)}` : "";
        ctx.fillText(line1, w / 2, captionY + fs);
        if (line2) ctx.fillText(line2, w / 2, captionY + fs * 2 + 4);
      }
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
