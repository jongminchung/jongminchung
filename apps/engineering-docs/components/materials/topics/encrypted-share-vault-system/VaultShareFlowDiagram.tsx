"use client";

import { useEffect, useRef } from "react";
import {
    SvgCanvas,
    type SvgCanvasHandle,
    type SvgDrawingContext,
} from "#components/materials/runtime/svg-canvas";

const FONT =
    "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

const COLORS = {
    alice: "#228be6",
    aliceBg: "#e7f5ff",
    bob: "#40c057",
    bobBg: "#ebfbee",
    server: "#868e96",
    serverBg: "#f1f3f5",
    vault: "#f59f00",
    text: "#495057",
    textLight: "#868e96",
    border: "#dee2e6",
    num: "#343a40",
    numBg: "#f1f3f5",
};

interface Props {
    caption?: string;
}

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

function drawArrow(
    ctx: SvgDrawingContext,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    s: number,
    dashed = false,
) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.setLineDash(dashed ? [4 * s, 3 * s] : []);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);

    const angle = Math.atan2(y2 - y1, x2 - x1);
    const size = 6 * s;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
        x2 - size * Math.cos(angle - 0.4),
        y2 - size * Math.sin(angle - 0.4),
    );
    ctx.lineTo(
        x2 - size * Math.cos(angle + 0.4),
        y2 - size * Math.sin(angle + 0.4),
    );
    ctx.closePath();
    ctx.fill();
}

