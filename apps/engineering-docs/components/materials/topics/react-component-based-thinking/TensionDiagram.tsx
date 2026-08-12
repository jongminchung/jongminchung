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

const CHIP_LABEL = "훅 useAddToCart";
const CHIP_NOTE = "경계에 산다";
const OUTSIDE_LABEL = "컴포넌트 트리 밖";

interface Props {
    caption?: string;
}

interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

interface OutsideBoxSpec {
    title: string;
    sub: string;
    fill: string;
    stroke: string;
}

// 컴포넌트 트리 밖에 사는 것들
const OUTSIDE_BOXES: OutsideBoxSpec[] = [
    { title: "스토어", sub: "전역 상태", fill: "#f3f0ff", stroke: "#845ef7" },
    {
        title: "쿼리 캐시",
        sub: "서버 상태의 사본",
        fill: "#d3f9d8",
        stroke: "#40c057",
    },
    {
        title: "순수 함수",
        sub: "도메인 로직",
        fill: "#fff5f5",
        stroke: "#fa5252",
    },
];

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

interface TreeNode {
    label: string;
    rect: Rect;
    fs: number;
}

interface TreeLayout {
    nodes: TreeNode[];
    edges: [number, number][];
    height: number;
}

// 트리 노드 좌표 계산. (x, y)는 트리 영역의 좌상단, tw는 트리 영역 너비.
function layoutTree(
    ctx: SvgDrawingContext,
    x: number,
    y: number,
    tw: number,
    s: number,
): TreeLayout {
    const baseFs = Math.max(10.5 * s, 10);
    const nodeH = baseFs + 12;
    const levelGap = Math.max(26 * s, 22);

    const spec = [
        { label: "App", cx: 0.5, level: 0, cap: 0.4 },
        { label: "ProductPage", cx: 0.3, level: 1, cap: 0.52 },
        { label: "Header", cx: 0.76, level: 1, cap: 0.4 },
        { label: "AddToCartButton", cx: 0.3, level: 2, cap: 0.58 },
        { label: "CartBadge", cx: 0.76, level: 2, cap: 0.42 },
    ];
    const nodes: TreeNode[] = spec.map((n) => {
        const fs = fitFontSize(ctx, n.label, baseFs, tw * n.cap - 14, "600");
        ctx.font = `600 ${fs}px ${FONT}`;
        const w = Math.ceil(ctx.measureText(n.label).width) + 14;
        return {
            label: n.label,
            fs,
            rect: {
                x: x + tw * n.cx - w / 2,
                y: y + n.level * (nodeH + levelGap),
                w,
                h: nodeH,
            },
        };
    });
    // [부모, 자식] 인덱스 쌍
    const edges: [number, number][] = [
        [0, 1],
        [0, 2],
        [1, 3],
        [2, 4],
    ];
    return { nodes, edges, height: nodeH * 3 + levelGap * 2 };
}

function drawTreeNode(ctx: SvgDrawingContext, node: TreeNode) {
    drawBox(
        ctx,
        node.rect.x,
        node.rect.y,
        node.rect.w,
        node.rect.h,
        6,
        "#e7f5ff",
        "#228be6",
        1.3,
    );
    ctx.font = `600 ${node.fs}px ${FONT}`;
    ctx.fillStyle = "#495057";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
        node.label,
        node.rect.x + node.rect.w / 2,
        node.rect.y + node.rect.h / 2 + 0.5,
    );
}

// 왼쪽(모바일에선 위쪽) "컴포넌트 세계" 패널. render=false면 높이·잎 노드 좌표만 계산한다.
function drawTreePanel(
    ctx: SvgDrawingContext,
    x: number,
    y: number,
    pw: number,
    s: number,
    render: boolean,
): { height: number; leaf: Rect } {
    const titleFs = Math.max(12.5 * s, 11.5);
    const padX = 12;
    const titleTop = 12;
    const treeTop = y + titleTop + titleFs + 14;

    const tree = layoutTree(ctx, x + padX, treeTop, pw - padX * 2, s);
    const height = titleTop + titleFs + 14 + tree.height + 16;
    // AddToCartButton 잎 노드 — 훅 칩과 이어진다
    const leaf = tree.nodes[3]!.rect;

    if (render) {
        drawBox(ctx, x, y, pw, height, 10, "#f8f9fa", "#dee2e6");
        ctx.font = `700 ${titleFs}px ${FONT}`;
        ctx.fillStyle = "#495057";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("컴포넌트 세계", x + pw / 2, y + titleTop + titleFs / 2);

        // 부모 → 자식 연결선
        ctx.strokeStyle = "#adb5bd";
        ctx.lineWidth = 1.1;
        for (const [p, c] of tree.edges) {
            const pr = tree.nodes[p]!.rect;
            const cr = tree.nodes[c]!.rect;
            ctx.beginPath();
            ctx.moveTo(pr.x + pr.w / 2, pr.y + pr.h);
            ctx.lineTo(cr.x + cr.w / 2, cr.y);
            ctx.stroke();
        }
        for (const node of tree.nodes) drawTreeNode(ctx, node);
    }
    return { height, leaf };
}

