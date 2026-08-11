// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  SvgCanvas,
  type SvgCanvasHandle,
  type SvgDrawingContext,
  type SvgGradient,
} from "#components/materials/runtime/svg-canvas";

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

// ===================================================================
// 토크나이저 + Pratt 파서 + 평가기 (본문 코드와 동일한 동작)
// ===================================================================

type TokenType = "number" | "ident" | "op" | "lparen" | "rparen" | "comma" | "eof";

interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

function isLetter(ch: string): boolean {
  return /[a-zA-Z가-힣_]/.test(ch);
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (ch === " " || ch === "\t") {
      i++;
      continue;
    }

    if (isDigit(ch)) {
      const start = i;
      while (i < input.length && isDigit(input[i])) i++;
      if (input[i] === "." && isDigit(input[i + 1])) {
        i++;
        while (i < input.length && isDigit(input[i])) i++;
      }
      tokens.push({ type: "number", value: input.slice(start, i), pos: start });
      continue;
    }

    if (isLetter(ch)) {
      const start = i;
      while (i < input.length && (isLetter(input[i]) || isDigit(input[i]))) i++;
      tokens.push({ type: "ident", value: input.slice(start, i), pos: start });
      continue;
    }

    if ("+-*/^=".includes(ch)) {
      tokens.push({ type: "op", value: ch, pos: i });
      i++;
      continue;
    }
    if (ch === "(") {
      tokens.push({ type: "lparen", value: ch, pos: i });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "rparen", value: ch, pos: i });
      i++;
      continue;
    }
    if (ch === ",") {
      tokens.push({ type: "comma", value: ch, pos: i });
      i++;
      continue;
    }

    throw new Error(`이해할 수 없는 문자 '${ch}' (위치 ${i})`);
  }

  tokens.push({ type: "eof", value: "", pos: input.length });
  return tokens;
}

type AstNode =
  | { type: "num"; value: number }
  | { type: "ident"; name: string }
  | { type: "unary"; op: string; operand: AstNode }
  | { type: "binary"; op: string; left: AstNode; right: AstNode }
  | { type: "call"; name: string; args: AstNode[] };

// [왼쪽 힘, 오른쪽 힘] — 왼쪽 힘 < 오른쪽 힘이면 좌결합, 반대면 우결합
const BINDING_POWER: Record<string, [number, number]> = {
  "+": [10, 11],
  "-": [10, 11],
  "*": [20, 21],
  "/": [20, 21],
  "^": [31, 30], // 우결합
};

class PrattParser {
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

  private expect(type: TokenType): Token {
    const token = this.peek();
    if (token.type !== type) {
      throw new Error(
        `${type}이 와야 하는데 '${token.value || "입력 끝"}'을 만났다 (위치 ${token.pos})`,
      );
    }
    return this.next();
  }

  parse(): AstNode {
    const node = this.parseExpression(0);
    const token = this.peek();
    if (token.type !== "eof") {
      throw new Error(`수식이 끝났는데 '${token.value}'가 남아 있다 (위치 ${token.pos})`);
    }
    return node;
  }

  private parseExpression(minBp: number): AstNode {
    let left = this.parsePrefix();

    while (true) {
      const token = this.peek();
      if (token.type !== "op") break;

      const bp = BINDING_POWER[token.value];
      if (!bp || bp[0] < minBp) break;

      this.next();
      const right = this.parseExpression(bp[1]);
      left = { type: "binary", op: token.value, left, right };
    }

    return left;
  }

