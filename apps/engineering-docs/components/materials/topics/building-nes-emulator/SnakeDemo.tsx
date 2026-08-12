"use client";

import React, { useEffect, useRef, useState } from "react";
import {
    cancelMaterialFrame,
    scheduleMaterialFrame,
} from "#components/materials/runtime/scheduler";
import { SnakeConsole } from "./pkg/nes_core";
import { ensureWasm } from "./wasmInit";

const FONT =
    "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";
const SCREEN = 32; // 32×32 픽셀 화면
// 프레임당 실행할 명령어 수 (×1 기준).
// 게임의 딜레이 루프(약 500~1,000 명령어/이동)를 감안해 초당 4~8칸 정도로 맞춘 값.
// 240으로 하면 초당 15칸 이상이라 시작하자마자 벽에 부딪힌다 (실측).
const BASE_INSTRUCTIONS = 80;
const SPEEDS = [1, 2, 4];
const MAX_CANVAS = 416;

// 방향 → 게임이 읽는 키 코드 (w/a/s/d의 ASCII)
const KEY_UP = 0x77;
const KEY_LEFT = 0x61;
const KEY_DOWN = 0x73;
const KEY_RIGHT = 0x64;

const keyFromEvent = (key: string): number | null => {
    switch (key) {
        case "ArrowUp":
        case "w":
        case "W":
            return KEY_UP;
        case "ArrowLeft":
        case "a":
        case "A":
            return KEY_LEFT;
        case "ArrowDown":
        case "s":
        case "S":
            return KEY_DOWN;
        case "ArrowRight":
        case "d":
        case "D":
            return KEY_RIGHT;
        default:
            return null;
    }
};

const SnakeDemo = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const consoleRef = useRef<SnakeConsole | null>(null);
    const [resetKey, setResetKey] = useState(0);
    const [speed, setSpeed] = useState(1);
    const [gameOver, setGameOver] = useState(false);
    const [snakeLen, setSnakeLen] = useState(0);
    const speedRef = useRef(1);
    speedRef.current = speed;
    const gameOverRef = useRef(false);

    useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;

        let cancelled = false;
        let raf = 0;

        // 32×32 픽셀 버퍼를 담는 오프스크린 캔버스
        const off = document.createElement("canvas");
        off.width = SCREEN;
        off.height = SCREEN;
        const offCtx = off.getContext("2d")!;

        gameOverRef.current = false;
        setGameOver(false);
        setSnakeLen(0);

        void (async () => {
            await ensureWasm();
            if (cancelled) return;

            const seed = resetKey === 0 ? 7 : Date.now() >>> 0;
            const nes = new SnakeConsole(seed);
            consoleRef.current = nes;
            let lastLen = -1;

            const render = () => {
                if (cancelled) return;

                if (!gameOverRef.current) {
                    const alive = nes.run(BASE_INSTRUCTIONS * speedRef.current);
                    if (!alive || nes.game_over()) {
                        gameOverRef.current = true;
                        setGameOver(true);
                    }
                }

                // 프레임 그리기
                const buf = nes.frame();
                const img = new ImageData(
                    new Uint8ClampedArray(buf),
                    SCREEN,
                    SCREEN,
                );
                offCtx.putImageData(img, 0, 0);

                const w = Math.min(container.clientWidth, MAX_CANVAS);
                const dpr = window.devicePixelRatio || 1;
                canvas.width = Math.round(w * dpr);
                canvas.height = Math.round(w * dpr);
                canvas.style.width = `${w}px`;
                canvas.style.height = `${w}px`;
                const ctx = canvas.getContext("2d")!;
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(off, 0, 0, canvas.width, canvas.height);

                const len = nes.snake_len();
                if (len !== lastLen) {
                    lastLen = len;
                    setSnakeLen(len);
                }

                raf = scheduleMaterialFrame(render);
            };

            raf = scheduleMaterialFrame(render);
        })();

        return () => {
            cancelled = true;
            cancelMaterialFrame(raf);
            consoleRef.current = null;
        };
    }, [resetKey]);

    const sendKey = (code: number) => {
        if (!gameOverRef.current) consoleRef.current?.set_key(code);
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
        const code = keyFromEvent(e.key);
        if (code === null) return;
        if (e.key.startsWith("Arrow")) e.preventDefault();
        sendKey(code);
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

    const dpadBtn: React.CSSProperties = {
        ...btn,
        minWidth: 48,
        minHeight: 48,
        fontSize: 16,
        padding: 0,
        touchAction: "manipulation",
        userSelect: "none",
    };

    return (
        <div
            data-testid="snake-demo"
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
                <button
                    data-testid="snake-restart"
                    style={{
                        ...btn,
                        ...(gameOver
                            ? {
                                  background: "#228be6",
                                  color: "#fff",
                                  borderColor: "#228be6",
                              }
                            : null),
                    }}
                    onClick={() => setResetKey((k) => k + 1)}
                >
                    다시 시작
                </button>
                <span style={{ fontSize: 12, color: "#868e96", marginLeft: 4 }}>
                    배속
                </span>
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
                <span
                    data-testid="snake-len"
                    style={{
                        fontSize: 12,
                        color: "#495057",
                        marginLeft: "auto",
                        fontWeight: 600,
                    }}
                >
                    뱀 길이 {snakeLen}
                </span>
            </div>

            <div
                ref={containerRef}
                style={{ display: "flex", justifyContent: "center" }}
            >
                <div
                    style={{
                        position: "relative",
                        width: "100%",
                        maxWidth: MAX_CANVAS,
                    }}
                >
                    <canvas
                        ref={canvasRef}
                        data-testid="snake-canvas"
                        tabIndex={0}
                        onKeyDown={onKeyDown}
                        onClick={(e) => e.currentTarget.focus()}
                        style={{
                            display: "block",
                            width: "100%",
                            borderRadius: 4,
                            outline: "none",
                            cursor: "pointer",
                            background: "#000",
                        }}
                    />
                    {gameOver && (
                        <div
                            data-testid="snake-gameover"
                            style={{
                                position: "absolute",
                                inset: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: "rgba(0, 0, 0, 0.55)",
                                borderRadius: 4,
                                color: "#fff",
                                fontWeight: 700,
                                fontSize: 24,
                                letterSpacing: 2,
                                pointerEvents: "none",
                            }}
                        >
                            GAME OVER
                        </div>
                    )}
                </div>
            </div>

            <p
                style={{
                    fontSize: 12,
                    color: "#868e96",
                    textAlign: "center",
                    margin: "10px 0 12px",
                }}
            >
                화면을 클릭하고 방향키/WASD로 조작
            </p>

            {/* 모바일용 D-패드 */}
            <div style={{ display: "flex", justifyContent: "center" }}>
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 48px)",
                        gridTemplateRows: "repeat(2, 48px)",
                        gap: 6,
                    }}
                >
                    <span />
                    <button
                        style={dpadBtn}
                        aria-label="위"
                        onClick={() => sendKey(KEY_UP)}
                    >
                        ▲
                    </button>
                    <span />
                    <button
                        style={dpadBtn}
                        aria-label="왼쪽"
                        onClick={() => sendKey(KEY_LEFT)}
                    >
                        ◀
                    </button>
                    <button
                        style={dpadBtn}
                        aria-label="아래"
                        onClick={() => sendKey(KEY_DOWN)}
                    >
                        ▼
                    </button>
                    <button
                        style={dpadBtn}
                        aria-label="오른쪽"
                        onClick={() => sendKey(KEY_RIGHT)}
                    >
                        ▶
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SnakeDemo;
