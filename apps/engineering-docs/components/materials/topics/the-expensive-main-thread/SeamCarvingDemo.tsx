// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useRef, useEffect, useState } from "react";
import {
  cancelMaterialFrame,
  scheduleMaterialFrame,
} from "@/components/materials/runtime/scheduler";
import { carveSeam, packFrame } from "./seamCarving";
import { useVisible } from "./useVisible";

// 시임 카빙으로 사진의 폭을 30% 줄인다 — 같은 계산을 메인 스레드에서 vs 워커에서.
const IMG_W = 840;
const IMG_H = 560;
const SEAMS = Math.round(IMG_W * 0.3); // 제거할 시임 수

type Phase = "loading" | "ready" | "running" | "done" | "error";

type Lang = "ko" | "en";

const STRINGS = {
  ko: {
    caption: "시임 카빙 — 중요한 피사체는 지키면서 사진의 폭을 30% 줄인다",
    main: "메인 스레드에서 실행",
    worker: "워커에서 실행",
    loading: "사진 불러오는 중…",
    error: "사진을 불러오지 못했다 — 네트워크 확인 후 새로고침",
    running: "줄이는 중…",
    run: "너비 30% 줄이기",
    reset: "원본으로",
  },
  en: {
    caption: "Seam carving — shrink the photo's width by 30% while keeping the important subjects",
    main: "Run on main thread",
    worker: "Run in worker",
    loading: "Loading photo…",
    error: "Failed to load the photo — check your network and refresh",
    running: "Shrinking…",
    run: "Shrink width by 30%",
    reset: "Reset to original",
  },
} as const;

