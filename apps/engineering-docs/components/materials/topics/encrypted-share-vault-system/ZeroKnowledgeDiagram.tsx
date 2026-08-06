// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useRef, useEffect } from "react";
import {
  SvgCanvas,
  type SvgCanvasHandle,
  type SvgDrawingContext,
  type SvgGradient,
} from "@/components/materials/runtime/svg-canvas";

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

const COLORS = {
  client: "#228be6",
  clientBg: "#e7f5ff",
  server: "#868e96",
  serverBg: "#f1f3f5",
  safe: "#40c057",
  safeBg: "#ebfbee",
  danger: "#fa5252",
  dangerBg: "#fff5f5",
  text: "#495057",
  textLight: "#868e96",
  border: "#dee2e6",
  cipher: "#7950f2",
  cipherBg: "#f3f0ff",
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

function drawDesktop(ctx: SvgDrawingContext, w: number): number {
  const s = w / 640;
  const h = 260 * s;
  const titleFs = Math.max(14 * s, 12);
  const labelFs = Math.max(11 * s, 10);
  const smallFs = Math.max(10 * s, 9);
  const tinyFs = Math.max(8.5 * s, 8);

  const halfW = w / 2;
  const pad = 16 * s;

  // 점선 경계
  ctx.strokeStyle = COLORS.border;
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(halfW, 8 * s);
  ctx.lineTo(halfW, h - 8 * s);
  ctx.stroke();
  ctx.setLineDash([]);

  // 클라이언트 영역 (왼쪽)
  const cBoxX = pad;
  const cBoxY = 30 * s;
  const cBoxW = halfW - pad * 2;
  const cBoxH = h - 60 * s;

  drawRoundRect(ctx, cBoxX, cBoxY, cBoxW, cBoxH, 8 * s, COLORS.clientBg, COLORS.client, 1.2);

  ctx.fillStyle = COLORS.client;
  ctx.font = `700 ${titleFs}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🖥 클라이언트 (디바이스)", cBoxX + cBoxW / 2, cBoxY + 22 * s);

  // 클라이언트 내부 아이템들
  const items = [
    { label: "Master Password", color: COLORS.safe },
    { label: "Secret Key", color: COLORS.safe },
    { label: "Private Key (복호화됨)", color: COLORS.safe },
    { label: "Vault Key (복호화됨)", color: COLORS.safe },
    { label: "비밀 데이터 (평문)", color: COLORS.safe },
  ];
  const itemH = 22 * s;
  const itemGap = 5 * s;
  let iy = cBoxY + 42 * s;
  for (const item of items) {
    drawRoundRect(
      ctx,
      cBoxX + 10 * s,
      iy,
      cBoxW - 20 * s,
      itemH,
      4 * s,
      COLORS.safeBg,
      COLORS.safe,
      1,
    );
    ctx.fillStyle = item.color;
    ctx.font = `${smallFs}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(item.label, cBoxX + cBoxW / 2, iy + itemH / 2);
    iy += itemH + itemGap;
  }

  ctx.fillStyle = COLORS.safe;
  ctx.font = `600 ${tinyFs}px ${FONT}`;
  ctx.fillText("✓ 모든 평문 데이터는 여기에만 존재", cBoxX + cBoxW / 2, iy + 8 * s);

  // 서버 영역 (오른쪽)
  const sBoxX = halfW + pad;
  const sBoxW = cBoxW;

  drawRoundRect(ctx, sBoxX, cBoxY, sBoxW, cBoxH, 8 * s, COLORS.serverBg, COLORS.server, 1.2);

  ctx.fillStyle = COLORS.server;
  ctx.font = `700 ${titleFs}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("🗄 서버", sBoxX + sBoxW / 2, cBoxY + 22 * s);

  // 서버 내부 아이템들
  const serverItems = [
    { label: "Public Key", color: COLORS.cipher },
    { label: "E(AUK, Private Key)", color: COLORS.cipher },
    { label: "E(Public Key, Vault Key)", color: COLORS.cipher },
    { label: "E(Vault Key, 비밀 데이터)", color: COLORS.cipher },
  ];
  iy = cBoxY + 42 * s;
  for (const item of serverItems) {
    drawRoundRect(
      ctx,
      sBoxX + 10 * s,
      iy,
      sBoxW - 20 * s,
      itemH,
      4 * s,
      COLORS.cipherBg,
      COLORS.cipher,
      1,
    );
    ctx.fillStyle = item.color;
    ctx.font = `${smallFs}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(item.label, sBoxX + sBoxW / 2, iy + itemH / 2);
    iy += itemH + itemGap;
  }

  ctx.fillStyle = COLORS.danger;
  ctx.font = `600 ${tinyFs}px ${FONT}`;
  ctx.fillText("✗ 서버가 해킹되어도 평문 유출 없음", sBoxX + sBoxW / 2, iy + 8 * s);

  // 경계 라벨
  ctx.save();
  ctx.translate(halfW, h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = COLORS.textLight;
  ctx.font = `600 ${labelFs}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("암호화 경계", 0, -8 * s);
  ctx.restore();

  // 상단 헤더
  ctx.fillStyle = COLORS.text;
  ctx.font = `600 ${labelFs}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("제로 지식 아키텍처: 서버는 평문을 절대 알 수 없다", w / 2, 16 * s);

  return h;
}

