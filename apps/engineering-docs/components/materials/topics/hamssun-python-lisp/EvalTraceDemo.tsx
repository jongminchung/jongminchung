"use client";

import React, { useMemo, useState } from "react";
import { read, type Expr } from "./engine";

const FONT =
    "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

// ---------- 트레이스 생성 ----------
// 데모 전용의 작은 재귀 평가기. engine.ts의 evaluate와 같은 결과를 내되,
// 각 부분식에 경로 id를 붙이고 스텝(enter/resolve/skip)을 기록한다.

type TraceValue = number | boolean;

type Step =
    | { kind: "enter"; path: string; expr: Expr; depth: number }
    | {
          kind: "resolve";
          path: string;
          expr: Expr;
          value: TraceValue;
          depth: number;
      }
    | { kind: "skip"; path: string; expr: Expr; reason: string; depth: number };

const asNum = (v: TraceValue): number => {
    if (typeof v !== "number")
        throw new TypeError(`숫자가 아니다: ${fmtValue(v)}`);
    return v;
};

const BUILTINS: Record<string, (...xs: TraceValue[]) => TraceValue> = {
    "+": (...xs) => xs.map(asNum).reduce((a, c) => a + c),
    "-": (...xs) =>
        xs.length === 1
            ? -asNum(xs[0]!)
            : xs.map(asNum).reduce((a, c) => a - c),
    "*": (...xs) => xs.map(asNum).reduce((a, c) => a * c),
    "/": (...xs) => xs.map(asNum).reduce((a, c) => a / c),
    ">": (a, b) => asNum(a) > asNum(b),
    "<": (a, b) => asNum(a) < asNum(b),
    ">=": (a, b) => asNum(a) >= asNum(b),
    "<=": (a, b) => asNum(a) <= asNum(b),
    "=": (a, b) => a === b,
    max: (...xs) => Math.max(...xs.map(asNum)),
    min: (...xs) => Math.min(...xs.map(asNum)),
    abs: (x) => Math.abs(asNum(x)),
    quotient: (a, b) => Math.floor(asNum(a) / asNum(b)),
    mod: (a, b) => {
        const m = asNum(a) % asNum(b);
        return m < 0 !== asNum(b) < 0 && m !== 0 ? m + asNum(b) : m; // 파이썬식 mod
    },
};

function traceEval(root: Expr): { steps: Step[]; result: TraceValue } {
    const steps: Step[] = [];

    function ev(x: Expr, path: string, depth: number): TraceValue {
        // 숫자·불리언 리터럴은 이미 값이다. 스텝을 만들지 않는다.
        if (typeof x === "number" || typeof x === "boolean") return x;
        if (typeof x === "string") {
            throw new ReferenceError(`이 데모가 모르는 이름: ${x}`);
        }
        steps.push({ kind: "enter", path, expr: x, depth });

        const head = x[0]!;

        // 특수형 if: 조건을 먼저 평가하고, 갈래 하나만 평가한다
        if (head === "if") {
            const test = ev(x[1]!, `${path}.1`, depth + 1);
            const truthy = test !== false && test !== 0; // 엔진의 진리값 규칙(파이썬식)과 동일
            if (truthy) {
                if (x.length > 3) {
                    steps.push({
                        kind: "skip",
                        path: `${path}.3`,
                        expr: x[3]!,
                        reason: "거짓 갈래",
                        depth: depth + 1,
                    });
                }
                const value = ev(x[2]!, `${path}.2`, depth + 1);
                steps.push({ kind: "resolve", path, expr: x, value, depth });
                return value;
            }
            steps.push({
                kind: "skip",
                path: `${path}.2`,
                expr: x[2]!,
                reason: "참 갈래",
                depth: depth + 1,
            });
            const value =
                x.length > 3 ? ev(x[3]!, `${path}.3`, depth + 1) : false;
            steps.push({ kind: "resolve", path, expr: x, value, depth });
            return value;
        }

        // 내장 함수 호출: 인자를 왼쪽부터 전부 평가한 뒤 적용한다
        const fn = typeof head === "string" ? BUILTINS[head] : undefined;
        if (!fn) {
            throw new TypeError(`이 데모가 모르는 함수: ${exprToStr(head)}`);
        }
        const args = x
            .slice(1)
            .map((arg, i) => ev(arg, `${path}.${i + 1}`, depth + 1));
        const value = fn(...args);
        steps.push({ kind: "resolve", path, expr: x, value, depth });
        return value;
    }

    const result = ev(root, "0", 0);
    return { steps, result };
}

