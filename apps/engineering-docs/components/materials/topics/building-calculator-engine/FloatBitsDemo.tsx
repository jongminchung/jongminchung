// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useEffect, useMemo, useState } from "react";

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = 'SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

interface FloatInfo {
  bits: string; // 64자리 '0'/'1'
  sign: number; // 0 | 1
  E: number; // 지수 필드 (0~2047)
  M: bigint; // 가수 필드 (52비트)
  significand: string; // 십진 유효숫자 (toPrecision 기반)
  exponent2: number; // 2의 지수 (해석 줄용)
  exact: string; // 정확한 십진 전개
}

function trimNumberString(s: string): string {
  if (!s.includes(".")) return s;
  return s.replace(/0+$/, "").replace(/\.$/, "");
}

function analyze(x: number): FloatInfo {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  const raw = view.getBigUint64(0);

  const sign = Number(raw >> 63n);
  const E = Number((raw >> 52n) & 0x7ffn);
  const M = raw & 0xfffffffffffffn;
  const bits = raw.toString(2).padStart(64, "0");

  // 정규수: 유효숫자 1.M × 2^(E-1075+52), 비정규수: 0.M × 2^(-1074+52)
  let frac: bigint;
  let e2: number;
  if (E === 0) {
    frac = M;
    e2 = -1074;
  } else {
    frac = (1n << 52n) | M;
    e2 = E - 1075;
  }

  // 정확한 십진 전개
  let exact: string;
  if (E === 0 && M === 0n) {
    exact = "0";
  } else if (e2 >= 0) {
    exact = (frac << BigInt(e2)).toString();
  } else {
    // frac × 2^e2 = frac × 5^(-e2) / 10^(-e2)
    const digits = (frac * 5n ** BigInt(-e2)).toString();
    const point = -e2;
    const padded = digits.padStart(point + 1, "0");
    const intPart = padded.slice(0, padded.length - point);
    const fracPart = padded.slice(padded.length - point).replace(/0+$/, "");
    exact = fracPart.length > 0 ? `${intPart}.${fracPart}` : intPart;
  }
  if (sign === 1) exact = `-${exact}`;

  const significand = trimNumberString((Number(frac) / 2 ** 52).toPrecision(17));

  return { bits, sign, E, M, significand, exponent2: e2 + 52, exact };
}

// 입력 문자열을 십진 표기로 정규화한다. 일반 십진 표기가 아니면 null.
function canonicalDecimal(s: string): string | null {
  const m = s.trim().match(/^([+-]?)(\d+)(?:\.(\d*))?$/);
  if (!m) return null;
  const neg = m[1] === "-";
  const int = m[2].replace(/^0+(?=\d)/, "");
  const frac = (m[3] ?? "").replace(/0+$/, "");
  const body = frac.length > 0 ? `${int}.${frac}` : int;
  if (body === "0") return "0";
  return neg ? `-${body}` : body;
}

function chunk8(s: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += 8) out.push(s.slice(i, i + 8));
  return out;
}

const PRESETS: Array<{ label: string; value: string }> = [
  { label: "0.1", value: "0.1" },
  { label: "0.2", value: "0.2" },
  { label: "0.3", value: "0.3" },
  { label: "0.25", value: "0.25" },
  { label: "0.1+0.2", value: "0.30000000000000004" },
];

interface GroupStyle {
  label: string;
  labelColor: string;
  onBg: string;
  offBg: string;
}

const GROUPS: GroupStyle[] = [
  { label: "부호(1)", labelColor: "#fa5252", onBg: "#fa5252", offBg: "#fff5f5" },
  { label: "지수(11)", labelColor: "#f08c00", onBg: "#f08c00", offBg: "#fff9db" },
  { label: "가수(52)", labelColor: "#228be6", onBg: "#228be6", offBg: "#e7f5ff" },
];

