"use client";

import { useEffect, useRef } from "react";
import {
    SvgCanvas,
    type SvgCanvasHandle,
    type SvgDrawingContext,
} from "#components/materials/runtime/svg-canvas";

const FONT =
    "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

interface NodeSpec {
    title: string;
    subtitle: string;
    border: string;
    bg: string;
    titleColor: string;
}

const COGNITION: NodeSpec = {
    title: "인지",
    subtitle: "가독성 · 네이밍 · 인지 부하",
    border: "#228be6",
    bg: "#e7f5ff",
    titleColor: "#1971c2",
};

const EXECUTION: NodeSpec = {
    title: "실행",
    subtitle: "성능 · 동시성 · 예외",
    border: "#fa5252",
    bg: "#fff5f5",
    titleColor: "#e03131",
};

const STRUCTURE: NodeSpec = {
    title: "구조",
    subtitle: "모듈 · 의존 · 아키텍처",
    border: "#fab005",
    bg: "#fff9db",
    titleColor: "#f08c00",
};

const LABEL_COG_EXEC = "try-catch · Result · async/await";
const LABEL_COG_STRUCT = "인터페이스 · 클래스 · import";
const LABEL_EXEC_STRUCT = "마이크로서비스 · 데이터 지향 설계";

// Mobile layout constants (shared with height pre-computation)
const M_TOP_PAD = 16;
const M_NODE_H = 56;
const M_GAP = 92;

// ── Helpers ──

interface NodeBoxOpts {
    titleFs: number;
    subFs: number;
    padX: number;
    h: number;
    r: number;
    w?: number; // fixed width (mobile); measured from text when omitted
}

function drawNodeBox(
    ctx: SvgDrawingContext,
    node: NodeSpec,
    cx: number,
    cy: number,
    o: NodeBoxOpts,
) {
    ctx.font = `600 ${o.titleFs}px ${FONT}`;
    const titleW = ctx.measureText(node.title).width;
    ctx.font = `${o.subFs}px ${FONT}`;
    const subW = ctx.measureText(node.subtitle).width;

    const w = o.w ?? Math.max(titleW, subW) + o.padX * 2;

    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - o.h / 2, w, o.h, o.r);
    ctx.fillStyle = node.bg;
    ctx.fill();
    ctx.strokeStyle = node.border;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillStyle = node.titleColor;
    ctx.font = `600 ${o.titleFs}px ${FONT}`;
    ctx.fillText(node.title, cx, cy - o.h * 0.185);

    ctx.fillStyle = "#868e96";
    ctx.font = `${o.subFs}px ${FONT}`;
    ctx.fillText(node.subtitle, cx, cy + o.h * 0.22);
}

function pillWidth(
    ctx: SvgDrawingContext,
    lines: string[],
    fs: number,
    padX: number,
): number {
    ctx.font = `${fs}px ${FONT}`;
    let textW = 0;
    for (const line of lines) {
        textW = Math.max(textW, ctx.measureText(line).width);
    }
    return textW + padX * 2;
}

function drawPill(
    ctx: SvgDrawingContext,
    cx: number,
    cy: number,
    lines: string[],
    fs: number,
    padX: number,
) {
    const w = pillWidth(ctx, lines, fs, padX);
    const lineH = fs + 4;
    const h = lines.length * lineH + 8;
    const r = lines.length === 1 ? h / 2 : 8;

    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - h / 2, w, h, r);
    ctx.fillStyle = "#f8f9fa";
    ctx.fill();
    ctx.strokeStyle = "#dee2e6";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#495057";
    ctx.font = `${fs}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const startY = cy - ((lines.length - 1) * lineH) / 2;
    for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i]!, cx, startY + i * lineH);
    }
}

// ── Horizontal layout (desktop) ──

function drawHorizontal(ctx: SvgDrawingContext, w: number): number {
    const s = w / 640;
    const h = 332 * s;

    // Triangle vertices (node centers)
    const top = { x: 320 * s, y: 60 * s };
    const left = { x: 120 * s, y: 280 * s };
    const right = { x: 520 * s, y: 280 * s };

    const titleFs = Math.max(15 * s, 12);
    const subFs = Math.max(11 * s, 9.5);
    const pillFs = Math.max(10.5 * s, 9);
    const centerFs = Math.max(11 * s, 9.5);
    const boxOpts: NodeBoxOpts = {
        titleFs,
        subFs,
        padX: 14 * s,
        h: 54 * s,
        r: 10 * s,
    };

    // Edges (drawn first; node boxes cover the segments behind them)
    ctx.strokeStyle = "#adb5bd";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(left.x, left.y);
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(right.x, right.y);
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
    ctx.stroke();

    // Nodes
    drawNodeBox(ctx, COGNITION, top.x, top.y, boxOpts);
    drawNodeBox(ctx, EXECUTION, left.x, left.y, boxOpts);
    drawNodeBox(ctx, STRUCTURE, right.x, right.y, boxOpts);

    // Intersection labels on edge midpoints
    const pillPadX = 12 * s;
    drawPill(
        ctx,
        (top.x + left.x) / 2,
        (top.y + left.y) / 2,
        [LABEL_COG_EXEC],
        pillFs,
        pillPadX,
    );
    drawPill(
        ctx,
        (top.x + right.x) / 2,
        (top.y + right.y) / 2,
        [LABEL_COG_STRUCT],
        pillFs,
        pillPadX,
    );
    drawPill(
        ctx,
        (left.x + right.x) / 2,
        (left.y + right.y) / 2,
        [LABEL_EXEC_STRUCT],
        pillFs,
        pillPadX,
    );

    // Faint label at the centroid: the three perspectives look at the same code
    ctx.fillStyle = "#adb5bd";
    ctx.font = `${centerFs}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
        "같은 코드",
        (top.x + left.x + right.x) / 3,
        (top.y + left.y + right.y) / 3,
    );

    return h;
}

