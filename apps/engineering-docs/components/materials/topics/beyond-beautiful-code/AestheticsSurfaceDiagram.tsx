"use client";

import { useEffect, useRef } from "react";
import {
    SvgCanvas,
    type SvgCanvasHandle,
    type SvgDrawingContext,
} from "#components/materials/runtime/svg-canvas";

const FONT =
    "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'SF Mono', Menlo, monospace";

const BASE_W = 640;
const BASE_H = 308;
const MOBILE_H = 296;

const DESKTOP_CHIPS = ["interface", "Result<T, E>", "retry(3)"] as const;
const MOBILE_CHIPS = ["interface", "Result<T, E>"] as const;

// ── Helpers ──

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

function drawEye(
    ctx: SvgDrawingContext,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    irisR: number,
) {
    ctx.strokeStyle = "#495057";
    ctx.lineWidth = 1.6;

    // Upper lid (ellipse arc)
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, Math.PI * 2);
    ctx.stroke();

    // Lower lid (ellipse arc)
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI);
    ctx.stroke();

    // Iris ring
    ctx.beginPath();
    ctx.arc(cx, cy, irisR, 0, Math.PI * 2);
    ctx.stroke();

    // Pupil dot
    ctx.beginPath();
    ctx.arc(cx, cy, irisR * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = "#495057";
    ctx.fill();
}

function drawGazeLines(
    ctx: SvgDrawingContext,
    fromX: number,
    fromY: number,
    targets: ReadonlyArray<readonly [number, number]>,
) {
    ctx.strokeStyle = "#adb5bd";
    ctx.lineWidth = 1.1;
    ctx.setLineDash([4, 4]);
    for (const [tx, ty] of targets) {
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(tx, ty);
        ctx.stroke();
    }
    ctx.setLineDash([]);
}

function chipWidth(
    ctx: SvgDrawingContext,
    text: string,
    fs: number,
    padX: number,
): number {
    ctx.font = `${fs}px ${MONO}`;
    return ctx.measureText(text).width + padX * 2;
}