  private parsePrefix(): AstNode {
    const token = this.next();

    if (token.type === "number") {
      return { type: "num", value: parseFloat(token.value) };
    }

    if (token.type === "op" && token.value === "-") {
      // 단항 마이너스는 곱셈보다 세게, 거듭제곱보다 약하게
      return { type: "unary", op: "-", operand: this.parseExpression(25) };
    }

    if (token.type === "ident") {
      if (this.peek().type === "lparen") {
        this.next();
        const args: AstNode[] = [];
        if (this.peek().type !== "rparen") {
          args.push(this.parseExpression(0));
          while (this.peek().type === "comma") {
            this.next();
            args.push(this.parseExpression(0));
          }
        }
        this.expect("rparen");
        return { type: "call", name: token.value, args };
      }
      return { type: "ident", name: token.value };
    }

    if (token.type === "lparen") {
      const node = this.parseExpression(0);
      this.expect("rparen");
      return node;
    }

    throw new Error(
      `숫자나 괄호가 와야 하는데 '${token.value || "입력 끝"}'을 만났다 (위치 ${token.pos})`,
    );
  }
}

interface Environment {
  variables: Map<string, number>;
  functions: Map<string, (...args: number[]) => number>;
}

function createEnvironment(): Environment {
  return {
    variables: new Map<string, number>([
      ["pi", Math.PI],
      ["e", Math.E],
    ]),
    functions: new Map<string, (...args: number[]) => number>([
      ["sqrt", Math.sqrt],
      ["sin", Math.sin],
      ["cos", Math.cos],
      ["abs", Math.abs],
      ["round", Math.round],
      ["min", Math.min],
      ["max", Math.max],
    ]),
  };
}

function evaluate(node: AstNode, env: Environment): number {
  switch (node.type) {
    case "num":
      return node.value;

    case "ident": {
      const value = env.variables.get(node.name);
      if (value === undefined) throw new Error(`모르는 이름: ${node.name}`);
      return value;
    }

    case "unary":
      return -evaluate(node.operand, env);

    case "binary": {
      const left = evaluate(node.left, env);
      const right = evaluate(node.right, env);
      switch (node.op) {
        case "+":
          return left + right;
        case "-":
          return left - right;
        case "*":
          return left * right;
        case "/":
          if (right === 0) throw new Error("0으로 나눌 수 없다");
          return left / right;
        case "^":
          return left ** right;
        default:
          throw new Error(`모르는 연산자: ${node.op}`);
      }
    }

    case "call": {
      const fn = env.functions.get(node.name);
      if (!fn) throw new Error(`모르는 함수: ${node.name}`);
      const args = node.args.map((arg) => evaluate(arg, env));
      return fn(...args);
    }
  }
}

// ===================================================================
// 트리 레이아웃 — 서브트리 리프 개수 기반 가로 폭 배분 (검증 완료)
// ===================================================================

interface Placed {
  node: AstNode;
  label: string;
  x: number; // 리프 단위 좌표 (0 ~ totalLeaves)
  depth: number;
  children: Placed[];
}

function childrenOf(node: AstNode): AstNode[] {
  switch (node.type) {
    case "binary":
      return [node.left, node.right];
    case "unary":
      return [node.operand];
    case "call":
      return node.args;
    default:
      return [];
  }
}

function formatValue(v: number): string {
  if (!Number.isFinite(v)) return String(v);
  if (Number.isInteger(v)) return String(v);
  return String(parseFloat(v.toPrecision(6)));
}

function labelOf(node: AstNode): string {
  switch (node.type) {
    case "num":
      return formatValue(node.value);
    case "ident":
      return node.name;
    case "unary":
      return node.op;
    case "binary":
      return node.op;
    case "call":
      return node.name;
  }
}

function leafCount(node: AstNode): number {
  const kids = childrenOf(node);
  if (kids.length === 0) return 1;
  return kids.reduce((sum, k) => sum + leafCount(k), 0);
}

function place(node: AstNode, startSlot: number, depth: number): Placed {
  const kids = childrenOf(node);
  if (kids.length === 0) {
    return { node, label: labelOf(node), x: startSlot + 0.5, depth, children: [] };
  }
  let slot = startSlot;
  const placedKids: Placed[] = [];
  for (const kid of kids) {
    placedKids.push(place(kid, slot, depth + 1));
    slot += leafCount(kid);
  }
  // 부모는 자식들 x의 평균 — 항상 자기 span 안에 머물러 겹치지 않는다
  const x = placedKids.reduce((s, k) => s + k.x, 0) / placedKids.length;
  return { node, label: labelOf(node), x, depth, children: placedKids };
}

