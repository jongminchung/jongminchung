// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  cancelMaterialFrame,
  scheduleMaterialFrame,
} from "#components/materials/runtime/scheduler";

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

// ===================================================================
// NaturalCalc 엔진: 글에서 만든 세 조각을 하나로 합친 버전
// - 관용 토크나이저(모르는 단어 무시, 콤마 숫자, 문맥 퍼센트)
// - 단위·차원 계산(Quantity = 값 + 차원 지수 벡터)
// - 노트(여러 줄 + 변수 + ans)
// ===================================================================

// ---------- 값: 숫자 + 차원 ----------

interface Dimension {
  length: number;
  time: number;
  mass: number;
}

interface Quantity {
  value: number; // 기준 단위(m, s, kg)로 정규화한 값
  dim: Dimension;
}

const DIMLESS: Dimension = { length: 0, time: 0, mass: 0 };

const UNITS: Record<string, { factor: number; dim: Dimension }> = {
  m: { factor: 1, dim: { length: 1, time: 0, mass: 0 } },
  km: { factor: 1000, dim: { length: 1, time: 0, mass: 0 } },
  cm: { factor: 0.01, dim: { length: 1, time: 0, mass: 0 } },
  s: { factor: 1, dim: { length: 0, time: 1, mass: 0 } },
  min: { factor: 60, dim: { length: 0, time: 1, mass: 0 } },
  h: { factor: 3600, dim: { length: 0, time: 1, mass: 0 } },
  kg: { factor: 1, dim: { length: 0, time: 0, mass: 1 } },
  g: { factor: 0.001, dim: { length: 0, time: 0, mass: 1 } },
};

function sameDim(a: Dimension, b: Dimension): boolean {
  return a.length === b.length && a.time === b.time && a.mass === b.mass;
}

function isDimless(d: Dimension): boolean {
  return d.length === 0 && d.time === 0 && d.mass === 0;
}

// 합성 차원을 기준 단위 조합으로: {length:1,time:-1} → "m/s"
function unitString(d: Dimension): string {
  const base: Array<[keyof Dimension, string]> = [
    ["length", "m"],
    ["mass", "kg"],
    ["time", "s"],
  ];
  const sup = (e: number) => (e === 1 ? "" : e === 2 ? "²" : e === 3 ? "³" : `^${e}`);
  const num: string[] = [];
  const den: string[] = [];
  for (const [key, name] of base) {
    const e = d[key];
    if (e > 0) num.push(name + sup(e));
    if (e < 0) den.push(name + sup(-e));
  }
  let out = num.join("·") || (den.length ? "1" : "");
  if (den.length) out += "/" + den.join("·");
  return out;
}

// "질량은" / "길이는"처럼 받침에 따라 조사를 고른다
function withTopic(word: string): string {
  const code = word.charCodeAt(word.length - 1);
  const hasBatchim = code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
  return word + (hasBatchim ? "은" : "는");
}

function dimName(d: Dimension): string {
  if (isDimless(d)) return "숫자";
  if (sameDim(d, UNITS.m.dim)) return "길이";
  if (sameDim(d, UNITS.s.dim)) return "시간";
  if (sameDim(d, UNITS.kg.dim)) return "질량";
  return unitString(d);
}

// ---------- 토크나이저: 아는 것만 줍고 나머지는 무시한다 ----------

type SpanType = "number" | "op" | "unit" | "keyword" | "ident" | "ignored";

interface Span {
  type: SpanType;
  start: number;
  end: number;
}

type Token =
  | { kind: "number"; value: number }
  | { kind: "unit"; name: string }
  | { kind: "ident"; name: string }
  | { kind: "keyword"; value: "of" | "in" }
  | { kind: "op"; value: string }
  | { kind: "eof" };

const isDigit = (c: string) => c >= "0" && c <= "9";
const isWordChar = (c: string) => /[a-zA-Z가-힣_]/.test(c);

