"use client";

import { useEffect, useRef } from "react";
import {
    SvgCanvas,
    type SvgCanvasHandle,
    type SvgDrawingContext,
} from "#components/materials/runtime/svg-canvas";

const FONT =
    "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

const PAD = 16;
const BASE_W = 640;
const LINE = "#adb5bd";

interface Props {
    caption?: string;
}

interface BranchSpec {
    title: string;
    color: string;
    bg: string;
    chips: string[];
}

const BRANCHES: BranchSpec[] = [
    {
        title: "뷰",
        color: "#228be6",
        bg: "#e7f5ff",
        chips: ["요소", "속성", "텍스트·자식", "스타일"],
    },
    {
        title: "데이터",
        color: "#40c057",
        bg: "#d3f9d8",
        chips: ["props", "상태", "파생 값"],
    },
    {
        title: "로직",
        color: "#845ef7",
        bg: "#f3f0ff",
        chips: ["이벤트 핸들러", "이펙트", "서버 통신"],
    },
];

const ROOT_LABEL = "컴포넌트";
const IDENTITY_TITLE = "정체성";
const IDENTITY_SUB = "위치 · key";

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
    dash?: number[],
) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    if (dash) ctx.setLineDash(dash);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    if (dash) ctx.setLineDash([]);
}

// 텍스트가 maxW를 넘지 않도록 폰트 크기를 줄여서 맞춘다
function fitFontSize(
    ctx: SvgDrawingContext,
    text: string,
    fs: number,
    maxW: number,
    weight = "",
): number {
    let size = fs;
    ctx.font = `${weight ? `${weight} ` : ""}${size}px ${FONT}`;
    while (size > 8.5 && ctx.measureText(text).width > maxW) {
        size -= 0.5;
        ctx.font = `${weight ? `${weight} ` : ""}${size}px ${FONT}`;
    }
    return size;
}

// 루트 "컴포넌트" 박스의 크기를 계산한다
function rootSize(ctx: SvgDrawingContext, s: number) {
    const fs = Math.max(14 * s, 12);
    ctx.font = `700 ${fs}px ${FONT}`;
    const w = Math.ceil(ctx.measureText(ROOT_LABEL).width) + 40;
    const h = fs + 22;
    return { w, h, fs };
}

function drawRoot(ctx: SvgDrawingContext, x: number, y: number, s: number) {
    const { w, h, fs } = rootSize(ctx, s);
    drawBox(ctx, x, y, w, h, 8, "#fff", "#495057", 1.8);
    ctx.font = `700 ${fs}px ${FONT}`;
    ctx.fillStyle = "#495057";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ROOT_LABEL, x + w / 2, y + h / 2 + 0.5);
}

// 정체성 박스(점선 — 코드에 드러나지 않는 구성 요소)의 크기를 계산한다
function identitySize(ctx: SvgDrawingContext, s: number) {
    const titleFs = Math.max(12 * s, 10);
    const subFs = Math.max(10 * s, 10);
    ctx.font = `700 ${titleFs}px ${FONT}`;
    const tw = ctx.measureText(IDENTITY_TITLE).width;
    ctx.font = `${subFs}px ${FONT}`;
    const sw = ctx.measureText(IDENTITY_SUB).width;
    const w = Math.ceil(Math.max(tw, sw)) + 26;
    const h = titleFs + subFs + 22;
    return { w, h, titleFs, subFs };
}

