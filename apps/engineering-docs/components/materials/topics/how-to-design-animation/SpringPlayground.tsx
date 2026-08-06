// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
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

type Lang = "ko" | "en";

const STRINGS = {
  ko: {
    stiffnessLabel: "Stiffness (강성)",
    dampingLabel: "Damping (감쇠)",
    underdamped: "Underdamped (진동)",
    critical: "Critically Damped (임계)",
    overdamped: "Overdamped (과감쇠)",
    playing: "재생 중...",
    play: "▶ 재생",
  },
  en: {
    stiffnessLabel: "Stiffness",
    dampingLabel: "Damping",
    underdamped: "Underdamped",
    critical: "Critically damped",
    overdamped: "Overdamped",
    playing: "Playing...",
    play: "▶ Play",
  },
} as const;

export const SpringPlayground = ({ locale: lang = "ko" }: { locale?: Lang }) => {
  const t = STRINGS[lang];
  const canvasRef = useRef<SvgCanvasHandle>(null);
  const ballRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const [stiffness, setStiffness] = useState(120);
  const [damping, setDamping] = useState(10);
  const [isPlaying, setIsPlaying] = useState(false);

  const animRef = useRef<number>(0);
  const stateRef = useRef({ current: 0, velocity: 0, target: 1 });
  const historyRef = useRef<number[]>([]);

  const drawGraph = useCallback(
    (ctx: SvgDrawingContext, width: number, height: number, history: number[]) => {
      const padding = 30;
      const graphW = width - padding * 2;
      const graphH = height - padding * 2;

      ctx.clearRect(0, 0, width, height);

      // Background
      ctx.fillStyle = "#f8f9fa";
      ctx.fillRect(padding, padding, graphW, graphH);

      // Target line
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = "#adb5bd";
      ctx.lineWidth = 1;
      ctx.beginPath();
      const targetY = padding + graphH * 0.15;
      ctx.moveTo(padding, targetY);
      ctx.lineTo(padding + graphW, targetY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Target label
      ctx.fillStyle = "#adb5bd";
      ctx.font = "10px -apple-system, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText("target", padding + graphW - 4, targetY - 6);

      // Start line
      const startY = padding + graphH * 0.85;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(padding, startY);
      ctx.lineTo(padding + graphW, startY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillText("start", padding + graphW - 4, startY - 6);

      // Axes
      ctx.strokeStyle = "#adb5bd";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(padding, padding);
      ctx.lineTo(padding, padding + graphH);
      ctx.lineTo(padding + graphW, padding + graphH);
      ctx.stroke();

      // Labels
      ctx.fillStyle = "#868e96";
      ctx.font = "11px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("time →", padding + graphW / 2, padding + graphH + 20);

      // Draw history
      if (history.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = "#228be6";
        ctx.lineWidth = 2.5;

        const maxPoints = 200;
        const step = Math.max(1, Math.floor(history.length / maxPoints));

        for (let i = 0; i < history.length; i += step) {
          const x = padding + (i / history.length) * graphW;
          const normalizedValue = history[i];
          const y = startY - normalizedValue * (startY - targetY);

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Current dot
        const lastVal = history[history.length - 1];
        const lastX = padding + graphW;
        const lastY = startY - lastVal * (startY - targetY);
        ctx.beginPath();
        ctx.fillStyle = "#ff6b6b";
        ctx.arc(lastX, lastY, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    [],
  );

  const play = useCallback(() => {
    setIsPlaying(true);
    stateRef.current = { current: 0, velocity: 0, target: 1 };
    historyRef.current = [0];

    const dt = 1 / 60;
    let frame = 0;
    const maxFrames = 300; // 5 seconds max

    const animate = () => {
      const state = stateRef.current;
      const force = -stiffness * (state.current - state.target) - damping * state.velocity;
      state.velocity += force * dt;
      state.current += state.velocity * dt;

      historyRef.current.push(state.current);
      frame++;

      // Update ball position
      if (ballRef.current && trackRef.current) {
        const trackWidth = trackRef.current.offsetWidth;
        const ballSize = 28;
        const startLeft = 6;
        const endLeft = trackWidth - 34 - ballSize / 2; // align ball center with target marker
        const clamped = Math.max(-0.2, Math.min(1.3, state.current));
        ballRef.current.style.left = `${startLeft + clamped * (endLeft - startLeft)}px`;
      }

      // Update canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const rect = canvas.getBoundingClientRect();
          drawGraph(ctx, rect.width, rect.height, historyRef.current);
        }
      }

      // Check convergence
      const isSettled =
        Math.abs(state.current - state.target) < 0.001 && Math.abs(state.velocity) < 0.001;

      if (frame < maxFrames && !isSettled) {
        animRef.current = scheduleMaterialFrame(animate);
      } else {
        state.current = state.target;
        state.velocity = 0;
        if (ballRef.current && trackRef.current) {
          const trackWidth = trackRef.current.offsetWidth;
          const ballSize = 28;
          const endLeft = trackWidth - 34 - ballSize / 2;
          ballRef.current.style.left = `${endLeft}px`;
        }
        setIsPlaying(false);
      }
    };

    animRef.current = scheduleMaterialFrame(animate);
  }, [stiffness, damping, drawGraph]);

  useEffect(() => {
    return () => cancelMaterialFrame(animRef.current);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    drawGraph(ctx, rect.width, rect.height, []);
  }, [drawGraph]);

  // Compute damping ratio for label
  const criticalDamping = 2 * Math.sqrt(stiffness);
  const dampingRatio = damping / criticalDamping;
  const dampingLabel =
    dampingRatio < 0.95 ? t.underdamped : dampingRatio < 1.05 ? t.critical : t.overdamped;

  return (
    <div
      style={{
        border: "1px solid #dee2e6",
        borderRadius: 8,
        padding: 20,
        margin: "24px 0",
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label style={{ fontSize: 13, color: "#495057", display: "block", marginBottom: 4 }}>
            {t.stiffnessLabel}: <strong>{stiffness}</strong>
          </label>
          <input
            type="range"
            min="10"
            max="400"
            value={stiffness}
            onChange={(e) => setStiffness(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label style={{ fontSize: 13, color: "#495057", display: "block", marginBottom: 4 }}>
            {t.dampingLabel}: <strong>{damping}</strong>
          </label>
          <input
            type="range"
            min="1"
            max="60"
            value={damping}
            onChange={(e) => setDamping(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>
      </div>

      <div
        style={{
          fontSize: 12,
          color: dampingRatio < 0.95 ? "#1971c2" : dampingRatio < 1.05 ? "#2b8a3e" : "#e67700",
          marginBottom: 12,
          padding: "6px 12px",
          background: dampingRatio < 0.95 ? "#e7f5ff" : dampingRatio < 1.05 ? "#ebfbee" : "#fff9db",
          borderRadius: 4,
          display: "inline-block",
        }}
      >
        {dampingLabel} — damping ratio: {dampingRatio.toFixed(2)}
      </div>

      <SvgCanvas
        ref={canvasRef}
        style={{ width: "100%", height: 200, display: "block", marginBottom: 12 }}
      />

      <div
        ref={trackRef}
        style={{
          position: "relative",
          height: 40,
          background: "#f1f3f5",
          borderRadius: 8,
          marginBottom: 4,
          overflow: "hidden",
        }}
      >
        <div
          ref={ballRef}
          style={{
            position: "absolute",
            left: 6,
            top: "50%",
            marginTop: -14,
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "#228be6",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 34,
            top: "50%",
            transform: "translateY(-50%)",
            width: 2,
            height: 20,
            background: "#adb5bd",
            borderRadius: 1,
          }}
        />
      </div>
      <div style={{ fontSize: 11, color: "#adb5bd", textAlign: "right", marginBottom: 12 }}>
        ↑ target
      </div>

      <button
        onClick={() => {
          cancelMaterialFrame(animRef.current);
          play();
        }}
        disabled={isPlaying}
        style={{
          padding: "10px 24px",
          background: isPlaying ? "#adb5bd" : "#228be6",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: isPlaying ? "default" : "pointer",
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        {isPlaying ? t.playing : t.play}
      </button>
    </div>
  );
};
