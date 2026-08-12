"use client";

import React, { useEffect, useRef, useState } from "react";
import {
    cancelMaterialFrame,
    scheduleMaterialFrame,
} from "#components/materials/runtime/scheduler";
import {
    SvgCanvas,
    type SvgCanvasHandle,
    type SvgDrawingContext,
} from "#components/materials/runtime/svg-canvas";

const FONT =
    "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

// ---------- 결정적 난수 (engine.ts와 동일) ----------
function mulberry32(seed: number) {
    let a = seed >>> 0;
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// 개체군: 각 개체의 적합도(생존 시간)
const FITNESS = [30, 5, 12, 45, 8, 22, 3, 18];
const N = FITNESS.length;
const TOTAL_FITNESS = FITNESS.reduce((a, b) => a + b, 0);

// 개체별 색 (팔레트 순환)
const COLORS = [
    "#228be6",
    "#fa5252",
    "#fab005",
    "#40c057",
    "#845ef7",
    "#e64980",
    "#15aabf",
    "#7048e8",
];

const CYCLE = 2800; // 한 사이클 길이(ms)

function clamp01(t: number) {
    return Math.min(1, Math.max(0, t));
}
function easeOut(t: number) {
    return 1 - Math.pow(1 - clamp01(t), 3);
}
function easeInOut(t: number) {
    const c = clamp01(t);
    return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

type Mode = "roulette" | "tournament";

// 룰렛: 시드 난수로 점수 비례 선택된 개체 인덱스를 구한다
function rouletteWinner(cycleIdx: number): number {
    const rand = mulberry32(cycleIdx * 1013904223 + 1);
    let pick = rand() * TOTAL_FITNESS;
    for (let i = 0; i < N; i++) {
        pick -= FITNESS[i]!;
        if (pick <= 0) return i;
    }
    return N - 1;
}

// 토너먼트: 시드 난수로 무작위 3마리를 뽑는다
function tournamentChallengers(cycleIdx: number): number[] {
    const rand = mulberry32(cycleIdx * 2654435761 + 7);
    const pool = Array.from({ length: N }, (_, i) => i);
    // Fisher-Yates 앞 3개만
    for (let i = 0; i < 3; i++) {
        const j = i + Math.floor(rand() * (N - i));
        const tmp = pool[i]!;
        pool[i]! = pool[j]!;
        pool[j]! = tmp;
    }
    return pool.slice(0, 3).sort((a, b) => a - b);
}

export const SelectionDemo = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<SvgCanvasHandle>(null);
    const [mode, setMode] = useState<Mode>("roulette");
    const modeRef = useRef<Mode>(mode);
    modeRef.current = mode;

    useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;

        let raf = 0;
        const start = performance.now();

        const render = (now: number) => {
            const m = modeRef.current;
            const w = container.clientWidth;
            const dpr = window.devicePixelRatio || 1;
            const narrow = w < 480;

            const captionH = 42;
            const h = narrow ? 300 : 320;

            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;

            const ctx = canvas.getContext("2d")!;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.scale(dpr, dpr);

            // 사이클 시간 (음수 방어)
            const elapsed = Math.max(0, now - start);
            const cycleIdx = Math.floor(elapsed / CYCLE);
            const cycleT = elapsed % CYCLE; // [0, CYCLE)
            const p = cycleT / CYCLE; // 진행률 [0,1)

            const cx = w / 2;
            const stageH = h - captionH;

            if (m === "roulette") {
                drawRoulette(
                    ctx,
                    cx,
                    stageH / 2 + 4,
                    Math.min(w, stageH * 1.9),
                    stageH,
                    cycleIdx,
                    p,
                    narrow,
                );
            } else {
                drawTournament(ctx, w, stageH, cycleIdx, p, narrow);
            }

            // 하단 설명
            const caption =
                m === "roulette"
                    ? "점수에 비례하는 크기의 칸. 점수가 높을수록 자주 뽑힌다."
                    : "무작위 3마리 중 최고를 뽑는다. 순위만 보므로 점수 독식이 없다.";
            ctx.font = `${narrow ? 11 : 12.5}px ${FONT}`;
            ctx.fillStyle = "#868e96";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            wrapText(ctx, caption, cx, h - captionH / 2 + 2, w - 24, 16);
            ctx.textAlign = "left";

            raf = scheduleMaterialFrame(render);
        };

        raf = scheduleMaterialFrame(render);
        return () => cancelMaterialFrame(raf);
    }, []);

    const tabStyle = (active: boolean): React.CSSProperties => ({
        flex: 1,
        padding: "8px 12px",
        fontSize: 13,
        fontWeight: 600,
        fontFamily: FONT,
        cursor: "pointer",
        border: "1px solid #dee2e6",
        borderRadius: 6,
        background: active ? "#228be6" : "#f8f9fa",
        color: active ? "#fff" : "#495057",
        transition: "background 0.15s, color 0.15s",
    });

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
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <button
                    type="button"
                    style={tabStyle(mode === "roulette")}
                    onClick={() => setMode("roulette")}
                >
                    룰렛 휠 선택
                </button>
                <button
                    type="button"
                    style={tabStyle(mode === "tournament")}
                    onClick={() => setMode("tournament")}
                >
                    토너먼트 선택
                </button>
            </div>
            <div ref={containerRef}>
                <SvgCanvas
                    ref={canvasRef}
                    style={{ display: "block", width: "100%" }}
                />
            </div>
        </div>
    );
};

