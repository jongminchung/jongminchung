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
const MONO = 'Menlo, Monaco, "Courier New", monospace';

function drawRoundRect(
    ctx: SvgDrawingContext,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill: string | null,
    stroke: string | null,
    lineWidth = 1.5,
) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
    }
    if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }
}

interface Row {
    id: number;
    role: string;
    isNull?: boolean;
}

const ROWS: Row[] = [
    { id: 1, role: "'admin'" },
    { id: 2, role: "'user'" },
    { id: 3, role: "NULL", isNull: true },
    { id: 4, role: "'guest'" },
];

function evalRow(row: Row): "true" | "false" | "NULL" {
    if (row.isNull) return "NULL";
    if (row.role === "'admin'") return "false";
    return "true";
}

const T_TABLE = 1.0;
const T_COMPARE = 3.0;
const T_FILTER = 4.5;
const T_HIGHLIGHT = 5.8;
const CYCLE = 9.0;

interface SceneArgs {
    ctx: SvgDrawingContext;
    w: number;
    t: number;
    scale: number;
}

function drawScene(args: SceneArgs): number {
    const { ctx, w, t, scale } = args;

    const codeFs = Math.max(11 * scale, 10);
    const labelFs = Math.max(11 * scale, 10);
    const smallFs = Math.max(10 * scale, 9);
    const rowFs = Math.max(11 * scale, 10);

    let cy = 0;

    // ── 쿼리 코드 ──
    const codeBg = "#1e1f24";
    const codeLineH = codeFs + 5;
    const codePadV = 12;
    const codeBoxH = codeLineH + codePadV * 2;
    drawRoundRect(ctx, 0, cy, w, codeBoxH, 8, codeBg, null);

    ctx.font = `${codeFs}px ${MONO}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const tokens: Array<[string, string]> = [
        ["SELECT", "#74c0fc"],
        [" * ", "#dcdcdc"],
        ["FROM", "#74c0fc"],
        [" users ", "#dcdcdc"],
        ["WHERE", "#74c0fc"],
        [" role != ", "#ff8787"],
        ["'admin'", "#ffe066"],
    ];
    let cx = 14;
    for (const [text, color] of tokens) {
        ctx.fillStyle = color;
        ctx.fillText(text, cx, cy + codePadV);
        cx += ctx.measureText(text).width;
    }
    cy += codeBoxH + 22;

    // ── 테이블 + 결과 영역 ──
    // 레이아웃: 좌측은 users 테이블, 우측은 비교 결과 박스
    const headerH = 28 * scale;
    const rowH = 34 * scale;

    // 테이블 너비 (왼쪽 절반)
    const gap = 16;
    const leftW = w * 0.42;
    const leftX = 0;
    const rightX = leftW + gap;

    // 테이블 라벨
    ctx.fillStyle = "#868e96";
    ctx.font = `500 ${smallFs}px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText("users 테이블", leftX, cy - 6);

    // 결과 영역 라벨
    ctx.textAlign = "left";
    ctx.fillText("role != 'admin' 결과", rightX, cy - 6);

    // 테이블 헤더
    drawRoundRect(ctx, leftX, cy, leftW, headerH, 6, "#f1f3f5", "#dee2e6", 1);
    ctx.fillStyle = "#495057";
    ctx.font = `600 ${smallFs}px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("id", leftX + 14, cy + headerH / 2);
    ctx.fillText("role", leftX + 60 * scale, cy + headerH / 2);

    const rowsTop = cy + headerH;

    // 행들
    for (let i = 0; i < ROWS.length; i++) {
        const row = ROWS[i]!;
        const ry = rowsTop + i * rowH;

        // 테이블 행 등장
        const tableDelay = i * 0.08;
        const tableP = Math.min(Math.max((t - tableDelay) / 0.3, 0), 1);
        ctx.globalAlpha = tableP;

        // 행 배경 (필터 단계 이후 색상 변화)
        let rowBg = "#fff";
        let rowBorder = "#dee2e6";
        if (t > T_FILTER) {
            const evalRes = evalRow(row);
            if (evalRes === "true") {
                rowBg = "#ebfbee";
                rowBorder = "#8ce99a";
            } else if (evalRes === "NULL") {
                rowBg = "#fff5f5";
                rowBorder = "#ffa8a8";
            } else {
                rowBg = "#f8f9fa";
                rowBorder = "#dee2e6";
            }
        }
        drawRoundRect(ctx, leftX, ry, leftW, rowH, 0, rowBg, rowBorder, 1);

        ctx.fillStyle = "#495057";
        ctx.font = `${rowFs}px ${MONO}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(String(row.id), leftX + 14, ry + rowH / 2);

        if (row.isNull) {
            ctx.fillStyle = "#adb5bd";
            ctx.font = `italic 600 ${rowFs}px ${MONO}`;
        } else {
            ctx.fillStyle = "#495057";
            ctx.font = `${rowFs}px ${MONO}`;
        }
        ctx.fillText(row.role, leftX + 60 * scale, ry + rowH / 2);

        ctx.globalAlpha = 1;
    }

    // 비교 결과 박스들 (오른쪽)
    for (let i = 0; i < ROWS.length; i++) {
        const row = ROWS[i]!;
        const ry = rowsTop + i * rowH;

        const compareDelay = T_TABLE + i * 0.35;
        const compareP = Math.min(Math.max((t - compareDelay) / 0.4, 0), 1);
        if (compareP <= 0) continue;
        ctx.globalAlpha = compareP;

        // 화살표 (테이블 행 → 결과 영역)
        const arrowY = ry + rowH / 2;
        ctx.strokeStyle = "#adb5bd";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(leftX + leftW + 2, arrowY);
        ctx.lineTo(rightX - 4, arrowY);
        ctx.stroke();
        ctx.fillStyle = "#adb5bd";
        ctx.beginPath();
        ctx.moveTo(rightX - 2, arrowY);
        ctx.lineTo(rightX - 8, arrowY - 3);
        ctx.lineTo(rightX - 8, arrowY + 3);
        ctx.closePath();
        ctx.fill();

        // 결과 텍스트와 박스
        const evalRes = evalRow(row);
        let resultText: string;
        let resultColor: string;
        let resultBg: string;
        let badgeText: string;

        if (evalRes === "true") {
            resultText = "true";
            resultColor = "#2b8a3e";
            resultBg = "#ebfbee";
            badgeText = "통과";
        } else if (evalRes === "NULL") {
            resultText = "NULL";
            resultColor = "#c92a2a";
            resultBg = "#fff5f5";
            badgeText = "제외";
        } else {
            resultText = "false";
            resultColor = "#868e96";
            resultBg = "#f1f3f5";
            badgeText = "제외";
        }

        // 결과 박스
        const resultBoxH = rowH - 8;
        const resultBoxY = ry + 4;

        // 결과 값 박스
        const valueBoxW = 70 * scale;
        drawRoundRect(
            ctx,
            rightX,
            resultBoxY,
            valueBoxW,
            resultBoxH,
            5,
            resultBg,
            resultColor,
            1.2,
        );
        ctx.fillStyle = resultColor;
        ctx.font = `700 ${rowFs}px ${MONO}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
            resultText,
            rightX + valueBoxW / 2,
            resultBoxY + resultBoxH / 2,
        );

        // → 화살표 + 통과/제외
        if (t > T_COMPARE) {
            const filterP = Math.min(Math.max((t - T_COMPARE) / 0.6, 0), 1);
            ctx.globalAlpha = compareP * filterP;

            const arrowX1 = rightX + valueBoxW + 4;
            const arrowX2 = rightX + valueBoxW + 18;
            ctx.strokeStyle = "#adb5bd";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(arrowX1, arrowY);
            ctx.lineTo(arrowX2 - 2, arrowY);
            ctx.stroke();
            ctx.fillStyle = "#adb5bd";
            ctx.beginPath();
            ctx.moveTo(arrowX2, arrowY);
            ctx.lineTo(arrowX2 - 6, arrowY - 3);
            ctx.lineTo(arrowX2 - 6, arrowY + 3);
            ctx.closePath();
            ctx.fill();

            // 통과/제외 배지
            const badgeBg = badgeText === "통과" ? "#d3f9d8" : "#ffe3e3";
            const badgeBorder = badgeText === "통과" ? "#37b24d" : "#fa5252";
            const badgeColor = badgeText === "통과" ? "#2b8a3e" : "#c92a2a";
            const badgeW = 52 * scale;
            const badgeX = arrowX2 + 4;
            drawRoundRect(
                ctx,
                badgeX,
                resultBoxY + 2,
                badgeW,
                resultBoxH - 4,
                4,
                badgeBg,
                badgeBorder,
                1,
            );
            ctx.fillStyle = badgeColor;
            ctx.font = `600 ${rowFs}px ${FONT}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(
                badgeText,
                badgeX + badgeW / 2,
                resultBoxY + resultBoxH / 2,
            );

            // 강조 단계: NULL 행 옆에 ❗ 표시
            if (t > T_HIGHLIGHT && row.isNull) {
                const hP = Math.min((t - T_HIGHLIGHT) / 0.4, 1);
                const pulse = 1 + 0.15 * Math.sin(t * 4);
                ctx.globalAlpha = hP;
                ctx.fillStyle = "#fa5252";
                ctx.font = `700 ${rowFs + 4}px ${FONT}`;
                ctx.textAlign = "left";
                ctx.textBaseline = "middle";
                ctx.save();
                const exX = badgeX + badgeW + 8;
                const exY = resultBoxY + resultBoxH / 2;
                ctx.translate(exX, exY);
                ctx.scale(pulse, pulse);
                ctx.fillText("❗", 0, 0);
                ctx.restore();
            }
        }

        ctx.globalAlpha = 1;
    }

    cy = rowsTop + ROWS.length * rowH + 28;

    // ── 강조 메시지 ──
    const msgPadV = 12;
    const msgGap = 5;
    const msgBoxH = msgPadV * 2 + labelFs + msgGap + smallFs;

    if (t > T_HIGHLIGHT) {
        const fadeIn = Math.min((t - T_HIGHLIGHT) / 0.5, 1);
        ctx.globalAlpha = fadeIn;

        drawRoundRect(ctx, 0, cy, w, msgBoxH, 8, "#fff5f5", "#fa5252", 1);
        ctx.fillStyle = "#c92a2a";
        ctx.font = `700 ${labelFs}px ${FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(
            '"admin이 아닌" 행을 찾았는데 NULL 행이 빠졌다',
            w / 2,
            cy + msgPadV,
        );

        ctx.fillStyle = "#868e96";
        ctx.font = `500 ${smallFs}px ${FONT}`;
        ctx.fillText(
            "SQL은 3치 논리: NULL과의 모든 비교는 NULL이고, WHERE는 true만 통과시킨다",
            w / 2,
            cy + msgPadV + labelFs + msgGap,
        );

        ctx.globalAlpha = 1;
    }
    cy += msgBoxH + 8;

    return cy;
}

interface Props {
    caption?: string;
}

export const ThreeValuedLogicDiagram = ({ caption }: Props) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<SvgCanvasHandle>(null);

    useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;

        const start = performance.now();
        let raf = 0;

        const draw = () => {
            const w = container.clientWidth;
            const dpr = window.devicePixelRatio || 1;
            const scale = Math.max(w / 600, 0.85);

            const codeFs = Math.max(11 * scale, 10);
            const labelFs = Math.max(11 * scale, 10);
            const smallFs = Math.max(10 * scale, 9);
            const codeLineH = codeFs + 5;
            const codeBoxH = codeLineH + 24;
            const headerH = 28 * scale;
            const rowH = 34 * scale;
            const tableH = headerH + ROWS.length * rowH;
            const msgBoxH = 24 + labelFs + 5 + smallFs;

            const height = codeBoxH + 22 + tableH + 28 + msgBoxH + 8;

            canvas.width = w * dpr;
            canvas.height = height * dpr;
            canvas.style.width = `${w}px`;
            canvas.style.height = `${height}px`;

            const ctx = canvas.getContext("2d")!;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);
            ctx.clearRect(0, 0, w, height);

            const now = performance.now();
            const t = ((now - start) / 1000) % CYCLE;
            drawScene({ ctx, w, t, scale });

            raf = scheduleMaterialFrame(draw);
        };

        draw();
        const ro = new ResizeObserver(() => {});
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
