import React, { useEffect, useRef } from "react";

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

// 시나리오 타임라인 (ms)
const T_OVER = 2500; // ② 과부하 시작: 유입 80/s → 200/s
const T_TIMEOUT = 6800; // 왼쪽 "전원 타임아웃" 라벨 등장
const T_VERDICT = 9000; // ③ 판독 배지
const CYCLE = 12000;

// 시뮬레이션 상수 (결정론적: 난수 없음)
const CAPACITY = 100; // 서버 처리량 100/s 고정
const QUEUE_CAP = 8; // 오른쪽 큐 상한
const TRAVEL = 450; // 유입 도트가 큐 입구까지 이동하는 시간
const REJECT_DUR = 650; // 429 튕김 연출 시간
const RAMP = 800; // 오른쪽 큐가 상한까지 차는 시간
const T_FULL = T_OVER + RAMP; // 오른쪽 큐 상한 도달 → 이후 초과분 거부

// 유입 도착 스케줄: 정상 250ms 간격(80/s 연출), 과부하 100ms 간격(200/s 연출)
const ARRIVALS: number[] = (() => {
  const a: number[] = [];
  for (let t = 300; t < T_OVER; t += 250) a.push(t);
  for (let t = T_OVER; t < CYCLE; t += 100) a.push(t);
  return a;
})();

// 오른쪽 패널: 큐가 가득 찬 뒤 도착분 중 30%를 결정론적 패턴으로 거부
function isRejected(arrive: number): boolean {
  if (arrive < T_FULL) return false;
  const i = Math.round((arrive - T_OVER) / 100);
  const m = i % 10;
  return m === 0 || m === 3 || m === 6;
}

function clamp01(t: number) {
  return Math.min(1, Math.max(0, t));
}
function easeOut(t: number) {
  return 1 - Math.pow(1 - clamp01(t), 3);
}
function fmt(n: number) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// 왼쪽(무한 큐) 스토리 수치: 초과 유입 100/s만큼 큐가 자라고, 대기 = 큐길이/처리량
function leftQueue(e: number) {
  return e < T_OVER ? 0 : Math.floor((e - T_OVER) * 0.1);
}
// 오른쪽(상한 큐) 스토리 수치: 상한 8까지 차오르고 그 뒤 안정
function rightRamp(e: number) {
  return e < T_OVER ? 0 : clamp01((e - T_OVER) / RAMP);
}

function drawArrow(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number) {
  ctx.strokeStyle = "#adb5bd";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2 - 5, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y);
  ctx.lineTo(x2 - 6, y - 4);
  ctx.lineTo(x2 - 6, y + 4);
  ctx.closePath();
  ctx.fillStyle = "#adb5bd";
  ctx.fill();
}

function drawBadge(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  color: string,
  fs: number,
  pop: number,
) {
  if (pop <= 0.01) return;
  ctx.font = `700 ${fs}px ${FONT}`;
  const bw = ctx.measureText(text).width + 20;
  const bh = fs + 12;
  const bx = cx - bw / 2;
  const by = cy - bh / 2 + (1 - pop) * 6;
  ctx.globalAlpha = pop;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, bh / 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, by + bh / 2 + 0.5);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.globalAlpha = 1;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines;
}

interface PanelOpts {
  side: "left" | "right";
  e: number;
  fs: number;
  qh: number;
}