// 경계에 걸친 훅 칩. render=false면 좌표만 계산한다.
function drawHookChip(
    ctx: SvgDrawingContext,
    cx: number,
    cy: number,
    s: number,
    render: boolean,
): Rect {
    const fs = Math.max(11 * s, 10);
    ctx.font = `700 ${fs}px ${FONT}`;
    const w = Math.ceil(ctx.measureText(CHIP_LABEL).width) + 24;
    const h = fs + 16;
    const rect: Rect = { x: cx - w / 2, y: cy - h / 2, w, h };
    if (render) {
        drawBox(ctx, rect.x, rect.y, w, h, h / 2, "#fff9db", "#fab005");
        ctx.font = `700 ${fs}px ${FONT}`;
        ctx.fillStyle = "#495057";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(CHIP_LABEL, cx, cy + 0.5);
    }
    return rect;
}

function drawOutsideBox(
    ctx: SvgDrawingContext,
    box: OutsideBoxSpec,
    rect: Rect,
    titleFs: number,
    subFs: number,
) {
    drawBox(ctx, rect.x, rect.y, rect.w, rect.h, 8, box.fill, box.stroke, 1.4);
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const tf = fitFontSize(ctx, box.title, titleFs, rect.w - 12, "700");
    ctx.font = `700 ${tf}px ${FONT}`;
    ctx.fillStyle = "#495057";
    ctx.fillText(box.title, cx, cy - subFs / 2 - 3);
    const sf = fitFontSize(ctx, box.sub, subFs, rect.w - 12);
    ctx.font = `${sf}px ${FONT}`;
    ctx.fillStyle = "#868e96";
    ctx.fillText(box.sub, cx, cy + tf / 2 + 3);
}

