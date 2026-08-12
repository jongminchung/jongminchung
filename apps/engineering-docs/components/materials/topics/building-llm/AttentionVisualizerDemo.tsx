"use client";

import { useCallback, useMemo, useState } from "react";

const TOKENS = ["고양이가", "매트", "위에", "앉았", "다"];

// Pre-computed attention weights: ATTENTION_WEIGHTS[i][j] = weight from token i to token j
// Causal mask: token i can only attend to tokens 0..i
const ATTENTION_WEIGHTS: number[][] = [
    [1.0], // 고양이가 → 자기 자신
    [0.3, 0.7], // 매트 → 고양이가(0.3), 매트(0.7)
    [0.15, 0.55, 0.3], // 위에 → 고양이가(0.15), 매트(0.55), 위에(0.3)
    [0.45, 0.1, 0.15, 0.3], // 앉았 → 고양이가(0.45), 매트(0.1), 위에(0.15), 앉았(0.3)
    [0.1, 0.05, 0.05, 0.65, 0.15], // 다 → 고양이가(0.1), 매트(0.05), 위에(0.05), 앉았(0.65), 다(0.15)
];

function weightToColor(weight: number): string {
    // Map weight to opacity of primary blue
    const alpha = Math.max(0.08, weight);
    return `rgba(34, 139, 230, ${alpha})`;
}

function weightToBorderColor(weight: number): string {
    const alpha = Math.max(0.15, weight);
    return `rgba(34, 139, 230, ${alpha})`;
}