// ---------- 룰렛 휠 그리기 ----------
function drawRoulette(
    ctx: SvgDrawingContext,
    cx: number,
    cy: number,
    size: number,
    stageH: number,
    cycleIdx: number,
    p: number,
    narrow: boolean,
) {
    const rOuter = Math.min(size, stageH) / 2 - (narrow ? 8 : 14);
    const rInner = rOuter * 0.46;

    const winner = rouletteWinner(cycleIdx);

    // 각 조각의 각도 구간 (12시 방향에서 시계방향)
    const segAngles: Array<{ a0: number; a1: number; mid: number }> = [];
    let acc = -Math.PI / 2; // 12시 시작
    for (let i = 0; i < N; i++) {
        const span = (FITNESS[i]! / TOTAL_FITNESS) * Math.PI * 2;
        segAngles.push({ a0: acc, a1: acc + span, mid: acc + span / 2 });
        acc += span;
    }

    // 포인터(바늘)가 도착할 각도: 당첨 조각 중심을 12시(-90도)로 맞춘다.
    // 바늘은 12시 고정, 대신 "선택됨" 하이라이트로 결과를 알린다.
    // 포인터 회전: 여러 바퀴 돌다가 당첨 조각 중심이 12시에 오도록 정지.
    const targetMid = segAngles[winner]!.mid; // 조각 중심 각도
    // 12시(-PI/2)에 이 조각이 오도록 바늘을 회전. 바늘은 winner의 mid를 가리켜야 함.
    const spins = 3;
    const finalAngle = targetMid + Math.PI / 2; // 바늘을 이 각도만큼 시계방향 추가 회전시키면 mid가 12시
    const spinPhase = 0.72; // 이 시점까지 회전
    const settled = p >= spinPhase;
    let pointerAngle: number;
    if (!settled) {
        const t = easeOut(p / spinPhase);
        pointerAngle = -Math.PI / 2 + t * (spins * Math.PI * 2 + finalAngle);
    } else {
        pointerAngle = -Math.PI / 2 + (spins * Math.PI * 2 + finalAngle);
    }

    // 도넛 조각 그리기
    for (let i = 0; i < N; i++) {
        const { a0, a1, mid } = segAngles[i]!;
        const isWin = settled && i === winner;
        ctx.beginPath();
        ctx.arc(cx, cy, rOuter, a0, a1);
        ctx.arc(cx, cy, rInner, a1, a0, true);
        ctx.closePath();
        ctx.fillStyle = COLORS[i]!;
        ctx.globalAlpha = isWin ? 1 : settled ? 0.28 : 0.9;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();

        // 점수 라벨
        const lr = (rOuter + rInner) / 2;
        const lx = cx + Math.cos(mid) * lr;
        const ly = cy + Math.sin(mid) * lr;
        ctx.font = `700 ${narrow ? 10 : 12}px ${FONT}`;
        ctx.fillStyle = "#fff";
        ctx.globalAlpha = isWin || !settled ? 1 : 0.5;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(FITNESS[i]), lx, ly);
        ctx.globalAlpha = 1;
    }

    // 중앙 원
    ctx.beginPath();
    ctx.arc(cx, cy, rInner - 2, 0, Math.PI * 2);
    ctx.fillStyle = "#f8f9fa";
    ctx.fill();
    ctx.strokeStyle = "#dee2e6";
    ctx.lineWidth = 1;
    ctx.stroke();

    // 회전 바늘
    const needleLen = rOuter - 4;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(pointerAngle);
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(needleLen, 0);
    ctx.lineTo(0, 5);
    ctx.closePath();
    ctx.fillStyle = "#495057";
    ctx.fill();
    ctx.restore();
    // 바늘 축
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#495057";
    ctx.fill();

    // 결과 라벨
    if (settled) {
        const flash = easeOut((p - spinPhase) / 0.12);
        ctx.globalAlpha = flash;
        const label = `글 ${winner + 1} 선택됨!`;
        ctx.font = `700 ${narrow ? 12 : 14}px ${FONT}`;
        const tw = ctx.measureText(label).width;
        const bx = cx - tw / 2 - 12;
        const by = cy + rOuter + (narrow ? 2 : 6);
        ctx.beginPath();
        ctx.roundRect(bx, by - 12, tw + 24, 24, 12);
        ctx.fillStyle = "#e7f5ff";
        ctx.fill();
        ctx.fillStyle = "#1971c2";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, cx, by + 1);
        ctx.globalAlpha = 1;
    }
}

