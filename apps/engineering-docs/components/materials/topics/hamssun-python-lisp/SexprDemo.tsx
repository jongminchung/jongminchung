"use client";

import React, { useMemo, useState } from "react";
import { parse, tokenize, type Expr } from "./engine";

const FONT =
    "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

type ChipKind = "paren" | "number" | "symbol";

const CHIP_STYLE: Record<
    ChipKind,
    { color: string; bg: string; border: string }
> = {
    paren: { color: "#f08c00", bg: "#fff9db", border: "#ffe066" },
    number: { color: "#228be6", bg: "#e7f5ff", border: "#a5d8ff" },
    symbol: { color: "#845ef7", bg: "#f3f0ff", border: "#d0bfff" },
};

// atom 판별: #t/#f 또는 Number()로 변환 가능하면 숫자/불리언, 아니면 심볼
function classifyToken(token: string): ChipKind {
    if (token === "(" || token === ")") return "paren";
    if (token === "#t" || token === "#f") return "number";
    if (!Number.isNaN(Number(token))) return "number";
    return "symbol";
}

const PRESETS = [
    "(+ 1 (* 2 3))",
    "(define square (lambda (x) (* x x)))",
    "(+ 1 (* 2 3)",
];

const TokenChip = ({ token }: { token: string }) => {
    const s = CHIP_STYLE[classifyToken(token)];
    return (
        <span
            style={{
                display: "inline-block",
                padding: "3px 9px",
                borderRadius: 6,
                background: s.bg,
                border: `1px solid ${s.border}`,
                color: s.color,
                fontFamily: MONO,
                fontSize: 13,
                fontWeight: 600,
                whiteSpace: "pre",
            }}
        >
            {token}
        </span>
    );
};

// 원자 칩 (파싱 트리 안에서 사용)
const AtomChip = ({ value }: { value: number | boolean | string }) => {
    const kind: ChipKind = typeof value === "string" ? "symbol" : "number";
    const s = CHIP_STYLE[kind];
    const label =
        value === true ? "#t" : value === false ? "#f" : String(value);
    return (
        <span
            style={{
                display: "inline-block",
                padding: "2px 8px",
                borderRadius: 6,
                background: s.bg,
                border: `1px solid ${s.border}`,
                color: s.color,
                fontFamily: MONO,
                fontSize: 13,
                fontWeight: 600,
                whiteSpace: "pre",
            }}
        >
            {label}
        </span>
    );
};

// 리스트는 중첩 박스, 원자는 색 칩 — 괄호 구조가 그대로 박스 중첩이 된다
const TreeNode = ({ expr, depth }: { expr: Expr; depth: number }) => {
    if (!Array.isArray(expr)) {
        return <AtomChip value={expr} />;
    }
    return (
        <span
            style={{
                display: "inline-flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 6,
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid #ced4da",
                background: depth % 2 === 0 ? "#fff" : "#f8f9fa",
            }}
        >
            {expr.length === 0 ? (
                <span
                    style={{ fontFamily: MONO, fontSize: 12, color: "#adb5bd" }}
                >
                    ()
                </span>
            ) : (
                expr.map((child, i) => (
                    <TreeNode key={i} expr={child} depth={depth + 1} />
                ))
            )}
        </span>
    );
};

// Python repr 형태 문자열 만들기 — 심볼은 따옴표, 숫자는 그대로
function toPyRepr(expr: Expr): string {
    if (Array.isArray(expr)) return "[" + expr.map(toPyRepr).join(", ") + "]";
    if (typeof expr === "string") return `'${expr}'`;
    if (typeof expr === "boolean") return expr ? "True" : "False";
    return String(expr);
}

const SECTION_TITLE: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    color: "#495057",
    letterSpacing: 0.3,
};

