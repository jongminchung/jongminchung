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
import { CHAMPION } from "./champion";
import {
  buildTrack,
  spawnCar,
  stepCar,
  forward,
  RAY_ANGLES,
  RAY_LEN,
  HALF_W,
  WORLD_W,
  WORLD_H,
  type Track,
  type Car,
} from "./engine";

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

const RAY_LABELS = ["좌90", "좌45", "정면", "우45", "우90"];

// 거리값(0=벽, 1=멀리)에 따라 빨강↔초록 보간
function rayColor(t: number): string {
  const c = Math.min(1, Math.max(0, t));
  // #fa5252 (250,82,82) → #40c057 (64,192,87)
  const r = Math.round(250 + (64 - 250) * c);
  const g = Math.round(82 + (192 - 82) * c);
  const b = Math.round(82 + (87 - 82) * c);
  return `rgb(${r}, ${g}, ${b})`;
}

export const GenomeDemo = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<SvgCanvasHandle>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const track: Track = buildTrack();
    let car: Car = spawnCar(track, CHAMPION);

    let raf = 0;
    let cw = 0;

    const measure = () => {
      cw = container.clientWidth;
    };
    measure();

    const ro = new ResizeObserver(() => measure());
    ro.observe(container);

    const render = () => {
      const w = cw || container.clientWidth || 600;
      const dpr = window.devicePixelRatio || 1;
      const vertical = w < 480;

      // 트랙 그리기 영역과 패널 영역 나누기
      const gap = 16;
      let trackW: number;
      let trackH: number;
      let panelX: number;
      let panelY: number;
      let panelW: number;
      let totalH: number;

      const aspect = WORLD_H / WORLD_W;

      if (vertical) {
        trackW = w;
        trackH = trackW * aspect;
        panelX = 0;
        panelY = trackH + gap;
        panelW = w;
        totalH = trackH + gap + 210;
      } else {
        panelW = Math.max(180, Math.min(240, w * 0.34));
        trackW = w - panelW - gap;
        trackH = trackW * aspect;
        panelX = trackW + gap;
        panelY = 0;
        totalH = trackH;
      }

      canvas.width = w * dpr;
      canvas.height = totalH * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${totalH}px`;

      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, totalH);

      // ---- 물리 한 프레임 진행 ----
      stepCar(track, car);
      if (!car.alive) {
        car = spawnCar(track, CHAMPION);
        stepCar(track, car);
      }

      // ---- 트랙 스케일(letterbox) ----
      const scale = Math.min(trackW / WORLD_W, trackH / WORLD_H);
      const offX = (trackW - WORLD_W * scale) / 2;
      const offY = (trackH - WORLD_H * scale) / 2;
      const tx = (x: number) => offX + x * scale;
      const ty = (y: number) => offY + y * scale;

      // 배경 (트랙 밖)
      ctx.fillStyle = "#f8f9fa";
      ctx.fillRect(0, 0, trackW, trackH);

      const center = track.center;
      const n = center.length;

      // ---- 도로: 중앙선 폴리라인을 굵은 스트로크로 그려 반폭 도로 표현 ----
      ctx.beginPath();
      ctx.moveTo(tx(center[0][0]), ty(center[0][1]));
      for (let i = 1; i < n; i++) ctx.lineTo(tx(center[i][0]), ty(center[i][1]));
      ctx.closePath();
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = "#e9ecef";
      ctx.lineWidth = HALF_W * 2 * scale;
      ctx.stroke();

      // 중앙 점선
      ctx.beginPath();
      ctx.moveTo(tx(center[0][0]), ty(center[0][1]));
      for (let i = 1; i < n; i++) ctx.lineTo(tx(center[i][0]), ty(center[i][1]));
      ctx.closePath();
      ctx.strokeStyle = "#ced4da";
      ctx.lineWidth = Math.max(1, 1.5 * scale);
      ctx.setLineDash([6 * scale, 8 * scale]);
      ctx.stroke();
      ctx.setLineDash([]);

      // ---- 감지선 5개 ----
      const sensors = car.sensors;
      for (let r = 0; r < RAY_ANGLES.length; r++) {
        const a = car.heading + RAY_ANGLES[r];
        const t = sensors[r]; // 0~1 정규화 거리
        const dist = t * RAY_LEN;
        const ex = car.x + Math.cos(a) * dist;
        const ey = car.y + Math.sin(a) * dist;
        const col = rayColor(t);
        ctx.beginPath();
        ctx.moveTo(tx(car.x), ty(car.y));
        ctx.lineTo(tx(ex), ty(ey));
        ctx.strokeStyle = col;
        ctx.lineWidth = Math.max(1, 1.5 * scale);
        ctx.stroke();
        // 끝점
        ctx.beginPath();
        ctx.arc(tx(ex), ty(ey), Math.max(2, 2.5 * scale), 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
      }

      // ---- 자동차 (삼각형) ----
      const carSize = Math.max(7, 9 * scale);
      ctx.save();
      ctx.translate(tx(car.x), ty(car.y));
      ctx.rotate(car.heading);
      ctx.beginPath();
      ctx.moveTo(carSize, 0);
      ctx.lineTo(-carSize * 0.7, carSize * 0.7);
      ctx.lineTo(-carSize * 0.7, -carSize * 0.7);
      ctx.closePath();
      ctx.fillStyle = "#228be6";
      ctx.fill();
      ctx.restore();

      // ---- 핸들 출력 계산 ----
      const steer = forward(car.genome, car.sensors, car.hid); // -1 ~ 1

      // ---- 우측/하단 패널 ----
      const pad = 4;
      let py = panelY + pad;
      const px = panelX + pad;
      const pw = panelW - pad * 2;

      const fs = 11;
      ctx.textBaseline = "alphabetic";

      // 감지선 제목
      ctx.font = `700 ${fs}px ${FONT}`;
      ctx.fillStyle = "#495057";
      ctx.textAlign = "left";
      ctx.fillText("감지선 (벽까지 거리)", px, py + fs);
      py += fs + 12;

      // 막대 5개
      const labelW = 34;
      const barX = px + labelW;
      const barW = pw - labelW;
      const barH = 12;
      const rowGap = 8;
      for (let r = 0; r < 5; r++) {
        const t = sensors[r];
        const y = py + r * (barH + rowGap);
        // 라벨
        ctx.font = `${fs}px ${FONT}`;
        ctx.fillStyle = "#868e96";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(RAY_LABELS[r], px, y + barH / 2);
        // 배경 트랙
        ctx.fillStyle = "#f1f3f5";
        ctx.beginPath();
        ctx.roundRect(barX, y, barW, barH, 3);
        ctx.fill();
        // 값
        ctx.fillStyle = rayColor(t);
        ctx.beginPath();
        ctx.roundRect(barX, y, Math.max(2, barW * t), barH, 3);
        ctx.fill();
      }
      py += 5 * (barH + rowGap) + 8;

      // 핸들 출력
      ctx.font = `700 ${fs}px ${FONT}`;
      ctx.fillStyle = "#495057";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("핸들 출력", px, py + fs);
      py += fs + 10;

      const sBarH = 14;
      const sBarY = py;
      // 배경
      ctx.fillStyle = "#f1f3f5";
      ctx.beginPath();
      ctx.roundRect(px, sBarY, pw, sBarH, 3);
      ctx.fill();
      // 중앙 0선
      const midX = px + pw / 2;
      ctx.strokeStyle = "#ced4da";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(midX, sBarY - 2);
      ctx.lineTo(midX, sBarY + sBarH + 2);
      ctx.stroke();
      // 좌우로 뻗는 값
      const half = pw / 2;
      const magW = Math.abs(steer) * half;
      ctx.fillStyle = "#228be6";
      if (steer >= 0) {
        ctx.beginPath();
        ctx.roundRect(midX, sBarY, Math.max(1, magW), sBarH, 3);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.roundRect(midX - magW, sBarY, Math.max(1, magW), sBarH, 3);
        ctx.fill();
      }
      py += sBarH + 8;

      // 핸들 라벨
      ctx.font = `${Math.max(9, fs - 1)}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("좌 ←", px, py + fs);
      ctx.textAlign = "right";
      ctx.fillText("→ 우", px + pw, py + fs);
      ctx.textAlign = "left";

      // ---- 하단 설명 ----
      ctx.font = `${Math.max(10, fs - 1)}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.textAlign = vertical ? "left" : "center";
      ctx.textBaseline = "alphabetic";
      const capText = "감지선 5개 → 두뇌(신경망) → 핸들값 하나";
      if (vertical) {
        ctx.fillText(capText, px, totalH - 6);
      } else {
        ctx.fillText(capText, trackW / 2, trackH - 8);
      }

      raf = scheduleMaterialFrame(render);
    };

    raf = scheduleMaterialFrame(render);
    return () => {
      cancelMaterialFrame(raf);
      ro.disconnect();
    };
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
