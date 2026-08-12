"use client";

import { useEffect, useRef } from "react";
import {
    SvgCanvas,
    type SvgCanvasHandle,
    type SvgDrawingContext,
} from "#components/materials/runtime/svg-canvas";

const FONT =
    "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

const C = {
    work: { fill: "#e7f5ff", stroke: "#228be6", text: "#1971c2" },
    input: { fill: "#fff9db", stroke: "#fab005", text: "#e8590c" },
    render: { fill: "#ebfbee", stroke: "#40c057", text: "#2f9e44" },
};

type Lang = "ko" | "en";

const STRINGS = {
    ko: {
        legendWork: "채팅 그리기",
        legendInput: "입력 처리",
        legendRender: "렌더링",
        rowNoYield: "양보 없음",
        longTask: "채팅 100개 그리기 — 하나의 롱 태스크",
        input: "입력",
        render: "렌더링",
        renderShort: "렌더",
        waitNote: "태스크가 끝날 때까지 입력과 렌더링은 큐에서 대기한다",
        rowYield: "양보 렌더",
        chunks: ["1~20", "21~40", "41~60"],
        scheduleNote: "setTimeout이 남은 작업을 다음 태스크로 예약",
        gapNote: "태스크 사이의 틈마다 밀려 있던 입력과 렌더링이 처리된다",
        inputWait: "입력 (대기 후 처리)",
        renderWait: "렌더링 (대기 후 처리)",
        seqChunk: (range: string) => `채팅 ${range} 그리기`,
    },
    en: {
        legendWork: "Drawing chats",
        legendInput: "Input handling",
        legendRender: "Rendering",
        rowNoYield: "No yielding",
        longTask: "Drawing 100 chats — one long task",
        input: "Input",
        render: "Rendering",
        renderShort: "Render",
        waitNote:
            "Input and rendering wait in the queue until the task finishes",
        rowYield: "With yielding",
        chunks: ["1–20", "21–40", "41–60"],
        scheduleNote:
            "setTimeout schedules the remaining work as the next task",
        gapNote: "Pending input and rendering run in the gaps between tasks",
        inputWait: "Input (processed after waiting)",
        renderWait: "Rendering (processed after waiting)",
        seqChunk: (range: string) => `Drawing chats ${range}`,
    },
} as const;

type T = (typeof STRINGS)[Lang];

function drawRoundRect(
    ctx: SvgDrawingContext,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill: string,
    stroke: string,
    lineWidth = 1.5,
) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
}

function drawBox(
    ctx: SvgDrawingContext,
    x: number,
    y: number,
    w: number,
    h: number,
    c: { fill: string; stroke: string; text: string },
    label: string,
    fs: number,
) {
    drawRoundRect(ctx, x, y, w, h, 6, c.fill, c.stroke);
    ctx.fillStyle = c.text;
    ctx.font = `600 ${fs}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + w / 2, y + h / 2 + 0.5);
}

function drawLegend(
    ctx: SvgDrawingContext,
    x: number,
    y: number,
    fs: number,
    s: number,
    t: T,
) {
    const items: [typeof C.work, string][] = [
        [C.work, t.legendWork],
        [C.input, t.legendInput],
        [C.render, t.legendRender],
    ];
    let cx = x;
    for (const [c, label] of items) {
        drawRoundRect(ctx, cx, y, 12 * s, 12 * s, 3, c.fill, c.stroke, 1);
        ctx.fillStyle = "#868e96";
        ctx.font = `${fs}px ${FONT}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(label, cx + 17 * s, y + 6 * s);
        cx += 17 * s + ctx.measureText(label).width + 18 * s;
    }
}

