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

// 시나리오 타임라인 (ms) — 모든 이벤트 시각을 상수로 고정한 결정론적 연출
const T_SLOW = 2500; // ② DB 슬로 쿼리 발생
const DIE = [5000, 7000, 8600]; // 서버 1·2·3이 차례로 헬스체크에서 제외되는 시각
const T_VERDICT = 9000; // ④ 전면 장애 판독
const CYCLE = 13000;
const FAIL_LABEL_DUR = 1800; // 제외 직후 "헬스체크 실패" 라벨 표시 시간

// 각 서버의 스레드 풀 게이지 키프레임 [시각, %]
// 재분배될수록 남은 서버의 기울기가 가팔라진다 = 도미노
const GAUGE: number[][][] = [
  [
    [0, 30],
    [T_SLOW, 32],
    [DIE[0], 100],
  ],
  [
    [0, 27],
    [T_SLOW, 29],
    [DIE[0], 58],
    [DIE[1], 100],
  ],
  [
    [0, 33],
    [T_SLOW, 31],
    [DIE[0], 52],
    [DIE[1], 74],
    [DIE[2], 100],
  ],
];

// 요청 도트: 스폰 시각과 목적 서버를 미리 계산해 둔다 (난수 없음)
interface Dot {
  t0: number;
  srv: number;
  leg1: number; // LB → 서버 이동 시간
  leg2: number; // 서버 → DB 이동 시간
}
const DOTS: Dot[] = (() => {
  const dots: Dot[] = [];
  let k = 0;
  for (let t = 200; t < DIE[2]; t += 300) {
    const alive: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      if (t < DIE[i]) alive.push(i);
    }
    if (alive.length === 0) break;
    const leg1 = 500;
    dots.push({ t0: t, srv: alive[k % alive.length], leg1, leg2: t + leg1 >= T_SLOW ? 1800 : 600 });
    k += 1;
  }
  return dots;
})();

function clamp01(t: number) {
  return Math.min(1, Math.max(0, t));
}
function easeOut(t: number) {
  return 1 - Math.pow(1 - clamp01(t), 3);
}

// 키프레임 선형 보간
function interp(e: number, keys: number[][]): number {
  if (e <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i += 1) {
    if (e < keys[i][0]) {
      const [t0, v0] = keys[i - 1];
      const [t1, v1] = keys[i];
      return v0 + ((v1 - v0) * (e - t0)) / (t1 - t0);
    }
  }
  return keys[keys.length - 1][1];
}

// LB가 각 서버에 보내는 트래픽 비율 (제외되면 null)
function share(e: number, i: number): number | null {
  if (e >= DIE[i]) return null;
  if (e < DIE[0]) return 33;
  if (e < DIE[1]) return 50;
  return 100;
}

function drawXMark(ctx: SvgDrawingContext, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r + 3.5, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.strokeStyle = "#fa5252";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - r, y - r);
  ctx.lineTo(x + r, y + r);
  ctx.moveTo(x + r, y - r);
  ctx.lineTo(x - r, y + r);
  ctx.stroke();
}