// ---------- 토너먼트 그리기 ----------
function drawTournament(
    ctx: SvgDrawingContext,
    w: number,
    stageH: number,
    cycleIdx: number,
    p: number,
    narrow: boolean,
) {
    const challengers = tournamentChallengers(cycleIdx);
    // 도전자 중 최고 점수 개체
    let winner = challengers[0]!;
    for (const c of challengers) if (FITNESS[c]! > FITNESS[winner]!) winner = c;

    const isChallenger = (i: number) => challengers.includes(i);

    // 등장 페이드: 사이클 시작 직후 도전자 하이라이트, 후반부에 승자 표시
    const revealP = easeInOut(clamp01(p / 0.35)); // 도전자 강조 정도
    const winnerP = easeOut(clamp01((p - 0.45) / 0.25)); // 승자 표시 정도

    // 8마리를 격자로 배치: 좁으면 2행4열, 넓으면 2행4열 유지(항상 4열)
    const cols = narrow ? 2 : 4;
    const rows = Math.ceil(N / cols);
    const marginX = narrow ? 14 : 24;
    const gridW = w - marginX * 2;
    const cellW = gridW / cols;
    const cellH = Math.min(stageH / rows, narrow ? stageH / rows : 118);
    const gridTop = (stageH - cellH * rows) / 2 + 4;
    const r = Math.min(cellW, cellH) * 0.3;

    for (let i = 0; i < N; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cxi = marginX + cellW * (col + 0.5);
        const cyi = gridTop + cellH * (row + 0.5);

        const chosen = isChallenger(i);
        // 강조되면 밝게, 아니면 흐리게
        const baseAlpha = 1;
        const dimAlpha = 0.22;
        const alpha = chosen
            ? baseAlpha
            : baseAlpha - (baseAlpha - dimAlpha) * revealP;

        const isWinner = i === winner;

        ctx.globalAlpha = alpha;

        // 도전자 하이라이트 링
        if (chosen && revealP > 0.05) {
            ctx.beginPath();
            ctx.arc(cxi, cyi, r + 6, 0, Math.PI * 2);
            ctx.strokeStyle = isWinner ? "#fab005" : "#adb5bd";
            ctx.lineWidth = isWinner ? 3 : 1.5;
            ctx.globalAlpha =
                alpha * (isWinner ? Math.max(revealP * 0.4, winnerP) : revealP);
            ctx.stroke();
            ctx.globalAlpha = alpha;
        }

        // 개체 원
        ctx.beginPath();
        ctx.arc(cxi, cyi, r, 0, Math.PI * 2);
        ctx.fillStyle = COLORS[i]!;
        ctx.fill();

        // 점수 라벨
        ctx.font = `700 ${narrow ? 13 : 16}px ${FONT}`;
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(FITNESS[i]), cxi, cyi);

        // 이름 라벨
        ctx.font = `${narrow ? 9 : 10}px ${FONT}`;
        ctx.fillStyle = "#868e96";
        ctx.fillText(`글 ${i + 1}`, cxi, cyi + r + (narrow ? 10 : 12));

        ctx.globalAlpha = 1;

        // 승자 왕관
        if (isWinner && winnerP > 0.02) {
            ctx.globalAlpha = winnerP;
            drawCrown(ctx, cxi, cyi - r - (narrow ? 12 : 16), narrow ? 9 : 12);
            ctx.globalAlpha = 1;
        }
    }

    // 승자 안내 배지
    if (winnerP > 0.02) {
        ctx.globalAlpha = winnerP;
        const label = `글 ${winner + 1} 승자 (점수 ${FITNESS[winner]!})`;
        ctx.font = `700 ${narrow ? 12 : 14}px ${FONT}`;
        const tw = ctx.measureText(label).width;
        const by = stageH - (narrow ? 4 : 8);
        const bx = w / 2 - tw / 2 - 12;
        ctx.beginPath();
        ctx.roundRect(bx, by - 22, tw + 24, 24, 12);
        ctx.fillStyle = "#fff9db";
        ctx.fill();
        ctx.fillStyle = "#e67700";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, w / 2, by - 9);
        ctx.globalAlpha = 1;
    }
}

