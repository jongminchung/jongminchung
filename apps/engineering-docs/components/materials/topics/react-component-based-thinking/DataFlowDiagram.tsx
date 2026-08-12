"use client";

import { useEffect, useRef } from "react";
import {
    cancelMaterialFrame,
    scheduleMaterialFrame,
} from "#components/materials/runtime/scheduler";
import {
    SvgCanvas,
    type SvgCanvasHandle,
    type SvgDrawingContext,
} from "#components/materials/runtime/svg-canvas";

const FONT =
    "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

const PAD = 12;
const BASE_W = 600;

// 타임라인(초): 파란 점 하강 → 정지 → 노란 점 상승 → 정지, 반복
const DOWN_START = 0;
const DOWN_END = 1.5;
const UP_START = 2.3;
const UP_END = 3.8;
const CYCLE = 5;
const FLASH_DUR = 0.6;

interface Props {
    caption?: string;
}

interface Point {
    x: number;
    y: number;
}

function easeInOutCubic(p: number): number {
    return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

function lerp(a: Point, b: Point, t: number): Point {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function drawBox(
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

// 텍스트가 maxW를 넘지 않도록 폰트 크기를 줄여서 맞춘다 (최소 10px)
function fitFontSize(
    ctx: SvgDrawingContext,
    text: string,
    fs: number,
    maxW: number,
    weight = "",
): number {
    let size = fs;
    ctx.font = `${weight ? `${weight} ` : ""}${size}px ${FONT}`;
    while (size > 10 && ctx.measureText(text).width > maxW) {
        size -= 0.5;
        ctx.font = `${weight ? `${weight} ` : ""}${size}px ${FONT}`;
    }
    return size;
}

// 간선 위 방향 화살촉 (a→b 방향)
function drawArrowHead(
    ctx: SvgDrawingContext,
    a: Point,
    b: Point,
    at: number,
    size: number,
    color: string,
) {
    const tip = lerp(a, b, at);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(
        tip.x - size * Math.cos(angle - 0.45),
        tip.y - size * Math.sin(angle - 0.45),
    );
    ctx.lineTo(
        tip.x - size * Math.cos(angle + 0.45),
        tip.y - size * Math.sin(angle + 0.45),
    );
    ctx.closePath();
    ctx.fill();
}

// 라벨 옆 작은 세로 화살표 (dir: 1 = 아래, -1 = 위)
function drawMiniArrow(
    ctx: SvgDrawingContext,
    x: number,
    cy: number,
    len: number,
    dir: number,
    color: string,
) {
    const a = 3.5;
    const y1 = cy - (len / 2) * dir;
    const y2 = cy + (len / 2) * dir;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2 - (a + 1) * dir);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y2);
    ctx.lineTo(x - a, y2 - (a + 2) * dir);
    ctx.lineTo(x + a, y2 - (a + 2) * dir);
    ctx.closePath();
    ctx.fill();
}

// 은은한 글로우가 있는 점
function drawDot(ctx: SvgDrawingContext, p: Point, r: number, color: string) {
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 1.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
}

// 전체 장면을 그리고 캔버스 높이를 반환한다. render=false면 높이만 계산.
function drawScene(
    ctx: SvgDrawingContext,
    w: number,
    t: number,
    render: boolean,
): number {
    const s = w / BASE_W;

    const titleFs = Math.max(14 * s, 11);
    const subFs = Math.max(11.5 * s, 10);
    const labelFs = Math.max(12 * s, 10);

    const parentW = Math.min(Math.max(216 * s, 150), w * 0.6);
    const parentH = titleFs + subFs + Math.max(26 * s, 20);
    const childW = Math.min(Math.max(168 * s, 118), w * 0.42);
    const childH = titleFs + Math.max(22 * s, 18);
    const gapV = Math.max(126 * s, 100);

    const parentX = w / 2 - parentW / 2;
    const parentY = PAD;
    const parentBottom = parentY + parentH;
    const childTop = parentBottom + gapV;
    const leftCx = w * 0.25;
    const rightCx = w * 0.75;
    const totalH = childTop + childH + PAD;
    if (!render) return totalH;

    // 애니메이션 상태 계산
    const downP =
        t <= DOWN_START
            ? 0
            : Math.min((t - DOWN_START) / (DOWN_END - DOWN_START), 1);
    const upP =
        t <= UP_START ? 0 : Math.min((t - UP_START) / (UP_END - UP_START), 1);
    const blueVisible = t >= DOWN_START && t <= DOWN_END;
    const yellowVisible = t >= UP_START && t <= UP_END;
    const leftFlash =
        t >= DOWN_END ? Math.max(0, 1 - (t - DOWN_END) / FLASH_DUR) : 0;
    const parentFlash =
        t >= UP_END ? Math.max(0, 1 - (t - UP_END) / FLASH_DUR) : 0;
    const cartCount = t >= UP_END ? 4 : 3;

    // 간선 끝점
    const leftEdgeA: Point = { x: parentX + parentW * 0.24, y: parentBottom };
    const leftEdgeB: Point = { x: leftCx, y: childTop };
    const rightEdgeA: Point = { x: rightCx, y: childTop };
    const rightEdgeB: Point = { x: parentX + parentW * 0.76, y: parentBottom };

    // 간선
    ctx.strokeStyle = "#adb5bd";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(leftEdgeA.x, leftEdgeA.y);
    ctx.lineTo(leftEdgeB.x, leftEdgeB.y);
    ctx.moveTo(rightEdgeA.x, rightEdgeA.y);
    ctx.lineTo(rightEdgeB.x, rightEdgeB.y);
    ctx.stroke();
    drawArrowHead(
        ctx,
        leftEdgeA,
        leftEdgeB,
        0.94,
        Math.max(7 * s, 6),
        "#adb5bd",
    );
    drawArrowHead(
        ctx,
        rightEdgeA,
        rightEdgeB,
        0.94,
        Math.max(7 * s, 6),
        "#adb5bd",
    );

    // 간선 라벨 (왼쪽: props 아래로, 오른쪽: 콜백 위로)
    const leftMid = lerp(leftEdgeA, leftEdgeB, 0.5);
    const rightMid = lerp(rightEdgeA, rightEdgeB, 0.5);
    const arrowLen = Math.max(15 * s, 12);

    const leftLabel = "props (count)";
    const lfs = fitFontSize(
        ctx,
        leftLabel,
        labelFs,
        leftMid.x - PAD - 22,
        "600",
    );
    ctx.font = `600 ${lfs}px ${FONT}`;
    ctx.fillStyle = "#228be6";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(leftLabel, leftMid.x - 22, leftMid.y);
    drawMiniArrow(ctx, leftMid.x - 13, leftMid.y, arrowLen, 1, "#228be6");

    const rightLabel = "콜백 (onAdded)";
    const rfs = fitFontSize(
        ctx,
        rightLabel,
        labelFs,
        w - rightMid.x - PAD - 22,
        "600",
    );
    ctx.font = `600 ${rfs}px ${FONT}`;
    ctx.fillStyle = "#fab005";
    ctx.textAlign = "left";
    ctx.fillText(rightLabel, rightMid.x + 22, rightMid.y);
    drawMiniArrow(ctx, rightMid.x + 13, rightMid.y, arrowLen, -1, "#fab005");

    // 부모 박스
    drawBox(ctx, parentX, parentY, parentW, parentH, 8, "#f8f9fa", "#adb5bd");
    if (parentFlash > 0) {
        ctx.globalAlpha = parentFlash * 0.4;
        ctx.beginPath();
        ctx.roundRect(parentX, parentY, parentW, parentH, 8);
        ctx.fillStyle = "#fab005";
        ctx.fill();
        ctx.globalAlpha = 1;
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const ptFs = fitFontSize(ctx, "ProductPage", titleFs, parentW - 16, "700");
    ctx.font = `700 ${ptFs}px ${FONT}`;
    ctx.fillStyle = "#495057";
    ctx.fillText("ProductPage", w / 2, parentY + parentH * 0.36);
    const subText = `cartCount = ${cartCount}`;
    const psFs = fitFontSize(ctx, subText, subFs, parentW - 16);
    ctx.font = `${psFs}px ${FONT}`;
    ctx.fillStyle = "#868e96";
    ctx.fillText(subText, w / 2, parentY + parentH * 0.7);

    // 자식 박스 2개
    const children: {
        label: string;
        cx: number;
        flash: number;
        flashColor: string;
    }[] = [
        {
            label: "CartBadge",
            cx: leftCx,
            flash: leftFlash,
            flashColor: "#228be6",
        },
        {
            label: "AddToCartButton",
            cx: rightCx,
            flash: 0,
            flashColor: "#228be6",
        },
    ];
    for (const c of children) {
        const cxLeft = c.cx - childW / 2;
        drawBox(ctx, cxLeft, childTop, childW, childH, 8, "#f8f9fa", "#adb5bd");
        if (c.flash > 0) {
            ctx.globalAlpha = c.flash * 0.4;
            ctx.beginPath();
            ctx.roundRect(cxLeft, childTop, childW, childH, 8);
            ctx.fillStyle = c.flashColor;
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        const cfs = fitFontSize(ctx, c.label, titleFs, childW - 14, "700");
        ctx.font = `700 ${cfs}px ${FONT}`;
        ctx.fillStyle = "#495057";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(c.label, c.cx, childTop + childH / 2);
    }

    // 이동하는 점
    const dotR = Math.max(6 * s, 5);
    if (blueVisible) {
        drawDot(
            ctx,
            lerp(leftEdgeA, leftEdgeB, easeInOutCubic(downP)),
            dotR,
            "#228be6",
        );
    }
    if (yellowVisible) {
        drawDot(
            ctx,
            lerp(rightEdgeA, rightEdgeB, easeInOutCubic(upP)),
            dotR,
            "#fab005",
        );
    }

    return totalH;
}

export const DataFlowDiagram = ({ caption }: Props) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<SvgCanvasHandle>(null);

    useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let raf = 0;
        let sizedW = 0;
        let sizedH = 0;
        const start = performance.now();

        const animate = (now: number) => {
            raf = scheduleMaterialFrame(animate);
            const w = container.clientWidth;
            if (w <= 0) return;
            const dpr = window.devicePixelRatio || 1;

            // rAF의 첫 타임스탬프는 performance.now()보다 이를 수 있으므로 음수 방지
            const elapsed = Math.max(0, now - start);
            const t = (elapsed / 1000) % CYCLE;

            const h = drawScene(ctx, w, t, false);
            if (
                w !== sizedW ||
                h !== sizedH ||
                canvas.width !== Math.round(w * dpr)
            ) {
                canvas.width = Math.round(w * dpr);
                canvas.height = Math.round(h * dpr);
                canvas.style.width = `${w}px`;
                canvas.style.height = `${h}px`;
                sizedW = w;
                sizedH = h;
            }

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, w, h);
            drawScene(ctx, w, t, true);
        };

        raf = scheduleMaterialFrame(animate);
        const ro = new ResizeObserver(() => {
            // 다음 프레임에서 캔버스 크기를 강제로 다시 잡게 한다
            sizedW = 0;
        });
        ro.observe(container);
        return () => {
            cancelMaterialFrame(raf);
            ro.disconnect();
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
