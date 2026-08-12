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

    const chars = ["가", "나", "다"];
    const vectors = [
        [0.2, -0.5, 0.8, 0.1],
        [0.3, -0.4, 0.7, 0.2],
        [-0.6, 0.9, -0.2, 0.5],
    ];

    /* ── layout: left half = embedding, right half = scatter ── */
    const halfW = w * 0.48;
    const leftAreaX = 0;
    const rightAreaX = w * 0.52;
    const topY = 28 * s;

    /* ══════════════════════════════════════
     LEFT: characters → arrow → vector bars
     ══════════════════════════════════════ */
    const boxSize = 36 * s;
    const boxGap = 12 * s;
    const charX = leftAreaX + 20 * s;
    const arrowStartX = charX + boxSize + 12 * s;
    const arrowEndX = leftAreaX + halfW * 0.42;
    const vecStartX = arrowEndX + 14 * s;

    /* section label */
    ctx.fillStyle = "#228be6";
    ctx.font = `bold ${Math.max(11 * s, 9)}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("임베딩", (arrowStartX + arrowEndX) / 2, topY - 6 * s);

    for (let i = 0; i < 3; i++) {
        const y = topY + i * (boxSize + boxGap);

        /* character box */
        ctx.fillStyle = "#f8f9fa";
        ctx.strokeStyle = "#adb5bd";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(charX, y, boxSize, boxSize, 4 * s);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#495057";
        ctx.font = `bold ${Math.max(15 * s, 11)}px ${FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(chars[i]!, charX + boxSize / 2, y + boxSize / 2);

        /* arrow */
        const arrowY = y + boxSize / 2;
        ctx.strokeStyle = "#228be6";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(arrowStartX, arrowY);
        ctx.lineTo(arrowEndX - 6 * s, arrowY);
        ctx.stroke();

        const headLen = 6 * s;
        ctx.beginPath();
        ctx.moveTo(arrowEndX - 6 * s, arrowY);
        ctx.lineTo(arrowEndX - 6 * s - headLen, arrowY - headLen * 0.5);
        ctx.lineTo(arrowEndX - 6 * s - headLen, arrowY + headLen * 0.5);
        ctx.closePath();
        ctx.fillStyle = "#228be6";
        ctx.fill();

        /* vector bar chart */
        const vec = vectors[i]!;
        const availableW = leftAreaX + halfW - vecStartX - 8 * s;
        const barW = Math.min(12 * s, availableW / (vec.length * 1.8));
        const barSpacing = barW + 5 * s;
        const barMaxH = boxSize * 0.55;
        const barBaseY = y + boxSize * 0.6;

        for (let j = 0; j < vec.length; j++) {
            const bx = vecStartX + j * barSpacing;
            const val = vec[j]!;
            const barH = Math.abs(val) * barMaxH;
            const by = val >= 0 ? barBaseY - barH : barBaseY;

            ctx.fillStyle =
                val >= 0 ? "rgba(34,139,230,0.6)" : "rgba(250,82,82,0.6)";
            ctx.beginPath();
            ctx.roundRect(bx, by, barW, barH, 2 * s);
            ctx.fill();

            /* value label below bars */
            ctx.fillStyle = "#868e96";
            ctx.font = `${Math.max(8 * s, 7)}px ${FONT}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            if (8 * s >= 7) {
                ctx.fillText(
                    val.toFixed(1),
                    bx + barW / 2,
                    y + boxSize + 3 * s,
                );
            }
        }
    }

    /* ══════════════════════════════════════
     Vertical dashed divider
     ══════════════════════════════════════ */
    const divX = w * 0.5;
    const contentBottom = topY + 3 * (boxSize + boxGap);
    ctx.strokeStyle = "#dee2e6";
    ctx.lineWidth = 1;
    ctx.setLineDash([4 * s, 4 * s]);
    ctx.beginPath();
    ctx.moveTo(divX, topY - 14 * s);
    ctx.lineTo(divX, contentBottom);
    ctx.stroke();
    ctx.setLineDash([]);

    /* ══════════════════════════════════════
     RIGHT: 2D scatter plot
     ══════════════════════════════════════ */
    const plotPad = 16 * s;
    const plotSize = Math.min(
        halfW - plotPad * 2,
        contentBottom - topY - 10 * s,
    );
    const plotX = rightAreaX + (halfW - plotSize) / 2;
    const plotY = topY + (contentBottom - topY - plotSize) / 2 - 8 * s;

    /* section label */
    ctx.fillStyle = "#495057";
    ctx.font = `bold ${Math.max(11 * s, 9)}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("벡터 공간", plotX + plotSize / 2, plotY - 6 * s);

    /* axes */
    ctx.strokeStyle = "#ced4da";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(plotX, plotY + plotSize);
    ctx.lineTo(plotX + plotSize, plotY + plotSize);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(plotX, plotY + plotSize);
    ctx.lineTo(plotX, plotY);
    ctx.stroke();

    /* scatter dots */
    const dots = [
        {
            char: "가",
            cx: plotX + plotSize * 0.3,
            cy: plotY + plotSize * 0.32,
            color: "#228be6",
        },
        {
            char: "나",
            cx: plotX + plotSize * 0.38,
            cy: plotY + plotSize * 0.42,
            color: "#40c057",
        },
        {
            char: "다",
            cx: plotX + plotSize * 0.78,
            cy: plotY + plotSize * 0.75,
            color: "#fa5252",
        },
    ];

    const dotR = 6 * s;
    for (const dot of dots) {
        ctx.beginPath();
        ctx.arc(dot.cx, dot.cy, dotR, 0, Math.PI * 2);
        ctx.fillStyle = dot.color;
        ctx.fill();

        ctx.fillStyle = dot.color;
        ctx.font = `bold ${Math.max(12 * s, 9)}px ${FONT}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(dot.char, dot.cx + dotR + 4 * s, dot.cy);
    }

    /* dashed circle around "가" and "나" */
    const groupCx = (dots[0]!.cx + dots[1]!.cx) / 2;
    const groupCy = (dots[0]!.cy + dots[1]!.cy) / 2;
    const groupR = 28 * s;
    ctx.strokeStyle = "#868e96";
    ctx.lineWidth = 1;
    ctx.setLineDash([3 * s, 3 * s]);
    ctx.beginPath();
    ctx.ellipse(groupCx, groupCy, groupR, groupR * 0.8, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    /* proximity label */
    ctx.fillStyle = "#868e96";
    ctx.font = `${Math.max(9 * s, 7)}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(
        "비슷한 글자는 가까이",
        plotX + plotSize / 2,
        plotY + plotSize + 8 * s,
    );

    return contentBottom + 10 * s;
}

export const EmbeddingDiagram = ({ caption }: { caption?: string }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<SvgCanvasHandle>(null);

    useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;

        const draw = () => {
            const w = container.clientWidth;
            if (w === 0) return;
            const dpr = window.devicePixelRatio || 1;

            canvas.width = w * dpr;
            canvas.height = 2000;
            const ctx = canvas.getContext("2d")!;
            ctx.scale(dpr, dpr);
            const h = drawScene(ctx, w);

            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.scale(dpr, dpr);
            drawScene(ctx, w);
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
