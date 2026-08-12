"use client";

import { useEffect, useRef } from "react";
import {
    SvgCanvas,
    type SvgCanvasHandle,
    type SvgDrawingContext,
} from "#components/materials/runtime/svg-canvas";

// 16:10 썸네일 (3200×2000 PNG로 다운로드). 발행 전 임시 컴포넌트.
const W = 1600;
const H = 1000;
const SCALE = 2;

function rr(
    ctx: SvgDrawingContext,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill?: string | null,
    stroke?: string | null,
    lw = 3,
) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
    }
    if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lw;
        ctx.stroke();
    }
}

function draw(ctx: SvgDrawingContext) {
    // 배경: 라이트 그라데이션
    const bg = ctx.createLinearGradient(0, 0, W * 0.4, H);
    bg.addColorStop(0, "#f4f7fa");
    bg.addColorStop(1, "#e7ebf1");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // 메인 리스트 카드
    const cardX = 300,
        cardY = 88,
        cardW = 1000,
        cardH = 640,
        pad = 36;
    ctx.save();
    ctx.shadowColor = "rgba(30,50,80,0.14)";
    ctx.shadowBlur = 46;
    ctx.shadowOffsetY = 18;
    rr(ctx, cardX, cardY, cardW, cardH, 26, "#ffffff");
    ctx.restore();

    // 카드 헤더
    rr(ctx, cardX + pad, cardY + 30, 56, 56, 28, "#dbeafe");
    rr(ctx, cardX + pad + 76, cardY + 42, 300, 32, 16, "#eef1f5");

    const rowX = cardX + pad;
    const rowW = cardW - pad * 2;
    const rowH = 54;
    const gap = 18;
    const firstRowY = cardY + 118;
    const rowY = (i: number) => firstRowY + i * (rowH + gap);

    // 새 글(노랑): 위에서 끼어드는 중
    const newY = rowY(0) - 26;
    rr(ctx, rowX, newY, rowW, rowH, 14, "#ffe8a3", "#f5b301", 4);
    ctx.beginPath();
    ctx.arc(rowX + 38, newY + rowH / 2, 14, 0, Math.PI * 2);
    ctx.fillStyle = "#f5b301";
    ctx.fill();
    rr(ctx, rowX + 70, newY + 19, 250, 16, 8, "#f8ce62");
    ctx.strokeStyle = "#f5b301";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(rowX + rowW * 0.5, cardY - 46);
    ctx.lineTo(rowX + rowW * 0.5, newY - 18);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(rowX + rowW * 0.5, newY - 6);
    ctx.lineTo(rowX + rowW * 0.5 - 14, newY - 26);
    ctx.lineTo(rowX + rowW * 0.5 + 14, newY - 26);
    ctx.closePath();
    ctx.fillStyle = "#f5b301";
    ctx.fill();

    // 일반 행 (스켈레톤)
    for (let i = 1; i <= 6; i++) {
        const y = rowY(i);
        rr(ctx, rowX, y, rowW, rowH, 14, "#f1f3f6");
        ctx.beginPath();
        ctx.arc(rowX + 38, y + rowH / 2, 14, 0, Math.PI * 2);
        ctx.fillStyle = "#dde2e9";
        ctx.fill();
        rr(ctx, rowX + 70, y + 19, 210 + (i % 3) * 60, 16, 8, "#e3e7ed");
    }

    // 페이지 창 (파랑, 행 2~4)
    const winY = rowY(2) - 12;
    const winH = rowH * 3 + gap * 2 + 24;
    rr(
        ctx,
        rowX - 14,
        winY,
        rowW + 28,
        winH,
        18,
        "rgba(34,139,230,0.09)",
        "#228be6",
        5,
    );
    for (let i = 2; i <= 4; i++) {
        const y = rowY(i);
        rr(ctx, rowX, y, rowW, rowH, 14, "#dcecfc");
        ctx.beginPath();
        ctx.arc(rowX + 38, y + rowH / 2, 14, 0, Math.PI * 2);
        ctx.fillStyle = "#a5cff5";
        ctx.fill();
        rr(ctx, rowX + 70, y + 19, 210 + (i % 3) * 60, 16, 8, "#bcd9f6");
    }

    // 중복 행 (빨강 빗금)
    const dupY = rowY(5);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(rowX, dupY, rowW, rowH, 14);
    ctx.clip();
    ctx.fillStyle = "#fca5a5";
    ctx.fillRect(rowX, dupY, rowW, rowH);
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 10;
    for (let sx = rowX - rowH; sx < rowX + rowW + rowH; sx += 34) {
        ctx.beginPath();
        ctx.moveTo(sx, dupY + rowH + 6);
        ctx.lineTo(sx + rowH + 6, dupY - 6);
        ctx.stroke();
    }
    ctx.restore();
    rr(ctx, rowX, dupY, rowW, rowH, 14, null, "#f0665f", 4);

    // 책갈피 리본 (초록, 카드 오른쪽 모서리에 걸침)
    const ribW = 74,
        ribX = cardX + cardW - 37,
        ribTop = cardY - 58;
    const ribBottom = winY + 6;
    ctx.save();
    ctx.shadowColor = "rgba(30,80,40,0.25)";
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 8;
    ctx.beginPath();
    ctx.moveTo(ribX, ribTop + 10);
    ctx.arcTo(ribX, ribTop, ribX + 10, ribTop, 10);
    ctx.lineTo(ribX + ribW - 10, ribTop);
    ctx.arcTo(ribX + ribW, ribTop, ribX + ribW, ribTop + 10, 10);
    ctx.lineTo(ribX + ribW, ribBottom);
    ctx.lineTo(ribX + ribW / 2, ribBottom - 26);
    ctx.lineTo(ribX, ribBottom);
    ctx.closePath();
    ctx.fillStyle = "#37b24d";
    ctx.fill();
    ctx.restore();

    // 페이지네이션 필 바
    const barY = 812,
        pillH = 92,
        pillR = 22;
    const pills: Array<{
        w: number;
        label: string;
        fill: string;
        color: string;
        stroke?: string;
    }> = [
        { w: 92, label: "‹", fill: "#ffffff", color: "#8b93a1" },
        { w: 92, label: "1", fill: "#ffffff", color: "#5c6470" },
        { w: 92, label: "2", fill: "#228be6", color: "#ffffff" },
        { w: 92, label: "3", fill: "#ffffff", color: "#5c6470" },
        { w: 92, label: "⋯", fill: "#ffffff", color: "#8b93a1" },
        {
            w: 260,
            label: "259,715",
            fill: "#fff0f0",
            color: "#e8590c",
            stroke: "#fa5252",
        },
        { w: 92, label: "›", fill: "#ffffff", color: "#8b93a1" },
    ];
    const totalW = pills.reduce((a, p) => a + p.w, 0) + (pills.length - 1) * 22;
    let px = (W - totalW) / 2;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const p of pills) {
        ctx.save();
        ctx.shadowColor = "rgba(30,50,80,0.10)";
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = 8;
        rr(ctx, px, barY, p.w, pillH, pillR, p.fill);
        ctx.restore();
        if (p.stroke) rr(ctx, px, barY, p.w, pillH, pillR, null, p.stroke, 4);
        ctx.fillStyle = p.color;
        ctx.font = "600 44px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText(p.label, px + p.w / 2, barY + pillH / 2 + 2);
        px += p.w + 22;
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
                        fontFamily:
                            "-apple-system, BlinkMacSystemFont, sans-serif",
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
