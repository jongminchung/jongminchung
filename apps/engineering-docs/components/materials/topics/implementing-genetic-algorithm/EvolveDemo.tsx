// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useEffect, useRef, useState } from "react";
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
import {
  buildTrack,
  spawnCar,
  stepCar,
  randomGenome,
  nextGeneration,
  mulberry32,
  DEFAULT_GA,
  type Car,
} from "./engine";
import { FONT, makeView, trackHeightFor, drawTrack, drawCar } from "./trackDraw";

const POP = 60; // 본문 실험과 동일한 개체군 크기
const MAX_FRAMES = 1800; // 30초 만점 (본문과 동일)
const GA = { ...DEFAULT_GA, popSize: POP };
const SPEEDS = [1, 3, 10]; // 사용자가 고르는 배속

interface DemoState {
  gen: number;
  cars: Car[];
  frame: number;
  aliveCount: number;
  bestEver: number;
  history: number[]; // 세대별 최고 프레임
}

export const EvolveDemo = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<SvgCanvasHandle>(null);
  const [resetKey, setResetKey] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(3);
  const pausedRef = useRef(false);
  pausedRef.current = paused;
  const speedRef = useRef(3);
  speedRef.current = speed;

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const track = buildTrack();
    const rand = mulberry32(7 + resetKey * 101);

    const spawnPop = (genomes: Float32Array[]) => genomes.map((g) => spawnCar(track, g));

    let genomes: Float32Array[] = Array.from({ length: POP }, () => randomGenome(rand));
    const st: DemoState = {
      gen: 0,
      cars: spawnPop(genomes),
      frame: 0,
      aliveCount: POP,
      bestEver: 0,
      history: [],
    };

    let raf = 0;

    const advanceGeneration = () => {
      const fits = st.cars.map((c) => c.frames);
      const genBest = Math.max(...fits);
      st.history.push(genBest);
      if (genBest > st.bestEver) st.bestEver = genBest;
      genomes = nextGeneration(genomes, fits, GA, rand);
      st.gen += 1;
      st.cars = spawnPop(genomes);
      st.frame = 0;
      st.aliveCount = POP;
    };

    const simulate = () => {
      const steps = speedRef.current;
      for (let s = 0; s < steps; s++) {
        let alive = 0;
        for (const c of st.cars) {
          if (c.alive) {
            stepCar(track, c);
            if (c.alive) alive++;
          }
        }
        st.aliveCount = alive;
        st.frame++;
        // 모두 죽었거나 만점 프레임 도달 → 다음 세대
        if (alive === 0 || st.frame >= MAX_FRAMES) {
          advanceGeneration();
          break;
        }
      }
    };

    const render = () => {
      const w = container.clientWidth;
      const dpr = window.devicePixelRatio || 1;
      const isMobile = w < 480;
      const trackH = trackHeightFor(w);
      const panelH = 54;
      const h = trackH + panelH;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      const view = makeView(w, trackH);
      drawTrack(ctx, track, view);

      // 자동차들
      for (const c of st.cars) {
        drawCar(
          ctx,
          view,
          c.x,
          c.y,
          c.heading,
          c.alive ? "#228be6" : "#ced4da",
          c.alive ? 0.9 : 0.35,
          8,
        );
      }

      // 상단 세대/생존 배지
      const badgeFs = isMobile ? 12 : 13;
      ctx.font = `700 ${badgeFs}px ${FONT}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#495057";
      ctx.fillText(`${st.gen}세대`, view.ox + 6, view.oy + 6);
      ctx.font = `${badgeFs}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.fillText(
        `살아있는 자동차 ${st.aliveCount} / ${POP}`,
        view.ox + 6,
        view.oy + 6 + badgeFs + 4,
      );
      const secAlive = (st.frame / 60).toFixed(1);
      ctx.textAlign = "right";
      ctx.fillText(`생존 ${secAlive}초`, view.ox + view.scale * 900 - 6, view.oy + 6);

      // 하단 패널: 세대별 최고 기록 막대 그래프
      const py = trackH + 8;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.font = `${isMobile ? 10 : 11}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.fillText("세대별 최고 생존 시간", 4, py);

      const barsTop = py + 16;
      const barsH = panelH - 22;
      const hist = st.history.slice(-40);
      const maxBars = Math.max(8, hist.length);
      const bw = Math.min(14, (w - 8) / maxBars - 2);
      hist.forEach((f, i) => {
        const bh = (f / MAX_FRAMES) * barsH;
        const bx = 4 + i * (bw + 2);
        ctx.fillStyle = f >= MAX_FRAMES ? "#40c057" : "#228be6";
        ctx.fillRect(bx, barsTop + (barsH - bh), bw, bh);
      });
      if (hist.length === 0) {
        ctx.fillStyle = "#adb5bd";
        ctx.fillText("첫 세대 진행 중…", 4, barsTop + 4);
      }

      if (!pausedRef.current) simulate();
      raf = scheduleMaterialFrame(render);
    };

    raf = scheduleMaterialFrame(render);
    return () => cancelMaterialFrame(raf);
  }, [resetKey]);

  const btn: React.CSSProperties = {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: 600,
    padding: "5px 12px",
    borderRadius: 6,
    border: "1px solid #dee2e6",
    background: "#fff",
    color: "#495057",
    cursor: "pointer",
  };

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
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button style={btn} onClick={() => setResetKey((k) => k + 1)}>
          0세대부터 다시
        </button>
        <button style={btn} onClick={() => setPaused((p) => !p)}>
          {paused ? "재생" : "일시정지"}
        </button>
        <span style={{ fontSize: 12, color: "#868e96", marginLeft: 4 }}>배속</span>
        {SPEEDS.map((s) => (
          <button
            key={s}
            style={{
              ...btn,
              padding: "5px 10px",
              background: speed === s ? "#228be6" : "#fff",
              color: speed === s ? "#fff" : "#495057",
              borderColor: speed === s ? "#228be6" : "#dee2e6",
            }}
            onClick={() => setSpeed(s)}
          >
            ×{s}
          </button>
        ))}
      </div>
      <div ref={containerRef}>
        <SvgCanvas ref={canvasRef} style={{ display: "block", width: "100%" }} />
      </div>
    </div>
  );
};
