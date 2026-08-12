"use client";

import React, { useEffect, useRef, useState } from "react";
import { Env, evaluate, readAll, standardEnv, toLispString } from "./engine";

const FONT =
    "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const BANNER = "함수썬 v0.1 — 브라우저에서 실행 중";

interface Line {
    kind: "banner" | "echo" | "result" | "error";
    text: string;
}

const PRESETS: { label: string; code: string }[] = [
    { label: "(+ 1 (* 2 3))", code: "(+ 1 (* 2 3))" },
    {
        label: "square",
        code: "(define square (lambda (x) (* x x))) (square 12)",
    },
    {
        label: "make-adder (클로저)",
        code: "(define make-adder (lambda (n) (lambda (x) (+ x n)))) (define add3 (make-adder 3)) (add3 10)",
    },
    {
        label: "(fact 20)",
        code: "(define fact (lambda (n) (if (<= n 1) 1 (* n (fact (- n 1)))))) (fact 20)",
    },
    {
        label: "레이튼 퍼즐",
        code: "(filter (lambda (n) (= n (* 4 (+ (quotient n 10) (mod n 10))))) (range 10 100))",
    },
];

const LINE_COLOR: Record<Line["kind"], string> = {
    banner: "#9399b2",
    echo: "#cdd6f4",
    result: "#a6e3a1",
    error: "#f38ba8",
};

export const ReplDemo = () => {
    const [lines, setLines] = useState<Line[]>([
        { kind: "banner", text: BANNER },
    ]);
    const [input, setInput] = useState("");
    const [focused, setFocused] = useState(false);

    const envRef = useRef<Env | null>(null);
    const historyRef = useRef<string[]>([]);
    const historyIndexRef = useRef<number>(0);
    const outputRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    // 새 출력이 생기면 맨 아래로 스크롤
    useEffect(() => {
        const el = outputRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [lines]);

    const runSource = (source: string) => {
        const trimmed = source.trim();
        if (trimmed === "") return;

        // SSR 안전: 환경은 첫 실행 시점에 lazy하게 만든다
        envRef.current ??= standardEnv();
        const env = envRef.current;

        const newLines: Line[] = [{ kind: "echo", text: trimmed }];
        try {
            const exprs = readAll(trimmed);
            for (const expr of exprs) {
                const value = evaluate(expr, env);
                if (value !== null) {
                    newLines.push({
                        kind: "result",
                        text: toLispString(value),
                    });
                }
            }
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            newLines.push({ kind: "error", text: `에러: ${message}` });
        }

        setLines((prev) => [...prev, ...newLines]);
        historyRef.current.push(trimmed);
        historyIndexRef.current = historyRef.current.length;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        runSource(input);
        setInput("");
        inputRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        const history = historyRef.current;
        if (e.key === "ArrowUp") {
            e.preventDefault();
            if (history.length === 0) return;
            historyIndexRef.current = Math.max(0, historyIndexRef.current - 1);
            setInput(history[historyIndexRef.current] ?? "");
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            if (historyIndexRef.current >= history.length) return;
            historyIndexRef.current = Math.min(
                history.length,
                historyIndexRef.current + 1,
            );
            setInput(history[historyIndexRef.current] ?? "");
        }
    };

    const handleReset = () => {
        envRef.current = standardEnv();
        historyRef.current = [];
        historyIndexRef.current = 0;
        setLines([{ kind: "banner", text: BANNER }]);
        setInput("");
        inputRef.current?.focus();
    };

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
            <div
                ref={outputRef}
                aria-label="함수썬 REPL 출력"
                style={{
                    height: 260,
                    overflowY: "auto",
                    boxSizing: "border-box",
                    padding: "12px 14px",
                    background: "#1e1e2e",
                    borderRadius: 6,
                    fontFamily: MONO,
                    fontSize: 13,
                    lineHeight: 1.7,
                }}
            >
                {lines.map((line, i) => (
                    <div
                        key={i}
                        style={{
                            color: LINE_COLOR[line.kind],
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-all",
                        }}
                    >
                        {line.kind === "echo" ? (
                            <>
                                <span style={{ color: "#6c7086" }}>
                                    {"함수썬> "}
                                </span>
                                {line.text}
                            </>
                        ) : (
                            line.text
                        )}
                    </div>
                ))}
            </div>

            <form
                onSubmit={handleSubmit}
                style={{ display: "flex", gap: 8, marginTop: 10 }}
            >
                <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholder="(+ 1 2)"
                    spellCheck={false}
                    autoComplete="off"
                    aria-label="함수썬 코드 입력"
                    style={{
                        flex: 1,
                        minWidth: 0,
                        boxSizing: "border-box",
                        padding: "10px 12px",
                        fontSize: 14,
                        fontFamily: MONO,
                        color: "#343a40",
                        background: "#fff",
                        border: focused
                            ? "1px solid #1864ab"
                            : "1px solid #5f666d",
                        boxShadow: focused
                            ? "0 0 0 2px rgba(34, 139, 230, 0.15)"
                            : "none",
                        borderRadius: 6,
                        outline: "none",
                        transition: "border-color 0.15s, box-shadow 0.15s",
                    }}
                />
                <button
                    type="submit"
                    style={{
                        padding: "10px 16px",
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: FONT,
                        color: "#fff",
                        background: "#1864ab",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                    }}
                >
                    실행
                </button>
                <button
                    type="button"
                    onClick={handleReset}
                    style={{
                        padding: "10px 14px",
                        fontSize: 13,
                        fontFamily: FONT,
                        color: "#495057",
                        background: "#f8f9fa",
                        border: "1px solid #dee2e6",
                        borderRadius: 6,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                    }}
                >
                    초기화
                </button>
            </form>

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
                        key={preset.label}
                        type="button"
                        onClick={() => {
                            runSource(preset.code);
                            inputRef.current?.focus();
                        }}
                        style={{
                            padding: "3px 10px",
                            fontSize: 12,
                            fontFamily: MONO,
                            color: "#495057",
                            background: "#f8f9fa",
                            border: "1px solid #dee2e6",
                            borderRadius: 100,
                            cursor: "pointer",
                        }}
                    >
                        {preset.label}
                    </button>
                ))}
            </div>

            <div
                style={{
                    marginTop: 14,
                    fontSize: 11,
                    color: "#5c636a",
                    textAlign: "center",
                }}
            >
                define한 이름은 초기화 전까지 계속 살아 있으니 자기만의 함수를
                하나 정의해서 굴려보자.
            </div>
        </div>
    );
};
