"use client";

import { useEffect, useRef } from "react";
import {
    SvgCanvas,
    type SvgCanvasHandle,
    type SvgDrawingContext,
} from "#components/materials/runtime/svg-canvas";

const FONT =
    "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

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

function drawBadge(
    ctx: SvgDrawingContext,
    cx: number,
    cy: number,
    text: string,
    color: string,
    bg: string,
    fs: number,
) {
    ctx.font = `600 ${fs}px ${FONT}`;
    const tw = ctx.measureText(text).width;
    const padH = fs * 0.7;
    const bw = tw + padH * 2;
    const bh = fs + fs * 0.7;
    ctx.beginPath();
    ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, bh / 2);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, cx, cy + 0.5);
}

type Lang = "ko" | "en";

const STRINGS = {
    ko: {
        // 메인 스레드가 하는 일 목록 (칩 형태로 그림)
        mainItems: [
            "JS 실행",
            "DOM",
            "스타일 계산",
            "레이아웃",
            "페인트",
            "이벤트 처리",
        ],
        mainThread: "메인 스레드",
        directControl: "직접 제어",
        compositor: "컴포지터 스레드",
        compositorRole: "레이어 합성",
        raster: "래스터 스레드",
        rasterRole: "픽셀 래스터화",
        worker: "워커 스레드",
        workerRole: "JS 계산 전용",
        workerRoleVertical: "JS 계산 전용 (DOM 불가)",
        noControl: "제어 불가",
        noDom: "DOM 불가",
    },
    en: {
        mainItems: [
            "JS execution",
            "DOM",
            "Style calculation",
            "Layout",
            "Paint",
            "Event handling",
        ],
        mainThread: "Main thread",
        directControl: "Direct control",
        compositor: "Compositor thread",
        compositorRole: "Layer compositing",
        raster: "Raster thread",
        rasterRole: "Pixel rasterization",
        worker: "Worker thread",
        workerRole: "JS computation only",
        workerRoleVertical: "JS computation only (no DOM)",
        noControl: "No control",
        noDom: "No DOM",
    },
} as const;

type T = (typeof STRINGS)[Lang];

function drawChips(
    ctx: SvgDrawingContext,
    items: readonly string[],
    left: number,
    right: number,
    top: number,
    fs: number,
): number {
    ctx.font = `${fs}px ${FONT}`;
    const gapX = fs * 0.6;
    const gapY = fs * 0.7;
    const chipH = fs + fs * 0.9;
    let x = left;
    let y = top;
    for (const item of items) {
        const tw = ctx.measureText(item).width;
        const padH = fs * 0.75;
        const cw = tw + padH * 2;
        if (x + cw > right) {
            x = left;
            y += chipH + gapY;
        }
        ctx.beginPath();
        ctx.roundRect(x, y, cw, chipH, 6);
        ctx.fillStyle = "#fff";
        ctx.fill();
        ctx.strokeStyle = "#a5d8ff";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "#1971c2";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `${fs}px ${FONT}`;
        ctx.fillText(item, x + cw / 2, y + chipH / 2);
        x += cw + gapX;
    }
    return y + chipH; // 마지막 줄 하단 y
}

// 하위 스레드 박스 하나 그리기
function drawSubThread(
    ctx: SvgDrawingContext,
    x: number,
    y: number,
    w: number,
    h: number,
    title: string,
    role: string,
    badge: string,
    badgeColor: string,
    badgeBg: string,
    titleFs: number,
    roleFs: number,
    badgeFs: number,
) {
    drawRoundRect(ctx, x, y, w, h, 10, "#f8f9fa", "#dee2e6");
    const cx = x + w / 2;
    ctx.fillStyle = "#495057";
    ctx.font = `600 ${titleFs}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(title, cx, y + h * 0.3);
    ctx.fillStyle = "#868e96";
    ctx.font = `${roleFs}px ${FONT}`;
    ctx.fillText(role, cx, y + h * 0.55);
    drawBadge(ctx, cx, y + h * 0.82, badge, badgeColor, badgeBg, badgeFs);
}

function drawHorizontal(ctx: SvgDrawingContext, w: number, t: T): number {
    const s = w / 620;
    const pad = 4 * s;
    const titleFs = Math.max(14 * s, 12);
    const labelFs = Math.max(11 * s, 10);
    const chipFs = Math.max(11 * s, 10);
    const roleFs = Math.max(10 * s, 9);
    const badgeFs = Math.max(9.5 * s, 8.5);

    // ── 메인 스레드 박스 ──
    const mainX = pad;
    const mainW = w - pad * 2;
    const mainY = 8 * s;
    const mainH = 108 * s;
    drawRoundRect(ctx, mainX, mainY, mainW, mainH, 12, "#e7f5ff", "#228be6", 2);

    ctx.fillStyle = "#1971c2";
    ctx.font = `700 ${titleFs}px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(t.mainThread, mainX + 18 * s, mainY + 22 * s);

    drawBadge(
        ctx,
        mainX + mainW - 52 * s,
        mainY + 22 * s,
        t.directControl,
        "#fff",
        "#228be6",
        badgeFs,
    );

    drawChips(
        ctx,
        t.mainItems,
        mainX + 18 * s,
        mainX + mainW - 18 * s,
        mainY + 40 * s,
        chipFs,
    );

    // ── 하위 스레드 3개 ──
    const subY = mainY + mainH + 22 * s;
    const subH = 84 * s;
    const gap = 14 * s;
    const subW = (mainW - gap * 2) / 3;

    drawSubThread(
        ctx,
        mainX,
        subY,
        subW,
        subH,
        t.compositor,
        t.compositorRole,
        t.noControl,
        "#868e96",
        "#e9ecef",
        labelFs,
        roleFs,
        badgeFs,
    );
    drawSubThread(
        ctx,
        mainX + subW + gap,
        subY,
        subW,
        subH,
        t.raster,
        t.rasterRole,
        t.noControl,
        "#868e96",
        "#e9ecef",
        labelFs,
        roleFs,
        badgeFs,
    );
    drawSubThread(
        ctx,
        mainX + (subW + gap) * 2,
        subY,
        subW,
        subH,
        t.worker,
        t.workerRole,
        t.noDom,
        "#e8590c",
        "#ffe8cc",
        labelFs,
        roleFs,
        badgeFs,
    );

    return subY + subH + 8 * s;
}