function tokenize(line: string, known: Set<string>): { tokens: Token[]; spans: Span[] } {
  const tokens: Token[] = [];
  const spans: Span[] = [];
  let i = 0;

  while (i < line.length) {
    const ch = line[i];

    if (ch === " " || ch === "\t") {
      i++;
      continue;
    }

    // 숫자: 콤마(4,500)와 소수점 허용
    if (isDigit(ch)) {
      const start = i;
      while (i < line.length && (isDigit(line[i]) || (line[i] === "," && isDigit(line[i + 1]))))
        i++;
      if (line[i] === "." && isDigit(line[i + 1])) {
        i++;
        while (i < line.length && isDigit(line[i])) i++;
      }
      tokens.push({ kind: "number", value: parseFloat(line.slice(start, i).replace(/,/g, "")) });
      spans.push({ type: "number", start, end: i });
      continue;
    }

    // 단어: 단위·키워드·변수만 살아남는다
    if (isWordChar(ch)) {
      const start = i;
      while (i < line.length && isWordChar(line[i])) i++;
      const word = line.slice(start, i);

      if (UNITS[word]) {
        tokens.push({ kind: "unit", name: word });
        spans.push({ type: "unit", start, end: i });
        continue;
      }
      if (word === "of" || word === "in") {
        tokens.push({ kind: "keyword", value: word });
        spans.push({ type: "keyword", start, end: i });
        continue;
      }
      // 할당 대상("이름 = ...")은 처음 보는 이름이라도 살린다
      let j = i;
      while (j < line.length && (line[j] === " " || line[j] === "\t")) j++;
      const isTarget = line[j] === "=";
      if (word === "ans" || known.has(word) || isTarget) {
        tokens.push({ kind: "ident", name: word });
        spans.push({ type: "ident", start, end: i });
        continue;
      }
      // 모르는 단어는 없는 셈 친다
      spans.push({ type: "ignored", start, end: i });
      continue;
    }

    // 연산자 (×, ÷ 도 받아준다)
    const opMap: Record<string, string> = { "×": "*", "÷": "/" };
    const op = opMap[ch] ?? ch;
    if ("+-*/^%()=".includes(op)) {
      tokens.push({ kind: "op", value: op });
      spans.push({ type: "op", start: i, end: i + 1 });
      i++;
      continue;
    }

    // 모르는 문자도 에러 대신 무시를 택한다
    spans.push({ type: "ignored", start: i, end: i + 1 });
    i++;
  }

  tokens.push({ kind: "eof" });
  return { tokens, spans };
}

// ---------- 파서 (Pratt) ----------

type Node =
  | { type: "num"; q: Quantity }
  | { type: "var"; name: string }
  | { type: "percent"; operand: Node }
  | { type: "neg"; operand: Node }
  | { type: "binary"; op: string; left: Node; right: Node }
  | { type: "convert"; operand: Node; unit: string };

const BINDING_POWER: Record<string, [number, number]> = {
  "+": [10, 11],
  "-": [10, 11],
  "*": [20, 21],
  "/": [20, 21],
  of: [20, 21],
  "^": [31, 30],
};

const PERCENT_BP = 40;
const IN_BP = 5; // "in km"는 가장 마지막에 붙는다

class Parser {
  private tokens: Token[];
  private current = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.current];
  }
  private next(): Token {
    return this.tokens[this.current++];
  }

  parse(): Node {
    const node = this.parseExpression(0);
    if (this.peek().kind !== "eof") throw new Error("수식을 끝까지 이해하지 못했다");
    return node;
  }

  private parseExpression(minBp: number): Node {
    let left = this.parsePrefix();

    while (true) {
      const token = this.peek();

      // 후위 %: 어떤 이항 연산자보다 세게 붙는다
      if (token.kind === "op" && token.value === "%" && PERCENT_BP >= minBp) {
        this.next();
        left = { type: "percent", operand: left };
        continue;
      }

      // "in km": 오른쪽에는 단위 이름 하나만 온다
      if (token.kind === "keyword" && token.value === "in" && IN_BP >= minBp) {
        this.next();
        const unit = this.next();
        if (unit.kind !== "unit") throw new Error("in 뒤에는 단위가 와야 한다");
        left = { type: "convert", operand: left, unit: unit.name };
        continue;
      }

      const key =
        token.kind === "keyword" && token.value === "of"
          ? "of"
          : token.kind === "op"
            ? token.value
            : null;
      if (!key) break;
      const bp = BINDING_POWER[key];
      if (!bp || bp[0] < minBp) break;

      this.next();
      const right = this.parseExpression(bp[1]);
      left = { type: "binary", op: key, left, right };
    }

    return left;
  }

  private parsePrefix(): Node {
    const token = this.next();

    if (token.kind === "number") {
      // 숫자 바로 뒤의 단위: 3km, 2h, 200 m
      const unitTok = this.peek();
      if (unitTok.kind === "unit") {
        this.next();
        const u = UNITS[unitTok.name];
        return { type: "num", q: { value: token.value * u.factor, dim: u.dim } };
      }
      return { type: "num", q: { value: token.value, dim: DIMLESS } };
    }
    if (token.kind === "ident") return { type: "var", name: token.name };
    if (token.kind === "op" && token.value === "-") {
      return { type: "neg", operand: this.parseExpression(25) };
    }
    if (token.kind === "op" && token.value === "(") {
      const node = this.parseExpression(0);
      const closing = this.peek();
      if (closing.kind === "op" && closing.value === ")") this.next();
      return node;
    }
    throw new Error("수식이 완성되지 않았다");
  }
}

