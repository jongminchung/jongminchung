// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useEffect, useRef } from "react";
import {
  cancelMaterialFrame,
  scheduleMaterialFrame,
} from "#components/materials/runtime/scheduler";
import {
  SvgCanvas,
  type SvgCanvasHandle,
  type SvgDrawingContext,
  type SvgGradient,
} from "#components/materials/runtime/svg-canvas";
import { CHAMPION } from "./champion";
import { buildTrack, spawnCar, stepCar, type Car } from "./engine";
import { FONT, makeView, trackHeightFor, drawTrack, drawCar } from "./trackDraw";

const STEPS_PER_FRAME = 2;
const TRAIL_MAX = 220;

export const ChampionDemo = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<SvgCanvasHandle>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const track = buildTrack();
    let car: Car = spawnCar(track, CHAMPION);
    let laps = 0;
    let elapsed = 0; // 초
    const trail: Array<[number, number]> = [];

    let raf = 0;
    const render = () => {
      const w = container.clientWidth;
      const dpr = window.devicePixelRatio || 1;
      const isMobile = w < 480;
      const trackH = trackHeightFor(w);
      const h = trackH + 30;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      const view = makeView(w, trackH);
      drawTrack(ctx, track, view);

      // 시뮬레이션
      for (let s = 0; s < STEPS_PER_FRAME; s++) {
        if (car.alive) {
          const prevX = car.x;
          const prevY = car.y;
          stepCar(track, car);
          elapsed += 1 / 60;
          laps += Math.hypot(car.x - prevX, car.y - prevY) / track.total;
          trail.push([car.x, car.y]);
          if (trail.length > TRAIL_MAX) trail.shift();
        } else {
          // 방어: 챔피언은 거의 안 죽지만 이탈 시 리셋
          car = spawnCar(track, CHAMPION);
          laps = 0;
          elapsed = 0;
          trail.length = 0;
        }
      }

      // 잔상 궤적
      ctx.lineWidth = Math.max(1.5, view.scale * 3);
      ctx.lineCap = "round";
      for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1];
        const b = trail[i];
        ctx.globalAlpha = (i / trail.length) * 0.5;
        ctx.strokeStyle = "#228be6";
        ctx.beginPath();
        ctx.moveTo(view.wx(a[0]), view.wy(a[1]));
        ctx.lineTo(view.wx(b[0]), view.wy(b[1]));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      drawCar(ctx, view, car.x, car.y, car.heading, "#228be6", 1, 10);

      // 배지
      const fs = isMobile ? 12 : 13;
      ctx.font = `700 ${fs}px ${FONT}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#495057";
      ctx.fillText("23세대에 태어난 챔피언", view.ox + 6, view.oy + 6);
      ctx.font = `${fs}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.fillText(
        `${laps.toFixed(1)}바퀴 · ${elapsed.toFixed(0)}초 무사고`,
        view.ox + 6,
        view.oy + 6 + fs + 4,
      );

      // 하단 캡션
      ctx.textAlign = "center";
      ctx.font = `${isMobile ? 10 : 11}px ${FONT}`;
      ctx.fillStyle = "#adb5bd";
      ctx.fillText(
        "43개의 숫자로 이루어진 두뇌 하나가 트랙의 모든 코너를 스스로 돈다",
        w / 2,
        trackH + 8,
      );

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
