"use client";

import { useEffect, useRef } from "react";
import {
    SvgCanvas,
    type SvgCanvasHandle,
    type SvgDrawingContext,
} from "#components/materials/runtime/svg-canvas";

const FONT =
    "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

interface Candidate {
    token: string;
    prob: number;
}

const CANDIDATES: Candidate[] = [
    { token: '" "', prob: 0.42 },
    { token: '"도"', prob: 0.25 },
    { token: '"은"', prob: 0.18 },
    { token: '"부"', prob: 0.1 },
    { token: '"이"', prob: 0.05 },
    { token: '"퀡"', prob: 0.0 },
];

function getBarColor(prob: number): string {
    if (prob >= 0.3) return "#228be6";
    if (prob >= 0.15) return "#40c057";
    if (prob >= 0.05) return "#fab005";
    return "#dee2e6";
}

function drawScene(ctx: SvgDrawingContext, w: number): number {
    const s = w / 540;
    const dpr = window.devicePixelRatio || 1;

    /* ── layout ── */
    const inputBoxX = w * 0.05;
    const inputBoxW = w * 0.28;
    const inputBoxH = 48 * s;
    const inputBoxY = 40 * s;

    const candidateStartX = w * 0.48;
    const candidateW = w * 0.48;
    const rowH = 36 * s;
    const candidateStartY = inputBoxY - 10 * s;
    const barMaxW = candidateW * 0.5;

    const totalH = candidateStartY + CANDIDATES.length * rowH + 30 * s;

    /* ── clear ── */
    ctx.clearRect(0, 0, w * dpr, totalH * dpr);

    /* ── input box ── */
    ctx.fillStyle = "#f1f3f5";
    ctx.strokeStyle = "#ced4da";
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    const r = 8 * s;
    const bx = inputBoxX,
        by = inputBoxY,
        bw = inputBoxW,
        bh = inputBoxH;
    ctx.moveTo(bx + r, by);
    ctx.lineTo(bx + bw - r, by);
    ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
    ctx.lineTo(bx + bw, by + bh - r);
    ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
    ctx.lineTo(bx + r, by + bh);
    ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
    ctx.lineTo(bx, by + r);
    ctx.quadraticCurveTo(bx, by, bx + r, by);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#343a40";
    ctx.font = `bold ${16 * s}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText('"나는 오늘"', bx + bw / 2, by + bh / 2);

    /* ── label above input ── */
    ctx.fillStyle = "#868e96";
    ctx.font = `${12 * s}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("입력", bx + bw / 2, by - 14 * s);

    /* ── label above candidates ── */
    ctx.fillText(
        "다음 글자 후보",
        candidateStartX + candidateW / 2,
        candidateStartY - 14 * s,
    );

    /* ── arrows and candidates ── */
    const arrowStartX = bx + bw + 6 * s;
    const arrowStartY = by + bh / 2;

    for (let i = 0; i < CANDIDATES.length; i++) {
        const { token, prob } = CANDIDATES[i]!;
        const cy = candidateStartY + rowH * i + rowH / 2;

        /* ── arrow ── */
        ctx.beginPath();
        ctx.moveTo(arrowStartX, arrowStartY);

        const endX = candidateStartX - 8 * s;
        const midX = (arrowStartX + endX) / 2;
        ctx.bezierCurveTo(midX, arrowStartY, midX, cy, endX, cy);

        ctx.strokeStyle = prob === 0 ? "#dee2e6" : "#adb5bd";
        ctx.lineWidth = prob === 0 ? 1 * s : (1 + prob * 3) * s;
        ctx.stroke();

        /* arrowhead */
        const aSize = 5 * s;
        ctx.beginPath();
        ctx.moveTo(endX, cy);
        ctx.lineTo(endX - aSize, cy - aSize * 0.6);
        ctx.lineTo(endX - aSize, cy + aSize * 0.6);
        ctx.closePath();
        ctx.fillStyle = prob === 0 ? "#dee2e6" : "#adb5bd";
        ctx.fill();

        /* ── token label ── */
        ctx.font = `bold ${14 * s}px ${FONT}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle = prob === 0 ? "#adb5bd" : "#343a40";
        ctx.fillText(token, candidateStartX, cy);

        /* ── probability bar ── */
        const barX = candidateStartX + 42 * s;
        const barH = 16 * s;
        const barW = prob > 0 ? Math.max(barMaxW * prob, 4 * s) : 0;

        if (barW > 0) {
            ctx.fillStyle = getBarColor(prob);
            ctx.globalAlpha = 0.25;
            ctx.beginPath();
            const br = Math.min(4 * s, barW / 2);
            ctx.moveTo(barX + br, cy - barH / 2);
            ctx.lineTo(barX + barW - br, cy - barH / 2);
            ctx.quadraticCurveTo(
                barX + barW,
                cy - barH / 2,
                barX + barW,
                cy - barH / 2 + br,
            );
            ctx.lineTo(barX + barW, cy + barH / 2 - br);
            ctx.quadraticCurveTo(
                barX + barW,
                cy + barH / 2,
                barX + barW - br,
                cy + barH / 2,
            );
            ctx.lineTo(barX + br, cy + barH / 2);
            ctx.quadraticCurveTo(barX, cy + barH / 2, barX, cy + barH / 2 - br);
            ctx.lineTo(barX, cy - barH / 2 + br);
            ctx.quadraticCurveTo(barX, cy - barH / 2, barX + br, cy - barH / 2);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }

        /* ── probability text ── */
        ctx.font = `${13 * s}px ${FONT}`;
        ctx.textAlign = "left";
        if (prob === 0) {
            ctx.fillStyle = "#adb5bd";
            ctx.fillText("0%", barX + 4 * s, cy);
        } else {
            ctx.fillStyle = "#495057";
            ctx.fillText(
                `${(prob * 100).toFixed(0)}%`,
                barX + barW + 6 * s,
                cy,
            );
        }
    }

    return totalH;
}

export const NextTokenDiagram = ({ caption }: { caption?: string }) => {
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

        /* DPR 변경 감지: 현재 DPR에 맞는 미디어 쿼리를 등록하고, 변경 시 다시 등록 */
        let dprMql: MediaQueryList | null = null;
        const onDprChange = () => {
            resize();
            watchDpr();
        };
        const watchDpr = () => {
            dprMql?.removeEventListener("change", onDprChange);
            dprMql = window.matchMedia(
                `(resolution: ${window.devicePixelRatio || 1}dppx)`,
            );
            dprMql.addEventListener("change", onDprChange);
        };
        watchDpr();

        return () => {
            window.removeEventListener("resize", resize);
            dprMql?.removeEventListener("change", onDprChange);
        };
    }, []);

    return (
        <figure ref={containerRef} style={{ margin: "2rem 0" }}>
            <SvgCanvas ref={canvasRef} />
            {caption && <figcaption>{caption}</figcaption>}
        </figure>
    );
};