function drawPanel(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  pw: number,
  { side, e, fs, qh }: PanelOpts,
) {
  const over = e >= T_OVER;
  const labelFs = Math.max(9, fs - 3);

  // --- 제목 ---
  ctx.font = `700 ${fs}px ${FONT}`;
  ctx.fillStyle = side === "left" ? "#fa5252" : "#2f9e44";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(
    side === "left" ? "흐름 제어 없음 (무한 큐)" : "흐름 제어 있음 (큐 상한 + 즉시 거부)",
    px,
    py + fs,
  );

  // --- 레이아웃 ---
  const labelRowY = py + fs + 8 + 10; // 미니 라벨 베이스라인
  const flowTop = py + fs + 8 + 15;
  const midY = flowTop + qh / 2;
  const inflowW = Math.max(34, pw * 0.13);
  const serverW = Math.max(50, pw * 0.18);
  const arrowW = 12;
  const serverX = px + pw - serverW;
  const queueX = px + inflowW + arrowW;
  const queueW = Math.max(60, serverX - arrowW - queueX);

  // --- 미니 라벨: 유입 속도 ---
  ctx.font = `700 ${labelFs}px ${FONT}`;
  ctx.fillStyle = over ? "#fa5252" : "#868e96";
  ctx.fillText(over ? "유입 200/s" : "유입 80/s", px, labelRowY);

  // --- 유입 경로 (점선 가이드) ---
  ctx.strokeStyle = "#dee2e6";
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 4]);
  ctx.beginPath();
  ctx.moveTo(px, midY);
  ctx.lineTo(queueX - 3, midY);
  ctx.stroke();
  ctx.setLineDash([]);

  // --- 대기 큐 박스 ---
  const heat = side === "left" ? clamp01((e - T_OVER) / 6000) : 0;
  ctx.beginPath();
  ctx.roundRect(queueX, flowTop, queueW, qh, 6);
  ctx.fillStyle = "#f8f9fa";
  ctx.fill();
  if (heat > 0.01) {
    ctx.globalAlpha = 0.16 * heat;
    ctx.fillStyle = "#fa5252";
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = side === "left" && heat > 0.5 ? "#fa5252" : "#dee2e6";
  ctx.lineWidth = 1;
  ctx.globalAlpha = side === "left" && heat > 0.5 ? 0.4 + 0.6 * heat : 1;
  ctx.stroke();
  ctx.globalAlpha = 1;

  const qL = leftQueue(e);
  const ramp = rightRamp(e);
  const qR = Math.round(QUEUE_CAP * ramp);

  let pileShown = 0;
  if (side === "left") {
    // --- 무한 큐: 도트 파일이 2~3줄로 쌓인다 (앞쪽 = 오른쪽) ---
    const sp = Math.max(9, Math.min(13, queueW / 14));
    const cols = Math.max(4, Math.floor((queueW - 16) / sp));
    const maxDots = cols * 3;
    pileShown = Math.min(maxDots, Math.floor(Math.max(0, e - T_OVER) / 90), qL);
    const rowOff = [0, -sp, sp] as const;
    const r = Math.max(3, sp * 0.32);
    ctx.fillStyle = "#fab005";
    for (let k = 0; k < pileShown; k += 1) {
      const col = Math.floor(k / 3);
      const x = queueX + queueW - 10 - col * sp;
      const y = midY + (rowOff[k % 3] ?? 0);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // 화면에 못 그린 잔여분 카운터: 스토리 수치 기준으로 계속 폭증
    const rest = qL - pileShown;
    if (rest > 0) {
      ctx.font = `700 ${labelFs}px ${FONT}`;
      ctx.fillStyle = "#fa5252";
      ctx.fillText(`+${fmt(rest)}`, queueX, labelRowY);
    }
  } else {
    // --- 상한 큐: 슬롯 8칸 + 상한선(세로 점선) ---
    const ss = Math.max(10, Math.min(18, (queueW - 26) / QUEUE_CAP - 3));
    const slotX = (i: number) => queueX + queueW - 8 - (i + 1) * (ss + 3) + 3;
    const sy = midY - ss / 2;
    for (let i = 0; i < QUEUE_CAP; i += 1) {
      ctx.beginPath();
      ctx.roundRect(slotX(i), sy, ss, ss, 3);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.strokeStyle = "#dee2e6";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    const filled = Math.max(0, Math.min(QUEUE_CAP, qR));
    ctx.fillStyle = "#fab005";
    for (let i = 0; i < filled; i += 1) {
      ctx.beginPath();
      ctx.arc(slotX(i) + ss / 2, midY, ss * 0.32, 0, Math.PI * 2);
      ctx.fill();
    }
    // 상한선: 마지막 슬롯 바로 뒤(입구 쪽) 세로 점선
    const capX = slotX(QUEUE_CAP - 1) - 5;
    ctx.strokeStyle = e >= T_FULL ? "#fa5252" : "#adb5bd";
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(capX, flowTop - 3);
    ctx.lineTo(capX, flowTop + qh + 3);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = `700 ${labelFs}px ${FONT}`;
    ctx.fillStyle = e >= T_FULL ? "#fa5252" : "#868e96";
    ctx.textAlign = "center";
    ctx.fillText("상한 8", capX, labelRowY);
    ctx.textAlign = "left";
  }

  // --- 유입 도트 + (오른쪽) 429 튕김 ---
  const dotR = Math.max(3.5, Math.min(5, pw / 70));
  for (const t of ARRIVALS) {
    const rejected = side === "right" && isRejected(t);
    if (e >= t - TRAVEL && e < t) {
      // 큐 입구를 향해 이동 중
      const p = (e - (t - TRAVEL)) / TRAVEL;
      ctx.beginPath();
      ctx.arc(px + 3 + (queueX - 8 - px) * p, midY, dotR, 0, Math.PI * 2);
      ctx.fillStyle = "#228be6";
      ctx.fill();
    } else if (rejected && e >= t && e < t + REJECT_DUR) {
      // 큐 앞에서 빨간색으로 튕겨 위로 사라진다
      const p = (e - t) / REJECT_DUR;
      const x = queueX - 6;
      const y = midY - easeOut(p) * 36;
      ctx.globalAlpha = 1 - p;
      ctx.beginPath();
      ctx.arc(x, y, dotR, 0, Math.PI * 2);
      ctx.fillStyle = "#fa5252";
      ctx.fill();
      ctx.font = `700 ${labelFs}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillText("429", x, y - dotR - 3);
      ctx.textAlign = "left";
      ctx.globalAlpha = 1;
    }
  }

  // --- 화살표: 큐 → 서버 ---
  drawArrow(ctx, queueX + queueW + 2, serverX - 2, midY);

  // --- 서버 박스 (처리량 100/s 고정) ---
  ctx.beginPath();
  ctx.roundRect(serverX, flowTop, serverW, qh, 6);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.strokeStyle = "#40c057";
  ctx.lineWidth = 2;
  ctx.stroke();
  const svFs = Math.max(10, fs - 1);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${svFs}px ${FONT}`;
  ctx.fillStyle = "#495057";
  ctx.fillText("서버", serverX + serverW / 2, midY - svFs * 0.55);
  ctx.font = `700 ${labelFs}px ${FONT}`;
  ctx.fillStyle = "#2f9e44";
  ctx.fillText(`${CAPACITY}/s`, serverX + serverW / 2, midY + svFs * 0.6);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  // 일정한 처리 속도를 보여주는 프로그레스 바 — 왼쪽 후반엔 "헛수고" 회색
  const wasted = side === "left" && e >= T_TIMEOUT;
  const barP = (e % 600) / 600;
  ctx.fillStyle = wasted ? "#adb5bd" : "#228be6";
  ctx.fillRect(serverX + 4, flowTop + qh - 6, (serverW - 8) * barP, 3);

  // --- 실시간 수치 (두 줄 + 상태 한 줄) ---
  const line = fs + 6;
  let ty = flowTop + qh + 12 + fs;
  const stat = (label: string, value: string, color: string) => {
    ctx.font = `${labelFs + 1}px ${FONT}`;
    ctx.fillStyle = "#868e96";
    ctx.fillText(label, px, ty);
    const lw = ctx.measureText(label).width;
    ctx.font = `700 ${labelFs + 1}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.fillText(value, px + lw, ty);
    ty += line;
  };
  if (side === "left") {
    stat("대기 큐: ", fmt(qL), qL > 0 ? "#fa5252" : "#228be6");
    stat("대기 시간: ", `${fmt(qL * 10)} ms`, qL > 0 ? "#fa5252" : "#228be6");
    if (e >= T_TIMEOUT) {
      ctx.globalAlpha = easeOut((e - T_TIMEOUT) / 400);
      ctx.font = `700 ${labelFs}px ${FONT}`;
      ctx.fillStyle = "#fa5252";
      ctx.fillText("전원이 타임아웃 — 처리해도 이미 버려진 요청", px, ty);
      ctx.globalAlpha = 1;
    }
  } else {
    const waitR = Math.round(80 * ramp);
    stat("대기 큐: ", `${qR}${e >= T_FULL ? " (상한)" : ""}`, "#228be6");
    stat("대기 시간: ", `${waitR} ms`, "#228be6");
    if (e >= T_FULL + 100) {
      ctx.globalAlpha = easeOut((e - T_FULL - 100) / 400);
      ctx.font = `700 ${labelFs}px ${FONT}`;
      ctx.fillStyle = "#fa5252";
      ctx.fillText("거부 30%", px, ty);
      const rw = ctx.measureText("거부 30%").width;
      ctx.font = `${labelFs}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.fillText(" · 성공한 요청의 대기 80ms", px + rw, ty);
      ctx.globalAlpha = 1;
    }
  }

  // --- ③ 판독 배지 ---
  if (e >= T_VERDICT) {
    const pop = easeOut((e - T_VERDICT) / 350);
    if (side === "left") {
      drawBadge(
        ctx,
        "대기 시간 ∞ 로 발산",
        px + pw / 2,
        midY,
        "#fa5252",
        Math.max(10, fs - 1),
        pop,
      );
    } else {
      drawBadge(ctx, "수용분은 건강", px + pw / 2, midY, "#40c057", Math.max(10, fs - 1), pop);
    }
  }
}

export const BackpressureDemo = () => {
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
      // rAF 첫 타임스탬프가 start보다 이를 수 있으므로 음수 방어
      const e = Math.max(0, (now - start) % CYCLE);

      const isMobile = w < 480;
      const pad = 4;
      const gap = Math.max(14, w * 0.03);
      const fs = Math.max(11, Math.min(13, w / 46));
      const panelW = isMobile ? w - pad * 2 : (w - pad * 2 - gap) / 2;
      const qh = Math.max(40, Math.min(54, panelW * 0.18));
      const panelH = fs + 8 + 15 + qh + 12 + (fs + 6) * 3 + 4;
      const captionH = isMobile ? 48 : 34;
      const h = pad + (isMobile ? panelH * 2 + gap : panelH) + captionH;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      drawPanel(ctx, pad, pad, panelW, { side: "left", e, fs, qh });
      drawPanel(
        ctx,
        isMobile ? pad : pad + panelW + gap,
        isMobile ? pad + panelH + gap : pad,
        panelW,
        {
          side: "right",
          e,
          fs,
          qh,
        },
      );

      // --- 하단 단계 설명 ---
      let caption = "① 유입이 처리 용량보다 작으면 큐는 비어 있다";
      if (e >= T_VERDICT) {
        caption =
          "③ 큐는 공짜 완충이 아니라 부채다 — 상한 없는 큐의 대기 시간 그래프는 우상향을 멈추지 않는다";
      } else if (e >= T_OVER) {
        caption =
          "② 같은 과부하 — 왼쪽은 전원이 조금씩 죽고, 오른쪽은 일부를 빨리 거부해 나머지를 살린다";
      }
      ctx.font = `${Math.max(10, fs - 1)}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.textAlign = "center";
      const lines = wrapText(ctx, caption, w - 16);
      lines.forEach((ln, i) => {
        ctx.fillText(ln, w / 2, h - 10 - (lines.length - 1 - i) * (fs + 3));
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