export const SeamCarvingDemo = ({ locale: lang = "ko" }: { locale?: Lang }) => {
  const t = STRINGS[lang];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fpsRef = useRef<HTMLSpanElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const framesRef = useRef<number[]>([]);
  const originalRef = useRef<Uint8ClampedArray | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const loadStartedRef = useRef(false);
  const [phase, setPhase] = useState<Phase>("loading");
  const [mode, setMode] = useState<"main" | "worker">("main");
  const { ref: rootRef, visible } = useVisible<HTMLDivElement>();

  useEffect(() => {
    return () => workerRef.current?.terminate();
  }, []);

  const draw = (packed: Uint8ClampedArray, w: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = w;
    canvas.height = IMG_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(w, IMG_H);
    img.data.set(packed);
    ctx.putImageData(img, 0, 0);
    canvas.style.width = `${(w / IMG_W) * 100}%`; // 내부 폭에 비례해 표시 폭도 줄인다
  };

  useEffect(() => {
    if (!visible) {
      // 화면 밖으로 나가면 진행 중인 워커 작업은 중단한다
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
        setPhase("ready");
      }
      return;
    }
    if (!loadStartedRef.current) {
      loadStartedRef.current = true;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const cv = document.createElement("canvas");
        cv.width = IMG_W;
        cv.height = IMG_H;
        const ctx = cv.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, IMG_W, IMG_H);
        originalRef.current = ctx.getImageData(0, 0, IMG_W, IMG_H).data.slice();
        draw(originalRef.current.slice(), IMG_W);
        setPhase("ready");
      };
      img.onerror = () => setPhase("error");
      img.src = "/materials/samples/main-thread.jpg";
    }
    const animate = (t: number) => {
      const frames = framesRef.current;
      frames.push(t);
      while (frames.length && t - frames[0] > 1000) frames.shift();
      if (fpsRef.current) fpsRef.current.textContent = String(frames.length);
      if (knobRef.current) {
        const p = (Math.sin(t * 0.004) + 1) / 2;
        const track = knobRef.current.parentElement;
        const range = track ? track.clientWidth - 14 : 100;
        knobRef.current.style.transform = `translateX(${p * range}px)`;
      }
      rafRef.current = scheduleMaterialFrame(animate);
    };
    rafRef.current = scheduleMaterialFrame(animate);
    return () => cancelMaterialFrame(rafRef.current);
  }, [visible]);

  const run = () => {
    const original = originalRef.current;
    if (!original || phase === "running" || phase === "loading") return;
    const px = original.slice(); // 원본은 보존하고 사본으로 작업한다
    setPhase("running");
    draw(original.slice(), IMG_W);

    if (mode === "main") {
      // 버튼 상태가 먼저 그려지도록 다음 태스크에서 통째로 실행한다
      setTimeout(() => {
        let w = IMG_W;
        for (let s = 0; s < SEAMS; s++) {
          carveSeam(px, IMG_W, w, IMG_H);
          w--;
        }
        draw(packFrame(px, IMG_W, w, IMG_H), w);
        setPhase("done");
      }, 30);
    } else {
      const worker = new Worker(new URL("./seamCarver.worker.ts", import.meta.url), {
        type: "module",
      });
      workerRef.current = worker;
      worker.onmessage = (
        e: MessageEvent<{ type: "frame" | "done"; buf: ArrayBuffer; w: number; done: number }>,
      ) => {
        const m = e.data;
        draw(new Uint8ClampedArray(m.buf), m.w);
        if (m.type === "done") {
          setPhase("done");
          worker.terminate();
          workerRef.current = null;
        }
      };
      // 작업용 사본을 복사 없이 소유권째 넘긴다(transferable)
      worker.postMessage({ buf: px.buffer, stride: IMG_W, w: IMG_W, h: IMG_H, seams: SEAMS }, [
        px.buffer,
      ]);
    }
  };

  const reset = () => {
    if (!originalRef.current || phase === "running") return;
    draw(originalRef.current.slice(), IMG_W);
    setPhase("ready");
  };

  const modeBtn = (m: "main" | "worker", label: string) => (
    <button
      onClick={() => setMode(m)}
      style={{
        flex: 1,
        padding: "7px 10px",
        border: mode === m ? "2px solid #228be6" : "1px solid #dee2e6",
        borderRadius: 6,
        background: mode === m ? "#e7f5ff" : "#fff",
        color: mode === m ? "#1971c2" : "#868e96",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: mode === m ? 700 : 500,
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      ref={rootRef}
      style={{
        border: "1px solid #dee2e6",
        borderRadius: 8,
        padding: 20,
        margin: "24px 0",
        background: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          fontSize: 11,
          color: "#868e96",
          marginBottom: 8,
        }}
      >
        <span>{t.caption}</span>
        <span style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
          <span ref={fpsRef} style={{ fontWeight: 700, color: "#495057" }}>
            60
          </span>{" "}
          fps
        </span>
      </div>
      <div
        style={{
          position: "relative",
          height: 14,
          background: "#f1f3f5",
          borderRadius: 7,
          marginBottom: 12,
        }}
      >
        <div
          ref={knobRef}
          style={{ width: 14, height: 14, borderRadius: "50%", background: "#228be6" }}
        />
      </div>

      {/* 모드 선택 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {modeBtn("main", t.main)}
        {modeBtn("worker", t.worker)}
      </div>

      {/* 사진 */}
      <div
        style={{
          background: "#f1f3f5",
          borderRadius: 8,
          padding: 10,
          textAlign: "center",
          minHeight: 120,
        }}
      >
        {phase === "loading" && (
          <div style={{ fontSize: 12, color: "#adb5bd", padding: "40px 0" }}>{t.loading}</div>
        )}
        {phase === "error" && (
          <div style={{ fontSize: 12, color: "#adb5bd", padding: "40px 0" }}>{t.error}</div>
        )}
        <canvas
          ref={canvasRef}
          style={{
            display: phase === "loading" || phase === "error" ? "none" : "inline-block",
            maxWidth: "100%",
            borderRadius: 6,
          }}
        />
      </div>

      {/* 실행 */}
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
        <button
          onClick={run}
          disabled={phase === "running" || phase === "loading" || phase === "error"}
          style={{
            padding: "8px 20px",
            border: "none",
            borderRadius: 6,
            background: phase === "running" || phase === "loading" ? "#ced4da" : "#228be6",
            color: "#fff",
            cursor: phase === "running" || phase === "loading" ? "default" : "pointer",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {phase === "running" ? t.running : t.run}
        </button>
        <button
          onClick={reset}
          disabled={phase !== "done"}
          style={{
            padding: "8px 18px",
            border: "none",
            borderRadius: 6,
            background: phase === "done" ? "#868e96" : "#e9ecef",
            color: phase === "done" ? "#fff" : "#adb5bd",
            cursor: phase === "done" ? "pointer" : "default",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {t.reset}
        </button>
      </div>
    </div>
  );
};
