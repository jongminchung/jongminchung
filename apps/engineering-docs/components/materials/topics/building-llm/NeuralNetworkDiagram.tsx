"use client";

import { useEffect, useRef } from "react";
import {
    SvgCanvas,
    type SvgCanvasHandle,
    type SvgDrawingContext,
} from "#components/materials/runtime/svg-canvas";

const FONT =
    "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

/* ── 레이아웃 단위 (기준 폭 540px, 스케일 s를 곱해 사용) ── */
const LAYOUT = {
    baseW: 540,
    topY: 50,
    layerH: 200,
    labelGap: 40,
    bottomPad: 30,
};

/* 폭 w에 대응하는 전체 캔버스 높이 — drawScene과 draw()가 공유 */
function sceneHeight(w: number): number {
    const s = w / LAYOUT.baseW;
    return (
        (LAYOUT.topY + LAYOUT.layerH + LAYOUT.labelGap + LAYOUT.bottomPad) * s
    );
}

function drawScene(ctx: SvgDrawingContext, w: number): void {
    const s = w / LAYOUT.baseW;

    /* ── layout ── */
    const nodeR = 18 * s;
    const layerX = [w * 0.2, w * 0.5, w * 0.8];
    const layers = [3, 4, 2]; // input, hidden, output
    const topY = LAYOUT.topY * s;
    const layerH = LAYOUT.layerH * s;
    const labelY = topY + layerH + LAYOUT.labelGap * s;

    const nodeColors = [
        { fill: "#e7f5ff", stroke: "#228be6" },
        { fill: "#ebfbee", stroke: "#40c057" },
        { fill: "#fff9db", stroke: "#fab005" },
    ];

    /* compute node positions */
    const positions: { x: number; y: number }[][] = [];
    for (let l = 0; l < 3; l++) {
        const count = layers[l]!;
        const spacing = layerH / (count + 1);
        const nodes: { x: number; y: number }[] = [];
        for (let i = 0; i < count; i++) {
            nodes.push({ x: layerX[l]!, y: topY + spacing * (i + 1) });
        }
        positions.push(nodes);
    }

    /* highlight: connection from input node 0 → hidden node 1 */
    const hlFrom = { layer: 0, node: 0 };
    const hlTo = { layer: 1, node: 1 };

    /* ── draw connections ── */
    for (let l = 0; l < 2; l++) {
        for (let i = 0; i < positions[l]!.length; i++) {
            for (let j = 0; j < positions[l + 1]!.length; j++) {
                const isHighlight =
                    l === hlFrom.layer && i === hlFrom.node && j === hlTo.node;
                const from = positions[l]![i]!;
                const to = positions[l + 1]![j]!;

                ctx.beginPath();
                ctx.moveTo(from.x, from.y);
                ctx.lineTo(to.x, to.y);
                ctx.strokeStyle = isHighlight ? "#228be6" : "#dee2e6";
                ctx.lineWidth = isHighlight ? 2.5 * s : 1 * s;
                ctx.stroke();
            }
        }
    }

    /* ── weight label on highlighted connection ── */
    const hf = positions[hlFrom.layer]![hlFrom.node]!;
    const ht = positions[hlTo.layer]![hlTo.node]!;
    const labelX = (hf.x + ht.x) / 2 - 8 * s;
    const labelYPos = (hf.y + ht.y) / 2 - 8 * s;
    ctx.fillStyle = "#228be6";
    ctx.font = `bold ${Math.max(11 * s, 9)}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("w\u2081", labelX, labelYPos);

    /* ── "가중치 (w)" label on a default connection ── */
    const gFrom = positions[0]![2]!;
    const gTo = positions[1]![2]!;
    const gwX = (gFrom.x + gTo.x) / 2 + 10 * s;
    const gwY = (gFrom.y + gTo.y) / 2 + 14 * s;
    ctx.fillStyle = "#868e96";
    ctx.font = `${Math.max(10 * s, 8)}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("가중치 (w)", gwX, gwY);

    /* ── draw nodes ── */
    for (let l = 0; l < 3; l++) {
        const color = nodeColors[l]!;
        for (const node of positions[l]!) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, nodeR, 0, Math.PI * 2);
            ctx.fillStyle = color.fill;
            ctx.fill();
            ctx.strokeStyle = color.stroke;
            ctx.lineWidth = 2 * s;
            ctx.stroke();
        }
    }

    /* ── layer labels ── */
    const labels = ["입력층", "은닉층", "출력층"];
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = `bold ${Math.max(12 * s, 10)}px ${FONT}`;
    for (let l = 0; l < 3; l++) {
        ctx.fillStyle = nodeColors[l]!.stroke;
        ctx.fillText(labels[l]!, layerX[l]!, labelY);
    }
}

export const NeuralNetworkDiagram = ({ caption }: { caption?: string }) => {
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
            const ctx = canvas.getContext("2d")!;

            const h = sceneHeight(w);

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

        /* DPR 변경(다른 배율 모니터로 이동) 감지: 다시 그린 뒤 새 DPR 기준으로 리스너 재등록 */
        let dprQuery: MediaQueryList | null = null;
        const onDprChange = () => {
            draw();
            listenDpr();
        };
        const listenDpr = () => {
            dprQuery?.removeEventListener("change", onDprChange);
            dprQuery = window.matchMedia(
                `(resolution: ${window.devicePixelRatio}dppx)`,
            );
            dprQuery.addEventListener("change", onDprChange);
        };
        listenDpr();

        return () => {
            ro.disconnect();
            dprQuery?.removeEventListener("change", onDprChange);
        };
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
