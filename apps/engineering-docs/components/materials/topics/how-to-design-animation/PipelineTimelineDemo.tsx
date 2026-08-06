// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useRef, useEffect } from "react";
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

const CANVAS_W = 400;
const CANVAS_H = 110;

type Lang = "ko" | "en";

const STRINGS = {
  ko: { trackBg: "배경", trackCard: "카드", trackContent: "내용", timeAxis: "시간" },
  en: { trackBg: "Background", trackCard: "Card", trackContent: "Content", timeAxis: "Time" },
} as const;

const TRACKS = [
  { labelKey: "trackBg", start: 0, duration: 200, color: "#228be6" },
  { labelKey: "trackCard", start: 200, duration: 300, color: "#fab005" },
  { labelKey: "trackContent", start: 500, duration: 200, color: "#fa5252" },
] as const;

const TOTAL = 700;
const PAUSE = 800;
const CYCLE = TOTAL + PAUSE;

const TRACK_H = 18;
const TRACK_GAP = 8;
const LABEL_W: Record<Lang, number> = { ko: 36, en: 64 };
const PAD_R = 16;
const PAD_T = 12;
const PAD_B = 22;

export const PipelineTimelineDemo = ({ locale: lang = "ko" }: { locale?: Lang }) => {
  const canvasRef = useRef<SvgCanvasHandle>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);

    const strings = STRINGS[lang];
    const labelW = LABEL_W[lang];
    const padL = labelW + 12;
    const barW = CANVAS_W - padL - PAD_R;
    const start = performance.now();

    const animate = (now: number) => {
      const elapsed = ((now - start) / 1000) * 1000; // ms
      const t = elapsed % CYCLE;

      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      // Draw tracks
      TRACKS.forEach((track, i) => {
        const y = PAD_T + i * (TRACK_H + TRACK_GAP);

        // Label
        ctx.fillStyle = "#868e96";
        ctx.font = "11px -apple-system, sans-serif";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(strings[track.labelKey], labelW, y + TRACK_H / 2);

        // Background bar
        ctx.fillStyle = "#f1f3f5";
        ctx.beginPath();
        ctx.roundRect(padL, y, barW, TRACK_H, 4);
        ctx.fill();

        // Active bar
        const x0 = padL + (track.start / TOTAL) * barW;
        const w = (track.duration / TOTAL) * barW;

        ctx.globalAlpha = 0.2;
        ctx.fillStyle = track.color;
        ctx.beginPath();
        ctx.roundRect(x0, y, w, TRACK_H, 4);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Filled portion based on current time
        if (t > track.start) {
          const progress = Math.min((t - track.start) / track.duration, 1);
          const filledW = w * progress;
          ctx.fillStyle = track.color;
          ctx.beginPath();
          ctx.roundRect(x0, y, filledW, TRACK_H, 4);
          ctx.fill();
        }
      });

      // Time axis
      const axisY = PAD_T + TRACKS.length * (TRACK_H + TRACK_GAP);
      ctx.strokeStyle = "#dee2e6";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, axisY);
      ctx.lineTo(padL + barW, axisY);
      ctx.stroke();

      // Arrow head
      ctx.beginPath();
      ctx.fillStyle = "#dee2e6";
      ctx.moveTo(padL + barW, axisY);
      ctx.lineTo(padL + barW - 5, axisY - 3);
      ctx.lineTo(padL + barW - 5, axisY + 3);
      ctx.closePath();
      ctx.fill();

      // Time label
      ctx.fillStyle = "#adb5bd";
      ctx.font = "10px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(strings.timeAxis, padL + barW / 2, axisY + 4);

      // Playhead
      if (t < TOTAL) {
        const px = padL + (t / TOTAL) * barW;
        ctx.strokeStyle = "#495057";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(px, PAD_T - 2);
        ctx.lineTo(px, axisY);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      animRef.current = scheduleMaterialFrame(animate);
    };

    animRef.current = scheduleMaterialFrame(animate);
    return () => cancelMaterialFrame(animRef.current);
  }, [lang]);

  return (
    <div style={{ margin: "24px 0" }}>
      <div style={{ display: "flex", justifyContent: "center", padding: "18px 0" }}>
        <SvgCanvas
          ref={canvasRef}
          style={{
            width: "100%",
            maxWidth: CANVAS_W,
            aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
            display: "block",
          }}
        />
      </div>
    </div>
  );
};
