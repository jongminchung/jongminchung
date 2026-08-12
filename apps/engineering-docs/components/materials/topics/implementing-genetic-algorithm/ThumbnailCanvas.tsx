"use client";

import { useEffect, useRef } from "react";
import {
    SvgCanvas,
    type SvgCanvasHandle,
    type SvgDrawingContext,
} from "#components/materials/runtime/svg-canvas";
import { CHAMPION } from "./champion";
import {
    buildTrack,
    HALF_W,
    mulberry32,
    randomGenome,
    spawnCar,
    stepCar,
    WORLD_H,
    WORLD_W,
    type Car,
} from "./engine";

// 16:10 썸네일 (3200×2000 PNG로 다운로드). 발행 전 임시 컴포넌트.
const W = 1600;
const H = 1000;
const SCALE = 2;
const FONT =
    "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

// 트랙 월드를 캔버스 영역에 letterbox로 맞추는 뷰
function makeView(cx: number, cy: number, cw: number, ch: number) {
    const scale = Math.min(cw / WORLD_W, ch / WORLD_H);
    const ox = cx + (cw - WORLD_W * scale) / 2;
    const oy = cy + (ch - WORLD_H * scale) / 2;
    return {
        scale,
        wx: (x: number) => ox + x * scale,
        wy: (y: number) => oy + y * scale,
    };
}

type View = ReturnType<typeof makeView>;

// 개체 하나를 죽을 때까지(또는 상한까지) 굴려 궤적을 수집
function runTrace(
    track: ReturnType<typeof buildTrack>,
    genome: Float32Array,
    maxFrames: number,
): [number, number][] {
    const car: Car = spawnCar(track, genome);
    const trace: [number, number][] = [[car.x, car.y]];
    for (let f = 0; f < maxFrames; f++) {
        stepCar(track, car);
        if (!car.alive) break;
        if (f % 2 === 0) trace.push([car.x, car.y]);
    }
    return trace;
}

function drawTrack(
    ctx: SvgDrawingContext,
    track: ReturnType<typeof buildTrack>,
    view: View,
) {
    const { center } = track;
    const n = center.length;
    const roadW = HALF_W * view.scale * 2;

    // 도로 본체
    ctx.beginPath();
    ctx.moveTo(view.wx(center[0]![0]), view.wy(center[0]![1]));
    for (let i = 1; i <= n; i++) {
        const p = center[i % n]!;
        ctx.lineTo(view.wx(p[0]!), view.wy(p[1]!));
    }
    ctx.closePath();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = "#e9edf2";
    ctx.lineWidth = roadW;
    ctx.stroke();

    // 도로 안쪽 미세 음영 (입체감)
    ctx.strokeStyle = "#dfe4ea";
    ctx.lineWidth = roadW - 6;
    ctx.stroke();

    // 중앙 점선
    ctx.setLineDash([view.scale * 16, view.scale * 14]);
    ctx.strokeStyle = "#b7c0cc";
    ctx.lineWidth = Math.max(2, view.scale * 2.4);
    ctx.beginPath();
    ctx.moveTo(view.wx(center[0]![0]), view.wy(center[0]![1]));
    for (let i = 1; i <= n; i++) {
        const p = center[i % n]!;
        ctx.lineTo(view.wx(p[0]!), view.wy(p[1]!));
    }
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // 출발선
    const a = center[0]!;
    const b = center[1]!;
    const ang = Math.atan2(b[1]! - a[1]!, b[0]! - a[0]!) + Math.PI / 2;
    const w = HALF_W * view.scale;
    ctx.strokeStyle = "#868e96";
    ctx.lineWidth = Math.max(3, view.scale * 3);
    ctx.beginPath();
    ctx.moveTo(
        view.wx(a[0]!) + Math.cos(ang) * w,
        view.wy(a[1]!) + Math.sin(ang) * w,
    );
    ctx.lineTo(
        view.wx(a[0]!) - Math.cos(ang) * w,
        view.wy(a[1]!) - Math.sin(ang) * w,
    );
    ctx.stroke();
}

