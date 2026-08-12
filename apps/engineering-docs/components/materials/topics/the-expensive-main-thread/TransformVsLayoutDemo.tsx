"use client";

import { motion, useReducedMotion } from "motion/react";
import React, { useEffect, useRef, useState } from "react";
import { useVisible } from "./useVisible";

type Lang = "ko" | "en";

const STRINGS = {
    ko: {
        compositor: "컴포지터",
        mainThread: "메인 스레드 (레이아웃 유발)",
        loadOff: "메인 스레드 부하 끄기",
        loadOn: "메인 스레드 부하 주기",
    },
    en: {
        compositor: "Compositor",
        mainThread: "Main thread (triggers layout)",
        loadOff: "Remove main thread load",
        loadOn: "Add main thread load",
    },
} as const;

const trackStyle: React.CSSProperties = {
    position: "relative",
    height: 34,
    background: "#e9ecef",
    borderRadius: 6,
    overflow: "hidden",
    containerType: "inline-size", // 100cqw = 트랙 너비
};

const dot = (color: string): React.CSSProperties => ({
    position: "absolute",
    top: 5,
    width: 24,
    height: 24,
    borderRadius: 6,
    background: color,
});

export const TransformVsLayoutDemo = ({
    locale: lang = "ko",
}: {
    locale?: Lang;
}) => {
    const t = STRINGS[lang];
    const [load, setLoad] = useState(false);
    const reducedMotion = useReducedMotion();
    const timerRef = useRef<number | null>(null);
    const { ref: rootRef, visible } = useVisible<HTMLDivElement>();

    useEffect(() => {
        if (load && visible) {
            // 매 틱마다 메인 스레드를 ~10ms씩 붙잡아 부하를 만든다
            timerRef.current = window.setInterval(() => {
                const end = performance.now() + 10;
                while (performance.now() < end) {
                    /* busy */
                }
            }, 0);
        }
        return () => {
            if (timerRef.current !== null) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [load, visible]);

    return (
        <div
            ref={rootRef}
            style={{
                border: "1px solid #dee2e6",
                borderRadius: 8,
                padding: 20,
                margin: "24px 0",
                background: "#fff",
            }}
        >
            <div
                style={{ background: "#f8f9fa", borderRadius: 8, padding: 16 }}
            >
                <div
                    style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#237032",
                        marginBottom: 6,
                    }}
                >
                    transform: translateX{" "}
                    <span style={{ fontWeight: 400, color: "#495057" }}>
                        · {t.compositor}
                    </span>
                </div>
                <div style={trackStyle}>
                    <motion.div
                        animate={{
                            x:
                                visible && !reducedMotion
                                    ? "calc(100cqw - 34px)"
                                    : 0,
                        }}
                        transition={{
                            duration: 1.8,
                            ease: "easeInOut",
                            repeat: Infinity,
                            repeatType: "mirror",
                        }}
                        style={{
                            ...dot("#237032"),
                            willChange: "transform",
                        }}
                    />
                </div>

                <div
                    style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#c2410c",
                        margin: "16px 0 6px",
                    }}
                >
                    left{" "}
                    <span style={{ fontWeight: 400, color: "#495057" }}>
                        · {t.mainThread}
                    </span>
                </div>
                <div style={trackStyle}>
                    <motion.div
                        animate={{
                            left:
                                visible && !reducedMotion
                                    ? "calc(100% - 34px)"
                                    : 0,
                        }}
                        transition={{
                            duration: 1.8,
                            ease: "easeInOut",
                            repeat: Infinity,
                            repeatType: "mirror",
                        }}
                        style={{
                            ...dot("#c2410c"),
                            left: 0,
                        }}
                    />
                </div>
            </div>

            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    marginTop: 14,
                }}
            >
                <button
                    onClick={() => setLoad((v) => !v)}
                    style={{
                        padding: "8px 18px",
                        border: "none",
                        borderRadius: 6,
                        background: load ? "#c92a2a" : "#1864ab",
                        color: "#fff",
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 600,
                    }}
                >
                    {load ? t.loadOff : t.loadOn}
                </button>
            </div>
        </div>
    );
};
