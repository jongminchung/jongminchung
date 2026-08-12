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
    password: "#e64980",
    passwordBg: "#fff0f6",
    secretKey: "#d6336c",
    secretKeyBg: "#fff0f6",
    auk: "#be4bdb",
    aukBg: "#f8f0fc",
    keyPair: "#7950f2",
    keyPairBg: "#f3f0ff",
    vaultKey: "#f59f00",
    vaultKeyBg: "#fff9db",
    item: "#228be6",
    itemBg: "#e7f5ff",
    textLight: "#868e96",
    arrow: "#adb5bd",
    kdf: "#12b886",
    kdfBg: "#e6fcf5",
    encrypt: "#fd7e14",
    encryptBg: "#fff4e6",
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

function drawVArrow(
    ctx: SvgDrawingContext,
    x: number,
    y1: number,
    y2: number,
    color: string,
    s: number,
) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
    ctx.stroke();
    const size = 5 * s;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y2 + 1);
    ctx.lineTo(x - size * 0.6, y2 - size);
    ctx.lineTo(x + size * 0.6, y2 - size);
    ctx.closePath();
    ctx.fill();
}

function draw(ctx: SvgDrawingContext, w: number): number {
    const s = w / 640;
    const titleFs = Math.max(12 * s, 10);
    const labelFs = Math.max(10 * s, 9);
    const smallFs = Math.max(9 * s, 8);

    const boxW = 200 * s; // 단일 키 박스 통일 너비
    const pairBoxW = 150 * s; // 나란히 놓는 박스 너비 (MP, SK)
    const boxH = 34 * s; // 키 박스 높이 (통일)
    const procH = 26 * s; // 프로세스 박스 높이 (PBKDF2, 암호화, 캡슐화)
    const arrowLen = 18 * s;
    const descGap = 14 * s;
    const cx = w / 2;

    const y = 16 * s;

    // ── Row 1: Master Password + Secret Key (나란히, 같은 크기) ──
    const pairGap = 30 * s;
    const mpX = cx - pairGap / 2 - pairBoxW;
    const skX = cx + pairGap / 2;

    drawRoundRect(
        ctx,
        mpX,
        y,
        pairBoxW,
        boxH,
        6 * s,
        COLORS.passwordBg,
        COLORS.password,
    );
    ctx.fillStyle = COLORS.password;
    ctx.font = `600 ${titleFs}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Master Password", mpX + pairBoxW / 2, y + boxH / 2);

    drawRoundRect(
        ctx,
        skX,
        y,
        pairBoxW,
        boxH,
        6 * s,
        COLORS.secretKeyBg,
        COLORS.secretKey,
    );
    ctx.fillStyle = COLORS.secretKey;
    ctx.font = `600 ${titleFs}px ${FONT}`;
    ctx.fillText("Secret Key", skX + pairBoxW / 2, y + boxH / 2);

    ctx.fillStyle = COLORS.textLight;
    ctx.font = `${smallFs}px ${FONT}`;
    ctx.fillText("(사용자 기억)", mpX + pairBoxW / 2, y + boxH + descGap);
    ctx.fillText("(디바이스 저장)", skX + pairBoxW / 2, y + boxH + descGap);

    const row1Bottom = y + boxH + descGap + 6 * s;

    // ── 화살표: MP, SK → PBKDF2 ──
    const mpCx = mpX + pairBoxW / 2;
    const skCx = skX + pairBoxW / 2;
    const kdfW = skCx - mpCx + pairBoxW; // MP 왼쪽끝 ~ SK 오른쪽끝
    const kdfY = row1Bottom + arrowLen;
    drawVArrow(ctx, mpCx, row1Bottom, kdfY, COLORS.arrow, s);
    drawVArrow(ctx, skCx, row1Bottom, kdfY, COLORS.arrow, s);

    // ── PBKDF2 ──
    drawRoundRect(
        ctx,
        cx - kdfW / 2,
        kdfY,
        kdfW,
        procH,
        4 * s,
        COLORS.kdfBg,
        COLORS.kdf,
    );
    ctx.fillStyle = COLORS.kdf;
    ctx.font = `600 ${labelFs}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("PBKDF2", cx, kdfY + procH / 2);

    // ── 화살표 → AUK ──
    const aukY = kdfY + procH + arrowLen;
    drawVArrow(ctx, cx, kdfY + procH, aukY, COLORS.arrow, s);

    // ── AUK ──
    drawRoundRect(
        ctx,
        cx - boxW / 2,
        aukY,
        boxW,
        boxH,
        6 * s,
        COLORS.aukBg,
        COLORS.auk,
    );
    ctx.fillStyle = COLORS.auk;
    ctx.font = `600 ${titleFs}px ${FONT}`;
    ctx.fillText("Account Unlock Key", cx, aukY + boxH / 2);

    // ── 화살표 → 암호화 ──
    const enc1Y = aukY + boxH + arrowLen;
    drawVArrow(ctx, cx, aukY + boxH, enc1Y, COLORS.arrow, s);

    // ── 암호화 ──
    drawRoundRect(
        ctx,
        cx - boxW / 2,
        enc1Y,
        boxW,
        procH,
        4 * s,
        COLORS.encryptBg,
        COLORS.encrypt,
    );
    ctx.fillStyle = COLORS.encrypt;
    ctx.font = `${labelFs}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("AUK로 개인 키 암호화", cx, enc1Y + procH / 2);

    // ── 화살표 → Key Pair ──
    const kpY = enc1Y + procH + arrowLen;
    drawVArrow(ctx, cx, enc1Y + procH, kpY, COLORS.arrow, s);

    // ── Key Pair ──
    drawRoundRect(
        ctx,
        cx - boxW / 2,
        kpY,
        boxW,
        boxH,
        6 * s,
        COLORS.keyPairBg,
        COLORS.keyPair,
    );
    ctx.fillStyle = COLORS.keyPair;
    ctx.font = `600 ${titleFs}px ${FONT}`;
    ctx.fillText("User Key Pair (RSA)", cx, kpY + boxH / 2);

    ctx.fillStyle = COLORS.textLight;
    ctx.font = `${smallFs}px ${FONT}`;
    ctx.fillText(
        "공개 키: 서버 저장 / 개인 키: AUK로 암호화",
        cx,
        kpY + boxH + descGap,
    );

    const kpBottom = kpY + boxH + descGap + 6 * s;

    // ── 화살표 → 캡슐화 ──
    const enc2Y = kpBottom + arrowLen;
    drawVArrow(ctx, cx, kpBottom, enc2Y, COLORS.arrow, s);

    // ── 캡슐화 ──
    drawRoundRect(
        ctx,
        cx - boxW / 2,
        enc2Y,
        boxW,
        procH,
        4 * s,
        COLORS.encryptBg,
        COLORS.encrypt,
    );
    ctx.fillStyle = COLORS.encrypt;
    ctx.font = `${labelFs}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("공개 키로 Vault Key 캡슐화", cx, enc2Y + procH / 2);

    // ── 화살표 → Vault Key ──
    const vkY = enc2Y + procH + arrowLen;
    drawVArrow(ctx, cx, enc2Y + procH, vkY, COLORS.arrow, s);

    // ── Vault Key ──
    drawRoundRect(
        ctx,
        cx - boxW / 2,
        vkY,
        boxW,
        boxH,
        6 * s,
        COLORS.vaultKeyBg,
        COLORS.vaultKey,
    );
    ctx.fillStyle = COLORS.vaultKey;
    ctx.font = `600 ${titleFs}px ${FONT}`;
    ctx.fillText("Vault Key (AES)", cx, vkY + boxH / 2);

    ctx.fillStyle = COLORS.textLight;
    ctx.font = `${smallFs}px ${FONT}`;
    ctx.fillText("금고마다 고유한 대칭 키", cx, vkY + boxH + descGap);

    const vkBottom = vkY + boxH + descGap + 6 * s;

    // ── 화살표 → Items ──
    const itemY = vkBottom + arrowLen;
    drawVArrow(ctx, cx, vkBottom, itemY, COLORS.arrow, s);

    // ── Items (3개 나란히, 같은 크기) ──
    const itemGap = 12 * s;
    const itemW = (boxW * 1.5 - itemGap * 2) / 3;
    const totalItemsW = itemW * 3 + itemGap * 2;
    const itemStartX = cx - totalItemsW / 2;

    for (let i = 0; i < 3; i++) {
        const ix = itemStartX + i * (itemW + itemGap);
        drawRoundRect(
            ctx,
            ix,
            itemY,
            itemW,
            boxH,
            6 * s,
            COLORS.itemBg,
            COLORS.item,
        );
        ctx.fillStyle = COLORS.item;
        ctx.font = `600 ${labelFs}px ${FONT}`;
        ctx.textAlign = "center";
        ctx.fillText(
            ["비밀 #1", "비밀 #2", "비밀 #3"][i]!,
            ix + itemW / 2,
            itemY + boxH / 2,
        );
    }

    ctx.fillStyle = COLORS.textLight;
    ctx.font = `${smallFs}px ${FONT}`;
    ctx.fillText("Vault Key로 AES-GCM 암호화", cx, itemY + boxH + descGap);

    return itemY + boxH + descGap + 16 * s;
}

export const KeyHierarchyDiagram = ({ caption }: Props) => {
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
