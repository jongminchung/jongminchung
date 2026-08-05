import React, { useEffect, useRef } from "react";

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

// 타임라인 (ms): 네 패널이 동시에 그려진다
const T_DRAW = 3500; // 곡선을 그리는 시간
const T_HOLD = 3000; // 완성된 그림을 보여주는 시간
const CYCLE = T_DRAW + T_HOLD;

const RPS_MAX = 10000; // Y축 상한
const HOURS = 48; // X축: 이틀치

const DROP_T = 0.7; // ② 수직 급락 지점 (진행률)
const SURGE_T = 0.55; // ③ 수직 급증 지점 (진행률)
const SPIKE_HOURS = [4, 28]; // ④ 새벽 4시 스파이크 (이틀)

interface Scenario {
  title: string;
  reading: string;
  color: string; // 판독 라벨·배지 텍스트 색
  badgeBg: string; // 배지 배경
  revealP: number; // 판독 캡션이 페이드 인되는 진행률
}

const SCENARIOS: Scenario[] = [
  {
    title: "① 평소 모양",
    reading: "매일 반복되는 지표",
    color: "#2f9e44",
    badgeBg: "#d3f9d8",
    revealP: 0.78,
  },
  {
    title: "② 수직 급락",
    reading: "서버가 한가해진 게 아니라 요청이 도달하지 못하는 것",
    color: "#fa5252",
    badgeBg: "#fff5f5",
    revealP: 0.78,
  },
  {
    title: "③ 수직 급증",
    reading: "바이럴·공격·크롤러일 수 있다",
    color: "#f08c00",
    badgeBg: "#fff9db",
    revealP: 0.68,
  },
  {
    title: "④ 새벽의 규칙적 스파이크",
    reading: "배치·크론을 한 번 의심해보자",
    color: "#845ef7",
    badgeBg: "#f3f0ff",
    revealP: 0.72,
  },
];

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
// 하루 24시간 기준 순환 거리
function circDist(a: number, b: number) {
  const d = Math.abs(a - b) % 24;
  return Math.min(d, 24 - d);
}
function bump(hd: number, center: number, sigma: number) {
  const d = circDist(hd, center);
  return Math.exp(-(d * d) / (2 * sigma * sigma));
}

// 하루의 능선: 점심(12:30)·저녁(19시)에 봉우리 ~9k, 새벽 4시에 골짜기 ~2.1k
function baseRps(hour: number) {
  const hd = ((hour % 24) + 24) % 24;
  return 2000 + 6600 * bump(hd, 12.5, 2.8) + 6800 * bump(hd, 19, 2.8);
}

// t: 0~1 (시간축 진행률, 48시간) → RPS
function rpsAt(scenario: number, t: number): number {
  const hour = t * HOURS;
  const texture = 120 * wave(t, 22, 0.8) + 70 * wave(t, 47, 2.1);

  if (scenario === 0) {
    // 이틀 반복되는 일간 능선
    return clamp(baseRps(hour) + texture, 0, RPS_MAX);
  }
  if (scenario === 1) {
    // 같은 능선을 그리다 수직으로 0 근처까지 낙하 후 바닥
    const normal = baseRps(hour) + texture;
    const floor = 130 + 60 * wave(t, 10, 0.3);
    const drop = smoothstep((t - DROP_T) / 0.008);
    return clamp(normal + (floor - normal) * drop, 0, RPS_MAX);
  }
  if (scenario === 2) {
    // 완만한 능선을 그리다 수직으로 2~3배 치솟아 고원 유지
    const gentle = 2600 + 0.28 * baseRps(hour) + 0.5 * texture;
    const plateau = 8800 + 160 * wave(t, 12, 0.5) + 0.5 * texture;
    const jump = smoothstep((t - SURGE_T) / 0.008);
    return clamp(gentle + (plateau - gentle) * jump, 0, RPS_MAX);
  }
  // 정상 능선 + 매일 새벽 4시 정확히 같은 위치에 짧고 뾰족한 스파이크
  let v = baseRps(hour) + texture;
  for (const c of SPIKE_HOURS) {
    const d = hour - c;
    v += 6600 * Math.exp(-(d * d) / (2 * 0.4 * 0.4));
  }
  return clamp(v, 0, RPS_MAX);
}

