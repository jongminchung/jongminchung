"use client";

import { useEffect, useRef } from "react";
import {
    cancelMaterialFrame,
    scheduleMaterialFrame,
} from "#components/materials/runtime/scheduler";
import {
    SvgCanvas,
    type SvgCanvasHandle,
} from "#components/materials/runtime/svg-canvas";

const FONT =
    "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

const SHARDS = 4;
// 두 국면: from/size 방식 → search_after 방식
const PHASE_MS = 3600;
const CYCLE = PHASE_MS * 2;

function clamp01(t: number) {
    return Math.min(1, Math.max(0, t));
}
function easeOut(t: number) {
    return 1 - Math.pow(1 - clamp01(t), 3);
}

export const ScatterGatherDemo = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<SvgCanvasHandle>(null);

    useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;

        let raf = 0;
        const start = performance.now();

        const render = (now: number) => {
            const w = container.clientWidth;
            const dpr = window.devicePixelRatio || 1;
            const e = (now - start) % CYCLE;
            const deep = e < PHASE_MS; // true: from 990, size 10 / false: search_after
            const t = e % PHASE_MS;

            const s = Math.max(0.6, w / 640);
            const h = 300 * Math.max(0.8, Math.min(1, s));
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;

            const ctx = canvas.getContext("2d")!;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.scale(dpr, dpr);

            const fs = Math.max(10, 12 * s);
            const titleFs = Math.max(12, 13 * s);

            // 국면 제목
            ctx.font = `700 ${titleFs}px ${FONT}`;
            ctx.fillStyle = deep ? "#fa5252" : "#2f9e44";
            ctx.textAlign = "center";
            ctx.textBaseline = "alphabetic";
            ctx.fillText(
                deep
                    ? "from: 990, size: 10 — 100번째 페이지"
                    : "search_after — 같은 지점을 커서로",
                w / 2,
                20,
            );

            // 코디네이터
            const coordW = Math.min(240, w * 0.4);
            const coordH = 46;
            const coordX = (w - coordW) / 2;
            const coordY = 36;
            ctx.beginPath();
            ctx.roundRect(coordX, coordY, coordW, coordH, 8);
            ctx.fillStyle = "#e7f5ff";
            ctx.fill();
            ctx.strokeStyle = "#228be6";
            ctx.lineWidth = 1.5;
            ctx.stroke();

            const perShard = deep ? 1000 : 10;
            const arrive = easeOut((t - 600) / 1200); // 문서가 코디네이터로 모이는 진행도
            const gathered = Math.round(perShard * SHARDS * arrive);
            const doneGather = t > 2000;

            ctx.font = `700 ${fs}px ${FONT}`;
            ctx.fillStyle = "#1971c2";
            ctx.fillText("코디네이터 노드", w / 2, coordY + 18);
            ctx.font = `${Math.max(9, fs - 2)}px ${FONT}`;
            ctx.fillStyle = "#495057";
            ctx.fillText(
                doneGather
                    ? deep
                        ? `${(perShard * SHARDS).toLocaleString()}건 병합 → 3,990건 버림 → 10건 반환`
                        : `${perShard * SHARDS}건 병합 → 30건 버림 → 10건 반환`
                    : `도착한 문서: ${gathered.toLocaleString()}건`,
                w / 2,
                coordY + 35,
            );

            // 샤드들
            const shardW = Math.min(120, (w - 40) / SHARDS - 12);
            const shardH = 54;
            const shardY = h - shardH - 34;
            const totalW = SHARDS * shardW + (SHARDS - 1) * 16;
            const startX = (w - totalW) / 2;

            for (let i = 0; i < SHARDS; i++) {
                const sx = startX + i * (shardW + 16);

                // 샤드 → 코디네이터로 흐르는 문서 뭉치
                if (t > 600 && !doneGather) {
                    const p = easeOut((t - 600) / 1200);
                    const fromX = sx + shardW / 2;
                    const fromY = shardY;
                    const toX =
                        coordX + coordW / 2 + (i - (SHARDS - 1) / 2) * 20;
                    const toY = coordY + coordH;
                    const x = fromX + (toX - fromX) * p;
                    const y = fromY + (toY - fromY) * p;
                    // 문서량을 뭉치 크기로 표현
                    const size = deep
                        ? Math.max(10, 16 * s)
                        : Math.max(4, 6 * s);
                    ctx.beginPath();
                    ctx.roundRect(
                        x - size / 2,
                        y - size / 2,
                        size,
                        size * 1.2,
                        2,
                    );
                    ctx.fillStyle = deep ? "#ffc9c9" : "#b2f2bb";
                    ctx.fill();
                    ctx.strokeStyle = deep ? "#fa5252" : "#40c057";
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }

                ctx.beginPath();
                ctx.roundRect(sx, shardY, shardW, shardH, 8);
                ctx.fillStyle = "#f8f9fa";
                ctx.fill();
                ctx.strokeStyle = "#adb5bd";
                ctx.lineWidth = 1.25;
                ctx.stroke();

                ctx.font = `700 ${Math.max(9, fs - 1)}px ${FONT}`;
                ctx.fillStyle = "#495057";
                ctx.fillText(`샤드 ${i + 1}`, sx + shardW / 2, shardY + 20);
                ctx.font = `${Math.max(9, fs - 2)}px ${FONT}`;
                ctx.fillStyle = deep ? "#e03131" : "#2f9e44";
                ctx.fillText(
                    t > 300 ? `상위 ${perShard.toLocaleString()}건 전송` : "…",
                    sx + shardW / 2,
                    shardY + 38,
                );
            }

            // 하단 요약
            ctx.font = `${Math.max(10, fs - 1)}px ${FONT}`;
            ctx.fillStyle = "#868e96";
            ctx.fillText(
                deep
                    ? "10건을 보여주려고 4,000건이 네트워크를 건넌다 — 오프셋 비용 × 샤드 수"
                    : "각 샤드는 커서 지점 이후 10건만 보내면 된다 — 깊이와 무관",
                w / 2,
                h - 10,
            );
            ctx.textAlign = "left";

            raf = scheduleMaterialFrame(render);
        };

        raf = scheduleMaterialFrame(render);
        return () => cancelMaterialFrame(raf);
    }, []);

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
            <div ref={containerRef}>
                <SvgCanvas
                    ref={canvasRef}
                    style={{ display: "block", width: "100%" }}
                />
            </div>
        </div>
    );
};