function dashedLine(
    ctx: SvgDrawingContext,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

// 데스크톱: 왼쪽 패널 | 세로 점선 경계(칩) | 오른쪽 바깥 박스 열
function drawDesktop(
    ctx: SvgDrawingContext,
    w: number,
    render: boolean,
): number {
    const s = w / BASE_W;
    const innerW = w - PAD * 2;

    // 칩 너비를 먼저 재서 경계 주변 여백을 정한다.
    // 칩은 왼쪽 패널에 10px 물리고, 오른쪽 박스 열과는 14px 떨어져 선으로 이어진다.
    const chipProbe = drawHookChip(ctx, 0, 0, s, false);
    const gapLeft = chipProbe.w / 2 - 10;
    const gapRight = chipProbe.w / 2 + 14;
    const usable = innerW - gapLeft - gapRight;
    const leftW = usable * 0.62;
    const rightW = usable * 0.38;
    const boundaryX = PAD + leftW + gapLeft;
    const rightX = boundaryX + gapRight;

    // 높이 선계산
    const panelH = drawTreePanel(ctx, PAD, 0, leftW, s, false).height;

    const boxTitleFs = Math.max(12 * s, 11);
    const boxSubFs = Math.max(10 * s, 10);
    const labelFs = Math.max(10 * s, 10);
    const boxH = boxTitleFs + boxSubFs + 26;
    const boxGap = Math.max(14 * s, 12);
    const labelH = labelFs + 10;
    const rightH = labelH + boxH * 3 + boxGap * 2;

    const maxH = Math.max(panelH, rightH);
    const H = PAD * 2 + maxH;
    if (!render) return H;

    const panelY = PAD + (maxH - panelH) / 2;
    const rightY = PAD + (maxH - rightH) / 2;

    // 세로 점선 경계
    ctx.strokeStyle = "#adb5bd";
    ctx.lineWidth = 1.3;
    ctx.setLineDash([5, 5]);
    dashedLine(ctx, boundaryX, PAD, boundaryX, H - PAD);
    ctx.setLineDash([]);

    // 왼쪽: 컴포넌트 세계
    const { leaf } = drawTreePanel(ctx, PAD, panelY, leftW, s, true);

    // 오른쪽 상단 라벨
    ctx.font = `600 ${labelFs}px ${FONT}`;
    ctx.fillStyle = "#adb5bd";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(OUTSIDE_LABEL, rightX + rightW, rightY + labelFs / 2);

    const boxRects: Rect[] = OUTSIDE_BOXES.map((_, i) => ({
        x: rightX,
        y: rightY + labelH + i * (boxH + boxGap),
        w: rightW,
        h: boxH,
    }));
    const queryRect = boxRects[1]!;
    const pureRect = boxRects[2]!;

    // 칩은 쿼리 캐시와 같은 높이에 둔다
    const chipCY = queryRect.y + queryRect.h / 2;
    const chip = drawHookChip(ctx, boundaryX, chipCY, s, false);

    // 연결선: 잎 노드 ↔ 훅 칩 ↔ 쿼리 캐시 (은은한 회색 실선)
    // 잎의 오른쪽 위 모서리에서 출발해 트리 행 사이 틈을 지나 칩으로 이어진다
    ctx.strokeStyle = "#ced4da";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(leaf.x + leaf.w, leaf.y + 3);
    ctx.lineTo(chip.x + 4, chipCY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(chip.x + chip.w, chipCY);
    ctx.lineTo(queryRect.x, chipCY);
    ctx.stroke();

    // 순수 함수 → 훅·컴포넌트 쪽 얇은 점선 (어디서든 부를 수 있다)
    ctx.strokeStyle = "#ced4da";
    ctx.lineWidth = 1.1;
    ctx.setLineDash([3, 4]);
    const pfX = pureRect.x;
    const pfY = pureRect.y + pureRect.h / 2;
    dashedLine(ctx, pfX, pfY, chip.x + chip.w * 0.8, chip.y + chip.h);
    dashedLine(ctx, pfX, pfY, PAD + leftW, panelY + panelH * 0.72);
    ctx.setLineDash([]);

    // 바깥 박스 3개
    OUTSIDE_BOXES.forEach((box, i) =>
        drawOutsideBox(ctx, box, boxRects[i]!, boxTitleFs, boxSubFs),
    );

    // 훅 칩 + 설명
    drawHookChip(ctx, boundaryX, chipCY, s, true);
    const noteFs = Math.max(10 * s, 10);
    ctx.font = `${noteFs}px ${FONT}`;
    ctx.fillStyle = "#868e96";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(CHIP_NOTE, boundaryX, chip.y + chip.h + 8 + noteFs / 2);

    return H;
}

// 모바일: 위 패널 → 가로 점선 경계 + 칩 → 바깥 박스 3개 세로 나열
function drawMobile(
    ctx: SvgDrawingContext,
    w: number,
    render: boolean,
): number {
    const s = w / BASE_W;
    const pw = w - PAD * 2;
    const gap1 = 20;
    const gap2 = 20;
    const boxGap = 10;

    const panelH = drawTreePanel(ctx, PAD, PAD, pw, s, false).height;
    const chipProbe = drawHookChip(ctx, 0, 0, s, false);

    const boxTitleFs = Math.max(12 * s, 11);
    const boxSubFs = Math.max(10 * s, 10);
    const labelFs = Math.max(10 * s, 10);
    const boxH = boxTitleFs + boxSubFs + 26;
    const labelH = labelFs + 8;

    const chipCY = PAD + panelH + gap1 + chipProbe.h / 2;
    const boxesTop = chipCY + chipProbe.h / 2 + gap2 + labelH;
    const H = boxesTop + boxH * 3 + boxGap * 2 + PAD;
    if (!render) return H;

    // 가로 점선 경계
    ctx.strokeStyle = "#adb5bd";
    ctx.lineWidth = 1.3;
    ctx.setLineDash([5, 5]);
    dashedLine(ctx, PAD, chipCY, w - PAD, chipCY);
    ctx.setLineDash([]);

    // 위: 컴포넌트 세계
    const { leaf } = drawTreePanel(ctx, PAD, PAD, pw, s, true);

    // 연결선: 잎 노드 → 칩, 칩 → 바깥 박스 열
    const chip = drawHookChip(ctx, w / 2, chipCY, s, false);
    ctx.strokeStyle = "#ced4da";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(leaf.x + leaf.w / 2, leaf.y + leaf.h);
    ctx.lineTo(w / 2, chip.y + 2);
    ctx.stroke();
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1.1;
    dashedLine(ctx, w / 2, chip.y + chip.h, w / 2, boxesTop);
    ctx.setLineDash([]);

    // 훅 칩 + 오른쪽 설명 (점선과 겹치지 않게 경계선 살짝 아래에 둔다)
    drawHookChip(ctx, w / 2, chipCY, s, true);
    const noteMaxW = w - PAD - (chip.x + chip.w + 10);
    const noteFs = fitFontSize(ctx, CHIP_NOTE, Math.max(10 * s, 10), noteMaxW);
    ctx.font = `${noteFs}px ${FONT}`;
    ctx.fillStyle = "#868e96";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(CHIP_NOTE, chip.x + chip.w + 10, chipCY + 5 + noteFs / 2);

    // 아래: 라벨 + 바깥 박스 3개
    ctx.font = `600 ${labelFs}px ${FONT}`;
    ctx.fillStyle = "#adb5bd";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(OUTSIDE_LABEL, w - PAD, boxesTop - labelH + labelFs / 2);

    OUTSIDE_BOXES.forEach((box, i) => {
        const rect: Rect = {
            x: PAD,
            y: boxesTop + i * (boxH + boxGap),
            w: pw,
            h: boxH,
        };
        drawOutsideBox(ctx, box, rect, boxTitleFs, boxSubFs);
    });

    return H;
}

// 전체를 그리고(또는 높이만 계산하고) 캔버스 높이를 반환한다
function drawAll(ctx: SvgDrawingContext, w: number, render: boolean): number {
    return w < 480 ? drawMobile(ctx, w, render) : drawDesktop(ctx, w, render);
}

export const TensionDiagram = ({ caption }: Props) => {
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