function layoutTree(root: AstNode): { root: Placed; totalLeaves: number; maxDepth: number } {
  const placed = place(root, 0, 0);
  let maxDepth = 0;
  const walk = (p: Placed) => {
    if (p.depth > maxDepth) maxDepth = p.depth;
    p.children.forEach(walk);
  };
  walk(placed);
  return { root: placed, totalLeaves: leafCount(root), maxDepth };
}

// ===================================================================
// 노드 색상
// ===================================================================

function nodeStyle(node: AstNode): { fill: string; stroke: string; text: string } {
  switch (node.type) {
    case "binary":
    case "unary":
      return { fill: "#e7f5ff", stroke: "#228be6", text: "#1971c2" };
    case "ident":
      return { fill: "#f3f0ff", stroke: "#845ef7", text: "#7048e8" };
    case "call":
      return { fill: "#ebfbee", stroke: "#40c057", text: "#2f9e44" };
    case "num":
      return { fill: "#fff", stroke: "#dee2e6", text: "#495057" };
  }
}

const PRESETS = ["1 + 2 * 3", "(1 + 2) * 3", "10 - 4 - 3", "2 ^ 3 ^ 2", "-2 ^ 2", "max(1, 2 + 3)"];

// ===================================================================
// 컴포넌트
// ===================================================================