export const SexprDemo = () => {
    const [input, setInput] = useState("(+ 1 (* 2 3))");
    const [focused, setFocused] = useState(false);

    const tokens = useMemo(() => tokenize(input), [input]);

    const parsed = useMemo<
        { expr: Expr; error: null } | { expr: null; error: string }
    >(() => {
        try {
            // parse는 토큰 배열을 소모(shift)하므로 복사본을 넘긴다
            const expr = parse([...tokens]);
            return { expr, error: null };
        } catch (e) {
            return {
                expr: null,
                error: e instanceof Error ? e.message : String(e),
            };
        }
    }, [tokens]);

    return (
        <div
            style={{
                border: "1px solid #dee2e6",
                borderRadius: 8,
                padding: 20,
                margin: "24px 0",
                background: "#fff",
                fontFamily: FONT,
            }}
        >
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                spellCheck={false}
                aria-label="토큰화하고 파싱할 S-표현식"
                style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "10px 12px",
                    fontSize: 14,
                    fontFamily: MONO,
                    color: "#343a40",
                    background: "#fff",
                    border: focused ? "1px solid #228be6" : "1px solid #ced4da",
                    boxShadow: focused
                        ? "0 0 0 2px rgba(34, 139, 230, 0.15)"
                        : "none",
                    borderRadius: 6,
                    outline: "none",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                }}
            />

            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    marginTop: 8,
                }}
            >
                {PRESETS.map((preset) => (
                    <button
                        key={preset}
                        type="button"
                        onClick={() => setInput(preset)}
                        style={{
                            padding: "3px 10px",
                            fontSize: 12,
                            fontFamily: MONO,
                            color: input === preset ? "#228be6" : "#868e96",
                            background:
                                input === preset ? "#e7f5ff" : "#f8f9fa",
                            border:
                                input === preset
                                    ? "1px solid #a5d8ff"
                                    : "1px solid #dee2e6",
                            borderRadius: 100,
                            cursor: "pointer",
                        }}
                    >
                        {preset}
                    </button>
                ))}
            </div>

            <div style={{ marginTop: 18 }}>
                <div style={SECTION_TITLE}>① 토큰화</div>
                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "flex-start",
                        gap: 6,
                        marginTop: 8,
                        minHeight: 28,
                    }}
                >
                    {tokens.length === 0 ? (
                        <span style={{ fontSize: 12, color: "#adb5bd" }}>
                            토큰이 없다
                        </span>
                    ) : (
                        tokens.map((token, i) => (
                            <TokenChip key={i} token={token} />
                        ))
                    )}
                </div>
            </div>

            <div style={{ marginTop: 18 }}>
                <div style={SECTION_TITLE}>② 파싱</div>
                {parsed.error !== null ? (
                    <div
                        style={{
                            marginTop: 8,
                            padding: "10px 12px",
                            background: "#fff5f5",
                            border: "1px solid #ffc9c9",
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#fa5252",
                        }}
                    >
                        SyntaxError: {parsed.error}
                    </div>
                ) : (
                    <>
                        <div
                            style={{
                                marginTop: 8,
                                overflowX: "auto",
                                paddingBottom: 4,
                            }}
                        >
                            <TreeNode expr={parsed.expr} depth={0} />
                        </div>
                        <div
                            style={{
                                marginTop: 8,
                                padding: "8px 12px",
                                background: "#f8f9fa",
                                border: "1px solid #dee2e6",
                                borderRadius: 6,
                                fontFamily: MONO,
                                fontSize: 13,
                                color: "#495057",
                                whiteSpace: "pre",
                                overflowX: "auto",
                            }}
                        >
                            {toPyRepr(parsed.expr)}
                        </div>
                    </>
                )}
            </div>

            <div
                style={{
                    marginTop: 14,
                    fontSize: 11,
                    color: "#adb5bd",
                    textAlign: "center",
                }}
            >
                괄호를 하나 지워보면 파서가 어떤 에러를 내는지 볼 수 있다.
            </div>
        </div>
    );
};
