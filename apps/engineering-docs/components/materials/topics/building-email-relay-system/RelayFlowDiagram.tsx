// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useRef, useEffect } from "react";
import {
  SvgCanvas,
  type SvgCanvasHandle,
  type SvgDrawingContext,
  type SvgGradient,
} from "#components/materials/runtime/svg-canvas";

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

const COLORS = {
  helpdesk: "#228be6",
  helpdeskBg: "#e7f5ff",
  relay: "#f59f00",
  relayBg: "#f1f3f5",
  mailbox: "#40c057",
  mailboxBg: "#ebfbee",
  text: "#495057",
  textLight: "#868e96",
  border: "#dee2e6",
};

interface Props {
  caption?: string;
}

function drawRoundRect(
  ctx: SvgDrawingContext,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  stroke: string,
  lineWidth = 1.5,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function drawArrow(
  ctx: SvgDrawingContext,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  s: number,
  dashed = false,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.setLineDash(dashed ? [4 * s, 3 * s] : []);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);

  const angle = Math.atan2(y2 - y1, x2 - x1);
  const size = 6 * s;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - size * Math.cos(angle - 0.4), y2 - size * Math.sin(angle - 0.4));
  ctx.lineTo(x2 - size * Math.cos(angle + 0.4), y2 - size * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fill();
}