// ---------- 평가 ----------

interface EvalContext {
  variables: Map<string, Quantity>;
  displayUnit?: string; // "in km"로 지정한 표시 단위
}

function evaluate(node: Node, ctx: EvalContext): Quantity {
  switch (node.type) {
    case "num":
      return node.q;

    case "var": {
      const q = ctx.variables.get(node.name);
      if (!q) {
        throw new Error(node.name === "ans" ? "아직 이전 결과가 없다" : `${node.name} 값을 모른다`);
      }
      return q;
    }

    case "percent": {
      const q = evaluate(node.operand, ctx);
      return { value: q.value / 100, dim: q.dim };
    }

    case "neg": {
      const q = evaluate(node.operand, ctx);
      return { value: -q.value, dim: q.dim };
    }

    case "convert": {
      const q = evaluate(node.operand, ctx);
      const unit = UNITS[node.unit];
      if (!sameDim(q.dim, unit.dim)) {
        throw new Error(`${dimName(q.dim)}를 ${node.unit}로 바꿀 수 없다`);
      }
      ctx.displayUnit = node.unit;
      return q;
    }

    case "binary": {
      const left = evaluate(node.left, ctx);

      // "80 + 10%"의 %는 왼쪽 값에 대한 비율로 해석한다
      if ((node.op === "+" || node.op === "-") && node.right.type === "percent") {
        const rate = evaluate(node.right, ctx).value;
        return {
          value: node.op === "+" ? left.value * (1 + rate) : left.value * (1 - rate),
          dim: left.dim,
        };
      }

      const right = evaluate(node.right, ctx);
      switch (node.op) {
        case "+":
        case "-": {
          if (!sameDim(left.dim, right.dim)) {
            throw new Error(`${dimName(left.dim)}와 ${withTopic(dimName(right.dim))} 더할 수 없다`);
          }
          return {
            value: node.op === "+" ? left.value + right.value : left.value - right.value,
            dim: left.dim,
          };
        }
        case "*":
        case "of":
          return {
            value: left.value * right.value,
            dim: {
              length: left.dim.length + right.dim.length,
              time: left.dim.time + right.dim.time,
              mass: left.dim.mass + right.dim.mass,
            },
          };
        case "/": {
          if (right.value === 0) throw new Error("0으로 나눌 수 없다");
          return {
            value: left.value / right.value,
            dim: {
              length: left.dim.length - right.dim.length,
              time: left.dim.time - right.dim.time,
              mass: left.dim.mass - right.dim.mass,
            },
          };
        }
        case "^": {
          if (!isDimless(left.dim) || !isDimless(right.dim)) {
            throw new Error("지수 계산은 숫자끼리만 가능하다");
          }
          return { value: left.value ** right.value, dim: DIMLESS };
        }
        default:
          throw new Error(`모르는 연산자: ${node.op}`);
      }
    }
  }
}

// ---------- 결과 포맷 ----------