function drawMobile(ctx: SvgDrawingContext, w: number): number {
  const s = w / 360;
  const titleFs = Math.max(12 * s, 10);
  const labelFs = Math.max(10 * s, 9);
  const smallFs = Math.max(9 * s, 8);

  const pad = 10 * s;
  const boxW = w - pad * 2;
  const itemH = 22 * s;
  const itemGap = 4 * s;
  let y = 12 * s;

  // 헤더
  ctx.fillStyle = COLORS.text;
  ctx.font = `600 ${labelFs}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("제로 지식 아키텍처", w / 2, y);
  y += 18 * s;

  // 클라이언트 박스
  const clientItems = [
    "Master Password",
    "Secret Key",
    "Private Key",
    "Vault Key",
    "비밀 데이터 (평문)",
  ];
  const clientH = 36 * s + clientItems.length * (itemH + itemGap) + 18 * s;
  drawRoundRect(ctx, pad, y, boxW, clientH, 6 * s, COLORS.clientBg, COLORS.client, 1.2);
  ctx.fillStyle = COLORS.client;
  ctx.font = `700 ${titleFs}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("🖥 클라이언트", w / 2, y + 18 * s);

  let iy = y + 32 * s;
  for (const item of clientItems) {
    drawRoundRect(ctx, pad + 8 * s, iy, boxW - 16 * s, itemH, 3 * s, COLORS.safeBg, COLORS.safe, 1);
    ctx.fillStyle = COLORS.safe;
    ctx.font = `${smallFs}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(item, w / 2, iy + itemH / 2);
    iy += itemH + itemGap;
  }
  ctx.fillStyle = COLORS.safe;
  ctx.font = `600 ${smallFs}px ${FONT}`;
  ctx.fillText("✓ 평문은 여기에만 존재", w / 2, iy + 4 * s);

  y += clientH + 12 * s;

  // 점선 경계
  ctx.strokeStyle = COLORS.border;
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(w - pad, y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = COLORS.textLight;
  ctx.font = `${smallFs}px ${FONT}`;
  ctx.fillText("── 암호화 경계 ──", w / 2, y + 1);
  y += 14 * s;

  // 서버 박스
  const serverItems = [
    "Public Key",
    "E(AUK, Private Key)",
    "E(PK, Vault Key)",
    "E(VK, 비밀 데이터)",
  ];
  const serverH = 36 * s + serverItems.length * (itemH + itemGap) + 18 * s;
  drawRoundRect(ctx, pad, y, boxW, serverH, 6 * s, COLORS.serverBg, COLORS.server, 1.2);
  ctx.fillStyle = COLORS.server;
  ctx.font = `700 ${titleFs}px ${FONT}`;
  ctx.fillText("🗄 서버", w / 2, y + 18 * s);

  iy = y + 32 * s;
  for (const item of serverItems) {
    drawRoundRect(
      ctx,
      pad + 8 * s,
      iy,
      boxW - 16 * s,
      itemH,
      3 * s,
      COLORS.cipherBg,
      COLORS.cipher,
      1,
    );
    ctx.fillStyle = COLORS.cipher;
    ctx.font = `${smallFs}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(item, w / 2, iy + itemH / 2);
    iy += itemH + itemGap;
  }
  ctx.fillStyle = COLORS.danger;
  ctx.font = `600 ${smallFs}px ${FONT}`;
  ctx.fillText("✗ 서버 해킹 시에도 평문 유출 없음", w / 2, iy + 4 * s);

  return y + serverH + 12 * s;
}

export const ZeroKnowledgeDiagram = ({ caption }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<SvgCanvasHandle>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const draw = () => {
      const w = container.clientWidth;
      const dpr = window.devicePixelRatio || 1;
      const isMobile = w < 480;
      const ctx = canvas.getContext("2d")!;

      canvas.width = 1;
      canvas.height = 1;
      const h = isMobile ? drawMobile(ctx, w) : drawDesktop(ctx, w);

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);
      if (isMobile) drawMobile(ctx, w);
      else drawDesktop(ctx, w);
    };

    draw();
    const observer = new ResizeObserver(draw);
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