function drawVertical(ctx: SvgDrawingContext, w: number, t: T): number {
    const titleFs = 14;
    const labelFs = 12;
    const chipFs = 11;
    const roleFs = 10;
    const badgeFs = 9.5;
    const pad = 4;

    const mainX = pad;
    const mainW = w - pad * 2;
    const mainY = 8;
    const mainH = 128;
    drawRoundRect(ctx, mainX, mainY, mainW, mainH, 12, "#e7f5ff", "#228be6", 2);

    ctx.fillStyle = "#1971c2";
    ctx.font = `700 ${titleFs}px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(t.mainThread, mainX + 14, mainY + 20);
    drawBadge(
        ctx,
        mainX + mainW - 46,
        mainY + 20,
        t.directControl,
        "#fff",
        "#228be6",
        badgeFs,
    );
    drawChips(
        ctx,
        t.mainItems,
        mainX + 14,
        mainX + mainW - 14,
        mainY + 38,
        chipFs,
    );

    const subH = 66;
    const subGap = 12;
    let y = mainY + mainH + 20;
    const subs: [string, string, string, string, string][] = [
        [t.compositor, t.compositorRole, t.noControl, "#868e96", "#e9ecef"],
        [t.raster, t.rasterRole, t.noControl, "#868e96", "#e9ecef"],
        [t.worker, t.workerRoleVertical, t.noDom, "#e8590c", "#ffe8cc"],
    ];
    for (const [title, role, badge, bc, bg] of subs) {
        drawRoundRect(ctx, mainX, y, mainW, subH, 10, "#f8f9fa", "#dee2e6");
        ctx.fillStyle = "#495057";
        ctx.font = `600 ${labelFs}px ${FONT}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(title, mainX + 14, y + subH / 2 - 9);
        ctx.fillStyle = "#868e96";
        ctx.font = `${roleFs}px ${FONT}`;
        ctx.fillText(role, mainX + 14, y + subH / 2 + 10);
        drawBadge(
            ctx,
            mainX + mainW - 44,
            y + subH / 2,
            badge,
            bc,
            bg,
            badgeFs,
        );
        y += subH + subGap;
    }
    return y;
}

interface Props {
    caption?: string;
    locale?: Lang;
}

export const BrowserThreadMapDiagram = ({
    caption,
    locale: lang = "ko",
}: Props) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<SvgCanvasHandle>(null);

    useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;
        const t = STRINGS[lang];

        const draw = () => {
            const w = container.clientWidth;
            const dpr = window.devicePixelRatio || 1;
            const isMobile = w < 480;
            const ctx = canvas.getContext("2d")!;

            // 높이를 먼저 측정하기 위해 임시 스케일로 계산
            canvas.width = w * dpr;
            const probeH = isMobile ? 480 : 260 * (w / 620);
            canvas.height = probeH * dpr;
            canvas.style.width = `${w}px`;
            canvas.style.height = `${probeH}px`;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.scale(dpr, dpr);
            const h = isMobile
                ? drawVertical(ctx, w, t)
                : drawHorizontal(ctx, w, t);
            ctx.restore();

            // 실제 높이로 재설정 후 다시 그림
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.scale(dpr, dpr);
            if (isMobile) drawVertical(ctx, w, t);
            else drawHorizontal(ctx, w, t);
        };

        draw();
        const ro = new ResizeObserver(draw);
        ro.observe(container);
        return () => ro.disconnect();
    }, [lang]);

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