function formatNumber(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function formatQuantity(q: Quantity, displayUnit?: string): string {
  if (displayUnit) {
    return `${formatNumber(q.value / UNITS[displayUnit].factor)} ${displayUnit}`;
  }
  if (isDimless(q.dim)) return formatNumber(q.value);

  const abs = Math.abs(q.value);
  // 단일 기본 차원이면 보기 좋은 단위를 고른다
  if (sameDim(q.dim, UNITS.m.dim)) {
    return abs >= 1000 ? `${formatNumber(q.value / 1000)} km` : `${formatNumber(q.value)} m`;
  }
  if (sameDim(q.dim, UNITS.s.dim)) {
    if (abs >= 3600) return `${formatNumber(q.value / 3600)} h`;
    if (abs >= 60) return `${formatNumber(q.value / 60)} min`;
    return `${formatNumber(q.value)} s`;
  }
  if (sameDim(q.dim, UNITS.kg.dim)) {
    return abs >= 1 ? `${formatNumber(q.value)} kg` : `${formatNumber(q.value * 1000)} g`;
  }
  // 합성 차원은 기준 단위 조합으로: 12.5 m/s
  return `${formatNumber(q.value)} ${unitString(q.dim)}`;
}

// ---------- 노트: 위에서 아래로 계산하며 변수를 쌓는다 ----------

interface LineOutput {
  spans: Span[];
  result?: string;
  error?: string;
}

function runNote(lines: string[]): LineOutput[] {
  const variables = new Map<string, Quantity>();
  const outputs: LineOutput[] = [];

  for (const line of lines) {
    const known = new Set(variables.keys());
    const { tokens, spans } = tokenize(line, known);

    // 계산할 것이 하나도 없는 줄은 조용히 넘어간다
    if (tokens.length <= 1) {
      outputs.push({ spans });
      continue;
    }

    try {
      // "이름 = 수식" 꼴이면 할당문이다
      let target: string | null = null;
      let exprTokens = tokens;
      const first = tokens[0];
      const second = tokens[1];
      if (first.kind === "ident" && second?.kind === "op" && second.value === "=") {
        target = first.name;
        exprTokens = tokens.slice(2);
      }
      if (exprTokens.length <= 1) {
        outputs.push({ spans });
        continue;
      }

      const ast = new Parser(exprTokens).parse();
      const ctx: EvalContext = { variables };
      const value = evaluate(ast, ctx);
      if (!Number.isFinite(value.value)) throw new Error("계산 결과가 정의되지 않는다");

      if (target) variables.set(target, value);
      variables.set("ans", value); // 직전 결과
      outputs.push({ spans, result: formatQuantity(value, ctx.displayUnit) });
    } catch (e) {
      outputs.push({ spans, error: (e as Error).message });
    }
  }

  return outputs;
}

// ===================================================================
// UI
// ===================================================================

const MAX_LINES = 30;

const SPAN_COLORS: Record<SpanType, string> = {
  number: "#228be6",
  op: "#495057",
  unit: "#845ef7",
  keyword: "#845ef7",
  ident: "#2b8a3e",
  ignored: "#adb5bd",
};

const DEFAULT_LINES = [
  "점심 8,000원 + 커피 4,500원",
  "하루지출 = ans",
  "하루지출 * 30일",
  "20% of 80",
  "숙소까지 3km + 200m",
  "90km / 2h",
];

// 스팬 정보로 한 줄을 색칠한다. 스팬 밖의 문자(공백 등)는 기본색.
function renderHighlighted(text: string, spans: Span[]): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let pos = 0;
  spans.forEach((span, k) => {
    if (span.start > pos) {
      parts.push(
        <span key={`g${k}`} style={{ color: "#495057" }}>
          {text.slice(pos, span.start)}
        </span>,
      );
    }
    parts.push(
      <span key={`s${k}`} style={{ color: SPAN_COLORS[span.type] }}>
        {text.slice(span.start, span.end)}
      </span>,
    );
    pos = span.end;
  });
  if (pos < text.length) {
    parts.push(
      <span key="tail" style={{ color: "#495057" }}>
        {text.slice(pos)}
      </span>,
    );
  }
  return parts;
}

