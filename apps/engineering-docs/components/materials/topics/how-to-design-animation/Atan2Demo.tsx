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

type Lang = "ko" | "en";

const STRINGS = {
  ko: { hint: "마우스를 움직여보세요" },
  en: { hint: "Move your mouse" },
} as const;

export const Atan2Demo = ({ locale: lang = "ko" }: { locale?: Lang }) => {
  const canvasRef = useRef<SvgCanvasHandle>(null);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const cx = w / 2;
    const cy = h / 2;

    const handlePointer = (e: MouseEvent | TouchEvent) => {
      const r = canvas.getBoundingClientRect();
      const point = "touches" in e ? e.touches[0] : e;
      if (!point) return;
      mouseRef.current = {
        x: point.clientX - r.left,
        y: point.clientY - r.top,
      };
    };

    canvas.addEventListener("mousemove", handlePointer);
    canvas.addEventListener("touchmove", handlePointer, { passive: true });

    const animate = () => {
      const mouse = mouseRef.current;
      const angle = mouse ? Math.atan2(mouse.y - cy, mouse.x - cx) : 0;

      ctx.clearRect(0, 0, w, h);

      // Background
      ctx.fillStyle = "#f8f9fa";
      ctx.fillRect(0, 0, w, h);

      // Reference x-axis line
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "#dee2e6";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + 80, cy);
      ctx.stroke();
      ctx.setLineDash([]);

      // Dashed line to cursor
      if (mouse) {
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = "#adb5bd";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(mouse.x, mouse.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Cursor dot
        ctx.beginPath();
        ctx.fillStyle = "#ff6b6b";
        ctx.arc(mouse.x, mouse.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Angle arc
      ctx.beginPath();
      ctx.strokeStyle = "#fab005";
      ctx.lineWidth = 2;
      ctx.arc(cx, cy, 28, 0, angle, angle < 0);
      ctx.stroke();

      // Arrow body
      const bodyLen = 40;
      ctx.beginPath();
      ctx.strokeStyle = "#228be6";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * bodyLen, cy + Math.sin(angle) * bodyLen);
      ctx.stroke();

      // Arrow head
      const tipX = cx + Math.cos(angle) * (bodyLen + 2);
      const tipY = cy + Math.sin(angle) * (bodyLen + 2);
      const headLen = 12;
      const headSpread = 0.45;
      ctx.beginPath();
      ctx.fillStyle = "#228be6";
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(
        tipX - Math.cos(angle - headSpread) * headLen,
        tipY - Math.sin(angle - headSpread) * headLen,
      );
      ctx.lineTo(
        tipX - Math.cos(angle + headSpread) * headLen,
        tipY - Math.sin(angle + headSpread) * headLen,
      );
      ctx.closePath();
      ctx.fill();

      // Center dot
      ctx.beginPath();
      ctx.fillStyle = "#228be6";
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();

      // Angle text
      ctx.fillStyle = "#868e96";
      ctx.font = "12px -apple-system, monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText(`\u03B8 = ${((angle * 180) / Math.PI).toFixed(1)}\u00B0`, w - 10, h - 8);

      if (!mouse) {
        ctx.fillStyle = "#adb5bd";
        ctx.font = "12px -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(STRINGS[lang].hint, cx, h - 16);
      }

      animRef.current = scheduleMaterialFrame(animate);
    };

    animRef.current = scheduleMaterialFrame(animate);

    return () => {
      canvas.removeEventListener("mousemove", handlePointer);
      canvas.removeEventListener("touchmove", handlePointer);
      cancelMaterialFrame(animRef.current);
    };
  }, [lang]);

  return (
    <div style={{ margin: "24px 0" }}>
      <SvgCanvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: 220,
          display: "block",
          cursor: "crosshair",
          borderRadius: 8,
          touchAction: "none",
        }}
      />
    </div>
  );
};