function drawCrown(ctx: SvgDrawingContext, cx: number, cy: number, s: number) {
    ctx.beginPath();
    ctx.moveTo(cx - s, cy + s * 0.5);
    ctx.lineTo(cx - s, cy - s * 0.5);
    ctx.lineTo(cx - s * 0.5, cy);
    ctx.lineTo(cx, cy - s * 0.7);
    ctx.lineTo(cx + s * 0.5, cy);
    ctx.lineTo(cx + s, cy - s * 0.5);
    ctx.lineTo(cx + s, cy + s * 0.5);
    ctx.closePath();
    ctx.fillStyle = "#fab005";
    ctx.fill();
    ctx.strokeStyle = "#e67700";
    ctx.lineWidth = 1;
    ctx.stroke();
}

// 텍스트 줄바꿈 (한 줄 넘치면 두 줄)
function wrapText(
    ctx: SvgDrawingContext,
    text: string,
    cx: number,
    cy: number,
    maxWidth: number,
    lineH: number,
) {
    if (ctx.measureText(text).width <= maxWidth) {
        ctx.fillText(text, cx, cy);
        return;
    }
    const words = text.split(" ");
    const lines: string[] = [];
    let cur = "";
    for (const word of words) {
        const test = cur ? `${cur} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && cur) {
            lines.push(cur);
            cur = word;
        } else {
            cur = test;
        }
    }
    if (cur) lines.push(cur);
    const startY = cy - ((lines.length - 1) * lineH) / 2;
    lines.forEach((ln, i) => ctx.fillText(ln, cx, startY + i * lineH));
}