export const AttentionVisualizerDemo = () => {
    const [selectedToken, setSelectedToken] = useState<number | null>(null);

    const handleTokenClick = useCallback((index: number) => {
        setSelectedToken((prev) => (prev === index ? null : index));
    }, []);

    const weights = useMemo(() => {
        if (selectedToken === null) return null;
        return ATTENTION_WEIGHTS[selectedToken];
    }, [selectedToken]);

    return (
        <div
            style={{
                border: "1px solid #dee2e6",
                borderRadius: 8,
                padding: 20,
                background: "#fff",
                fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
            }}
        >
            {/* 설명 */}
            <div
                style={{
                    fontSize: 12,
                    color: "#868e96",
                    marginBottom: 16,
                    fontWeight: 500,
                    lineHeight: 1.6,
                }}
            >
                토큰을 클릭하면 해당 토큰이 각 토큰에 얼마나{" "}
                <strong style={{ color: "#228be6" }}>어텐션(attention)</strong>
                을 주는지 확인할 수 있습니다. Causal Mask(인과적 마스킹)로 인해
                자기 자신과 이전 토큰에만 어텐션을 줄 수 있습니다.
            </div>

            {/* 토큰 행 */}
            <div
                style={{
                    display: "flex",
                    gap: 8,
                    justifyContent: "center",
                    flexWrap: "wrap",
                    marginBottom: 20,
                    padding: "16px 0",
                }}
            >
                {TOKENS.map((token, i) => {
                    const isSelected = selectedToken === i;
                    const isAttended =
                        weights !== null &&
                        selectedToken !== null &&
                        i <= selectedToken;
                    const weight =
                        isAttended && weights![i]! !== undefined
                            ? weights![i]!
                            : 0;
                    const isMasked =
                        selectedToken !== null && i > selectedToken;

                    return (
                        <button
                            type="button"
                            key={i}
                            onClick={() => handleTokenClick(i)}
                            style={{
                                position: "relative",
                                padding: "10px 16px",
                                borderRadius: 6,
                                fontSize: 16,
                                fontWeight: isSelected ? 700 : 500,
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                border: isSelected
                                    ? "2px solid #228be6"
                                    : isAttended
                                      ? `2px solid ${weightToBorderColor(weight)}`
                                      : "2px solid #dee2e6",
                                background: isSelected
                                    ? "#e7f5ff"
                                    : isAttended
                                      ? weightToColor(weight)
                                      : isMasked
                                        ? "#f1f3f5"
                                        : "#f8f9fa",
                                color: isMasked
                                    ? "#ced4da"
                                    : isSelected
                                      ? "#228be6"
                                      : "#495057",
                                userSelect: "none",
                                textDecoration: isMasked
                                    ? "line-through"
                                    : "none",
                            }}
                        >
                            {token}
                            {/* 어텐션 가중치 표시 */}
                            {isAttended && !isSelected && weights && (
                                <span
                                    style={{
                                        position: "absolute",
                                        top: -10,
                                        right: -6,
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: "#fff",
                                        background: "#228be6",
                                        borderRadius: 10,
                                        padding: "1px 6px",
                                        minWidth: 18,
                                        textAlign: "center",
                                        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                                    }}
                                >
                                    {(weight * 100).toFixed(0)}%
                                </span>
                            )}
                            {isSelected && (
                                <span
                                    style={{
                                        position: "absolute",
                                        top: -10,
                                        right: -6,
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: "#fff",
                                        background: "#228be6",
                                        borderRadius: 10,
                                        padding: "1px 6px",
                                        minWidth: 18,
                                        textAlign: "center",
                                        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                                    }}
                                >
                                    Q
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* 어텐션 가중치 바 차트 */}
            {selectedToken !== null && weights && (
                <div
                    style={{
                        background: "#f8f9fa",
                        borderRadius: 6,
                        padding: 16,
                        marginBottom: 16,
                    }}
                >
                    <div
                        style={{
                            fontSize: 12,
                            color: "#868e96",
                            marginBottom: 12,
                            fontWeight: 500,
                        }}
                    >
                        <strong style={{ color: "#228be6" }}>
                            {TOKENS[selectedToken]}
                        </strong>
                        의 어텐션 분포
                    </div>
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                        }}
                    >
                        {TOKENS.map((token, i) => {
                            const isAccessible = i <= selectedToken;
                            const weight = isAccessible ? weights[i] : 0;

                            return (
                                <div
                                    key={i}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                    }}
                                >
                                    <span
                                        style={{
                                            width: 60,
                                            textAlign: "right",
                                            fontSize: 14,
                                            fontWeight: 500,
                                            color: isAccessible
                                                ? "#495057"
                                                : "#ced4da",
                                            flexShrink: 0,
                                        }}
                                    >
                                        {token}
                                    </span>
                                    <div
                                        style={{
                                            flex: 1,
                                            height: 22,
                                            background: "#e9ecef",
                                            borderRadius: 3,
                                            overflow: "hidden",
                                        }}
                                    >
                                        {isAccessible && (
                                            <div
                                                style={{
                                                    height: "100%",
                                                    width: `${weight! * 100}%`,
                                                    background:
                                                        "linear-gradient(90deg, #228be6, #4dabf7)",
                                                    borderRadius: 3,
                                                    transition:
                                                        "width 0.3s ease",
                                                }}
                                            />
                                        )}
                                    </div>
                                    <span
                                        style={{
                                            fontSize: 12,
                                            color: isAccessible
                                                ? "#868e96"
                                                : "#ced4da",
                                            width: 42,
                                            textAlign: "right",
                                            flexShrink: 0,
                                            fontVariantNumeric: "tabular-nums",
                                        }}
                                    >
                                        {isAccessible
                                            ? `${(weight! * 100).toFixed!(0)}%`
                                            : "—"}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 마스킹 안내 */}
            {selectedToken !== null && selectedToken < TOKENS.length - 1 && (
                <div
                    style={{
                        fontSize: 12,
                        color: "#868e96",
                        textAlign: "center",
                        lineHeight: 1.5,
                    }}
                >
                    취소선이 있는 토큰은 Causal Mask에 의해 어텐션이 차단됩니다.
                </div>
            )}

            {selectedToken === null && (
                <div
                    style={{
                        fontSize: 13,
                        color: "#868e96",
                        textAlign: "center",
                        padding: "8px 0",
                    }}
                >
                    위의 토큰을 클릭해 보세요
                </div>
            )}
        </div>
    );
};
