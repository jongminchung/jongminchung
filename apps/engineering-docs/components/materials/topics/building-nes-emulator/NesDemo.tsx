// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  cancelMaterialFrame,
  scheduleMaterialFrame,
} from "@/components/materials/runtime/scheduler";
import { chaseRom } from "./chaseRom";
import { NesAudio } from "./nesAudio";
import { NesConsole } from "./pkg/nes_core";
import { ensureWasm } from "./wasmInit";

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";
const NES_W = 256;
const NES_H = 240;
const MAX_WIDTH = 560;
const FRAME_MS = 1000 / 60; // 16.667ms
const MAX_CATCHUP = 3; // 한 프레임에 최대 3번만 실행 (120Hz 모니터 2배속 방지)

// 버튼 인덱스: A=0, B=1, Select=2, Start=3, Up=4, Down=5, Left=6, Right=7
const BTN = { A: 0, B: 1, SELECT: 2, START: 3, UP: 4, DOWN: 5, LEFT: 6, RIGHT: 7 } as const;

const keyToButton = (key: string): number | null => {
  switch (key) {
    case "ArrowUp":
      return BTN.UP;
    case "ArrowDown":
      return BTN.DOWN;
    case "ArrowLeft":
      return BTN.LEFT;
    case "ArrowRight":
      return BTN.RIGHT;
    case "x":
    case "X":
      return BTN.A;
    case "z":
    case "Z":
      return BTN.B;
    case "Enter":
      return BTN.START;
    case "Shift":
      return BTN.SELECT;
    default:
      return null;
  }
};