function drawNumCircle(
    ctx: SvgDrawingContext,
    cx: number,
    cy: number,
    num: number,
    s: number,
    color: string,
) {
    const r = 9 * s;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `700 ${Math.max(9 * s, 8)}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(num), cx, cy + 0.5);
}

function draw(ctx: SvgDrawingContext, w: number): number {
    const s = w / 700;

    const titleFs = Math.max(13 * s, 11);
    const smallFs = Math.max(9.5 * s, 9);

    // 액터 배치
    const actorW = 110 * s;
    const actorH = 40 * s;
    const aliceCx = 80 * s;
    const serverCx = w / 2;
    const bobCx = w - 80 * s;
    const actorY = 10 * s;

    // 행 간격
    const rowH = 44 * s;
    const lifeTop = actorY + actorH + 4 * s;
    const startY = lifeTop + 24 * s;
    const rowCount = 7;
    const lifeBottom = startY + rowH * (rowCount - 1) + 24 * s;
    const h = lifeBottom + 12 * s;

    // 라이프라인 (점선)
    ctx.strokeStyle = COLORS.border;
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    [aliceCx, serverCx, bobCx].forEach((cx) => {
        ctx.beginPath();
        ctx.moveTo(cx, lifeTop);
        ctx.lineTo(cx, lifeBottom);
        ctx.stroke();
    });
    ctx.setLineDash([]);

    // 액터 박스
    drawRoundRect(
        ctx,
        aliceCx - actorW / 2,
        actorY,
        actorW,
        actorH,
        6 * s,
        COLORS.aliceBg,
        COLORS.alice,
    );
    ctx.fillStyle = COLORS.alice;
    ctx.font = `700 ${titleFs}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Alice", aliceCx, actorY + actorH / 2);

    drawRoundRect(
        ctx,
        serverCx - actorW / 2,
        actorY,
        actorW,
        actorH,
        6 * s,
        COLORS.serverBg,
        COLORS.server,
    );
    ctx.fillStyle = COLORS.server;
    ctx.font = `700 ${titleFs}px ${FONT}`;
    ctx.fillText("서버", serverCx, actorY + actorH / 2);

    drawRoundRect(
        ctx,
        bobCx - actorW / 2,
        actorY,
        actorW,
        actorH,
        6 * s,
        COLORS.bobBg,
        COLORS.bob,
    );
    ctx.fillStyle = COLORS.bob;
    ctx.font = `700 ${titleFs}px ${FONT}`;
    ctx.fillText("Bob", bobCx, actorY + actorH / 2);

    // ── 시퀀스 메시지들 ──

    // ① Alice → Server: 공개 키 등록
    let y = startY;
    drawNumCircle(ctx, aliceCx - 14 * s, y, 1, s, COLORS.alice);
    drawArrow(ctx, aliceCx, y, serverCx, y, COLORS.alice, s);
    ctx.fillStyle = COLORS.alice;
    ctx.font = `${smallFs}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("공개 키 등록", (aliceCx + serverCx) / 2, y - 10 * s);

    // ② Bob → Server: 공개 키 등록
    y = startY + rowH;
    drawNumCircle(ctx, bobCx + 14 * s, y, 2, s, COLORS.bob);
    drawArrow(ctx, bobCx, y, serverCx, y, COLORS.bob, s);
    ctx.fillStyle = COLORS.bob;
    ctx.font = `${smallFs}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("공개 키 등록", (bobCx + serverCx) / 2, y - 10 * s);

    // ③ Alice: 금고 생성 + Vault Key 생성 (self-arrow)
    y = startY + rowH * 2;
    drawNumCircle(ctx, aliceCx - 14 * s, y + 8 * s, 3, s, COLORS.vault);
    const loopW = 30 * s;
    ctx.strokeStyle = COLORS.vault;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(aliceCx, y);
    ctx.lineTo(aliceCx + loopW, y);
    ctx.lineTo(aliceCx + loopW, y + 16 * s);
    ctx.lineTo(aliceCx + 6 * s, y + 16 * s);
    ctx.stroke();
    ctx.fillStyle = COLORS.vault;
    ctx.beginPath();
    ctx.moveTo(aliceCx + 6 * s, y + 16 * s);
    ctx.lineTo(aliceCx + 12 * s, y + 12 * s);
    ctx.lineTo(aliceCx + 12 * s, y + 20 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLORS.vault;
    ctx.font = `${smallFs}px ${FONT}`;
    ctx.textAlign = "left";
    ctx.fillText(
        "금고 생성 + Vault Key 생성",
        aliceCx + loopW + 8 * s,
        y + 5 * s,
    );

    // ④ Alice → Server: E(Alice PK, VK) 저장
    y = startY + rowH * 3;
    drawNumCircle(ctx, aliceCx - 14 * s, y, 4, s, COLORS.vault);
    drawArrow(ctx, aliceCx, y, serverCx, y, COLORS.vault, s);
    ctx.fillStyle = COLORS.vault;
    ctx.font = `${smallFs}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("E(Alice PK, VK) 저장", (aliceCx + serverCx) / 2, y - 10 * s);

    // ⑤ Alice → Server: E(Bob PK, VK) 저장 (공유)
    y = startY + rowH * 4;
    drawNumCircle(ctx, aliceCx - 14 * s, y, 5, s, COLORS.vault);
    drawArrow(ctx, aliceCx, y, serverCx, y, COLORS.vault, s);
    ctx.fillStyle = COLORS.vault;
    ctx.font = `${smallFs}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(
        "E(Bob PK, VK) 저장 (공유)",
        (aliceCx + serverCx) / 2,
        y - 10 * s,
    );

    // ⑥ Server → Bob: E(Bob PK, VK) 전달
    y = startY + rowH * 5;
    drawNumCircle(ctx, serverCx - 14 * s, y, 6, s, COLORS.server);
    drawArrow(ctx, serverCx, y, bobCx, y, COLORS.server, s, true);
    ctx.fillStyle = COLORS.server;
    ctx.font = `${smallFs}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("E(Bob PK, VK) 전달", (serverCx + bobCx) / 2, y - 10 * s);

    // ⑦ Bob: 개인 키로 VK 복호화 (self-arrow)
    y = startY + rowH * 6;
    drawNumCircle(ctx, bobCx + 14 * s, y + 8 * s, 7, s, COLORS.bob);
    ctx.strokeStyle = COLORS.bob;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(bobCx, y);
    ctx.lineTo(bobCx - loopW, y);
    ctx.lineTo(bobCx - loopW, y + 16 * s);
    ctx.lineTo(bobCx - 6 * s, y + 16 * s);
    ctx.stroke();
    ctx.fillStyle = COLORS.bob;
    ctx.beginPath();
    ctx.moveTo(bobCx - 6 * s, y + 16 * s);
    ctx.lineTo(bobCx - 12 * s, y + 12 * s);
    ctx.lineTo(bobCx - 12 * s, y + 20 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLORS.bob;
    ctx.font = `${smallFs}px ${FONT}`;
    ctx.textAlign = "right";
    ctx.fillText(
        "D(Bob SK, 암호문) → VK 획득",
        bobCx - loopW - 8 * s,
        y + 5 * s,
    );

    return h;
}

export const VaultShareFlowDiagram = ({ caption }: Props) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<SvgCanvasHandle>(null);

    useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;

        const render = () => {
            const w = container.clientWidth;
            const dpr = window.devicePixelRatio || 1;
            const ctx = canvas.getContext("2d")!;

            // 높이 측정
            canvas.width = 1;
            canvas.height = 1;
            const h = draw(ctx, w);

            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.scale(dpr, dpr);
            draw(ctx, w);
        };

        render();
        const observer = new ResizeObserver(render);
        observer.observe(container);
        return () => observer.disconnect();
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