// ── Vertical layout (mobile) ──

function drawVertical(ctx: SvgDrawingContext, w: number): number {
    const cx = w / 2;
    const nw = w * 0.62;
    const nodeRight = cx + nw / 2;

    const y1 = M_TOP_PAD;
    const y2 = y1 + M_NODE_H + M_GAP;
    const y3 = y2 + M_NODE_H + M_GAP;
    const c1 = y1 + M_NODE_H / 2;
    const c2 = y2 + M_NODE_H / 2;
    const c3 = y3 + M_NODE_H / 2;

    // 인지↔구조: dashed curve bulging out on the right (drawn behind nodes)
    const ctrlX = nodeRight + w * 0.14;
    ctx.strokeStyle = "#adb5bd";
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(nodeRight, c1);
    ctx.quadraticCurveTo(ctrlX, c2, nodeRight, c3);
    ctx.stroke();
    ctx.setLineDash([]);

    // Short connectors between adjacent nodes
    ctx.strokeStyle = "#adb5bd";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, y1 + M_NODE_H);
    ctx.lineTo(cx, y2);
    ctx.moveTo(cx, y2 + M_NODE_H);
    ctx.lineTo(cx, y3);
    ctx.stroke();

    // Nodes
    const boxOpts: NodeBoxOpts = {
        titleFs: 14,
        subFs: 10.5,
        padX: 12,
        h: M_NODE_H,
        r: 10,
        w: nw,
    };
    drawNodeBox(ctx, COGNITION, cx, c1, boxOpts);
    drawNodeBox(ctx, EXECUTION, cx, c2, boxOpts);
    drawNodeBox(ctx, STRUCTURE, cx, c3, boxOpts);

    // Intersection labels on the connectors
    drawPill(ctx, cx, (y1 + M_NODE_H + y2) / 2, [LABEL_COG_EXEC], 9.5, 10);
    drawPill(ctx, cx, (y2 + M_NODE_H + y3) / 2, [LABEL_EXEC_STRUCT], 9.5, 10);

    // 인지↔구조 label: two stacked lines on the upper part of the curve
    // (t = 0.25 keeps it clear of the 실행 node and inside the canvas)
    const t = 0.25;
    const mt = 1 - t;
    const lx = mt * mt * nodeRight + 2 * mt * t * ctrlX + t * t * nodeRight;
    const ly = mt * mt * c1 + 2 * mt * t * c2 + t * t * c3;
    const curveLines = ["인터페이스 ·", "클래스 · import"];
    const labelW = pillWidth(ctx, curveLines, 9, 8);
    const lcx = Math.min(lx, w - 4 - labelW / 2);
    drawPill(ctx, lcx, ly, curveLines, 9, 8);

    return y3 + M_NODE_H + M_TOP_PAD;
}

// ── Component ──

interface Props {
    caption?: string;
}

export const ThreePerspectivesDiagram = ({ caption }: Props) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<SvgCanvasHandle>(null);

    useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;

        const draw = () => {
            const w = container.clientWidth;
            const dpr = window.devicePixelRatio || 1;
            const isMobile = w < 480;

            const ctx = canvas.getContext("2d")!;

            // Pre-compute height
            let h: number;
            if (isMobile) {
                h = M_TOP_PAD + 3 * M_NODE_H + 2 * M_GAP + M_TOP_PAD;
            } else {
                h = 332 * (w / 640);
            }

            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.scale(dpr, dpr);

            if (isMobile) {
                drawVertical(ctx, w);
            } else {
                drawHorizontal(ctx, w);
            }
        };

        draw();
        const ro = new ResizeObserver(draw);
        ro.observe(container);
        return () => ro.disconnect();
    }, []);

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