function drawChip(
    ctx: SvgDrawingContext,
    x: number,
    midY: number,
    text: string,
    fs: number,
    padX: number,
    h: number,
): number {
    const w = chipWidth(ctx, text, fs, padX);
    drawRoundRect(
        ctx,
        x,
        midY - h / 2,
        w,
        h,
        Math.min(5, h / 2),
        "#fff",
        "#dee2e6",
        1,
    );
    ctx.fillStyle = "#495057";
    ctx.font = `${fs}px ${MONO}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + padX, midY + 0.5);
    return w;
}

function drawUpArrow(
    ctx: SvgDrawingContext,
    x: number,
    fromY: number,
    tipY: number,
    color: string,
    lineWidth: number,
    head: number,
) {
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x, fromY);
    ctx.lineTo(x, tipY + head);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, tipY);
    ctx.lineTo(x - head * 0.62, tipY + head);
    ctx.lineTo(x + head * 0.62, tipY + head);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
}

function drawConceptBox(
    ctx: SvgDrawingContext,
    x: number,
    y: number,
    w: number,
    h: number,
    border: string,
    bg: string,
    titleColor: string,
    title: string,
    subtitle: string,
    titleFs: number,
    subFs: number,
) {
    drawRoundRect(ctx, x, y, w, h, 10, bg, border, 1.5);

    const cx = x + w / 2;
    ctx.fillStyle = titleColor;
    ctx.font = `600 ${titleFs}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(title, cx, y + h * 0.36);

    ctx.fillStyle = "#868e96";
    ctx.font = `${subFs}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(subtitle, cx, y + h * 0.68);
}

// ── Horizontal layout (desktop) ──

function drawHorizontal(ctx: SvgDrawingContext, w: number): number {
    const s = w / BASE_W;
    const h = BASE_H * s;

    const cx = 320 * s;

    const labelFs = Math.max(10.5 * s, 9.5);
    const bandTitleFs = Math.max(13 * s, 11);
    const chipFs = Math.max(10 * s, 9);
    const arrowLabelFs = Math.max(9.5 * s, 8.5);
    const boxTitleFs = Math.max(14 * s, 12);
    const boxSubFs = Math.max(10.5 * s, 9);
    const faintFs = Math.max(11 * s, 10);

    // 1. Eye (the reader) at the top
    drawEye(ctx, cx, 36 * s, 20 * s, 13 * s, Math.max(6 * s, 4.5));

    ctx.fillStyle = "#868e96";
    ctx.font = `${labelFs}px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("읽는 사람", 350 * s, 36 * s);

    // Gaze lines spreading down toward the surface
    drawGazeLines(ctx, cx, 53 * s, [
        [235 * s, 99 * s],
        [cx, 99 * s],
        [405 * s, 99 * s],
    ]);

    // "Visible" label between the eye and the band (right side)
    ctx.fillStyle = "#adb5bd";
    ctx.font = `${labelFs}px ${FONT}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText("보이는 미학", 606 * s, 88 * s);

    // 2. Expression band — the surface of the code
    const bandX = 32 * s;
    const bandY = 104 * s;
    const bandW = 576 * s;
    const bandH = 44 * s;
    const bandMidY = bandY + bandH / 2;
    drawRoundRect(
        ctx,
        bandX,
        bandY,
        bandW,
        bandH,
        10 * s,
        "#e7f5ff",
        "#228be6",
        1.5,
    );

    ctx.fillStyle = "#1971c2";
    ctx.font = `600 ${bandTitleFs}px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("표현 — 코드의 표면", 50 * s, bandMidY);

    // Code chips inside the band (right side, laid out right-to-left)
    const chipH = Math.max(20 * s, 16);
    const chipPad = Math.max(7 * s, 6);
    const chipGap = Math.max(8 * s, 7);
    let chipRight = bandX + bandW - 14 * s;
    for (let i = DESKTOP_CHIPS.length - 1; i >= 0; i--) {
        const cw = chipWidth(ctx, DESKTOP_CHIPS[i]!, chipFs, chipPad);
        drawChip(
            ctx,
            chipRight - cw,
            bandMidY,
            DESKTOP_CHIPS[i]!,
            chipFs,
            chipPad,
            chipH,
        );
        chipRight -= cw + chipGap;
    }

    // 3. Arrows rising from the two hidden aesthetics into the surface
    const structX = 180 * s;
    const execX = 460 * s;
    const arrowFromY = 196 * s;
    const arrowTipY = 152 * s;
    const head = Math.max(6 * s, 5);
    drawUpArrow(ctx, structX, arrowFromY, arrowTipY, "#fab005", 1.8, head);
    drawUpArrow(ctx, execX, arrowFromY, arrowTipY, "#fa5252", 1.8, head);

    // Arrow labels, placed outside the arrows so they never overlap
    ctx.fillStyle = "#868e96";
    ctx.font = `${arrowLabelFs}px ${FONT}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "right";
    ctx.fillText("인터페이스 · import ·", 166 * s, 167 * s);
    ctx.fillText("디렉터리로 드러남", 166 * s, 181 * s);
    ctx.textAlign = "left";
    ctx.fillText("Result · 테스트 ·", 474 * s, 167 * s);
    ctx.fillText("재시도 코드로 드러남", 474 * s, 181 * s);

    // 4. Hidden aesthetics: structure and execution
    const boxY = 200 * s;
    const boxH = 74 * s;
    drawConceptBox(
        ctx,
        72 * s,
        boxY,
        216 * s,
        boxH,
        "#fab005",
        "#fff9db",
        "#f08c00",
        "구조",
        "경계 · 책임 분배 · 의존 방향",
        boxTitleFs,
        boxSubFs,
    );
    drawConceptBox(
        ctx,
        352 * s,
        boxY,
        216 * s,
        boxH,
        "#fa5252",
        "#fff5f5",
        "#e03131",
        "실행",
        "견고함 · 효율 · 동시성",
        boxTitleFs,
        boxSubFs,
    );

    // 5. "Invisible" caption below the boxes
    ctx.fillStyle = "#adb5bd";
    ctx.font = `${faintFs}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("보이지 않는 미학", cx, 292 * s);

    return h;
}