type Seg = [string, string, boolean]; // [텍스트, 색, 볼드]
function drawSegs(ctx: SvgDrawingContext, segs: Seg[], cx: number, y: number, fs: number) {
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const widths = segs.map(([text, , bold]) => {
    ctx.font = `${bold ? "700 " : ""}${fs}px ${FONT}`;
    return ctx.measureText(text).width;
  });
  let x = cx - widths.reduce((a, b) => a + b, 0) / 2;
  segs.forEach(([text, color, bold], i) => {
    ctx.font = `${bold ? "700 " : ""}${fs}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    x += widths[i];
  });
}

// 캡션이 폭을 넘으면 공백 기준으로 두 줄로 나눈다 (모바일 대응)
function wrapText(ctx: SvgDrawingContext, text: string, maxW: number): string[] {
  if (ctx.measureText(text).width <= maxW) return [text];
  const words = text.split(" ");
  let line1 = "";
  let i = 0;
  while (i < words.length) {
    const next = line1 ? `${line1} ${words[i]}` : words[i];
    if (line1 && ctx.measureText(next).width > maxW) break;
    line1 = next;
    i += 1;
  }
  return [line1, words.slice(i).join(" ")];
}

export const CascadeDemo = () => {
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
      const e = Math.max(0, (now - start) % CYCLE);
      const s = w / 640;
      const mobile = w < 480;

      // --- 레이아웃 ---
      const pad = 10;
      const lbW = mobile ? 56 : Math.max(70, 92 * s);
      const lbH = Math.max(46, 58 * s);
      const dbW = mobile ? 52 : Math.max(60, 78 * s);
      const dbH = Math.max(44, 56 * s);
      const linkW = mobile ? 30 : Math.max(44, 72 * s);
      const srvW = w - pad * 2 - lbW - dbW - linkW * 2;
      const srvH = mobile ? 54 : Math.max(54, 66 * s);
      const srvGap = Math.max(12, 16 * s);

      const topY = 15;
      const colTop = topY + 16;
      const colH = 3 * srvH + 2 * srvGap;
      const midY = colTop + colH / 2;
      const verdictH = mobile ? 44 : 28;
      const capH = mobile ? 34 : 22;
      const h = colTop + colH + 10 + verdictH + capH + 4;

      const labelFs = Math.max(10, 11.5 * s);
      const smallFs = Math.max(9, 10.5 * s);
      const titleFs = Math.max(11, 13 * s);
      const capFs = Math.max(10, 12 * s);

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      const lbX = pad;
      const lbRight = lbX + lbW;
      const srvX = lbRight + linkW;
      const srvRight = srvX + srvW;
      const dbX = srvRight + linkW;
      const srvY = (i: number) => colTop + i * (srvH + srvGap);
      const srvCY = (i: number) => srvY(i) + srvH / 2;
      const slow = e >= T_SLOW;
      const deadCount = DIE.filter((d) => e >= d).length;

      // --- 상단: 유입 트래픽 라벨 ---
      const mode = e < DIE[0] ? "균등 분배" : e < DIE[2] ? "재분배 중" : "보낼 서버 없음";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.font = `700 ${labelFs}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      const prefix = "유입 트래픽: ";
      ctx.fillText(prefix, pad, topY);
      ctx.fillStyle = e < DIE[0] ? "#228be6" : "#fa5252";
      ctx.fillText(mode, pad + ctx.measureText(prefix).width, topY);

      // --- 연결선: LB → 서버 ---
      for (let i = 0; i < 3; i += 1) {
        const cy = srvCY(i);
        const dead = e >= DIE[i];
        const mx = (lbRight + srvX) / 2;
        const my = (midY + cy) / 2;
        ctx.beginPath();
        ctx.moveTo(lbRight, midY);
        ctx.lineTo(srvX, cy);
        if (dead) {
          ctx.strokeStyle = "#dee2e6";
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
          drawXMark(ctx, mx, my, Math.max(4, 5 * s));
          // 제외 직후 잠깐 "헬스체크 실패" 라벨
          if (e < DIE[i] + FAIL_LABEL_DUR) {
            ctx.globalAlpha = easeOut((e - DIE[i]) / 250);
            ctx.font = `700 ${smallFs}px ${FONT}`;
            ctx.fillStyle = "#fa5252";
            ctx.textAlign = "center";
            ctx.fillText("헬스체크 실패", mx, my - Math.max(11, 13 * s));
            ctx.globalAlpha = 1;
          }
        } else {
          ctx.strokeStyle = "#adb5bd";
          ctx.lineWidth = 1.5;
          ctx.stroke();
          // 트래픽 비율 라벨: 33% → 50% → 100%로 격상
          const pct = share(e, i)!;
          ctx.font = `700 ${smallFs}px ${FONT}`;
          ctx.fillStyle = pct === 33 ? "#228be6" : pct === 50 ? "#f08c00" : "#fa5252";
          ctx.textAlign = "center";
          ctx.fillText(`${pct}%`, mx, my - 8);
        }
      }
      ctx.textAlign = "left";

      // --- 연결선: 서버 → DB ---
      for (let i = 0; i < 3; i += 1) {
        const dead = e >= DIE[i];
        ctx.beginPath();
        ctx.moveTo(srvRight, srvCY(i));
        ctx.lineTo(dbX, midY);
        ctx.strokeStyle = "#dee2e6";
        ctx.lineWidth = dead ? 1 : 1.5;
        if (dead) ctx.setLineDash([3, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // --- 요청 도트 ---
      const dotR = Math.max(3, 4.5 * s);
      for (const d of DOTS) {
        const cy = srvCY(d.srv);
        if (e >= d.t0 && e < d.t0 + d.leg1) {
          // LB → 서버
          const p = (e - d.t0) / d.leg1;
          ctx.beginPath();
          ctx.arc(lbRight + (srvX - lbRight) * p, midY + (cy - midY) * p, dotR, 0, Math.PI * 2);
          ctx.fillStyle = "#228be6";
          ctx.fill();
        } else if (e >= d.t0 + d.leg1 && e < d.t0 + d.leg1 + d.leg2) {
          // 서버 → DB (슬로 쿼리 구간에서는 노랗게, 느리게 기어간다)
          const p = (e - d.t0 - d.leg1) / d.leg2;
          ctx.beginPath();
          ctx.arc(srvRight + (dbX - srvRight) * p, cy + (midY - cy) * p, dotR, 0, Math.PI * 2);
          ctx.fillStyle = d.leg2 > 1000 ? "#fab005" : "#228be6";
          ctx.fill();
        }
      }

      // --- LB 박스 ---
      const lbY = midY - lbH / 2;
      ctx.beginPath();
      ctx.roundRect(lbX, lbY, lbW, lbH, 6);
      ctx.fillStyle = "#e7f5ff";
      ctx.fill();
      ctx.strokeStyle = "#228be6";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `700 ${titleFs}px ${FONT}`;
      ctx.fillStyle = "#1c7ed6";
      ctx.fillText("LB", lbX + lbW / 2, midY - titleFs * 0.5);
      ctx.font = `${Math.max(8, 9.5 * s)}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.fillText("로드 밸런서", lbX + lbW / 2, midY + titleFs * 0.55);

      // --- LB 아래: 정상 서버 카운터 (3 → 2 → 1 → 0) ---
      const chain: Seg[] = [];
      for (let n = 3; n >= 3 - deadCount; n -= 1) {
        if (n < 3) chain.push([" → ", "#adb5bd", false]);
        const current = n === 3 - deadCount;
        chain.push([`${n}`, current ? (n === 3 ? "#2f9e44" : "#fa5252") : "#adb5bd", current]);
      }
      ctx.font = `${smallFs}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.fillText("정상 서버", lbX + lbW / 2, lbY + lbH + Math.max(11, 13 * s));
      drawSegs(ctx, chain, lbX + lbW / 2, lbY + lbH + Math.max(24, 28 * s), smallFs);

      // --- 서버 박스 3대 ---
      for (let i = 0; i < 3; i += 1) {
        const by = srvY(i);
        const dead = e >= DIE[i];
        let g = interp(e, GAUGE[i]);
        if (e < T_SLOW) g += 2 * Math.sin(e / 240 + i * 2.1); // 정상 구간의 미세한 출렁임
        g = Math.min(100, Math.max(0, g));

        ctx.beginPath();
        ctx.roundRect(srvX, by, srvW, srvH, 6);
        ctx.fillStyle = dead ? "#fff5f5" : "#fff";
        ctx.fill();
        ctx.strokeStyle = dead ? "#fa5252" : g >= 85 ? "#fab005" : "#dee2e6";
        ctx.lineWidth = dead ? 2 : 1.5;
        ctx.stroke();

        // 제목 + 상태
        const rowY = by + Math.max(13, 16 * s);
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.font = `700 ${Math.max(10, 12 * s)}px ${FONT}`;
        ctx.fillStyle = dead ? "#fa5252" : "#495057";
        ctx.fillText(`서버 ${i + 1}`, srvX + 10, rowY);
        ctx.textAlign = "right";
        ctx.font = `700 ${smallFs}px ${FONT}`;
        if (dead) {
          ctx.fillStyle = "#fa5252";
          ctx.fillText("제외", srvX + srvW - 10, rowY);
        } else if (g >= 85) {
          ctx.fillStyle = "#f08c00";
          ctx.fillText("포화 임박", srvX + srvW - 10, rowY);
        } else {
          ctx.fillStyle = "#2f9e44";
          ctx.fillText("정상", srvX + srvW - 10, rowY);
        }
        ctx.textAlign = "left";

        // 스레드 풀 게이지 바
        const pctW = Math.max(30, 36 * s);
        const barX = srvX + 10;
        const barW = srvW - 20 - pctW;
        const barH = Math.max(7, 9 * s);
        const barY = by + srvH - barH - Math.max(9, 11 * s);
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, barH / 2);
        ctx.fillStyle = "#f8f9fa";
        ctx.fill();
        ctx.strokeStyle = "#dee2e6";
        ctx.lineWidth = 1;
        ctx.stroke();
        if (g > 2) {
          ctx.beginPath();
          ctx.roundRect(barX, barY, barW * (g / 100), barH, barH / 2);
          ctx.fillStyle = dead || g >= 85 ? "#fa5252" : g >= 60 ? "#fab005" : "#40c057";
          ctx.fill();
        }
        ctx.font = `700 ${smallFs}px ${FONT}`;
        ctx.fillStyle = dead || g >= 85 ? "#fa5252" : "#868e96";
        ctx.textAlign = "right";
        ctx.fillText(`${Math.round(g)}%`, srvX + srvW - 10, barY + barH / 2);
        ctx.textAlign = "left";
      }

      // --- DB 박스 ---
      const dbY = midY - dbH / 2;
      ctx.beginPath();
      ctx.roundRect(dbX, dbY, dbW, dbH, 6);
      ctx.fillStyle = slow ? "#fff5f5" : "#fff";
      ctx.fill();
      ctx.strokeStyle = slow ? "#fa5252" : "#40c057";
      ctx.lineWidth = 2;
      ctx.globalAlpha = slow ? 0.75 + 0.25 * Math.sin(e / 120) : 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `700 ${titleFs}px ${FONT}`;
      ctx.fillStyle = "#495057";
      ctx.fillText("DB", dbX + dbW / 2, midY - titleFs * 0.55);
      ctx.font = `700 ${smallFs}px ${FONT}`;
      ctx.fillStyle = slow ? "#fa5252" : "#2f9e44";
      ctx.fillText(slow ? "2,000ms" : "20ms", dbX + dbW / 2, midY + titleFs * 0.6);
      if (slow) {
        ctx.font = `700 ${Math.max(8, 9.5 * s)}px ${FONT}`;
        ctx.fillStyle = "#fa5252";
        ctx.fillText("슬로 쿼리", dbX + dbW / 2, dbY - Math.max(9, 11 * s));
      }

      // --- ④ 전면 장애 배지 + 판독 라벨 ---
      const verdictY = colTop + colH + 10 + verdictH / 2;
      if (e >= T_VERDICT) {
        const a = easeOut((e - T_VERDICT) / 500);
        ctx.globalAlpha = a;
        const badge = "전면 장애";
        const verdict = "서버 3대가 죽었지만 원인은 DB의 슬로 쿼리 하나";
        ctx.font = `700 ${smallFs}px ${FONT}`;
        const bw = ctx.measureText(badge).width + 16;
        const bh = Math.max(17, 20 * s);
        const drawBadge = (bx: number, by: number) => {
          ctx.beginPath();
          ctx.roundRect(bx, by - bh / 2, bw, bh, 4);
          ctx.fillStyle = "#fa5252";
          ctx.fill();
          ctx.font = `700 ${smallFs}px ${FONT}`;
          ctx.fillStyle = "#fff";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(badge, bx + bw / 2, by + 0.5);
        };
        const segs: Seg[] = [
          ["서버 3대가 죽었지만 원인은 ", "#495057", false],
          ["DB의 슬로 쿼리 하나", "#fa5252", true],
        ];
        if (mobile) {
          drawBadge(w / 2 - bw / 2, verdictY - 11);
          drawSegs(ctx, segs, w / 2, verdictY + 11, smallFs);
        } else {
          ctx.font = `${labelFs}px ${FONT}`;
          const tw = ctx.measureText(verdict).width;
          const total = bw + 10 + tw;
          drawBadge(w / 2 - total / 2, verdictY);
          drawSegs(ctx, segs, w / 2 - total / 2 + bw + 10 + tw / 2, verdictY, labelFs);
        }
        ctx.globalAlpha = 1;
      }

      // --- 하단 단계 설명 ---
      let caption = "① 정상: 트래픽이 3대에 고르게 나뉜다";
      if (e >= T_VERDICT) {
        caption = "④ 전면 장애: 도미노의 시작점은 서버가 아니라 DB였다";
      } else if (e >= DIE[0]) {
        caption = "③ 빠진 서버의 몫이 남은 서버를 더 빨리 쓰러뜨린다 — 도미노";
      } else if (e >= T_SLOW) {
        caption = "② DB가 느려지자 스레드가 마르고, 서버 1이 헬스체크에 응답하지 못한다";
      }
      ctx.font = `${capFs}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      const lines = wrapText(ctx, caption, w - 8);
      if (lines.length === 1) {
        ctx.fillText(lines[0], w / 2, h - 10);
      } else {
        ctx.fillText(lines[0], w / 2, h - 10 - capFs * 1.25);
        ctx.fillText(lines[1], w / 2, h - 10);
      }
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