const NesDemo = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nesRef = useRef<NesConsole | null>(null);
  const romRef = useRef<Uint8Array | null>(null);
  const audioRef = useRef<NesAudio | null>(null);
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  pausedRef.current = paused;

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let cancelled = false;
    let raf = 0;
    let last = -1;
    let acc = 0;
    let lastW = 0;

    const audio = new NesAudio();
    audioRef.current = audio;

    // 탭이 백그라운드로 가면 suspend, 돌아오면 resume (일시정지 중이 아니면)
    const onVisibility = () => {
      if (document.hidden) audio.suspend();
      else if (!pausedRef.current) audio.resume();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const off = document.createElement("canvas");
    off.width = NES_W;
    off.height = NES_H;
    const offCtx = off.getContext("2d")!;

    (async () => {
      await ensureWasm();
      if (cancelled) return;

      try {
        const rom = chaseRom();
        romRef.current = rom;
        nesRef.current = new NesConsole(rom);
      } catch (e) {
        setError(String(e));
        return;
      }

      const render = (ts: number) => {
        if (cancelled) return;
        raf = scheduleMaterialFrame(render);

        const nes = nesRef.current;
        if (!nes) return;

        if (last < 0) last = ts;
        let delta = ts - last;
        last = ts;
        // 탭이 비활성이었다가 돌아오면 델타가 매우 커진다 → 버린다 (자동 일시정지 효과)
        if (delta > 250) delta = 0;

        if (!pausedRef.current) {
          acc += delta;
          let steps = 0;
          while (acc >= FRAME_MS && steps < MAX_CATCHUP) {
            nes.run_frame();
            acc -= FRAME_MS;
            steps++;
          }
          if (acc >= FRAME_MS) acc = 0; // 밀린 시간은 버린다
        }

        // 쌓인 APU 샘플을 매 프레임 배출한다.
        // 음소거/미시작이어도 호출해야 Rust 쪽 버퍼가 무한히 쌓이지 않는다.
        audio.push(nes.audio());

        // 프레임버퍼 → 캔버스
        const buf = nes.frame();
        offCtx.putImageData(new ImageData(new Uint8ClampedArray(buf), NES_W, NES_H), 0, 0);

        const w = Math.min(container.clientWidth, MAX_WIDTH);
        const h = Math.round((w * NES_H) / NES_W);
        const dpr = window.devicePixelRatio || 1;
        if (w !== lastW) {
          lastW = w;
          canvas.width = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
          canvas.style.width = `${w}px`;
          canvas.style.height = `${h}px`;
        }
        const ctx = canvas.getContext("2d")!;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
      };

      raf = scheduleMaterialFrame(render);
    })();

    return () => {
      cancelled = true;
      cancelMaterialFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      audio.close();
      audioRef.current = null;
      nesRef.current = null;
    };
  }, []);

  const setButton = (idx: number, pressed: boolean) => {
    nesRef.current?.set_button(idx, pressed);
  };

  const releaseAll = () => {
    for (let i = 0; i < 8; i++) setButton(i, false);
  };

  const onKey = (e: React.KeyboardEvent<HTMLCanvasElement>, pressed: boolean) => {
    const btn = keyToButton(e.key);
    if (btn === null) return;
    if (e.key.startsWith("Arrow") || e.key === "Enter") e.preventDefault();
    setButton(btn, pressed);
  };

  const loadRom = (rom: Uint8Array) => {
    try {
      const nes = new NesConsole(rom);
      romRef.current = rom;
      nesRef.current = nes;
      setError(null);
      setPaused(false);
    } catch (e) {
      setError(String(e));
    }
  };

  const loadFile = (file: File) => {
    file
      .arrayBuffer()
      .then((buf) => loadRom(new Uint8Array(buf)))
      .catch(() => setError("파일을 읽지 못했다"));
  };

  const reset = () => {
    if (romRef.current) loadRom(romRef.current);
  };

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

  const padBtn: React.CSSProperties = {
    ...btn,
    minWidth: 44,
    minHeight: 44,
    fontSize: 15,
    padding: 0,
    touchAction: "none",
    userSelect: "none",
    WebkitUserSelect: "none",
  };

  // 터치/포인터로 누르고 있는 동안 버튼 유지
  const holdProps = (idx: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setButton(idx, true);
    },
    onPointerUp: () => setButton(idx, false),
    onPointerCancel: () => setButton(idx, false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  return (
    <div
      data-testid="nes-demo"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) loadFile(file);
      }}
      style={{
        border: dragging ? "2px dashed #228be6" : "1px solid #dee2e6",
        borderRadius: 8,
        padding: dragging ? 19 : 20,
        margin: "24px 0",
        background: "#fff",
        fontFamily: FONT,
      }}
    >
      {/* 컨트롤 바 */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button data-testid="nes-reset" style={btn} onClick={reset}>
          리셋
        </button>
        <button
          data-testid="nes-pause"
          style={{
            ...btn,
            ...(paused
              ? { background: "#228be6", color: "#fff", border: "1px solid #228be6" }
              : null),
          }}
          onClick={() => {
            const next = !paused;
            setPaused(next);
            // 일시정지 중에는 오디오 컨텍스트도 재운다 (버튼 클릭은 사용자 제스처라 resume 가능)
            if (next) audioRef.current?.suspend();
            else audioRef.current?.resume();
          }}
        >
          {paused ? "재생" : "일시정지"}
        </button>
        <button
          data-testid="nes-mute"
          style={{
            ...btn,
            ...(muted
              ? { background: "#228be6", color: "#fff", border: "1px solid #228be6" }
              : null),
          }}
          onClick={() => {
            const next = !muted;
            setMuted(next);
            audioRef.current?.setMuted(next);
          }}
        >
          {muted ? "소리 켬" : "소리 끔"}
        </button>
        <label style={{ ...btn, marginLeft: "auto" }}>
          파일 선택
          <input
            type="file"
            accept=".nes"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) loadFile(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {error && (
        <div
          data-testid="nes-error"
          style={{
            marginBottom: 12,
            padding: "8px 12px",
            borderRadius: 6,
            background: "#fff5f5",
            border: "1px solid #ffc9c9",
            color: "#e03131",
            fontSize: 13,
          }}
        >
          롬을 불러오지 못했다: {error}
        </div>
      )}

      {/* 화면 */}
      <div ref={containerRef} style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ position: "relative", width: "100%", maxWidth: MAX_WIDTH }}>
          <canvas
            ref={canvasRef}
            data-testid="nes-canvas"
            tabIndex={0}
            onKeyDown={(e) => onKey(e, true)}
            onKeyUp={(e) => onKey(e, false)}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              releaseAll();
            }}
            onClick={(e) => {
              e.currentTarget.focus();
              // 오토플레이 정책: 사용자 제스처(첫 클릭) 안에서만 AudioContext 생성/resume 가능
              if (!pausedRef.current) audioRef.current?.start();
            }}
            style={{
              display: "block",
              width: "100%",
              borderRadius: 4,
              outline: "none",
              cursor: "pointer",
              background: "#000",
              aspectRatio: `${NES_W} / ${NES_H}`,
            }}
          />
          {!focused && (
            <div
              data-testid="nes-overlay"
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0, 0, 0, 0.45)",
                borderRadius: 4,
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                textAlign: "center",
                padding: 16,
                pointerEvents: "none",
              }}
            >
              클릭하고 키보드로 조작
              <br />
              (방향키 · X=A · Z=B · Enter=Start)
            </div>
          )}
        </div>
      </div>

      {/* 모바일 컨트롤 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          maxWidth: MAX_WIDTH,
          margin: "14px auto 0",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        {/* 십자키 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 44px)",
            gridTemplateRows: "repeat(3, 44px)",
            gap: 4,
          }}
        >
          <span />
          <button style={padBtn} aria-label="위" {...holdProps(BTN.UP)}>
            ▲
          </button>
          <span />
          <button style={padBtn} aria-label="왼쪽" {...holdProps(BTN.LEFT)}>
            ◀
          </button>
          <span />
          <button style={padBtn} aria-label="오른쪽" {...holdProps(BTN.RIGHT)}>
            ▶
          </button>
          <span />
          <button style={padBtn} aria-label="아래" {...holdProps(BTN.DOWN)}>
            ▼
          </button>
          <span />
        </div>

        {/* A/B/Start/Select */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ ...padBtn, borderRadius: 22 }} aria-label="B" {...holdProps(BTN.B)}>
              B
            </button>
            <button style={{ ...padBtn, borderRadius: 22 }} aria-label="A" {...holdProps(BTN.A)}>
              A
            </button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={{ ...padBtn, fontSize: 10, minWidth: 56 }}
              aria-label="Select"
              {...holdProps(BTN.SELECT)}
            >
              SELECT
            </button>
            <button
              style={{ ...padBtn, fontSize: 10, minWidth: 56 }}
              aria-label="Start"
              {...holdProps(BTN.START)}
            >
              START
            </button>
          </div>
        </div>
      </div>

      <p style={{ fontSize: 12, color: "#868e96", textAlign: "center", margin: "12px 0 0" }}>
        직접 구한 .nes 파일을 여기 끌어다 놓거나 위의 [파일 선택]으로 불러올 수 있다
      </p>
    </div>
  );
};

export default NesDemo;