export const NaturalCalcDemo = () => {
  const [lines, setLines] = useState<string[]>(DEFAULT_LINES);
  const [focusedRow, setFocusedRow] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const overlayRefs = useRef<Array<HTMLDivElement | null>>([]);
  const pendingFocus = useRef<{ row: number; col: number } | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 479px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // 줄 추가/삭제 후 커서를 옮긴다
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    const input = inputRefs.current[target.row];
    if (input) {
      input.focus();
      const col = Math.min(target.col, input.value.length);
      input.setSelectionRange(col, col);
    }
  });

  // 줄이 바뀔 때마다 노트 전체를 위에서부터 재평가한다 (변수 전파)
  const outputs = useMemo(() => runNote(lines), [lines]);

  const syncScroll = (row: number) => {
    const input = inputRefs.current[row];
    const overlay = overlayRefs.current[row];
    if (input && overlay) overlay.scrollLeft = input.scrollLeft;
  };

  const handleChange = (row: number, value: string) => {
    setLines((prev) => prev.map((line, i) => (i === row ? value : line)));
    scheduleMaterialFrame(() => syncScroll(row));
  };

  const handleKeyDown = (row: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const caret = input.selectionStart ?? 0;

    if (e.key === "Enter") {
      e.preventDefault();
      if (lines.length >= MAX_LINES) return;
      // 커서 위치에서 줄을 자르고 새 줄을 만든다
      const before = input.value.slice(0, caret);
      const after = input.value.slice(input.selectionEnd ?? caret);
      setLines((prev) => [...prev.slice(0, row), before, after, ...prev.slice(row + 1)]);
      pendingFocus.current = { row: row + 1, col: 0 };
      return;
    }

    if (e.key === "Backspace" && caret === 0 && input.selectionEnd === 0 && row > 0) {
      e.preventDefault();
      // 줄 맨 앞에서 지우면 윗줄과 합쳐진다 (빈 줄이면 그냥 삭제)
      const prevLine = lines[row - 1];
      setLines((prev) => [
        ...prev.slice(0, row - 1),
        prevLine + input.value,
        ...prev.slice(row + 1),
      ]);
      pendingFocus.current = { row: row - 1, col: prevLine.length };
      return;
    }

    if (e.key === "ArrowUp" && row > 0) {
      e.preventDefault();
      const above = inputRefs.current[row - 1];
      if (above) {
        above.focus();
        const col = Math.min(caret, above.value.length);
        above.setSelectionRange(col, col);
      }
      return;
    }

    if (e.key === "ArrowDown" && row < lines.length - 1) {
      e.preventDefault();
      const below = inputRefs.current[row + 1];
      if (below) {
        below.focus();
        const col = Math.min(caret, below.value.length);
        below.setSelectionRange(col, col);
      }
    }
  };

  const fontSize = isMobile ? 13 : 14;
  const rowHeight = isMobile ? 26 : 28;
  const resultWidth = isMobile ? 88 : 130;

  const textStyle: React.CSSProperties = {
    fontFamily: MONO,
    fontSize,
    lineHeight: `${rowHeight}px`,
    padding: "0 6px",
    whiteSpace: "pre",
    boxSizing: "border-box",
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
      <div>
        {lines.map((line, row) => {
          const output = outputs[row];
          const focused = focusedRow === row;
          return (
            <div
              key={row}
              style={{
                display: "flex",
                alignItems: "center",
                gap: isMobile ? 6 : 10,
                background: focused ? "#f8f9fa" : "transparent",
                borderRadius: 4,
              }}
            >
              <div style={{ position: "relative", flex: 1, minWidth: 0, height: rowHeight }}>
                <div
                  ref={(el) => {
                    overlayRefs.current[row] = el;
                  }}
                  aria-hidden
                  style={{
                    ...textStyle,
                    position: "absolute",
                    inset: 0,
                    overflow: "hidden",
                    pointerEvents: "none",
                    color: "#495057",
                  }}
                >
                  {renderHighlighted(line, output?.spans ?? [])}
                </div>
                <input
                  ref={(el) => {
                    inputRefs.current[row] = el;
                  }}
                  type="text"
                  value={line}
                  onChange={(e) => handleChange(row, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(row, e)}
                  onScroll={() => syncScroll(row)}
                  onFocus={() => setFocusedRow(row)}
                  onBlur={() => setFocusedRow((cur) => (cur === row ? null : cur))}
                  spellCheck={false}
                  autoComplete="off"
                  aria-label={`계산 노트 ${row + 1}번째 줄`}
                  style={{
                    ...textStyle,
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    border: "none",
                    outline: "none",
                    margin: 0,
                    background: "transparent",
                    color: "transparent",
                    caretColor: "#212529",
                  }}
                />
              </div>
              <div
                style={{
                  width: resultWidth,
                  flexShrink: 0,
                  textAlign: "right",
                  fontFamily: MONO,
                  lineHeight: `${rowHeight}px`,
                  paddingRight: 6,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontSize: output?.error ? (isMobile ? 11 : 12) : fontSize,
                  fontWeight: output?.error ? 400 : 700,
                  color: output?.error ? "#fa5252" : "#228be6",
                }}
                title={output?.error ?? output?.result}
              >
                {output?.error ?? output?.result ?? ""}
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 10,
          fontSize: 11,
          color: "#adb5bd",
          textAlign: "center",
        }}
      >
        자유롭게 고쳐 써보자. 회색으로 표시된 단어는 엔진이 무시한 부분이다.
      </div>
    </div>
  );
};
