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
    text: "#495057",
    textLight: "#868e96",
    track: "#f1f3f5",
    none: "#adb5bd",
    prose: "#fab005",
    skill: "#228be6",
};

const MAX = 25;

const DATA = [
    {
        name: "맨몸",
        desc: "(스킬 없이 과제만)",
        value: 0,
        color: COLORS.none,
        best: false,
    },
    {
        name: "산문",
        desc: "(한 문단 지시)",
        value: 24,
        color: COLORS.prose,
        best: false,
    },
    { name: "스킬 v1", desc: "", value: 24, color: COLORS.skill, best: false },
    {
        name: "스킬 v2",
        desc: "(사다리 3번 명확화)",
        value: 25,
        color: COLORS.skill,
        best: true,
    },
];

interface Props {
    caption?: string;
}

function drawBar(
    ctx: SvgDrawingContext,
    x: number,
    y: number,
    trackW: number,
    barH: number,
    value: number,
    color: string,
    r: number,
) {
    // 트랙
    ctx.beginPath();
    ctx.roundRect(x, y, trackW, barH, r);
    ctx.fillStyle = COLORS.track;
    ctx.fill();

    // 채워진 막대
    if (value > 0) {
        const barW = trackW * (value / MAX);
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, Math.min(r, barW / 2));
        ctx.fillStyle = color;
        ctx.fill();
    }
}

function drawValueLabel(
    ctx: SvgDrawingContext,
    x: number,
    cy: number,
    d: (typeof DATA)[number],
    valueFs: number,
    smallFs: number,
) {
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const label = `${d.value}/${MAX}`;
    if (d.best) {
        ctx.font = `700 ${valueFs}px ${FONT}`;
        ctx.fillStyle = COLORS.skill;
        ctx.fillText(label, x, cy);
        const tw = ctx.measureText(label).width;
        ctx.font = `600 ${smallFs}px ${FONT}`;
        ctx.fillText("만점", x + tw + 5, cy);
    } else {
        ctx.font = `600 ${valueFs}px ${FONT}`;
        ctx.fillStyle = COLORS.text;
        ctx.fillText(label, x, cy);
    }
}

// Horizontal layout (desktop): 왼쪽 조건 이름 | 트랙 | 값 라벨
function drawHorizontal(ctx: SvgDrawingContext, w: number): number {
    const s = w / 640;
    const titleFs = Math.max(12 * s, 10);
    const nameFs = Math.max(11 * s, 10);
    const smallFs = Math.max(9 * s, 8);
    const valueFs = Math.max(11 * s, 10);

    const labelW = 150 * s;
    const gap = 12 * s;
    const valueW = 78 * s;
    const trackX = labelW + gap;
    const trackW = w - trackX - valueW;
    const barH = 20 * s;
    const rowH = 44 * s;

    // 제목
    let y = 14 * s;
    ctx.font = `600 ${titleFs}px ${FONT}`;
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`5개 검사 항목 전항목 통과 (${MAX}회 중)`, 0, y);

    y += 24 * s;

    DATA.forEach((d) => {
        const cy = y + barH / 2;

        // 조건 이름 (이름 + 괄호 설명 2줄)
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        if (d.desc) {
            ctx.font = `600 ${nameFs}px ${FONT}`;
            ctx.fillStyle = COLORS.text;
            ctx.fillText(d.name, labelW, cy - 7 * s);
            ctx.font = `${smallFs}px ${FONT}`;
            ctx.fillStyle = COLORS.textLight;
            ctx.fillText(d.desc, labelW, cy + 8 * s);
        } else {
            ctx.font = `600 ${nameFs}px ${FONT}`;
            ctx.fillStyle = COLORS.text;
            ctx.fillText(d.name, labelW, cy);
        }

        drawBar(ctx, trackX, y, trackW, barH, d.value, d.color, 4 * s);

        if (d.value === 0) {
            // 값 0: 트랙 왼쪽 안에 라벨
            ctx.font = `600 ${valueFs}px ${FONT}`;
            ctx.fillStyle = COLORS.textLight;
            ctx.textAlign = "left";
            ctx.fillText(`0/${MAX}`, trackX + 8 * s, cy);
        } else {
            drawValueLabel(
                ctx,
                trackX + trackW + 8 * s,
                cy,
                d,
                valueFs,
                smallFs,
            );
        }

        y += rowH;
    });

    return y - rowH + barH + 12 * s;
}

// Vertical layout (mobile): 조건 이름을 막대 위에 배치
function drawVertical(ctx: SvgDrawingContext, w: number): number {
    const s = Math.max(w / 480, 0.7);
    const titleFs = Math.max(12 * s, 10);
    const nameFs = Math.max(11 * s, 10);
    const smallFs = Math.max(9 * s, 8);
    const valueFs = Math.max(11 * s, 10);

    const barH = 18;
    const trackW = w;

    // 제목
    let y = 10;
    ctx.font = `600 ${titleFs}px ${FONT}`;
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`5개 검사 항목 전항목 통과 (${MAX}회 중)`, 0, y);

    y += 24;

    DATA.forEach((d) => {
        // 이름(왼쪽) + 값 라벨(오른쪽)을 막대 위 한 줄에
        const lineCy = y + nameFs / 2;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.font = `600 ${nameFs}px ${FONT}`;
        ctx.fillStyle = COLORS.text;
        ctx.fillText(d.name, 0, lineCy);
        if (d.desc) {
            const nw = ctx.measureText(d.name).width;
            ctx.font = `${smallFs}px ${FONT}`;
            ctx.fillStyle = COLORS.textLight;
            ctx.fillText(d.desc, nw + 5, lineCy);
        }

        // 값 라벨 (오른쪽 정렬)
        const label = `${d.value}/${MAX}`;
        if (d.best) {
            ctx.font = `600 ${smallFs}px ${FONT}`;
            const bw = ctx.measureText("만점").width;
            ctx.fillStyle = COLORS.skill;
            ctx.textAlign = "right";
            ctx.fillText("만점", w, lineCy);
            ctx.font = `700 ${valueFs}px ${FONT}`;
            ctx.fillText(label, w - bw - 5, lineCy);
        } else {
            ctx.font = `600 ${valueFs}px ${FONT}`;
            ctx.fillStyle = d.value === 0 ? COLORS.textLight : COLORS.text;
            ctx.textAlign = "right";
            ctx.fillText(label, w, lineCy);
        }

        y += nameFs + 7;
        drawBar(ctx, 0, y, trackW, barH, d.value, d.color, 4);
        y += barH + 16;
    });

    return y - 4;
}

export const ThreeArmChart = ({ caption }: Props) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<SvgCanvasHandle>(null);

    useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;

        const render = () => {
            const w = container.clientWidth;
            const dpr = window.devicePixelRatio || 1;
            const isMobile = w < 480;
            const ctx = canvas.getContext("2d")!;

            // 1차 그리기로 높이 측정
            canvas.width = 1;
            canvas.height = 1;
            const h = isMobile ? drawVertical(ctx, w) : drawHorizontal(ctx, w);

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
