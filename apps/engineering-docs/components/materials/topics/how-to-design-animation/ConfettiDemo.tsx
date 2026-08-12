"use client";

import { useEffect, useRef, useState } from "react";
import { seededMaterialRandom } from "#components/materials/runtime/random";
import {
    cancelMaterialFrame,
    scheduleMaterialFrame,
} from "#components/materials/runtime/scheduler";
import {
    SvgCanvas,
    type SvgCanvasHandle,
} from "#components/materials/runtime/svg-canvas";

const GRAVITY = 0.15;
const DRAG = 0.02;
const COUNT = 80;

const COLORS = [
    "#228be6",
    "#40c057",
    "#fab005",
    "#fa5252",
    "#845ef7",
    "#ff922b",
];

type Lang = "ko" | "en";

const STRINGS = {
    ko: {
        launch: "발사",
        caption: "규칙만 정의하면 자연스러운 움직임이 만들어진다",
    },
    en: {
        launch: "Launch",
        caption: "Define the rules and natural motion emerges",
    },
} as const;

interface Confetti {
    x: number;
    y: number;
    vx: number;
    vy: number;
    w: number;
    h: number;
    rotation: number;
    rotationSpeed: number;
    color: string;
    opacity: number;
}

function createBurst(cx: number, cy: number): Confetti[] {
    return Array.from({ length: COUNT }, () => {
        const angle =
            -Math.PI / 2 +
            (seededMaterialRandom("how-to-design-animation/ConfettiDemo") -
                0.5) *
                Math.PI *
                0.8;
        const speed =
            4 +
            seededMaterialRandom("how-to-design-animation/ConfettiDemo") * 6;
        return {
            x:
                cx +
                (seededMaterialRandom("how-to-design-animation/ConfettiDemo") -
                    0.5) *
                    20,
            y: cy,
            vx:
                Math.cos(angle) * speed +
                (seededMaterialRandom("how-to-design-animation/ConfettiDemo") -
                    0.5) *
                    2,
            vy:
                Math.sin(angle) * speed -
                seededMaterialRandom("how-to-design-animation/ConfettiDemo") *
                    2,
            w:
                4 +
                seededMaterialRandom("how-to-design-animation/ConfettiDemo") *
                    4,
            h:
                6 +
                seededMaterialRandom("how-to-design-animation/ConfettiDemo") *
                    8,
            rotation:
                seededMaterialRandom("how-to-design-animation/ConfettiDemo") *
                Math.PI *
                2,
            rotationSpeed:
                (seededMaterialRandom("how-to-design-animation/ConfettiDemo") -
                    0.5) *
                0.3,
            color: COLORS[
                Math.floor(
                    seededMaterialRandom(
                        "how-to-design-animation/ConfettiDemo",
                    ) * COLORS.length,
                )
            ]!,
            opacity: 1,
        };
    });
}

export const ConfettiDemo = ({ locale: lang = "ko" }: { locale?: Lang }) => {
    const t = STRINGS[lang];
    const canvasRef = useRef<SvgCanvasHandle>(null);
    const animRef = useRef<number>(0);
    const particlesRef = useRef<Confetti[]>([]);
    const [active, setActive] = useState(false);

    const launch = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const W = canvas.getBoundingClientRect().width;
        particlesRef.current = createBurst(W / 2, 20);
        setActive(true);
    };

    useEffect(() => {
        if (!active) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = window.devicePixelRatio || 1;
        const W = canvas.getBoundingClientRect().width;
        const H = canvas.getBoundingClientRect().height;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        const ctx = canvas.getContext("2d")!;
        ctx.scale(dpr, dpr);

        const animate = () => {
            ctx.clearRect(0, 0, W, H);
            let alive = false;

            for (const p of particlesRef.current) {
                if (p.opacity <= 0) continue;
                alive = true;

                // 1. 힘: 중력 + 공기 저항
                p.vy += GRAVITY;
                p.vx *= 1 - DRAG;
                p.vy *= 1 - DRAG * 0.5;

                // 2. 적분
                p.x += p.vx;
                p.y += p.vy;
                p.rotation += p.rotationSpeed;

                // 3. 제약: 바닥 근처에서 페이드아웃
                if (p.y > H - 20) {
                    p.opacity -= 0.05;
                }

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = Math.max(0, p.opacity);
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                ctx.restore();
            }

            if (alive) {
                animRef.current = scheduleMaterialFrame(animate);
            } else {
                setActive(false);
            }
        };

        animRef.current = scheduleMaterialFrame(animate);
        return () => cancelMaterialFrame(animRef.current);
    }, [active]);

    return (
        <div
            style={{
                border: "1px solid #dee2e6",
                borderRadius: 8,
                padding: 20,
                margin: "24px 0",
                background: "#fff",
            }}
        >
            <div style={{ position: "relative" }}>
                <SvgCanvas
                    ref={canvasRef}
                    style={{
                        width: "100%",
                        height: 220,
                        display: "block",
                        borderRadius: 8,
                        background: "#f8f9fa",
                    }}
                />
                <div
                    style={{
                        position: "absolute",
                        bottom: 16,
                        left: 0,
                        right: 0,
                        textAlign: "center",
                    }}
                >
                    <button
                        onClick={launch}
                        style={{
                            padding: "8px 24px",
                            borderRadius: 20,
                            border: "none",
                            background: "#228be6",
                            color: "#fff",
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        {t.launch}
                    </button>
                </div>
            </div>
            <div
                style={{
                    fontSize: 11,
                    color: "#adb5bd",
                    textAlign: "center",
                    marginTop: 10,
                }}
            >
                {t.caption}
            </div>
        </div>
    );
};