// ---------- 표시용 포매터 ----------

function exprToStr(x: Expr): string {
    if (x === true) return "#t";
    if (x === false) return "#f";
    if (Array.isArray(x)) return "(" + x.map(exprToStr).join(" ") + ")";
    return String(x);
}

function fmtValue(v: TraceValue): string {
    if (v === true) return "#t";
    if (v === false) return "#f";
    return String(v);
}

// ---------- 트리 렌더링 ----------

interface TreeView {
    resolved: Map<string, TraceValue>; // 값으로 접힌 부분식들
    skipped: Set<string>; // if가 건너뛴 갈래들
    current: Step | null; // 방금 적용된 스텝 (하이라이트 대상)
}

const renderExpr = (
    expr: Expr,
    path: string,
    view: TreeView,
): React.ReactNode => {
    // 이미 값이 된 부분식은 초록 칩으로 치환한다
    if (view.resolved.has(path)) {
        const justNow =
            view.current?.kind === "resolve" && view.current.path === path;
        return (
            <span
                style={{
                    color: "#2f9e44",
                    background: "#ebfbee",
                    border: justNow ? "1px solid #2f9e44" : "1px solid #b2f2bb",
                    borderRadius: 4,
                    padding: "1px 6px",
                    fontWeight: 700,
                }}
            >
                {fmtValue(view.resolved.get(path)!)}
            </span>
        );
    }

    // 건너뛴 갈래는 서브트리 통째로 회색 취소선
    if (view.skipped.has(path)) {
        return (
            <span style={{ color: "#adb5bd", textDecoration: "line-through" }}>
                {exprToStr(expr)}
            </span>
        );
    }

    const entering =
        view.current?.kind === "enter" && view.current.path === path;
    const highlight: React.CSSProperties | undefined = entering
        ? {
              background: "#e7f5ff",
              border: "1px solid #74c0fc",
              borderRadius: 4,
              padding: "1px 4px",
          }
        : undefined;

    if (!Array.isArray(expr)) {
        return <span style={highlight}>{exprToStr(expr)}</span>;
    }

    return (
        <span style={highlight}>
            {"("}
            {expr.map((child, i) => (
                <React.Fragment key={i}>
                    {i > 0 && " "}
                    {renderExpr(child, `${path}.${i}`, view)}
                </React.Fragment>
            ))}
            {")"}
        </span>
    );
};

// ---------- 컴포넌트 ----------

const PRESETS = [
    "(* (+ 1 2) (- 7 3))",
    "(+ 1 (* 2 (max 3 4)))",
    "(if (> 10 5) (+ 1 1) (/ 1 0))",
];

const stepLog = (step: Step): string => {
    const indent = "  ".repeat(step.depth);
    if (step.kind === "enter")
        return `${indent}${exprToStr(step.expr)} 평가 시작`;
    if (step.kind === "resolve")
        return `${indent}${exprToStr(step.expr)} → ${fmtValue(step.value)}`;
    return `${indent}${exprToStr(step.expr)} 건너뜀 (${step.reason})`;
};

const btnStyle = (disabled: boolean): React.CSSProperties => ({
    padding: "5px 12px",
    fontSize: 12,
    fontFamily: FONT,
    color: disabled ? "#ced4da" : "#495057",
    background: disabled ? "#f8f9fa" : "#fff",
    border: "1px solid #dee2e6",
    borderRadius: 6,
    cursor: disabled ? "default" : "pointer",
});

