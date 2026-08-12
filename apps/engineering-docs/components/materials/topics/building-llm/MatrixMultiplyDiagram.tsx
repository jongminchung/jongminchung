"use client";

import { useEffect, useRef } from "react";
import {
    SvgCanvas,
    type SvgCanvasHandle,
    type SvgDrawingContext,
} from "#components/materials/runtime/svg-canvas";

const FONT =
    "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

function drawScene(ctx: SvgDrawingContext, w: number): number {
    const s = w / 540;

    /* ── colors ── */
    const inputColor = { fill: "#e7f5ff", stroke: "#228be6", text: "#1864ab" };
    const weightColor = { fill: "#ebfbee", stroke: "#40c057", text: "#2b8a3e" };
    const outputColor = { fill: "#fff9db", stroke: "#fab005", text: "#e67700" };

    /* ── layout ── */
    const cellW = 48 * s;
    const cellH = 32 * s;

    /* ── Top: individual neuron equations ── */
    const topY = 30 * s;

    ctx.fillStyle = "#868e96";
    ctx.font = `${Math.max(12 * s, 9)}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("뉴런 2개를 각각 계산하면", w / 2, topY - 12 * s);

    /* neuron boxes */
    const neuronBoxW = w * 0.8;
    const neuronBoxX = (w - neuronBoxW) / 2;
    const neuronBoxY = topY;
    const neuronRowH = 28 * s;
    const neuronBoxH = neuronRowH * 2 + 20 * s;

    /* background box */
    const br = 8 * s;
    ctx.fillStyle = "#f8f9fa";
    ctx.strokeStyle = "#dee2e6";
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.roundRect(neuronBoxX, neuronBoxY, neuronBoxW, neuronBoxH, br);
    ctx.fill();
    ctx.stroke();

    ctx.font = `${Math.max(14 * s, 11)}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const eqSpacing = neuronRowH + 4 * s;
    const eqTotalH = eqSpacing; /* distance between two lines */
    const eq1Y = neuronBoxY + (neuronBoxH - eqTotalH) / 2;
    const eq2Y = eq1Y + eqSpacing;

    /* neuron 1 */
    ctx.fillStyle = outputColor.text;
    ctx.font = `bold ${Math.max(14 * s, 11)}px ${FONT}`;
    ctx.textAlign = "left";
    ctx.fillText("y₁", neuronBoxX + 16 * s, eq1Y);
    ctx.fillStyle = "#495057";
    ctx.font = `${Math.max(14 * s, 11)}px ${FONT}`;
    ctx.fillText("=  w₁₁·x₁ + w₁₂·x₂ + w₁₃·x₃", neuronBoxX + 42 * s, eq1Y);

    /* neuron 2 */
    ctx.fillStyle = outputColor.text;
    ctx.font = `bold ${Math.max(14 * s, 11)}px ${FONT}`;
    ctx.fillText("y₂", neuronBoxX + 16 * s, eq2Y);
    ctx.fillStyle = "#495057";
    ctx.font = `${Math.max(14 * s, 11)}px ${FONT}`;
    ctx.fillText("=  w₂₁·x₁ + w₂₂·x₂ + w₂₃·x₃", neuronBoxX + 42 * s, eq2Y);

    /* ── Arrow ── */
    const arrowTopY = neuronBoxY + neuronBoxH + 18 * s;
    const arrowLen = 36 * s;
    const arrowBottomY = arrowTopY + arrowLen;
    ctx.strokeStyle = "#adb5bd";
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(w / 2, arrowTopY);
    ctx.lineTo(w / 2, arrowBottomY);
    ctx.stroke();
    /* arrowhead */
    ctx.beginPath();
    ctx.moveTo(w / 2, arrowBottomY);
    ctx.lineTo(w / 2 - 5 * s, arrowBottomY - 8 * s);
    ctx.moveTo(w / 2, arrowBottomY);
    ctx.lineTo(w / 2 + 5 * s, arrowBottomY - 8 * s);
    ctx.stroke();

    /* label to the right of arrow */
    ctx.fillStyle = "#868e96";
    ctx.font = `${Math.max(12 * s, 9)}px ${FONT}`;
    ctx.textAlign = "left";
    ctx.fillText("행렬로 묶으면", w / 2 + 12 * s, arrowTopY + arrowLen / 2);

    /* ── Bottom: matrix multiplication ── */
    const matY = arrowBottomY + 18 * s;

    /* Calculate total width first, then center */
    const signW = 20 * s; /* width reserved for × and = signs */
    const signGap = 10 * s; /* gap around signs */
    const inputMatW = cellW * 3;
    const weightMatW = cellW * 2;
    const outputMatW = cellW * 2;
    const totalMatW =
        inputMatW +
        signGap +
        signW +
        signGap +
        weightMatW +
        signGap +
        signW +
        signGap +
        outputMatW;
    const matStartX = (w - totalMatW) / 2;

    const inputCenterY =
        matY + cellH * 1.5; /* vertically center with weight matrix */

    /* draw input matrix [x₁, x₂, x₃] */
    const inputX = matStartX;
    drawMatrix(
        ctx,
        s,
        inputX,
        inputCenterY - cellH / 2,
        3,
        1,
        cellW,
        cellH,
        [["x₁", "x₂", "x₃"]],
        inputColor,
    );

    /* multiply sign */
    const mulX = inputX + inputMatW + signGap + signW / 2;
    ctx.fillStyle = "#495057";
    ctx.font = `bold ${Math.max(18 * s, 14)}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("×", mulX, inputCenterY);

    /* Weight matrix 3×2 */
    const weightX = inputX + inputMatW + signGap + signW + signGap;
    const weightH = cellH * 3;
    drawMatrix(
        ctx,
        s,
        weightX,
        inputCenterY - weightH / 2,
        2,
        3,
        cellW,
        cellH,
        [
            ["w₁₁", "w₂₁"],
            ["w₁₂", "w₂₂"],
            ["w₁₃", "w₂₃"],
        ],
        weightColor,
    );

    /* equals sign */
    const eqX = weightX + weightMatW + signGap + signW / 2;
    ctx.fillStyle = "#495057";
    ctx.font = `bold ${Math.max(18 * s, 14)}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("=", eqX, inputCenterY);

    /* Output vector [y₁, y₂] */
    const outX = weightX + weightMatW + signGap + signW + signGap;
    drawMatrix(
        ctx,
        s,
        outX,
        inputCenterY - cellH / 2,
        2,
        1,
        cellW,
        cellH,
        [["y₁", "y₂"]],
        outputColor,
    );

    /* labels */
    const labelY = matY + cellH * 3 + 14 * s;
    ctx.font = `${Math.max(11 * s, 9)}px ${FONT}`;
    ctx.fillStyle = inputColor.text;
    ctx.textAlign = "center";
    ctx.fillText("입력 (1×3)", inputX + inputMatW / 2, labelY);

    ctx.fillStyle = weightColor.text;
    ctx.fillText("가중치 (3×2)", weightX + weightMatW / 2, labelY);

    ctx.fillStyle = outputColor.text;
    ctx.fillText("출력 (1×2)", outX + outputMatW / 2, labelY);

    return labelY + 20 * s;
}