function drawTrace(
    ctx: SvgDrawingContext,
    trace: [number, number][],
    view: View,
    color: string,
    width: number,
    alpha: number,
) {
    if (trace.length < 2) return;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(view.wx(trace[0]![0]), view.wy(trace[0]![1]));
    for (let i = 1; i < trace.length; i++) {
        ctx.lineTo(view.wx(trace[i]![0]), view.wy(trace[i]![1]));
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
}

function drawCar(
    ctx: SvgDrawingContext,
    view: View,
    x: number,
    y: number,
    heading: number,
    color: string,
    size: number,
    alpha = 1,
) {
    ctx.save();
    ctx.translate(view.wx(x), view.wy(y));
    ctx.rotate(heading);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.7, size * 0.62);
    ctx.lineTo(-size * 0.7, -size * 0.62);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
}

function draw(ctx: SvgDrawingContext) {
    // 배경 그라데이션
    const bg = ctx.createLinearGradient(0, 0, W * 0.4, H);
    bg.addColorStop(0, "#f4f7fa");
    bg.addColorStop(1, "#e7ebf1");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const track = buildTrack();

    // 트랙을 캔버스 전체에 여백만 두고 배치 (텍스트 없이 비주얼만)
    const view = makeView(90, 90, W - 180, H - 180);

    drawTrack(ctx, track, view);

    // --- 0세대: 무작위 개체들의 짧은 궤적 (흐리게, 벽 근처에서 끊김) ---
    const rand = mulberry32(21);
    let shown = 0;
    for (let i = 0; i < 260 && shown < 22; i++) {
        const trace = runTrace(track, randomGenome(rand), 240);
        if (trace.length < 3) continue; // 즉사한 개체는 건너뜀
        shown++;
        drawTrace(
            ctx,
            trace,
            view,
            "#adb5bd",
            Math.max(2, view.scale * 3),
            0.32,
        );
        // 궤적 끝(죽은 지점)에 흐린 자동차
        const last = trace[trace.length - 1]!;
        const prev = trace[trace.length - 2]!;
        const heading = Math.atan2(last[1]! - prev[1]!, last[0]! - prev[0]!);
        drawCar(
            ctx,
            view,
            last[0]!,
            last[1]!,
            heading,
            "#ced4da",
            view.scale * 9,
            0.5,
        );
    }

    // --- 챔피언: 트랙을 완주하는 매끄러운 궤적 (파랑, 강조) ---
    const champTrace = runTrace(track, CHAMPION, 1800);
    // 글로우 언더레이
    drawTrace(
        ctx,
        champTrace,
        view,
        "#a5cff5",
        Math.max(10, view.scale * 15),
        0.5,
    );
    drawTrace(ctx, champTrace, view, "#228be6", Math.max(5, view.scale * 7), 1);
    // 챔피언 자동차 (궤적 선두)
    if (champTrace.length >= 2) {
        const head = champTrace[champTrace.length - 1]!;
        const beforeHead = champTrace[champTrace.length - 2]!;
        const heading = Math.atan2(
            head[1]! - beforeHead[1]!,
            head[0]! - beforeHead[0]!,
        );
        // 강조용 흰 테두리 원
        ctx.beginPath();
        ctx.arc(
            view.wx(head[0]!),
            view.wy(head[1]!),
            view.scale * 20,
            0,
            Math.PI * 2,
        );
        ctx.fillStyle = "rgba(34,139,230,0.16)";
        ctx.fill();
        drawCar(
            ctx,
            view,
            head[0]!,
            head[1]!,
            heading,
            "#1971c2",
            view.scale * 14,
            1,
        );
    }
}

export const ThumbnailCanvas = () => {
    const canvasRef = useRef<SvgCanvasHandle>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = W * SCALE;
        canvas.height = H * SCALE;
        const ctx = canvas.getContext("2d")!;
        ctx.scale(SCALE, SCALE);
        draw(ctx);
    }, []);

    const download = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "thumbnail.png";
            a.click();
            URL.revokeObjectURL(url);
        }, "image/png");
    };

    return (
        <div style={{ margin: "24px 0" }}>
            <SvgCanvas
                ref={canvasRef}
                style={{
                    display: "block",
                    width: "100%",
                    borderRadius: 8,
                    border: "1px solid #dee2e6",
                }}
            />
            <div style={{ textAlign: "center", marginTop: 8 }}>
                <button
                    onClick={download}
                    style={{
                        fontFamily: FONT,
                        fontSize: 13,
                        padding: "8px 16px",
                        borderRadius: 6,
                        border: "1px solid #228be6",
                        background: "#e7f5ff",
                        color: "#228be6",
                        cursor: "pointer",
                    }}
                >
                    썸네일 PNG 다운로드 (3200×2000)
                </button>
            </div>
        </div>
    );
};