export const EvalTraceDemo = () => {
    const [presetIndex, setPresetIndex] = useState(0);
    const [stepIndex, setStepIndex] = useState(0); // 0 = 아무것도 하지 않은 원본 트리

    const trace = useMemo(() => {
        const source = PRESETS[presetIndex]!;
        const tree = read(source);
        return { tree, ...traceEval(tree) };
    }, [presetIndex]);

    const total = trace.steps.length;
    const applied = trace.steps.slice(0, stepIndex);

    const view = useMemo<TreeView>(() => {
        const resolved = new Map<string, TraceValue>();
        const skipped = new Set<string>();
        for (const step of applied) {
            if (step.kind === "resolve") resolved.set(step.path, step.value);
            if (step.kind === "skip") skipped.add(step.path);
        }
        return { resolved, skipped, current: applied.at(-1) ?? null };
    }, [applied]);

    const selectPreset = (i: number) => {
        setPresetIndex(i);
        setStepIndex(0);
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
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {PRESETS.map((preset, i) => (
                    <button
                        key={preset}
                        type="button"
                        onClick={() => selectPreset(i)}
                        style={{
                            padding: "3px 10px",
                            fontSize: 12,
                            fontFamily: MONO,
                            color: presetIndex === i ? "#228be6" : "#868e96",
                            background:
                                presetIndex === i ? "#e7f5ff" : "#f8f9fa",
                            border:
                                presetIndex === i
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

            {/* 트리: 스텝이 진행될수록 값으로 접힌다 */}
            <div
                style={{
                    marginTop: 14,
                    padding: "16px 14px",
                    background: "#f8f9fa",
                    border: "1px solid #e9ecef",
                    borderRadius: 6,
                    overflowX: "auto",
                }}
            >
                <div
                    style={{
                        fontFamily: MONO,
                        fontSize: 15,
                        lineHeight: 2,
                        color: "#343a40",
                        whiteSpace: "nowrap",
                    }}
                >
                    {renderExpr(trace.tree, "0", view)}
                </div>
            </div>

            {/* 컨트롤 */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 6,
                    marginTop: 12,
                }}
            >
                <button
                    type="button"
                    onClick={() => setStepIndex(0)}
                    disabled={stepIndex === 0}
                    style={btnStyle(stepIndex === 0)}
                >
                    처음
                </button>
                <button
                    type="button"
                    onClick={() => setStepIndex((s) => Math.max(0, s - 1))}
                    disabled={stepIndex === 0}
                    style={btnStyle(stepIndex === 0)}
                >
                    ◀ 이전
                </button>
                <button
                    type="button"
                    onClick={() => setStepIndex((s) => Math.min(total, s + 1))}
                    disabled={stepIndex === total}
                    style={btnStyle(stepIndex === total)}
                >
                    다음 ▶
                </button>
                <span
                    style={{
                        marginLeft: "auto",
                        fontSize: 12,
                        fontFamily: MONO,
                        color: "#868e96",
                    }}
                >
                    스텝 {stepIndex}/{total}
                </span>
            </div>

            {/* 로그 패널 */}
            <div
                style={{
                    marginTop: 12,
                    padding: "10px 12px",
                    minHeight: 96,
                    background: "#f8f9fa",
                    border: "1px solid #e9ecef",
                    borderRadius: 6,
                    overflowX: "auto",
                }}
            >
                {applied.length === 0 ? (
                    <div
                        style={{
                            fontFamily: MONO,
                            fontSize: 12,
                            color: "#adb5bd",
                        }}
                    >
                        [다음 ▶]을 눌러 평가를 시작하자
                    </div>
                ) : (
                    applied.map((step, i) => (
                        <div
                            key={i}
                            style={{
                                fontFamily: MONO,
                                fontSize: 12,
                                lineHeight: 1.8,
                                whiteSpace: "pre",
                                color:
                                    i === applied.length - 1
                                        ? step.kind === "skip"
                                            ? "#868e96"
                                            : step.kind === "resolve"
                                              ? "#2f9e44"
                                              : "#228be6"
                                        : step.kind === "skip"
                                          ? "#adb5bd"
                                          : "#868e96",
                                fontWeight:
                                    i === applied.length - 1 ? 700 : 400,
                            }}
                        >
                            {stepLog(step)}
                        </div>
                    ))
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
                세 번째 프리셋에서 if가 (/ 1 0)을 평가하지 않고 건너뛰는 순간을
                눈으로 확인해보자.
            </div>
        </div>
    );
};
