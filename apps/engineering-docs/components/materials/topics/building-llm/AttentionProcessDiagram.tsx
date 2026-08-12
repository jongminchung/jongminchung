"use client";

import { useEffect, useRef } from "react";
import {
    SvgCanvas,
    type SvgCanvasHandle,
    type SvgDrawingContext,
} from "#components/materials/runtime/svg-canvas";

const FONT =
    "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

function roundRect(
    ctx: SvgDrawingContext,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function drawBox(
    ctx: SvgDrawingContext,
    s: number,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    fill: string,
    stroke: string,
    textColor: string,
    fontSize?: number,
) {
    roundRect(ctx, x, y, w, h, 5 * s);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();

    const size = fontSize ?? Math.max(12 * s, 10);
    ctx.fillStyle = textColor;
    ctx.font = `bold ${size}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const lines = label.split("\n");
    const lineHeight = size * 1.3;
    const firstY = y + h / 2 - ((lines.length - 1) * lineHeight) / 2;
    for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i]!, x + w / 2, firstY + i * lineHeight);
    }
}

function drawHArrow(
    ctx: SvgDrawingContext,
    s: number,
    x1: number,
    y: number,
    x2: number,
    color: string,
    lineWidth?: number,
) {
    ctx.strokeStyle = color;
    ctx.lineWidth = (lineWidth ?? 1.5) * s;
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();

    const dir = x2 > x1 ? 1 : -1;
    const headLen = 6 * s;
    ctx.beginPath();
    ctx.moveTo(x2, y);
    ctx.lineTo(x2 - dir * headLen, y - headLen * 0.45);
    ctx.moveTo(x2, y);
    ctx.lineTo(x2 - dir * headLen, y + headLen * 0.45);
    ctx.stroke();
}

function drawScene(ctx: SvgDrawingContext, w: number): number {
    const s = w / 600;

    const words = ["영희", "철수", "그는"];
    const scores = [0.25, 0.6, 0.15];

    /* Layout: 4 columns flowing left to right */
    /*  [Col1: Q/K pairs]  →  [Col2: Scores]  →  [Col3: ×V mix]  →  [Col4: Result] */

    const colGap = 32 * s;
    const rowH = 38 * s;
    const rowGap = 10 * s;
    const boxW = Math.max(72 * s, 44);
    const boxH = 30 * s;
    const smallBoxW = Math.max(56 * s, 36);
    const smallBoxH = 28 * s;

    const topY = 36 * s;
    const numRows = 3;
    const totalContentH = numRows * rowH + (numRows - 1) * rowGap;

    /* Column X positions */
    const col1W = boxW * 2 + 20 * s; /* Q_그는 × K_xxx */
    const col2W = smallBoxW;
    const col3W = smallBoxW;
    const col4W = Math.max(100 * s, 64);
    const totalW = col1W + col2W + col3W + col4W + colGap * 3;
    const startX = (w - totalW) / 2;

    const col1X = startX;
    const col2X = col1X + col1W + colGap;
    const col3X = col2X + col2W + colGap;
    const col4X = col3X + col3W + colGap;

    /* ── Column headers ── */
    ctx.fillStyle = "#868e96";
    ctx.font = `${Math.max(11 * s, 9)}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";

    ctx.fillText("Q와 K 비교", col1X + col1W / 2, topY - 8 * s);
    ctx.fillText("비율", col2X + col2W / 2, topY - 8 * s);
    ctx.fillText("× V", col3X + col3W / 2, topY - 8 * s);
    ctx.fillText("결과", col4X + col4W / 2, topY - 8 * s);

    /* ── Draw rows ── */
    const rowCenterYs: number[] = [];

    for (let i = 0; i < numRows; i++) {
        const rowY = topY + i * (rowH + rowGap);
        const cy = rowY + rowH / 2;
        rowCenterYs.push(cy);

        const score = scores[i]!;
        const pct = `${(score * 100).toFixed(0)}%`;
        const opacity = 0.3 + score * 0.7;

        /* Col 1: Q_그는 · K_word */
        const qBoxX = col1X;
        const dotX = qBoxX + boxW + 3 * s;
        const kBoxX = dotX + 14 * s;

        drawBox(
            ctx,
            s,
            qBoxX,
            cy - boxH / 2,
            boxW,
            boxH,
            "Q_그는",
            "#e7f5ff",
            "#228be6",
            "#1864ab",
            Math.max(11 * s, 9),
        );

        ctx.fillStyle = "#495057";
        ctx.font = `bold ${Math.max(14 * s, 11)}px ${FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("·", dotX + 4 * s, cy);

        drawBox(
            ctx,
            s,
            kBoxX,
            cy - boxH / 2,
            boxW,
            boxH,
            `K_${words[i]}`,
            "#ebfbee",
            "#40c057",
            "#2b8a3e",
            Math.max(11 * s, 9),
        );

        /* Arrow col1 → col2 */
        drawHArrow(ctx, s, kBoxX + boxW + 4 * s, cy, col2X - 4 * s, "#adb5bd");

        /* Col 2: Score */
        drawBox(
            ctx,
            s,
            col2X,
            cy - smallBoxH / 2,
            smallBoxW,
            smallBoxH,
            pct,
            `rgba(34,139,230,${opacity * 0.15})`,
            `rgba(34,139,230,${opacity})`,
            "#1864ab",
            Math.max(13 * s, 10),
        );

        /* Arrow col2 → col3 */
        drawHArrow(
            ctx,
            s,
            col2X + smallBoxW + 4 * s,
            cy,
            col3X - 4 * s,
            "#adb5bd",
        );

        /* Col 3: score × V */
        drawBox(
            ctx,
            s,
            col3X,
            cy - smallBoxH / 2,
            smallBoxW,
            smallBoxH,
            `V_${words[i]}`,
            `rgba(250,176,5,${opacity * 0.2})`,
            `rgba(250,176,5,${opacity})`,
            "#e67700",
            Math.max(11 * s, 9),
        );
    }

    /* ── Merge arrows from col3 → col4 result ── */
    const resultCy = rowCenterYs[1]!; /* vertically centered with middle row */
    const resultBoxW = col4W;
    const resultBoxH = Math.max(36 * s, 32);

    for (let i = 0; i < numRows; i++) {
        const fromX = col3X + smallBoxW + 4 * s;
        const fromY = rowCenterYs[i]!;
        const toX = col4X - 4 * s;
        const lineW = 0.6 + scores[i]! * 3;
        const opacity = 0.2 + scores[i]! * 0.6;

        ctx.strokeStyle = `rgba(127,80,242,${opacity})`;
        ctx.lineWidth = lineW * s;
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.quadraticCurveTo(fromX + (toX - fromX) * 0.5, fromY, toX, resultCy);
        ctx.stroke();

        /* arrowhead */
        const headLen = 6 * s;
        ctx.beginPath();
        ctx.moveTo(toX, resultCy);
        ctx.lineTo(toX - headLen, resultCy - headLen * 0.45);
        ctx.moveTo(toX, resultCy);
        ctx.lineTo(toX - headLen, resultCy + headLen * 0.45);
        ctx.stroke();
    }

    drawBox(
        ctx,
        s,
        col4X,
        resultCy - resultBoxH / 2,
        resultBoxW,
        resultBoxH,
        '"그는"의\n새 벡터',
        "#f3f0ff",
        "#7950f2",
        "#5f3dc4",
        Math.max(12 * s, 10),
    );

    return topY + totalContentH + 20 * s;
}

export const AttentionProcessDiagram = ({ caption }: { caption?: string }) => {
    const canvasRef = useRef<SvgCanvasHandle>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const resize = () => {
            const dpr = window.devicePixelRatio || 1;
            const w = container.clientWidth;
            const ctx = canvas.getContext("2d")!;

            canvas.width = w * dpr;
            canvas.height = 600 * dpr;
            ctx.scale(dpr, dpr);
            const h = drawScene(ctx, w);

            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            ctx.scale(dpr, dpr);
            drawScene(ctx, w);
        };

        resize();
        window.addEventListener("resize", resize);
        return () => window.removeEventListener("resize", resize);
    }, []);

    return (
        <figure ref={containerRef} style={{ margin: "2rem 0" }}>
            <SvgCanvas ref={canvasRef} />
            {caption && <figcaption>{caption}</figcaption>}
        </figure>
    );
};