function fmtRps(v: number) {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`;
}

// 판독 캡션을 패널 폭에 맞춰 최대 세 줄로 나눈다
function wrapReading(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  if (ctx.measureText(text).width <= maxW) return [text];

  // ' — ' 기준 분할을 먼저 시도하고, 넘치는 조각은 단어 단위로 다시 접는다
  const sep = text.indexOf(" — ");
  const chunks = sep >= 0 ? [text.slice(0, sep), `— ${text.slice(sep + 3)}`] : [text];

  const lines: string[] = [];
  for (const chunk of chunks) {
    if (ctx.measureText(chunk).width <= maxW) {
      lines.push(chunk);
      continue;
    }
    const words = chunk.split(" ");
    let line = "";
    for (const word of words) {
      const cand = line ? `${line} ${word}` : word;
      if (ctx.measureText(cand).width > maxW && line) {
        lines.push(line);
        line = word;
      } else {
        line = cand;
      }
    }
    if (line) lines.push(line);
  }
  return lines.slice(0, 3);
}

export const TrafficPatternDemo = () => {
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

      const e = Math.max(0, (now - start) % CYCLE);
      const progress = Math.min(1, e / T_DRAW);

      // --- 그리드 레이아웃: 넓으면 2×2, 좁으면 1열 ---
      const cols = w >= 560 ? 2 : 1;
      const rows = Math.ceil(SCENARIOS.length / cols);
      const pad = 8;
      const gapX = 20;
      const gapY = 20;
      const panelW = (w - pad * 2 - gapX * (cols - 1)) / cols;

      const fs = Math.max(9.5, Math.min(12, panelW / 26));
      const axisW = Math.max(26, fs * 2.4);
      const badgeH = 22;
      const plotW = panelW - axisW;
      const trackH = Math.max(90, Math.min(130, panelW * 0.34));
      const captionLineH = fs + 3;
      const captionH = captionLineH * 3 + 4;
      const panelH = badgeH + 8 + trackH + 16 + captionH;

      const headerH = fs + 12;
      const h = pad + headerH + rows * panelH + (rows - 1) * gapY + pad;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      // --- 공통 헤더 ---
      ctx.font = `700 ${fs}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("RPS(초당 요청 수) · 이틀치(48시간)", pad, pad + fs);

      SCENARIOS.forEach((sc, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const px0 = pad + col * (panelW + gapX);
        const py0 = pad + headerH + row * (panelH + gapY);

        const plotX = px0 + axisW;
        const trackY = py0 + badgeH + 8;
        const trackBottom = trackY + trackH;
        const captionTop = trackBottom + 16;

        const toY = (v: number) => trackY + trackH * (1 - clamp(v, 0, RPS_MAX) / RPS_MAX);

        // --- 시나리오 제목 배지 (사이클 시작 시 페이드 인) ---
        const badgeA = Math.min(1, e / 300);
        ctx.globalAlpha = badgeA;
        ctx.font = `700 ${fs}px ${FONT}`;
        const badgeW = ctx.measureText(sc.title).width + 20;
        ctx.beginPath();
        ctx.roundRect(px0, py0, badgeW, badgeH, 12);
        ctx.fillStyle = sc.badgeBg;
        ctx.fill();
        ctx.fillStyle = sc.color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(sc.title, px0 + badgeW / 2, py0 + badgeH / 2 + 0.5);
        ctx.globalAlpha = 1;

        // --- 트랙 ---
        ctx.fillStyle = "#f8f9fa";
        ctx.fillRect(plotX, trackY, plotW, trackH);

        // 세로 눈금(12시간 간격) + 시간 라벨(0·24·48시만)
        for (let hh = 0; hh <= HOURS; hh += 12) {
          const gx = plotX + (plotW * hh) / HOURS;
          if (hh > 0 && hh < HOURS) {
            ctx.strokeStyle = hh === 24 ? "#ced4da" : "#e9ecef";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(gx, trackY);
            ctx.lineTo(gx, trackBottom);
            ctx.stroke();
          }
          if (hh % 24 === 0) {
            ctx.font = `${Math.max(9, fs - 2)}px ${FONT}`;
            ctx.fillStyle = "#adb5bd";
            ctx.textAlign = hh === 0 ? "left" : hh === HOURS ? "right" : "center";
            ctx.textBaseline = "alphabetic";
            ctx.fillText(`${hh}시`, gx, trackBottom + 12);
          }
        }

        // 가로 눈금(0 / 5k / 10k)
        [0, 5000, 10000].forEach((v) => {
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
          ctx.fillText(v === 0 ? "0" : `${v / 1000}k`, plotX - 6, gy);
        });

        ctx.strokeStyle = "#adb5bd";
        ctx.lineWidth = 1;
        ctx.strokeRect(plotX, trackY, plotW, trackH);

        // --- 곡선 (왼쪽→오른쪽 진행) ---
        const valueAt = (t: number) => rpsAt(i, t);
        const endPx = plotW * progress;
        const endT = endPx / plotW;

        const traceCurve = () => {
          ctx.beginPath();
          for (let px = 0; px <= endPx; px += 2) {
            const cy = toY(valueAt(px / plotW));
            if (px === 0) ctx.moveTo(plotX, cy);
            else ctx.lineTo(plotX + px, cy);
          }
          ctx.lineTo(plotX + endPx, toY(valueAt(endT)));
        };

        if (progress > 0) {
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

        // --- 시나리오별 주석 ---
        if (i === 1 && progress > DROP_T + 0.01) {
          // 낙하 지점의 빨간 화살표
          const a = clamp((progress - DROP_T - 0.01) / 0.06, 0, 1);
          const ax = plotX + plotW * DROP_T + 9;
          const yTop = toY(5200);
          const yBot = toY(900);
          ctx.globalAlpha = a;
          ctx.strokeStyle = "#fa5252";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(ax, yTop);
          ctx.lineTo(ax, yBot - 7);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(ax, yBot);
          ctx.lineTo(ax - 5, yBot - 8);
          ctx.lineTo(ax + 5, yBot - 8);
          ctx.closePath();
          ctx.fillStyle = "#fa5252";
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        if (i === 3) {
          // 이틀 모두 정확히 같은 시각의 스파이크 강조
          SPIKE_HOURS.forEach((c, si) => {
            const tc = c / HOURS;
            if (progress <= tc + 0.012) return;
            const a = clamp((progress - tc - 0.012) / 0.06, 0, 1);
            const sx = plotX + plotW * tc;
            const tipY = toY(8700);

            ctx.globalAlpha = a;
            ctx.strokeStyle = "#845ef7";
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(sx, tipY);
            ctx.lineTo(sx, trackBottom);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.font = `700 ${Math.max(9, fs - 1)}px ${FONT}`;
            ctx.fillStyle = "#845ef7";
            ctx.textAlign = si === 0 ? "center" : "right";
            ctx.textBaseline = "alphabetic";
            ctx.fillText(si === 0 ? "새벽 4시" : "또 새벽 4시", sx + (si === 0 ? 0 : 30), tipY - 8);
            ctx.globalAlpha = 1;
          });
        }

        // --- 진행 커서 + 현재 값 ---
        const rpsNow = valueAt(progress);
        const dotY = toY(rpsNow);
        const cx = plotX + plotW * progress;

        if (progress < 1) {
          ctx.strokeStyle = "#adb5bd";
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(cx, trackY);
          ctx.lineTo(cx, trackBottom);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.beginPath();
        ctx.arc(cx, dotY, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = "#228be6";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const dotLabel = fmtRps(rpsNow);
        ctx.font = `700 ${Math.max(9, fs - 1)}px ${FONT}`;
        const nearRight = cx > plotX + plotW - ctx.measureText(dotLabel).width - 12;
        const labelY = dotY - 10 < trackY + 6 ? dotY + 12 : dotY - 10;
        ctx.textAlign = nearRight ? "right" : "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#228be6";
        ctx.fillText(dotLabel, cx + (nearRight ? -8 : 8), labelY);

        // --- 패널 하단 캡션: 판독 요지 (패턴이 드러난 뒤 페이드 인) ---
        const readA = clamp((progress - sc.revealP) / 0.1, 0, 1);
        if (readA > 0) {
          ctx.font = `700 ${Math.max(9.5, fs - 1)}px ${FONT}`;
          ctx.globalAlpha = readA;
          ctx.fillStyle = sc.color;
          ctx.textAlign = "center";
          ctx.textBaseline = "alphabetic";
          const lines = wrapReading(ctx, sc.reading, panelW - 4);
          lines.forEach((line, li) => {
            ctx.fillText(line, px0 + panelW / 2, captionTop + fs + li * captionLineH);
          });
          ctx.globalAlpha = 1;
        }
        ctx.textAlign = "left";
      });

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
