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
// 화면 800ms = 시뮬레이션 1초 (0.8× 슬로 모션)
const SCALE = 800;
const T_FWD = 500; // 요청이 게이트웨이 도착 → 백엔드로 전달, 타임아웃 카운트다운 시작
const T_ARRIVE = 1000; // 요청이 백엔드 도착, 처리 시작
const T_TIMEOUT = T_FWD + 3 * SCALE; // 2900 — 게이트웨이 3s 만료, 504 반환
const T_RETURN_END = T_TIMEOUT + 600; // 3500 — 504가 사용자에게 도착
const T_DONE = T_ARRIVE + 5 * SCALE; // 5000 — 백엔드 처리 완료 (200 기록)
const T_DROP_END = T_DONE + 600; // 5600 — 응답이 게이트웨이 앞에서 폐기
const T_QUESTION = 6100; // 두 패널 사이 "?" 모순 표시
const CYCLE = 11000; // 8000~11000 유지 후 리셋

function clamp01(t: number) {
  return Math.min(1, Math.max(0, t));
}
function easeOut(t: number) {
  return 1 - Math.pow(1 - clamp01(t), 3);
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function drawXMark(ctx: SvgDrawingContext, x: number, y: number, r: number, alpha = 1) {
  ctx.globalAlpha = alpha;
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
  ctx.globalAlpha = 1;
}

function drawDot(
  ctx: SvgDrawingContext,
  x: number,
  y: number,
  r: number,
  color: string,
  alpha: number,
) {
  if (alpha <= 0.01) return;
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawArrow(ctx: SvgDrawingContext, x1: number, y1: number, x2: number, y2: number) {
  ctx.strokeStyle = "#dee2e6";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2 - 6, y2);
  ctx.stroke();
  ctx.fillStyle = "#dee2e6";
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 7, y2 - 4);
  ctx.lineTo(x2 - 7, y2 + 4);
  ctx.closePath();
  ctx.fill();
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

export const TimeoutMismatchDemo = () => {
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
      // rAF 첫 타임스탬프가 start보다 이를 수 있으므로 음수 방어 필수
      const e = Math.max(0, (now - start) % CYCLE);
      const s = w / 640;
      const mobile = w < 480;

      // --- 레이아웃 ---
      const pad = 10;
      const userW = mobile ? 56 : Math.max(64, 84 * s);
      const gwW = mobile ? 86 : Math.max(96, 130 * s);
      const beW = mobile ? 96 : Math.max(108, 152 * s);
      const linkW = Math.max(24, (w - pad * 2 - userW - gwW - beW) / 2);
      const boxTop = 44;
      const boxH = Math.max(56, 68 * s);
      const boxCY = boxTop + boxH / 2;
      const underY = boxTop + boxH + Math.max(13, 15 * s);
      const panelTop = boxTop + boxH + Math.max(30, 36 * s);
      const panelH = Math.max(50, 58 * s);
      const capFs = Math.max(10, 12 * s);
      const h = panelTop + panelH + 16 + capFs * 2.7;

      const titleFs = Math.max(11, 13 * s);
      const labelFs = Math.max(10, 11.5 * s);
      const smallFs = Math.max(9, 10.5 * s);
      const countFs = Math.max(13, 16 * s);
      const valueFs = Math.max(11, 13.5 * s);

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      const userX = pad;
      const userRight = userX + userW;
      const gwX = userRight + linkW;
      const gwRight = gwX + gwW;
      const beX = gwRight + linkW;
      const beRight = beX + beW;

      const timedOut = e >= T_TIMEOUT;
      const done = e >= T_DONE;

      // --- 상단: 시뮬레이션 시계 + 시간 배율 ---
      const simT = Math.min(e, T_DONE) / SCALE;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.font = `700 ${labelFs}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      const clockPrefix = "경과 ";
      ctx.fillText(clockPrefix, pad, 14);
      ctx.fillStyle = "#495057";
      ctx.fillText(`${simT.toFixed(1)}s`, pad + ctx.measureText(clockPrefix).width, 14);
      ctx.textAlign = "right";
      ctx.font = `${smallFs}px ${FONT}`;
      ctx.fillStyle = "#adb5bd";
      ctx.fillText("0.8× 슬로 모션", w - pad, 14);

      // --- 연결선 (사용자 ↔ 게이트웨이 ↔ 백엔드) ---
      drawArrow(ctx, userRight, boxCY, gwX, boxCY);
      drawArrow(ctx, gwRight, boxCY, beX, boxCY);

      // --- 폐기 연출: 백엔드 → 게이트웨이 앞 점선 화살표 + X ---
      const dropX = gwRight + linkW * 0.3;
      if (e >= T_DONE) {
        const p = easeOut((e - T_DONE) / (T_DROP_END - T_DONE));
        ctx.strokeStyle = "#fa5252";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(beX, boxCY);
        ctx.lineTo(lerp(beX, dropX, p), boxCY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        if (e < T_DROP_END) {
          // 200 응답 도트가 게이트웨이를 향해 이동
          drawDot(ctx, lerp(beX, dropX, p), boxCY, Math.max(4, 5 * s), "#40c057", 1 - p * 0.4);
        } else {
          drawXMark(ctx, dropX, boxCY, Math.max(4, 5 * s), easeOut((e - T_DROP_END) / 300));
          ctx.globalAlpha = easeOut((e - T_DROP_END) / 300);
          ctx.font = `700 ${smallFs}px ${FONT}`;
          ctx.fillStyle = "#fa5252";
          ctx.textAlign = "center";
          ctx.fillText("응답 버려짐", dropX, boxCY - Math.max(13, 16 * s));
          ctx.globalAlpha = 1;
        }
      }

      // --- 요청/응답 도트 ---
      const dotR = Math.max(4, 5 * s);
      if (e < T_FWD) {
        // ① 사용자 → 게이트웨이
        const p = easeOut(e / T_FWD);
        drawDot(ctx, lerp(userRight, gwX, p), boxCY, dotR, "#228be6", 1);
      } else if (e < T_ARRIVE) {
        // ① 게이트웨이 → 백엔드
        const p = easeOut((e - T_FWD) / (T_ARRIVE - T_FWD));
        drawDot(ctx, lerp(gwRight, beX, p), boxCY, dotR, "#228be6", 1);
      }
      if (e >= T_TIMEOUT && e < T_RETURN_END) {
        // ② 게이트웨이 → 사용자: 빨간 504 응답
        const p = easeOut((e - T_TIMEOUT) / (T_RETURN_END - T_TIMEOUT));
        const x = lerp(gwX, userRight, p);
        drawDot(ctx, x, boxCY, dotR, "#fa5252", 1);
        ctx.font = `700 ${smallFs}px ${FONT}`;
        ctx.fillStyle = "#fa5252";
        ctx.textAlign = "center";
        ctx.fillText("504", x, boxCY - Math.max(11, 13 * s));
      }

      // --- 사용자 박스 ---
      ctx.beginPath();
      ctx.roundRect(userX, boxTop, userW, boxH, 6);
      ctx.fillStyle = "#f8f9fa";
      ctx.fill();
      ctx.strokeStyle = e >= T_RETURN_END ? "#fa5252" : "#adb5bd";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `700 ${labelFs}px ${FONT}`;
      ctx.fillStyle = "#495057";
      ctx.fillText("사용자", userX + userW / 2, boxCY);
      // 504 수신 배지
      if (e >= T_RETURN_END) {
        const a = easeOut((e - T_RETURN_END) / 300);
        ctx.globalAlpha = a;
        ctx.font = `700 ${smallFs}px ${FONT}`;
        const bw = ctx.measureText("504 수신").width + 14;
        const bh = Math.max(16, 18 * s);
        ctx.beginPath();
        ctx.roundRect(userX + userW / 2 - bw / 2, underY - bh / 2 + 2, bw, bh, 4);
        ctx.fillStyle = "#fa5252";
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.fillText("504 수신", userX + userW / 2, underY + 2.5);
        ctx.globalAlpha = 1;
      }

      // --- 게이트웨이 박스 ---
      ctx.beginPath();
      ctx.roundRect(gwX, boxTop, gwW, boxH, 6);
      ctx.fillStyle = timedOut ? "#fff5f5" : "#e7f5ff";
      ctx.fill();
      ctx.strokeStyle = timedOut ? "#fa5252" : "#228be6";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = `700 ${titleFs}px ${FONT}`;
      ctx.fillStyle = timedOut ? "#fa5252" : "#1c7ed6";
      ctx.fillText("게이트웨이", gwX + gwW / 2, boxTop + Math.max(14, 17 * s));
      // 카운트다운 타이머: 3.0s → 0.0s → "504 반환"
      const remain = Math.min(3, Math.max(0, 3 - (e - T_FWD) / SCALE));
      ctx.font = `700 ${countFs}px ${FONT}`;
      if (timedOut) {
        ctx.fillStyle = "#fa5252";
        ctx.fillText("504 반환", gwX + gwW / 2, boxTop + boxH * 0.66);
      } else {
        ctx.fillStyle = e < T_FWD ? "#adb5bd" : remain <= 1 ? "#fa5252" : "#1c7ed6";
        ctx.fillText(`${remain.toFixed(1)}s`, gwX + gwW / 2, boxTop + boxH * 0.66);
      }
      // 아래 라벨: 타임아웃 3s
      ctx.font = `${smallFs}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.fillText("타임아웃 3s", gwX + gwW / 2, underY + 2.5);

      // --- 백엔드 박스 ---
      const abandoned = timedOut && !done; // 연결이 끊긴 줄 모르고 일하는 구간
      ctx.beginPath();
      ctx.roundRect(beX, boxTop, beW, boxH, 6);
      ctx.fillStyle = abandoned ? "#fff9db" : "#fff";
      ctx.fill();
      ctx.strokeStyle = done ? "#40c057" : abandoned ? "#fab005" : "#dee2e6";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = `700 ${titleFs}px ${FONT}`;
      ctx.fillStyle = "#495057";
      ctx.fillText("백엔드", beX + beW / 2, boxTop + Math.max(14, 17 * s));
      // 처리 프로그레스 바 (0 → 5s)
      const workT = Math.min(5, Math.max(0, (e - T_ARRIVE) / SCALE));
      const barH = Math.max(7, 9 * s);
      const barX = beX + 10;
      const barW = beW - 20;
      const barY = boxTop + boxH - barH - Math.max(9, 11 * s);
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, barH / 2);
      ctx.fillStyle = "#f8f9fa";
      ctx.fill();
      ctx.strokeStyle = "#dee2e6";
      ctx.lineWidth = 1;
      ctx.stroke();
      if (workT > 0.05) {
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW * (workT / 5), barH, barH / 2);
        ctx.fillStyle = done ? "#40c057" : abandoned ? "#fab005" : "#228be6";
        ctx.fill();
      }
      ctx.font = `700 ${smallFs}px ${FONT}`;
      ctx.fillStyle = done ? "#2f9e44" : abandoned ? "#f08c00" : "#868e96";
      ctx.fillText(
        done ? "완료" : `${workT.toFixed(1)}s / 5s`,
        beX + beW / 2,
        barY - Math.max(8, 10 * s),
      );
      // 아래 라벨: 처리 5s (슬로 쿼리)
      ctx.font = `${smallFs}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.fillText("처리 5s (슬로 쿼리)", beX + beW / 2, underY + 2.5);

      // --- 백엔드 위 상태 배지 ---
      const badgeY = boxTop - Math.max(13, 15 * s);
      if (abandoned) {
        // ② 아무도 기다리지 않는 일 (노랑)
        const a = easeOut((e - T_TIMEOUT) / 300);
        ctx.globalAlpha = a;
        ctx.font = `700 ${smallFs}px ${FONT}`;
        const text = "아무도 기다리지 않는 일";
        const bw = ctx.measureText(text).width + 14;
        const bh = Math.max(16, 19 * s);
        const bx = Math.min(beX + beW / 2, w - pad - bw / 2);
        ctx.beginPath();
        ctx.roundRect(bx - bw / 2, badgeY - bh / 2, bw, bh, 4);
        ctx.fillStyle = "#fff9db";
        ctx.fill();
        ctx.strokeStyle = "#fab005";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "#f08c00";
        ctx.fillText(text, bx, badgeY + 0.5);
        ctx.globalAlpha = 1;
      } else if (done) {
        // ③ 200 성공 기록 (초록 체크)
        const a = easeOut((e - T_DONE) / 300);
        ctx.globalAlpha = a;
        const cx = beX + beW / 2;
        const r = Math.max(6, 7 * s);
        ctx.font = `700 ${smallFs}px ${FONT}`;
        const text = "200 성공";
        const tw = ctx.measureText(text).width;
        const total = r * 2 + 6 + tw;
        const ccx = cx - total / 2 + r;
        ctx.beginPath();
        ctx.arc(ccx, badgeY, r, 0, Math.PI * 2);
        ctx.fillStyle = "#40c057";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(ccx - r * 0.45, badgeY + r * 0.05);
        ctx.lineTo(ccx - r * 0.1, badgeY + r * 0.42);
        ctx.lineTo(ccx + r * 0.5, badgeY - r * 0.35);
        ctx.stroke();
        ctx.textAlign = "left";
        ctx.fillStyle = "#2f9e44";
        ctx.fillText(text, ccx + r + 6, badgeY + 0.5);
        ctx.textAlign = "center";
        ctx.globalAlpha = 1;
      }

      // --- 하단 지표 패널 2개 ---
      const gap = Math.max(30, 40 * s);
      const panelW = (w - pad * 2 - gap) / 2;
      const p1x = pad;
      const p2x = pad + panelW + gap;
      const panelTitleY = panelTop + Math.max(14, 16 * s);
      const panelValueY = panelTop + panelH - Math.max(15, 18 * s);

      // 게이트웨이 패널 (빨강): 504 에러율 0 → 40%
      const errPct = timedOut ? 40 * easeOut((e - T_TIMEOUT) / 1800) : 0;
      ctx.beginPath();
      ctx.roundRect(p1x, panelTop, panelW, panelH, 6);
      ctx.fillStyle = timedOut ? "#fff5f5" : "#f8f9fa";
      ctx.fill();
      ctx.strokeStyle = timedOut ? "#fa5252" : "#dee2e6";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = `${smallFs}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.fillText("게이트웨이가 보는 세상", p1x + panelW / 2, panelTitleY);
      ctx.font = `700 ${valueFs}px ${FONT}`;
      ctx.fillStyle = timedOut ? "#fa5252" : "#adb5bd";
      ctx.fillText(
        timedOut ? `504 에러율 ${Math.round(errPct)}%` : "504 에러율 —",
        p1x + panelW / 2,
        panelValueY,
      );

      // 백엔드 패널 (초록): 성공률 100%
      ctx.beginPath();
      ctx.roundRect(p2x, panelTop, panelW, panelH, 6);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.strokeStyle = done ? "#40c057" : "#dee2e6";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = `${smallFs}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.fillText("백엔드가 보는 세상", p2x + panelW / 2, panelTitleY);
      ctx.font = `700 ${valueFs}px ${FONT}`;
      ctx.fillStyle = done ? "#2f9e44" : "#adb5bd";
      ctx.fillText(done ? "성공률 100%" : "성공률 —", p2x + panelW / 2, panelValueY);

      // 두 패널 사이 "?" 모순 표시
      if (e >= T_QUESTION) {
        const a = easeOut((e - T_QUESTION) / 400);
        const qr = Math.max(10, 12 * s);
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(w / 2, panelTop + panelH / 2, qr, 0, Math.PI * 2);
        ctx.fillStyle = "#fff9db";
        ctx.fill();
        ctx.strokeStyle = "#fab005";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.font = `700 ${Math.max(12, 14 * s)}px ${FONT}`;
        ctx.fillStyle = "#f08c00";
        ctx.fillText("?", w / 2, panelTop + panelH / 2 + 1);
        ctx.globalAlpha = 1;
      }

      // --- 하단 단계 설명 ---
      let caption = "① 게이트웨이는 3초까지만 기다린다 — 백엔드의 쿼리는 5초짜리";
      if (e >= T_DONE) {
        caption = "③ 두 대시보드가 서로 모순이면 고장이 아니라 타임아웃 계층부터 의심하라";
      } else if (e >= T_TIMEOUT) {
        caption = "② 사용자는 이미 에러를 받았는데, 백엔드는 계속 일한다";
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