// ── Vertical layout (mobile) ──

function drawVertical(ctx: SvgDrawingContext, w: number): number {
    const cx = w / 2;

    // 1. Eye (the reader)
    drawEye(ctx, cx, 30, 16, 10.5, 4.5);

    ctx.fillStyle = "#868e96";
    ctx.font = `9.5px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("읽는 사람", cx + 26, 30);

    // Gaze lines toward the surface
    drawGazeLines(ctx, cx, 44, [
        [cx - 58, 75],
        [cx, 75],
        [cx + 58, 75],
    ]);

    ctx.fillStyle = "#adb5bd";
    ctx.font = `9.5px ${FONT}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText("보이는 미학", w - 16, 66);

    // 2. Expression band: title line + reduced chip row inside
    const bandX = 14;
    const bandY = 80;
    const bandW = w - 28;
    const bandH = 54;
    drawRoundRect(
        ctx,
        bandX,
        bandY,
        bandW,
        bandH,
        8,
        "#e7f5ff",
        "#228be6",
        1.5,
    );

    ctx.fillStyle = "#1971c2";
    ctx.font = `600 12px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("표현 — 코드의 표면", cx, 96);

    const chipFs = 9;
    const chipPad = 6;
    const chipGap = 8;
    const chipH = 17;
    const widths = MOBILE_CHIPS.map((t) => chipWidth(ctx, t, chipFs, chipPad));
    const totalChipW =
        widths.reduce((a, b) => a + b, 0) + chipGap * (MOBILE_CHIPS.length - 1);
    let chipX = cx - totalChipW / 2;
    MOBILE_CHIPS.forEach((t, i) => {
        drawChip(ctx, chipX, 118, t, chipFs, chipPad, chipH);
        chipX += widths[i]! + chipGap;
    });

    // 3. Arrows from the hidden boxes up to the band
    const boxW = w * 0.42;
    const boxY = 196;
    const boxH = 68;
    const leftBoxX = 10;
    const rightBoxX = w - 10 - boxW;
    const leftAx = leftBoxX + boxW / 2;
    const rightAx = rightBoxX + boxW / 2;
    drawUpArrow(ctx, leftAx, boxY - 4, 142, "#fab005", 1.6, 5);
    drawUpArrow(ctx, rightAx, boxY - 4, 142, "#fa5252", 1.6, 5);

    // Shortened arrow labels, staggered so they never collide
    ctx.fillStyle = "#868e96";
    ctx.font = `9px ${FONT}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText("인터페이스 · 디렉터리", leftAx + 9, 154);
    ctx.textAlign = "right";
    ctx.fillText("Result · 테스트", rightAx - 9, 176);

    // 4. Hidden aesthetics boxes, side by side
    drawConceptBox(
        ctx,
        leftBoxX,
        boxY,
        boxW,
        boxH,
        "#fab005",
        "#fff9db",
        "#f08c00",
        "구조",
        "경계 · 책임 분배 · 의존 방향",
        12.5,
        9,
    );
    drawConceptBox(
        ctx,
        rightBoxX,
        boxY,
        boxW,
        boxH,
        "#fa5252",
        "#fff5f5",
        "#e03131",
        "실행",
        "견고함 · 효율 · 동시성",
        12.5,
        9,
    );

    // 5. "Invisible" caption
    ctx.fillStyle = "#adb5bd";
    ctx.font = `9.5px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("보이지 않는 미학", cx, 282);

    return MOBILE_H;
}

// ── Component ──

interface Props {
    caption?: string;
}

export const AestheticsSurfaceDiagram = ({ caption }: Props) => {
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

            // Pre-compute height, size the canvas, then draw
            const h = isMobile ? MOBILE_H : BASE_H * (w / BASE_W);

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