function drawIdentity(ctx: SvgDrawingContext, x: number, y: number, s: number) {
    const { w, h, titleFs, subFs } = identitySize(ctx, s);
    drawBox(ctx, x, y, w, h, 7, "#fff", LINE, 1.3, [4, 4]);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${titleFs}px ${FONT}`;
    ctx.fillStyle = "#868e96";
    ctx.fillText(IDENTITY_TITLE, x + w / 2, y + 8 + titleFs / 2);
    ctx.font = `${subFs}px ${FONT}`;
    ctx.fillStyle = LINE;
    ctx.fillText(IDENTITY_SUB, x + w / 2, y + h - 8 - subFs / 2);
}

// 갈래 박스 하나를 그린다. layout='stack'이면 칩을 세로로 쌓고(데스크톱 열),
// 'flow'면 칩을 가로로 흘려 배치한다(모바일 전체 폭). render=false면 높이만 계산한다.
function drawBranchBox(
    ctx: SvgDrawingContext,
    x: number,
    y: number,
    boxW: number,
    branch: BranchSpec,
    s: number,
    layout: "stack" | "flow",
    render: boolean,
): number {
    const pad = 12;
    const titleFs = Math.max(13 * s, 11);
    const chipFs = Math.max(11 * s, 10);
    const chipH = chipFs + 14;
    const gap = 8;
    const innerW = boxW - pad * 2;

    // 칩 배치를 (0,0) 기준으로 선계산한다
    const pos: { x: number; y: number; w: number; label: string }[] = [];
    if (layout === "stack") {
        branch.chips.forEach((label, i) => {
            pos.push({ x: 0, y: i * (chipH + gap), w: innerW, label });
        });
    } else {
        ctx.font = `600 ${chipFs}px ${FONT}`;
        let cx = 0;
        let cy = 0;
        const rows: number[][] = [[]];
        branch.chips.forEach((label, i) => {
            const cw = Math.ceil(ctx.measureText(label).width) + 20;
            if (cx > 0 && cx + cw > innerW) {
                cx = 0;
                cy += chipH + gap;
                rows.push([]);
            }
            pos.push({ x: cx, y: cy, w: cw, label });
            rows[rows.length - 1]!.push(i);
            cx += cw + 7;
        });
        // 줄 단위로 가운데 정렬
        for (const row of rows) {
            if (row.length === 0) continue;
            const last = pos[row[row.length - 1]!]!;
            const used = last.x + last.w;
            const shift = (innerW - used) / 2;
            for (const i of row) pos[i]!.x += shift;
        }
    }
    const chipsH = pos.length > 0 ? pos[pos.length - 1]!.y + chipH : 0;
    const boxH = pad + titleFs + 10 + chipsH + pad;

    if (render) {
        drawBox(ctx, x, y, boxW, boxH, 8, branch.bg, branch.color, 1.5);
        ctx.font = `700 ${titleFs}px ${FONT}`;
        ctx.fillStyle = branch.color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(branch.title, x + boxW / 2, y + pad + titleFs / 2);

        const chipTop = y + pad + titleFs + 10;
        for (const p of pos) {
            drawBox(
                ctx,
                x + pad + p.x,
                chipTop + p.y,
                p.w,
                chipH,
                5,
                "#fff",
                branch.color,
                1.2,
            );
            const fs = fitFontSize(ctx, p.label, chipFs, p.w - 10, "600");
            ctx.font = `600 ${fs}px ${FONT}`;
            ctx.fillStyle = "#495057";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(
                p.label,
                x + pad + p.x + p.w / 2,
                chipTop + p.y + chipH / 2 + 0.5,
            );
        }
    }
    return boxH;
}

// 데스크톱: 루트 + 옆의 정체성 박스, 아래로 3열 분기
function drawDesktop(
    ctx: SvgDrawingContext,
    w: number,
    render: boolean,
): number {
    const s = w / BASE_W;
    const root = rootSize(ctx, s);
    const idn = identitySize(ctx, s);

    // 정체성 박스가 루트보다 높으면 루트를 살짝 내려서 세로 중앙을 맞춘다
    const rootY = PAD + Math.max(0, (idn.h - root.h) / 2);
    const rootX = w / 2 - root.w / 2;
    const idGap = Math.max(36 * s, 24);
    const idX = Math.min(rootX + root.w + idGap, w - PAD - idn.w);
    const idY = rootY + root.h / 2 - idn.h / 2;

    const linkH = Math.max(44 * s, 34);
    const colGap = Math.max(16 * s, 12);
    const colW = (w - PAD * 2 - colGap * 2) / 3;
    const colY = rootY + root.h + linkH;

    const heights = BRANCHES.map((b, i) =>
        drawBranchBox(
            ctx,
            PAD + i * (colW + colGap),
            colY,
            colW,
            b,
            s,
            "stack",
            false,
        ),
    );

    if (render) {
        // 루트 → 각 열 연결선 (베지어)
        const fromX = w / 2;
        const fromY = rootY + root.h;
        ctx.strokeStyle = LINE;
        ctx.lineWidth = 1.5;
        BRANCHES.forEach((_, i) => {
            const toX = PAD + i * (colW + colGap) + colW / 2;
            ctx.beginPath();
            ctx.moveTo(fromX, fromY);
            ctx.bezierCurveTo(
                fromX,
                fromY + linkH * 0.55,
                toX,
                colY - linkH * 0.55,
                toX,
                colY,
            );
            ctx.stroke();
        });

        // 루트 → 정체성 점선 연결
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(rootX + root.w, rootY + root.h / 2);
        ctx.lineTo(idX, rootY + root.h / 2);
        ctx.stroke();
        ctx.setLineDash([]);

        drawRoot(ctx, rootX, rootY, s);
        drawIdentity(ctx, idX, idY, s);
        BRANCHES.forEach((b, i) => {
            drawBranchBox(
                ctx,
                PAD + i * (colW + colGap),
                colY,
                colW,
                b,
                s,
                "stack",
                true,
            );
        });
    }

    return colY + Math.max(...heights) + PAD;
}

// 모바일: 루트 → 정체성 → 세 갈래 박스를 세로로 쌓는다
function drawMobile(
    ctx: SvgDrawingContext,
    w: number,
    render: boolean,
): number {
    const s = w / BASE_W;
    const boxW = w - PAD * 2;
    const cx = w / 2;
    const seg = 22;

    const root = rootSize(ctx, s);
    const idn = identitySize(ctx, s);

    let y = PAD;
    if (render) drawRoot(ctx, cx - root.w / 2, y, s);
    y += root.h;

    // 루트 → 정체성: 점선 세로 연결
    if (render) {
        ctx.strokeStyle = LINE;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(cx, y);
        ctx.lineTo(cx, y + seg);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    y += seg;

    if (render) drawIdentity(ctx, cx - idn.w / 2, y, s);
    y += idn.h;

    for (const branch of BRANCHES) {
        if (render) {
            ctx.strokeStyle = LINE;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(cx, y);
            ctx.lineTo(cx, y + seg);
            ctx.stroke();
        }
        y += seg;
        const h = drawBranchBox(ctx, PAD, y, boxW, branch, s, "flow", render);
        y += h;
    }

    return y + PAD;
}

// 전체를 그리고(또는 높이만 계산하고) 캔버스 높이를 반환한다
function drawAll(ctx: SvgDrawingContext, w: number, render: boolean): number {
    return w < 480 ? drawMobile(ctx, w, render) : drawDesktop(ctx, w, render);
}

export const ComponentAnatomyDiagram = ({ caption }: Props) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<SvgCanvasHandle>(null);

    useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const draw = () => {
            const w = container.clientWidth;
            if (w <= 0) return;
            const dpr = window.devicePixelRatio || 1;

            const h = drawAll(ctx, w, false);
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.scale(dpr, dpr);
            drawAll(ctx, w, true);
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
