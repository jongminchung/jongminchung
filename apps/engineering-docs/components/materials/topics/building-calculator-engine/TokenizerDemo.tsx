// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useMemo, useState } from "react";

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

type TokenType = "number" | "ident" | "op" | "lparen" | "rparen" | "comma" | "eof";

interface Token {
  type: TokenType;
  value: string;
  pos: number; // 원본 문자열에서의 시작 위치
}

interface TokenizeResult {
  tokens: Token[];
  error: { message: string; pos: number } | null;
}

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

function isLetter(ch: string): boolean {
  return /[a-zA-Z가-힣_]/.test(ch);
}

// 글 본문의 tokenize와 동작이 정확히 같다.
// 데모에서는 에러가 나도 그때까지 만든 토큰을 보여주기 위해 throw 대신 결과로 돌려준다.
function tokenize(input: string): TokenizeResult {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    // 공백은 토큰이 아니다. 그냥 지나간다.
    if (ch === " " || ch === "\t") {
      i++;
      continue;
    }

    // 숫자: 연속된 숫자를 소수점 하나까지 포함해 통째로 읽는다
    if (isDigit(ch)) {
      const start = i;
      while (i < input.length && isDigit(input[i])) i++;
      if (input[i] === "." && isDigit(input[i + 1])) {
        i++; // 소수점
        while (i < input.length && isDigit(input[i])) i++;
      }
      tokens.push({ type: "number", value: input.slice(start, i), pos: start });
      continue;
    }

    // 이름: 변수나 함수 이름이 될 글자 덩어리
    if (isLetter(ch)) {
      const start = i;
      while (i < input.length && (isLetter(input[i]) || isDigit(input[i]))) i++;
      tokens.push({ type: "ident", value: input.slice(start, i), pos: start });
      continue;
    }

    // 연산자와 구분자
    if ("+-*/^".includes(ch)) {
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

    return { tokens, error: { message: `이해할 수 없는 문자 '${ch}' (위치 ${i})`, pos: i } };
  }

  tokens.push({ type: "eof", value: "", pos: input.length });
  return { tokens, error: null };
}

const TOKEN_STYLE: Record<TokenType, { color: string; bg: string; border: string }> = {
  number: { color: "#228be6", bg: "#e7f5ff", border: "#a5d8ff" },
  ident: { color: "#845ef7", bg: "#f3f0ff", border: "#d0bfff" },
  op: { color: "#fa5252", bg: "#fff5f5", border: "#ffc9c9" },
  lparen: { color: "#f08c00", bg: "#fff9db", border: "#ffe066" },
  rparen: { color: "#f08c00", bg: "#fff9db", border: "#ffe066" },
  comma: { color: "#868e96", bg: "#f8f9fa", border: "#dee2e6" },
  eof: { color: "#868e96", bg: "#fff", border: "#adb5bd" },
};

const PRESETS = ["1 + 2 * 3", "sqrt(16) + pi", "3.5.2 + @"];

const TokenChip = ({ token }: { token: Token }) => {
  const s = TOKEN_STYLE[token.type];
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        padding: "5px 10px",
        borderRadius: 6,
        background: s.bg,
        border: token.type === "eof" ? `1px dashed ${s.border}` : `1px solid ${s.border}`,
        minWidth: 34,
      }}
    >
      <span style={{ fontSize: 9, fontWeight: 700, color: s.color, letterSpacing: 0.5 }}>
        {token.type}
      </span>
      <span
        style={{
          fontFamily: MONO,
          fontSize: 13,
          color: token.type === "eof" ? "#adb5bd" : "#343a40",
          whiteSpace: "pre",
        }}
      >
        {token.type === "eof" ? "∅" : token.value}
      </span>
      <span style={{ fontSize: 9, color: "#adb5bd" }}>pos {token.pos}</span>
    </div>
  );
};

export const TokenizerDemo = () => {
  const [input, setInput] = useState("12 + 3.5 * (버스요금 - 1)");
  const [focused, setFocused] = useState(false);

  const result = useMemo(() => tokenize(input), [input]);

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
        aria-label="토큰으로 쪼갤 수식"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "10px 12px",
          fontSize: 14,
          fontFamily: MONO,
          color: "#343a40",
          background: "#fff",
          border: focused ? "1px solid #228be6" : "1px solid #ced4da",
          boxShadow: focused ? "0 0 0 2px rgba(34, 139, 230, 0.15)" : "none",
          borderRadius: 6,
          outline: "none",
          transition: "border-color 0.15s, box-shadow 0.15s",
        }}
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
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
              background: input === preset ? "#e7f5ff" : "#f8f9fa",
              border: input === preset ? "1px solid #a5d8ff" : "1px solid #dee2e6",
              borderRadius: 100,
              cursor: "pointer",
            }}
          >
            {preset}
          </button>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          gap: 6,
          marginTop: 16,
          minHeight: 54,
        }}
      >
        {result.tokens.map((token, i) => (
          <TokenChip key={i} token={token} />
        ))}
      </div>

      {result.error && (
        <div
          style={{
            marginTop: 10,
            padding: "10px 12px",
            background: "#fff5f5",
            border: "1px solid #ffc9c9",
            borderRadius: 6,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: "#fa5252" }}>
            {result.error.message}
          </div>
          <div
            style={{
              marginTop: 6,
              fontFamily: MONO,
              fontSize: 13,
              color: "#495057",
              whiteSpace: "pre",
              overflowX: "auto",
            }}
          >
            {input.split("").map((ch, i) => (
              <span
                key={i}
                style={
                  i === result.error!.pos
                    ? {
                        background: "#fa5252",
                        color: "#fff",
                        borderRadius: 2,
                        padding: "1px 2px",
                        margin: "0 1px",
                      }
                    : undefined
                }
              >
                {ch}
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 14, fontSize: 11, color: "#adb5bd", textAlign: "center" }}>
        수식을 자유롭게 고쳐보자. 공백은 토큰이 되지 않는다.
      </div>
    </div>
  );
};