function drawHorizontal(ctx: SvgDrawingContext, w: number, t: T): number {
    const s = w / 620;
    const left = 8 * s;
    const right = w - 8 * s;
    const W = right - left;
    const boxH = 34 * s;
    const labelFs = Math.max(12 * s, 11);
    const boxFs = Math.max(11 * s, 9.5);
    const smallFs = Math.max(9.5 * s, 8.5);
    const legendFs = Math.max(10.5 * s, 9.5);

    // ── 범례 ──
    drawLegend(ctx, left, 10 * s, legendFs, s, t);

    // ── Row 1: 양보 없음 ──
    let y = 44 * s;
    ctx.fillStyle = "#495057";
    ctx.font = `700 ${labelFs}px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(t.rowNoYield, left, y);

    const t1 = y + 8 * s;
    const inW = W * 0.12;
    const renW = W * 0.15;
    const longW = W - inW - renW - 8 * s; // 남는 폭 없이 가득 채운다
    drawBox(ctx, left, t1, longW, boxH, C.work, t.longTask, boxFs);
    drawBox(ctx, left + longW + 4 * s, t1, inW, boxH, C.input, t.input, boxFs);
    drawBox(
        ctx,
        left + longW + 4 * s + inW + 4 * s,
        t1,
        renW,
        boxH,
        C.render,
        t.render,
        boxFs,
    );

    // 대기 표시
    ctx.fillStyle = "#adb5bd";
    ctx.font = `${smallFs}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(t.waitNote, left + longW / 2, t1 + boxH + 6 * s);

    // ── Row 2: 양보 렌더 ──
    y = t1 + boxH + 44 * s;
    ctx.fillStyle = "#495057";
    ctx.font = `700 ${labelFs}px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(t.rowYield, left, y);

    const t2 = y + 26 * s; // 화살표 공간 확보
    const dotsW = 22 * s;
    const gapW = W * 0.14;
    const chunkW = (W - gapW * 2 - dotsW) / 3; // 세 조각 + 두 틈 + 말줄임이 폭을 가득 채운다
    let x = left;

    const chunks = t.chunks;
    const chunkXs: number[] = [];
    for (let i = 0; i < chunks.length; i++) {
        chunkXs.push(x);
        drawBox(ctx, x, t2, chunkW, boxH, C.work, chunks[i]!, boxFs);
        x += chunkW;
        if (i < chunks.length - 1) {
            // 틈: 입력 + 렌더링
            const gInW = gapW * 0.42;
            const gRenW = gapW * 0.5;
            drawBox(
                ctx,
                x + gapW * 0.03,
                t2,
                gInW,
                boxH,
                C.input,
                t.input,
                smallFs,
            );
            drawBox(
                ctx,
                x + gapW * 0.03 + gInW + gapW * 0.04,
                t2,
                gRenW,
                boxH,
                C.render,
                t.renderShort,
                smallFs,
            );
            x += gapW;
        }
    }
    ctx.fillStyle = "#adb5bd";
    ctx.font = `700 ${boxFs}px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("…", x + 6 * s, t2 + boxH / 2);

    // ── setTimeout 예약 화살표 (첫 번째 틈 위로) ──
    const a1 = chunkXs[0]! + chunkW - 4 * s; // 첫 조각 끝
    const a2 = chunkXs[1]! + 4 * s; // 다음 조각 시작
    const arcTop = t2 - 14 * s;
    ctx.strokeStyle = "#868e96";
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(a1, t2 - 2 * s);
    ctx.quadraticCurveTo((a1 + a2) / 2, arcTop, a2, t2 - 2 * s);
    ctx.stroke();
    ctx.setLineDash([]);
    // 화살촉
    ctx.beginPath();
    ctx.fillStyle = "#868e96";
    ctx.moveTo(a2, t2 - 1 * s);
    ctx.lineTo(a2 - 5 * s, t2 - 7 * s);
    ctx.lineTo(a2 + 1 * s, t2 - 8 * s);
    ctx.closePath();
    ctx.fill();
    // 라벨
    ctx.fillStyle = "#868e96";
    ctx.font = `${smallFs}px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(t.scheduleNote, (a1 + a2) / 2 + 10 * s, arcTop + 2 * s);

    // 틈 설명
    ctx.fillStyle = "#adb5bd";
    ctx.font = `${smallFs}px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(t.gapNote, left, t2 + boxH + 6 * s);

    return t2 + boxH + 26 * s;
}

function drawVertical(ctx: SvgDrawingContext, w: number, t: T): number {
    const left = 8;
    const W = w - 16;
    const labelFs = 12;
    const boxFs = 11;
    const smallFs = 9.5;

    drawLegend(ctx, left, 8, 10, 1, t);

    // ── 양보 없음 ──
    let y = 40;
    ctx.fillStyle = "#495057";
    ctx.font = `700 ${labelFs}px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(t.rowNoYield, left, y);
    y += 8;

    drawBox(ctx, left, y, W, 88, C.work, t.longTask, boxFs);
    y += 92;
    drawBox(ctx, left, y, W, 26, C.input, t.inputWait, smallFs);
    y += 30;
    drawBox(ctx, left, y, W, 26, C.render, t.renderWait, smallFs);
    y += 44;

    // ── 양보 렌더 ──
    ctx.fillStyle = "#495057";
    ctx.font = `700 ${labelFs}px ${FONT}`;
    ctx.textAlign = "left"; // drawBox가 center로 바꿔놓으므로 되돌린다
    ctx.textBaseline = "alphabetic";
    ctx.fillText(t.rowYield, left, y);
    y += 8;

    const seq: [typeof C.work, string, number][] = [
        [C.work, t.seqChunk(t.chunks[0]), 40],
        [C.input, t.input, 22],
        [C.render, t.render, 22],
        [C.work, t.seqChunk(t.chunks[1]), 40],
        [C.input, t.input, 22],
        [C.render, t.render, 22],
        [C.work, t.seqChunk(t.chunks[2]), 40],
    ];
    for (const [c, label, h] of seq) {
        drawBox(ctx, left, y, W, h, c, label, c === C.work ? boxFs : smallFs);
        y += h + 4;
    }
    ctx.fillStyle = "#adb5bd";
    ctx.font = `700 ${boxFs}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("⋮", left + W / 2, y + 2);
    return y + 22;
}

interface Props {
    caption?: string;
    locale?: Lang;
}

export const YieldTimelineDiagram = ({
    caption,
    locale: lang = "ko",
}: Props) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<SvgCanvasHandle>(null);

    useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;
        const t = STRINGS[lang];

        const draw = () => {
            const w = container.clientWidth;
            const dpr = window.devicePixelRatio || 1;
            const isMobile = w < 480;
            const ctx = canvas.getContext("2d")!;

            const probeH = isMobile ? 620 : 230 * (w / 620);
            canvas.width = w * dpr;
            canvas.height = probeH * dpr;
            canvas.style.width = `${w}px`;
            canvas.style.height = `${probeH}px`;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.scale(dpr, dpr);
            const h = isMobile
                ? drawVertical(ctx, w, t)
                : drawHorizontal(ctx, w, t);
            ctx.restore();

            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.scale(dpr, dpr);
            if (isMobile) drawVertical(ctx, w, t);
            else drawHorizontal(ctx, w, t);
        };

        draw();
        const ro = new ResizeObserver(draw);
        ro.observe(container);
        return () => ro.disconnect();
    }, [lang]);

    return (
        <figure>
            <div ref={containerRef}>
                <SvgCanvas
                    ref={canvasRef}
                    style={{ display: "block", width: "100%" }}
                />
            </div>
            {caption && (
                <figcaption dangerouslySetInnerHTML={{ __html: caption }} />
            )}
        </figure>
    );
};
