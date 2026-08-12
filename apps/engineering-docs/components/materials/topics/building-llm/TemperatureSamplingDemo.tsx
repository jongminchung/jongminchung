"use client";

import { useMemo, useState } from "react";

const BASE_LOGITS: [string, number][] = [
    ["다", 3.5],
    [" ", 3.2],
    ["는", 2.8],
    ["고", 2.1],
    ["을", 1.8],
    ["에", 1.5],
    ["이", 1.2],
    ["가", 0.9],
    ["도", 0.6],
    ["서", 0.3],
];

function softmax(logits: number[]): number[] {
    const max = Math.max(...logits);
    const exps = logits.map((l) => Math.exp(l - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map((e) => e / sum);
}

const fontFamily = "-apple-system, BlinkMacSystemFont, sans-serif";

export const TemperatureSamplingDemo = ({ caption }: { caption?: string }) => {
    const [temperature, setTemperature] = useState(1.0);
    const [topK, setTopK] = useState(5);

    const { tokens, maxProb } = useMemo(() => {
        // 본문 generate()와 동일한 순서: 로짓을 temperature로 나눈다
        const scaledLogits = BASE_LOGITS.map(([, l]) => l / temperature);

        // Top-k 밖의 로짓은 -Infinity로 제거
        const sorted = [...scaledLogits].sort((a, b) => b - a);
        const kthLogit = sorted[Math.min(topK, scaledLogits.length) - 1]!;
        const maskedLogits = scaledLogits.map((l) =>
            l < kthLogit ? -Infinity : l,
        );

        // 살아남은 후보만으로 softmax 재계산 (exp(-Infinity) === 0)
        const probs = softmax(maskedLogits);

        const tokens = BASE_LOGITS.map(([char], i) => ({
            char,
            prob: probs[i]!,
            active: maskedLogits[i] !== -Infinity,
        }));

        const maxProb = Math.max(
            ...tokens.filter((t) => t.active).map((t) => t.prob),
        );

        return { tokens, maxProb };
    }, [temperature, topK]);

    return (
        <figure style={{ margin: "2rem 0" }}>
            <div
                style={{
                    border: "1px solid #dee2e6",
                    borderRadius: 8,
                    padding: 20,
                    background: "#fff",
                    fontFamily,
                }}
            >
                <div style={{ marginBottom: 16 }}>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            marginBottom: 12,
                        }}
                    >
                        <label
                            style={{
                                fontSize: 14,
                                color: "#495057",
                                fontWeight: 600,
                                minWidth: 100,
                            }}
                        >
                            Temperature: {temperature.toFixed(1)}
                        </label>
                        <input
                            type="range"
                            min={0.1}
                            max={2.0}
                            step={0.1}
                            value={temperature}
                            onChange={(e) =>
                                setTemperature(parseFloat(e.target.value))
                            }
                            style={{ flex: 1 }}
                        />
                    </div>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                        }}
                    >
                        <label
                            style={{
                                fontSize: 14,
                                color: "#495057",
                                fontWeight: 600,
                                minWidth: 100,
                            }}
                        >
                            Top-k: {topK}
                        </label>
                        <input
                            type="range"
                            min={1}
                            max={10}
                            step={1}
                            value={topK}
                            onChange={(e) => setTopK(parseInt(e.target.value))}
                            style={{ flex: 1 }}
                        />
                    </div>
                </div>

                <div
                    style={{
                        background: "#f8f9fa",
                        borderRadius: 6,
                        padding: 16,
                    }}
                >
                    {tokens.map(({ char, prob, active }) => {
                        const displayChar = char === " " ? "⎵" : char;
                        const pct = (prob! * 100).toFixed!(1);
                        const barWidth =
                            maxProb > 0 ? (prob! / maxProb) * 100 : 0;

                        return (
                            <div
                                key={char}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    marginBottom: 6,
                                    opacity: active ? 1 : 0.3,
                                    transition: "opacity 0.2s ease",
                                }}
                            >
                                <span
                                    style={{
                                        width: 28,
                                        fontSize: 15,
                                        fontWeight: 600,
                                        color: active ? "#495057" : "#868e96",
                                        textAlign: "center",
                                        flexShrink: 0,
                                    }}
                                >
                                    {displayChar}
                                </span>
                                <div
                                    style={{
                                        flex: 1,
                                        height: 20,
                                        background: "#dee2e6",
                                        borderRadius: 4,
                                        marginLeft: 8,
                                        marginRight: 8,
                                        overflow: "hidden",
                                    }}
                                >
                                    <div
                                        style={{
                                            width: `${barWidth}%`,
                                            height: "100%",
                                            background: active
                                                ? "#228be6"
                                                : "#adb5bd",
                                            borderRadius: 4,
                                            transition:
                                                "width 0.2s ease, background 0.2s ease",
                                        }}
                                    />
                                </div>
                                <span
                                    style={{
                                        width: 48,
                                        fontSize: 13,
                                        color: active ? "#495057" : "#868e96",
                                        textAlign: "right",
                                        flexShrink: 0,
                                    }}
                                >
                                    {pct}%
                                </span>
                            </div>
                        );
                    })}
                </div>

                <div
                    style={{
                        marginTop: 12,
                        fontSize: 12,
                        color: "#868e96",
                        lineHeight: 1.5,
                    }}
                >
                    Temperature가 낮을수록 확률 분포가 뾰족해지고, 높을수록
                    균일해집니다. Top-k는 상위 k개의 토큰만 샘플링 후보로
                    남깁니다.
                </div>
            </div>
            {caption && <figcaption>{caption}</figcaption>}
        </figure>
    );
};