function drawNumCircle(
  ctx: SvgDrawingContext,
  cx: number,
  cy: number,
  num: number,
  s: number,
  color: string,
) {
  const r = 9 * s;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `700 ${Math.max(9 * s, 8)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(num), cx, cy + 0.5);
}

function drawActor(
  ctx: SvgDrawingContext,
  cx: number,
  y: number,
  w: number,
  h: number,
  s: number,
  title: string,
  subtitle: string,
  color: string,
  bg: string,
) {
  drawRoundRect(ctx, cx - w / 2, y, w, h, 6 * s, bg, color);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // 박스 폭에 맞게 폰트 축소 (모바일 대비)
  const maxTextW = w - 10 * s;
  let titleFs = Math.max(13 * s, 11);
  ctx.font = `700 ${titleFs}px ${FONT}`;
  const titleW = ctx.measureText(title).width;
  if (titleW > maxTextW) {
    titleFs = Math.max(titleFs * (maxTextW / titleW), 8);
    ctx.font = `700 ${titleFs}px ${FONT}`;
  }
  ctx.fillStyle = color;
  ctx.fillText(title, cx, y + h / 2 - 7 * s);

  ctx.fillStyle = COLORS.textLight;
  ctx.font = `${Math.max(8.5 * s, 8)}px ${FONT}`;
  ctx.fillText(subtitle, cx, y + h / 2 + 9 * s);
}

function draw(ctx: SvgDrawingContext, w: number): number {
  const s = w / 700;

  const smallFs = Math.max(9.5 * s, 9);
  const tinyFs = Math.max(8.5 * s, 8);

  // 액터 배치
  const actorW = 118 * s;
  const actorH = 46 * s;
  const helpdeskCx = 85 * s;
  const relayCx = w / 2;
  const mailboxCx = w - 85 * s;
  const actorY = 10 * s;

  // 행 간격 (보조 라벨 공간 포함)
  const rowH = 52 * s;
  const lifeTop = actorY + actorH + 4 * s;
  const startY = lifeTop + 26 * s;
  const rowCount = 5;
  const lifeBottom = startY + rowH * (rowCount - 1) + 30 * s;
  const h = lifeBottom + 12 * s;

  // 라이프라인 (점선)
  ctx.strokeStyle = COLORS.border;
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1;
  [helpdeskCx, relayCx, mailboxCx].forEach((cx) => {
    ctx.beginPath();
    ctx.moveTo(cx, lifeTop);
    ctx.lineTo(cx, lifeBottom);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  // 액터 박스
  drawActor(
    ctx,
    helpdeskCx,
    actorY,
    actorW,
    actorH,
    s,
    "헬프데스크",
    "티켓 DB",
    COLORS.helpdesk,
    COLORS.helpdeskBg,
  );
  drawActor(
    ctx,
    relayCx,
    actorY,
    actorW,
    actorH,
    s,
    "릴레이 수신 서버",
    "SMTP",
    COLORS.relay,
    COLORS.relayBg,
  );
  drawActor(
    ctx,
    mailboxCx,
    actorY,
    actorW,
    actorH,
    s,
    "고객 메일함",
    "Gmail",
    COLORS.mailbox,
    COLORS.mailboxBg,
  );

  // ── 시퀀스 메시지들 ──
  ctx.textBaseline = "middle";

  // ① 헬프데스크 → 고객 메일함: 알림 메일 발송 (서버 라이프라인을 가로지르는 긴 화살표)
  let y = startY;
  drawNumCircle(ctx, helpdeskCx - 14 * s, y, 1, s, COLORS.helpdesk);
  drawArrow(ctx, helpdeskCx, y, mailboxCx, y, COLORS.helpdesk, s);
  ctx.fillStyle = COLORS.helpdesk;
  ctx.font = `${smallFs}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("알림 메일 발송", (helpdeskCx + mailboxCx) / 2, y - 10 * s);
  ctx.fillStyle = COLORS.textLight;
  ctx.font = `${tinyFs}px ${FONT}`;
  ctx.fillText("Reply-To: reply+토큰@relay…", (helpdeskCx + mailboxCx) / 2, y + 12 * s);

  // ② 고객 메일함: 고객이 답장 작성 (self-arrow)
  y = startY + rowH;
  const loopW = 30 * s;
  drawNumCircle(ctx, mailboxCx + 14 * s, y + 8 * s, 2, s, COLORS.mailbox);
  ctx.strokeStyle = COLORS.mailbox;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(mailboxCx, y);
  ctx.lineTo(mailboxCx - loopW, y);
  ctx.lineTo(mailboxCx - loopW, y + 16 * s);
  ctx.lineTo(mailboxCx - 6 * s, y + 16 * s);
  ctx.stroke();
  ctx.fillStyle = COLORS.mailbox;
  ctx.beginPath();
  ctx.moveTo(mailboxCx - 6 * s, y + 16 * s);
  ctx.lineTo(mailboxCx - 12 * s, y + 12 * s);
  ctx.lineTo(mailboxCx - 12 * s, y + 20 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLORS.mailbox;
  ctx.font = `${smallFs}px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText("고객이 답장 작성", mailboxCx - loopW - 8 * s, y + 5 * s);

  // ③ 고객 메일함 → 릴레이 수신 서버: SMTP 배달
  y = startY + rowH * 2;
  drawNumCircle(ctx, mailboxCx + 14 * s, y, 3, s, COLORS.mailbox);
  drawArrow(ctx, mailboxCx, y, relayCx, y, COLORS.mailbox, s);
  ctx.fillStyle = COLORS.mailbox;
  ctx.font = `${smallFs}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("SMTP 배달", (mailboxCx + relayCx) / 2, y - 10 * s);
  ctx.fillStyle = COLORS.textLight;
  ctx.font = `${tinyFs}px ${FONT}`;
  ctx.fillText("MX 조회로 서버를 찾는다", (mailboxCx + relayCx) / 2, y + 12 * s);

  // ④ 릴레이 수신 서버: 토큰 검증 · MIME 파싱 · 인용 제거 (self-arrow)
  y = startY + rowH * 3;
  drawNumCircle(ctx, relayCx - 14 * s, y + 8 * s, 4, s, COLORS.relay);
  ctx.strokeStyle = COLORS.relay;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(relayCx, y);
  ctx.lineTo(relayCx + loopW, y);
  ctx.lineTo(relayCx + loopW, y + 16 * s);
  ctx.lineTo(relayCx + 6 * s, y + 16 * s);
  ctx.stroke();
  ctx.fillStyle = COLORS.relay;
  ctx.beginPath();
  ctx.moveTo(relayCx + 6 * s, y + 16 * s);
  ctx.lineTo(relayCx + 12 * s, y + 12 * s);
  ctx.lineTo(relayCx + 12 * s, y + 20 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLORS.relay;
  ctx.font = `${smallFs}px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText("토큰 검증 · MIME 파싱 · 인용 제거", relayCx + loopW + 8 * s, y + 5 * s);

  // ⑤ 릴레이 수신 서버 → 헬프데스크: 코멘트 저장 (점선)
  y = startY + rowH * 4;
  drawNumCircle(ctx, relayCx + 14 * s, y, 5, s, COLORS.relay);
  drawArrow(ctx, relayCx, y, helpdeskCx, y, COLORS.relay, s, true);
  ctx.fillStyle = COLORS.relay;
  ctx.font = `${smallFs}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("코멘트 저장", (relayCx + helpdeskCx) / 2, y - 10 * s);
  ctx.fillStyle = COLORS.textLight;
  ctx.font = `${tinyFs}px ${FONT}`;
  ctx.fillText("티켓 #42에 새 코멘트", (relayCx + helpdeskCx) / 2, y + 12 * s);

  return h;
}

export const RelayFlowDiagram = ({ caption }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<SvgCanvasHandle>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const render = () => {
      const w = container.clientWidth;
      const dpr = window.devicePixelRatio || 1;
      const ctx = canvas.getContext("2d")!;

      // 높이 측정
      canvas.width = 1;
      canvas.height = 1;
      const h = draw(ctx, w);

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);
      draw(ctx, w);
    };

    render();
    const observer = new ResizeObserver(render);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <figure>
      <div ref={containerRef}>
        <SvgCanvas ref={canvasRef} style={{ display: "block", width: "100%" }} />
      </div>
      {caption && <figcaption dangerouslySetInnerHTML={{ __html: caption }} />}
    </figure>
  );
};
