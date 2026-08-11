// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useRef, useEffect, useState } from "react";
import {
  cancelMaterialFrame,
  scheduleMaterialFrame,
} from "#components/materials/runtime/scheduler";

type Lang = "ko" | "en";

const STRINGS = {
  ko: {
    amplitude: "Amplitude (진폭)",
    frequency: "Frequency (주파수)",
    phaseOffset: "Phase Offset (위상 차이)",
    caption: "위상 차이를 조절하면 파동 효과를 만들 수 있습니다",
  },
  en: {
    amplitude: "Amplitude",
    frequency: "Frequency",
    phaseOffset: "Phase Offset",
    caption: "Adjust the phase offset to create a wave effect",
  },
} as const;

export const TrigWaveDemo = ({ locale: lang = "ko" }: { locale?: Lang }) => {
  const t = STRINGS[lang];
  const animRef = useRef<number>(0);
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const timeRef = useRef(0);

  const [amplitude, setAmplitude] = useState(20);
  const [frequency, setFrequency] = useState(1);
  const [phaseOffset, setPhaseOffset] = useState(0.5);

  const BAR_COUNT = 20;

  useEffect(() => {
    const animate = () => {
      timeRef.current += 1 / 60;

      barsRef.current.forEach((bar, i) => {
        if (!bar) return;
        const y = amplitude * Math.sin(timeRef.current * frequency * Math.PI * 2 + i * phaseOffset);
        bar.style.transform = `translateY(${y}px)`;
      });

      animRef.current = scheduleMaterialFrame(animate);
    };

    animRef.current = scheduleMaterialFrame(animate);
    return () => cancelMaterialFrame(animRef.current);
  }, [amplitude, frequency, phaseOffset]);

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
        <div style={{ flex: 1, minWidth: 140 }}>
          <label style={{ fontSize: 13, color: "#495057", display: "block", marginBottom: 4 }}>
            {t.amplitude}: <strong>{amplitude}</strong>
          </label>
          <input
            type="range"
            min="5"
            max="40"
            value={amplitude}
            onChange={(e) => setAmplitude(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label style={{ fontSize: 13, color: "#495057", display: "block", marginBottom: 4 }}>
            {t.frequency}: <strong>{frequency.toFixed(1)}</strong>
          </label>
          <input
            type="range"
            min="0.5"
            max="5"
            step="0.1"
            value={frequency}
            onChange={(e) => setFrequency(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label style={{ fontSize: 13, color: "#495057", display: "block", marginBottom: 4 }}>
            {t.phaseOffset}: <strong>{phaseOffset.toFixed(1)}</strong>
          </label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={phaseOffset}
            onChange={(e) => setPhaseOffset(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 120,
          background: "#f8f9fa",
          borderRadius: 8,
          gap: 6,
        }}
      >
        {Array.from({ length: BAR_COUNT }, (_, i) => (
          <div
            key={i}
            ref={(el) => {
              barsRef.current[i] = el;
            }}
            style={{
              width: 8,
              height: 40,
              borderRadius: 4,
              background: `hsl(${210 + i * 3}, 70%, 55%)`,
            }}
          />
        ))}
      </div>
      <div style={{ fontSize: 11, color: "#adb5bd", textAlign: "center", marginTop: 6 }}>
        {t.caption}
      </div>
    </div>
  );
};