function drawMatrix(
    ctx: SvgDrawingContext,
    s: number,
    x: number,
    y: number,
    cols: number,
    rows: number,
    cellW: number,
    cellH: number,
    values: string[][],
    color: { fill: string; stroke: string; text: string },
) {
    const r = 4 * s;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const cx = x + col * cellW;
            const cy = y + row * cellH;

            ctx.fillStyle = color.fill;
            ctx.strokeStyle = color.stroke;
            ctx.lineWidth = 1.5 * s;
            ctx.beginPath();
            ctx.roundRect(cx + 1, cy + 1, cellW - 2, cellH - 2, r);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = color.text;
            ctx.font = `bold ${Math.max(13 * s, 10)}px ${FONT}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(values[row]![col]!, cx + cellW / 2, cy + cellH / 2);
        }
    }

    /* bracket lines */
    ctx.strokeStyle = color.stroke;
    ctx.lineWidth = 2 * s;
    const bx1 = x - 3 * s;
    const bx2 = x + cols * cellW + 3 * s;
    const by1 = y;
    const by2 = y + rows * cellH;
    const bLen = 6 * s;

    /* left bracket */
    ctx.beginPath();
    ctx.moveTo(bx1 + bLen, by1);
    ctx.lineTo(bx1, by1);
    ctx.lineTo(bx1, by2);
    ctx.lineTo(bx1 + bLen, by2);
    ctx.stroke();

    /* right bracket */
    ctx.beginPath();
    ctx.moveTo(bx2 - bLen, by1);
    ctx.lineTo(bx2, by1);
    ctx.lineTo(bx2, by2);
    ctx.lineTo(bx2 - bLen, by2);
    ctx.stroke();
}

export const MatrixMultiplyDiagram = ({ caption }: { caption?: string }) => {
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

            /* first pass to get height */
            canvas.width = w * dpr;
            canvas.height = 600 * dpr;
            ctx.scale(dpr, dpr);
            const h = drawScene(ctx, w);

            /* resize and redraw */
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            ctx.scale(dpr, dpr);
            drawScene(ctx, w);
        };

        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(container);
        return () => ro.disconnect();
    }, []);

    return (
        <figure ref={containerRef} style={{ margin: "2rem 0" }}>
            <SvgCanvas ref={canvasRef} />
            {caption && <figcaption>{caption}</figcaption>}
        </figure>
    );
};