export const FloatBitsDemo = () => {
  const [input, setInput] = useState("0.1");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 479px)");
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const num = input.trim() === "" ? NaN : Number(input);
  const valid = Number.isFinite(num);
  const info = useMemo(() => (valid ? analyze(num) : null), [valid, num]);

  const canonical = canonicalDecimal(input);
  const isExact = info !== null && canonical !== null && canonical === info.exact;

  const cellW = isMobile ? 11 : 16;
  const cellH = isMobile ? 16 : 22;
  const cellFs = isMobile ? 8 : 10;

  const bitCell = (bit: string, g: GroupStyle, key: number) => (
    <div
      key={key}
      style={{
        width: cellW,
        height: cellH,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 3,
        background: bit === "1" ? g.onBg : g.offBg,
        color: bit === "1" ? "#fff" : "#adb5bd",
        fontFamily: MONO,
        fontSize: cellFs,
        fontWeight: bit === "1" ? 700 : 400,
      }}
    >
      {bit}
    </div>
  );

  const fields: Array<[GroupStyle, string]> | null = info
    ? [
        [GROUPS[0], info.bits.slice(0, 1)],
        [GROUPS[1], info.bits.slice(1, 12)],
        [GROUPS[2], info.bits.slice(12)],
      ]
    : null;

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
      {/* 입력 + 프리셋 */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          aria-label="십진 소수 입력"
          style={{
            fontFamily: MONO,
            fontSize: 14,
            padding: "6px 10px",
            border: "1px solid #dee2e6",
            borderRadius: 6,
            width: isMobile ? "100%" : 200,
            boxSizing: "border-box",
            color: "#495057",
            outline: "none",
          }}
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {PRESETS.map((p) => {
            const active = input === p.value;
            return (
              <button
                key={p.label}
                onClick={() => setInput(p.value)}
                style={{
                  fontFamily: MONO,
                  fontSize: 12,
                  padding: "4px 10px",
                  borderRadius: 12,
                  border: active ? "1px solid #228be6" : "1px solid #dee2e6",
                  background: active ? "#e7f5ff" : "#f8f9fa",
                  color: active ? "#1971c2" : "#495057",
                  cursor: "pointer",
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {!info && (
        <div
          style={{
            marginTop: 16,
            padding: "14px 12px",
            borderRadius: 6,
            background: "#f8f9fa",
            color: "#868e96",
            fontSize: 13,
            textAlign: "center",
          }}
        >
          유한한 숫자를 입력하면 64비트로 어떻게 저장되는지 보여준다.
        </div>
      )}

      {info && fields && (
        <>
          {/* 64비트 표시 */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "flex-start",
              columnGap: isMobile ? 8 : 12,
              rowGap: 10,
              marginTop: 16,
            }}
          >
            {fields.map(([g, bits], fi) => (
              <div key={fi}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: g.labelColor,
                    marginBottom: 4,
                  }}
                >
                  {g.label}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", columnGap: 6, rowGap: 5 }}>
                  {chunk8(bits).map((byte, bi) => (
                    <div key={bi} style={{ display: "flex", gap: 2 }}>
                      {byte.split("").map((b, i) => bitCell(b, g, bi * 8 + i))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* 해석 줄 */}
          <div
            style={{
              marginTop: 12,
              fontFamily: MONO,
              fontSize: 13,
              color: "#495057",
              overflowWrap: "break-word",
            }}
          >
            (-1)^{info.sign} × {info.significand} × 2^{info.exponent2}
          </div>

          {/* 입력값 vs 실제 저장값 */}
          <div
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 6,
              background: "#f8f9fa",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
              <span style={{ fontSize: 12, color: "#868e96", flexShrink: 0, width: 90 }}>
                입력한 값
              </span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#228be6",
                  wordBreak: "break-all",
                }}
              >
                {input.trim()}
              </span>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
              <span style={{ fontSize: 12, color: "#868e96", flexShrink: 0, width: 90 }}>
                실제 저장된 값
              </span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 13,
                  fontWeight: 700,
                  color: isExact ? "#2f9e44" : "#e03131",
                  wordBreak: "break-all",
                }}
              >
                {info.exact}
                {isExact && (
                  <span
                    style={{
                      display: "inline-block",
                      marginLeft: 8,
                      padding: "2px 8px",
                      borderRadius: 10,
                      border: "1px solid #40c057",
                      background: "#d3f9d8",
                      color: "#2f9e44",
                      fontFamily: FONT,
                      fontSize: 11,
                      fontWeight: 700,
                      verticalAlign: "middle",
                    }}
                  >
                    정확히 표현된다
                  </span>
                )}
              </span>
            </div>
          </div>
        </>
      )}

      <div style={{ marginTop: 12, fontSize: 11, color: "#adb5bd", textAlign: "center" }}>
        분모가 2의 거듭제곱인 소수만 정확히 저장된다. 0.5나 0.25를 넣어보자.
      </div>
    </div>
  );
};
