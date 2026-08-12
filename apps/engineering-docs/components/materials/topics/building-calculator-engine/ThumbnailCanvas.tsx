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

const SANS = "-apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

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

// 하이라이트 조각: 계산 노트의 색이 입혀진 텍스트 스팬
type Span = { t: string; c: string };

// 한 줄 = 왼쪽 입력 스팬들 + 오른쪽 결과
type Line = { spans: Span[]; result: string };

const COL_INK = "#343a40"; // 연산자
const COL_NUM = "#1971c2"; // 숫자
const COL_UNIT = "#7048e8"; // 단위·of·%
const COL_VAR = "#2b8a3e"; // 변수·ans
const COL_MUTE = "#adb5bd"; // 무시된 단어
const COL_RES = "#1971c2"; // 결과

const LINES: Line[] = [
    {
        spans: [
            { t: "점심 ", c: COL_MUTE },
            { t: "8,000", c: COL_NUM },
            { t: "원", c: COL_MUTE },
            { t: " + ", c: COL_INK },
            { t: "커피 ", c: COL_MUTE },
            { t: "4,500", c: COL_NUM },
            { t: "원", c: COL_MUTE },
        ],
        result: "12,500",
    },
    {
        spans: [
            { t: "하루지출", c: COL_VAR },
            { t: " = ", c: COL_INK },
            { t: "ans", c: COL_VAR },
        ],
        result: "12,500",
    },
    {
        spans: [
            { t: "하루지출", c: COL_VAR },
            { t: " * ", c: COL_INK },
            { t: "30", c: COL_NUM },
            { t: "일", c: COL_MUTE },
        ],
        result: "375,000",
    },
    {
        spans: [
            { t: "20", c: COL_NUM },
            { t: "%", c: COL_UNIT },
            { t: " of ", c: COL_UNIT },
            { t: "80", c: COL_NUM },
        ],
        result: "16",
    },
    {
        spans: [
            { t: "숙소까지 ", c: COL_MUTE },
            { t: "3", c: COL_NUM },
            { t: "km", c: COL_UNIT },
            { t: " + ", c: COL_INK },
            { t: "200", c: COL_NUM },
            { t: "m", c: COL_UNIT },
        ],
        result: "3.2 km",
    },
    {
        spans: [
            { t: "90", c: COL_NUM },
            { t: "km", c: COL_UNIT },
            { t: " / ", c: COL_INK },
            { t: "2", c: COL_NUM },
            { t: "h", c: COL_UNIT },
        ],
        result: "12.5 m/s",
    },
];

function draw(ctx: SvgDrawingContext) {
    // 배경: 라이트 그라데이션 (책상 위 느낌)
    const bg = ctx.createLinearGradient(0, 0, W * 0.5, H);
    bg.addColorStop(0, "#eef1f6");
    bg.addColorStop(1, "#dde3ec");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // ── macOS 창 (캔버스 중앙) ────────────────────────────
    const winW = 1300,
        winH = 620;
    const winX = (W - winW) / 2,
        winY = (H - winH) / 2;
    const barH = 62;

    // 창 그림자 + 본체
    ctx.save();
    ctx.shadowColor = "rgba(30,50,80,0.22)";
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 30;
    rr(ctx, winX, winY, winW, winH, 22, "#ffffff");
    ctx.restore();

    // 타이틀바
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(winX, winY, winW, winH, 22);
    ctx.clip();
    ctx.fillStyle = "#f2f3f5";
    ctx.fillRect(winX, winY, winW, barH);
    ctx.strokeStyle = "#e3e6ea";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(winX, winY + barH);
    ctx.lineTo(winX + winW, winY + barH);
    ctx.stroke();
    ctx.restore();

    // 신호등 버튼
    const dotY = winY + barH / 2;
    const dots = ["#ff5f57", "#febc2e", "#28c840"];
    dots.forEach((c, i) => {
        ctx.beginPath();
        ctx.arc(winX + 40 + i * 34, dotY, 11, 0, Math.PI * 2);
        ctx.fillStyle = c;
        ctx.fill();
    });

    // 창 제목
    ctx.fillStyle = "#868e96";
    ctx.font = `600 27px ${SANS}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("계산 노트", winX + winW / 2, dotY + 1);

    // ── 계산 노트 본문 ───────────────────────────────────
    const noteX = winX + 56;
    const noteRight = winX + winW - 56;
    const firstY = winY + barH + 78;
    const lineGap = 78;

    ctx.textBaseline = "middle";

    LINES.forEach((line, i) => {
        const y = firstY + i * lineGap;

        // 왼쪽: 하이라이트된 입력 스팬
        ctx.textAlign = "left";
        ctx.font = `500 40px ${MONO}`;
        let x = noteX;
        for (const s of line.spans) {
            ctx.fillStyle = s.c;
            ctx.fillText(s.t, x, y);
            x += ctx.measureText(s.t).width;
        }

        // 오른쪽: 결과 (파랑 굵게)
        ctx.textAlign = "right";
        ctx.font = `700 40px ${MONO}`;
        ctx.fillStyle = COL_RES;
        ctx.fillText(line.result, noteRight, y);

        // 줄 구분선 (마지막 줄 제외)
        if (i < LINES.length - 1) {
            ctx.strokeStyle = "#f1f3f5";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(noteX, y + lineGap / 2);
            ctx.lineTo(noteRight, y + lineGap / 2);
            ctx.stroke();
        }
    });
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
                        fontFamily: SANS,
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