export const AstDemo = () => {
  const [input, setInput] = useState("1 + 2 * 3");
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<SvgCanvasHandle>(null);

  const parsed = useMemo(() => {
    try {
      const ast = new PrattParser(tokenize(input)).parse();
      const env = createEnvironment();
      let result: number | null = null;
      let evalError: string | null = null;
      try {
        result = evaluate(ast, env);
      } catch (e) {
        evalError = e instanceof Error ? e.message : String(e);
      }
      return { ok: true as const, ast, env, result, evalError };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
    }
  }, [input]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const draw = () => {
      const w = container.clientWidth;
      if (w <= 0) return;
      const dpr = window.devicePixelRatio || 1;
      const isMobile = w < 480;

      if (!parsed.ok) {
        // 에러 시에는 캔버스를 비운다 (에러 박스는 DOM으로 표시)
        canvas.width = w * dpr;
        canvas.height = 1;
        canvas.style.width = `${w}px`;
        canvas.style.height = "0px";
        return;
      }

      const { root, totalLeaves, maxDepth } = layoutTree(parsed.ast);

      const fs = Math.max(isMobile ? 10 : 12, Math.min(13, w / 40));
      const nodeH = isMobile ? 26 : 32;
      const levelGap = isMobile ? 54 : 68;
      const padX = 12;
      const padY = 10;

      const h = padY * 2 + nodeH + maxDepth * levelGap;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);
      ctx.font = `600 ${fs}px ${MONO}`;

      // 리프 단위 → 픽셀 변환 (트리 전체가 폭에 맞게 스케일, 최대 간격 제한)
      const unitX = Math.min((w - padX * 2) / totalLeaves, isMobile ? 72 : 96);
      const treeW = totalLeaves * unitX;
      const offsetX = padX + (w - padX * 2 - treeW) / 2;
      const px = (p: Placed) => offsetX + p.x * unitX;
      const py = (p: Placed) => padY + nodeH / 2 + p.depth * levelGap;

      // 노드별 부분 결과 (내부 노드에만 표시)
      const partial = (node: AstNode): string | null => {
        if (node.type === "num" || node.type === "ident") return null;
        try {
          return formatValue(evaluate(node, parsed.env));
        } catch {
          return null;
        }
      };

      // 1) 간선 먼저
      ctx.strokeStyle = "#adb5bd";
      ctx.lineWidth = 1;
      const drawEdges = (p: Placed) => {
        for (const c of p.children) {
          ctx.beginPath();
          ctx.moveTo(px(p), py(p) + nodeH / 2);
          ctx.lineTo(px(c), py(c) - nodeH / 2);
          ctx.stroke();
          drawEdges(c);
        }
      };
      drawEdges(root);

      // 2) 노드 (알약 모양: 짧은 라벨은 원, 긴 라벨은 둥근 사각)
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const drawNodes = (p: Placed) => {
        const cx = px(p);
        const cy = py(p);
        const style = nodeStyle(p.node);
        const textW = ctx.measureText(p.label).width;
        const nodeW = Math.max(nodeH, textW + (isMobile ? 12 : 16));

        ctx.beginPath();
        ctx.roundRect(cx - nodeW / 2, cy - nodeH / 2, nodeW, nodeH, nodeH / 2);
        ctx.fillStyle = style.fill;
        ctx.fill();
        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = style.text;
        ctx.fillText(p.label, cx, cy + 0.5);

        // 부분 결과: 내부 노드 오른쪽 옆 작은 회색 글씨
        const pv = partial(p.node);
        if (pv !== null) {
          ctx.font = `${Math.max(10, fs - 2)}px ${MONO}`;
          ctx.fillStyle = "#868e96";
          ctx.textAlign = "left";
          ctx.fillText(pv, cx + nodeW / 2 + 5, cy + 0.5);
          ctx.textAlign = "center";
          ctx.font = `600 ${fs}px ${MONO}`;
        }

        p.children.forEach(drawNodes);
      };
      drawNodes(root);
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(container);
    return () => ro.disconnect();
  }, [parsed]);

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
        spellCheck={false}
        autoComplete="off"
        aria-label="수식 입력"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "8px 12px",
          fontSize: 14,
          fontFamily: MONO,
          color: "#495057",
          border: "1px solid #dee2e6",
          borderRadius: 6,
          outline: "none",
          background: "#f8f9fa",
        }}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {PRESETS.map((preset) => {
          const active = preset === input;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => setInput(preset)}
              style={{
                padding: "3px 10px",
                fontSize: 12,
                fontFamily: MONO,
                color: active ? "#1971c2" : "#868e96",
                background: active ? "#e7f5ff" : "#fff",
                border: `1px solid ${active ? "#228be6" : "#dee2e6"}`,
                borderRadius: 999,
                cursor: "pointer",
              }}
            >
              {preset}
            </button>
          );
        })}
      </div>

      {parsed.ok ? (
        <>
          <div ref={containerRef} style={{ marginTop: 16 }}>
            <SvgCanvas ref={canvasRef} style={{ display: "block", width: "100%" }} />
          </div>
          {parsed.evalError ? (
            <div
              style={{
                marginTop: 12,
                textAlign: "center",
                fontFamily: MONO,
                fontSize: 13,
                color: "#e03131",
              }}
            >
              {parsed.evalError}
            </div>
          ) : (
            <div
              style={{
                marginTop: 12,
                textAlign: "center",
                fontFamily: MONO,
                fontSize: 18,
                fontWeight: 700,
                color: "#228be6",
              }}
            >
              {`= ${formatValue(parsed.result!)}`}
            </div>
          )}
        </>
      ) : (
        <div
          style={{
            marginTop: 16,
            padding: "14px 16px",
            background: "#fff5f5",
            border: "1px solid #ffc9c9",
            borderRadius: 6,
            fontSize: 13,
            color: "#c92a2a",
            fontFamily: MONO,
          }}
        >
          {parsed.error}
        </div>
      )}

      <div style={{ fontSize: 11, color: "#adb5bd", textAlign: "center", marginTop: 12 }}>
        괄호를 넣어 트리 모양이 어떻게 바뀌는지 확인해보자.
      </div>
    </div>
  );
};
