import React, { useEffect, useRef } from "react";

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

// 시나리오 타임라인 (ms)
const T_SURGE = 3400; // 유입이 200 → 600으로 증가하기 시작
const T_RAMP = 600; // 증가에 걸리는 시간
const T_QUEUE = 4300; // 초과분이 앱 앞에 도착해 줄이 생기기 시작
const T_DIAG = 7000; // 진단 포인트 강조 시작
const CYCLE = 10400;

const CAP_APP = 300;
const IN_LOW = 200;
const IN_HIGH = 600;
const MAX_Q_DOTS = 12; // 시각적으로 표시하는 대기 도트 상한

const STAGES = [
  { name: "게이트웨이", cap: 1000 },
  { name: "애플리케이션", cap: CAP_APP },
  { name: "데이터베이스", cap: 800 },
];

function clamp01(t: number) {
  return Math.min(1, Math.max(0, t));
}
function easeOut(t: number) {
  return 1 - Math.pow(1 - clamp01(t), 3);
}

function gaugeColor(util: number) {
  if (util >= 0.999) return "#fa5252";
  if (util >= 0.8) return "#fab005";
  return "#40c057";
}

// 파이프 구간을 따라 일정 간격으로 흐르는 요청 도트
function drawFlowDots(
  ctx: CanvasRenderingContext2D,
  x1: number,
  x2: number,
  y: number,
  spacing: number,
  e: number,
  speed: number,
  r: number,
) {
  if (x2 - x1 < r * 2) return;
  const offset = (((e * speed) % spacing) + spacing) % spacing;
  ctx.fillStyle = "#228be6";
  for (let x = x1 + offset; x < x2; x += spacing) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export const BottleneckDemo = () => {
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
      const s = w / 640;
      const isMobile = w < 480;

      const fs = Math.max(10, Math.min(13, 13 * s));
      const smallFs = Math.max(9, 11 * s);
      const dotR = Math.max(2.5, 3.2 * s);

      // 가로 레이아웃: [유입] [게이트웨이] [큐] [앱] [DB] [유출]
      const pad = 10;
      const innerW = w - pad * 2;
      const bw = innerW * 0.18;
      const gIn = innerW * 0.085;
      const g1 = innerW * 0.165; // 앱 앞은 큐가 쌓일 공간이라 조금 넓게
      const g2 = innerW * 0.1;
      const xWeb = pad + gIn;
      const xApp = xWeb + bw + g1;
      const xDb = xApp + bw + g2;

      const boxTop = 48;
      const boxH = Math.max(36, 40 * s);
      const pipeY = boxTop + boxH / 2;
      const capY = boxTop + boxH + 15;
      const gaugeY = capY + 7;
      const gaugeH = 7;
      const pctY = gaugeY + gaugeH + 14;
      const h = pctY + (isMobile ? 48 : 32);

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      // --- 현재 유입/처리량 ---
      const inflow = IN_LOW + (IN_HIGH - IN_LOW) * easeOut((e - T_SURGE) / T_RAMP);
      const thru = Math.min(inflow, CAP_APP);
      const congested = inflow > CAP_APP + 1;

      // --- 상단 수치: 유입 → 처리 ---
      ctx.font = `700 ${fs}px ${FONT}`;
      ctx.textBaseline = "alphabetic";
      const p1 = `트래픽 ${Math.round(inflow).toLocaleString()} req/s`;
      const p2 = "  →  ";
      const p3 = `처리 ${Math.round(thru).toLocaleString()} req/s`;
      const w1 = ctx.measureText(p1).width;
      const w2 = ctx.measureText(p2).width;
      const w3 = ctx.measureText(p3).width;
      let tx = w / 2 - (w1 + w2 + w3) / 2;
      ctx.textAlign = "left";
      ctx.fillStyle = "#495057";
      ctx.fillText(p1, tx, 18);
      tx += w1;
      ctx.fillStyle = "#adb5bd";
      ctx.fillText(p2, tx, 18);
      tx += w2;
      ctx.fillStyle = congested ? "#fa5252" : "#2f9e44";
      ctx.fillText(p3, tx, 18);

      // --- 파이프 라인 (박스 사이 연결선) ---
      ctx.strokeStyle = "#dee2e6";
      ctx.lineWidth = 2;
      const pipes: Array<[number, number]> = [
        [pad, xWeb],
        [xWeb + bw, xApp],
        [xApp + bw, xDb],
        [xDb + bw, w - pad],
      ];
      pipes.forEach(([a, b]) => {
        ctx.beginPath();
        ctx.moveTo(a, pipeY);
        ctx.lineTo(b, pipeY);
        ctx.stroke();
      });
      // 유출구 화살표
      ctx.beginPath();
      ctx.moveTo(w - pad, pipeY);
      ctx.lineTo(w - pad - 6, pipeY - 4);
      ctx.lineTo(w - pad - 6, pipeY + 4);
      ctx.closePath();
      ctx.fillStyle = "#adb5bd";
      ctx.fill();

      // --- 대기 큐 (DB 앞) ---
      const qFill = e >= T_QUEUE ? Math.min(MAX_Q_DOTS, Math.floor((e - T_QUEUE) / 240)) : 0;
      const qWait = e >= T_QUEUE ? Math.floor((e - T_QUEUE) * (IN_HIGH - CAP_APP) * 0.001) : 0;
      const qSp = Math.max(8, 10 * s);
      const qCols = Math.ceil(qFill / 2);

      // --- 흐르는 요청 도트 ---
      const spacingIn = Math.max(7, (5400 / inflow) * s);
      const spacingOut = Math.max(7, (5400 / thru) * s);
      const speed = Math.max(0.045, 0.07 * s);
      drawFlowDots(ctx, pad + 4, xWeb, pipeY, spacingIn, e, speed, dotR);
      // 앱 앞 구간: 큐가 생기면 도트가 큐 꼬리 앞에서 멈춘다(줄에 합류)
      const qTailX = qFill > 0 ? xApp - 12 - qCols * qSp : xApp - 2;
      drawFlowDots(ctx, xWeb + bw, qTailX, pipeY, spacingIn, e, speed, dotR);
      drawFlowDots(ctx, xApp + bw, xDb, pipeY, spacingOut, e, speed, dotR);
      drawFlowDots(ctx, xDb + bw, w - pad - 8, pipeY, spacingOut, e, speed, dotR);

      // 큐에 쌓인 도트 (DB에 가까운 쪽부터 2줄로 채운다)
      ctx.fillStyle = "#fa5252";
      for (let i = 0; i < qFill; i++) {
        const qx = xApp - 12 - Math.floor(i / 2) * qSp;
        const qy = pipeY + (i % 2 === 0 ? -4.5 : 4.5);
        ctx.beginPath();
        ctx.arc(qx, qy, dotR, 0, Math.PI * 2);
        ctx.fill();
      }
      if (qWait > 0) {
        const qCenterX = xApp - 8 - (qCols * qSp) / 2;
        ctx.font = `700 ${Math.max(9, fs - 3)}px ${FONT}`;
        ctx.fillStyle = "#fa5252";
        ctx.textAlign = "center";
        ctx.fillText(`${qWait}개 대기`, qCenterX, pipeY - 18);
      }

      // 진단 강조: 앱 앞 큐를 빨간 점선 박스로
      const diagP = easeOut((e - T_DIAG) / 300);
      if (diagP > 0.01) {
        ctx.globalAlpha = diagP;
        ctx.strokeStyle = "#fa5252";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        const qLeft = xApp - 16 - Math.ceil(MAX_Q_DOTS / 2) * qSp;
        ctx.strokeRect(qLeft, pipeY - 13, xApp - 4 - qLeft, 26);
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      // --- 단계 박스 + 용량 라벨 + 사용률 게이지 ---
      const boxXs = [xWeb, xApp, xDb] as const;
      STAGES.forEach((stage, i) => {
        const x = boxXs[i];
        if (x === undefined) return;
        const load = i > 1 ? thru : inflow;
        const util = Math.min(load / stage.cap, 1);
        const isApp = i === 1;
        const appHot = isApp && congested;

        ctx.beginPath();
        ctx.roundRect(x, boxTop, bw, boxH, 6);
        ctx.fillStyle = appHot ? "#fff5f5" : "#fff";
        ctx.fill();
        ctx.strokeStyle = appHot ? "#fa5252" : "#adb5bd";
        ctx.lineWidth = appHot ? 1.5 : 1;
        ctx.stroke();

        ctx.font = `700 ${Math.max(9.5, fs - 1)}px ${FONT}`;
        ctx.fillStyle = appHot ? "#fa5252" : "#495057";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          i === 2 && isMobile ? "DB" : isApp && isMobile ? "앱" : stage.name,
          x + bw / 2,
          boxTop + boxH / 2 + 0.5,
        );
        ctx.textBaseline = "alphabetic";

        // 용량 라벨
        ctx.font = `${smallFs}px ${FONT}`;
        ctx.fillStyle = "#868e96";
        ctx.fillText(`용량 ${stage.cap.toLocaleString()} req/s`, x + bw / 2, capY);

        // 사용률 게이지
        ctx.beginPath();
        ctx.roundRect(x, gaugeY, bw, gaugeH, 3.5);
        ctx.fillStyle = "#e9ecef";
        ctx.fill();
        if (util > 0.02) {
          ctx.beginPath();
          ctx.roundRect(x, gaugeY, bw * util, gaugeH, 3.5);
          ctx.fillStyle = gaugeColor(util);
          ctx.fill();
        }
        ctx.font = `700 ${smallFs}px ${FONT}`;
        ctx.fillStyle = gaugeColor(util);
        ctx.fillText(`${Math.round(util * 100)}%`, x + bw / 2, pctY);

        // 진단 강조: 병목이 아닌 단(게이트웨이·DB)은 한가하다는 배지
        if (!isApp && diagP > 0.01) {
          ctx.globalAlpha = diagP;
          ctx.font = `700 ${Math.max(9, fs - 3)}px ${FONT}`;
          const badge = "여유(한가함)";
          const bWidth = ctx.measureText(badge).width + 12;
          ctx.beginPath();
          ctx.roundRect(x + bw / 2 - bWidth / 2, boxTop - 19, bWidth, 15, 4);
          ctx.fillStyle = "#d3f9d8";
          ctx.fill();
          ctx.fillStyle = "#2f9e44";
          ctx.textBaseline = "middle";
          ctx.fillText(badge, x + bw / 2, boxTop - 11);
          ctx.textBaseline = "alphabetic";
          ctx.globalAlpha = 1;
        }
      });

      // --- 하단 단계 설명 ---
      let caption = "① 트래픽이 가장 좁은 단(앱 300)보다 작으면|모든 게 평화롭다";
      if (e >= T_DIAG) {
        caption = "③ 병목 앞은 줄을 서고 병목 뒤는 한가하다|— 어디가 좁은지는 큐가 알려준다";
      } else if (e >= T_SURGE) {
        caption = "② 트래픽 600인데 처리량은 300|— 초과분은 전부 앱 앞의 줄이 된다";
      }
      ctx.font = `${Math.max(10, fs - 1)}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.textAlign = "center";
      if (isMobile) {
        const [l1 = "", l2 = ""] = caption.split("|");
        ctx.fillText(l1.trim(), w / 2, h - 24);
        ctx.fillText(l2.trim(), w / 2, h - 8);
      } else {
        ctx.fillText(caption.replace("|", " "), w / 2, h - 10);
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
