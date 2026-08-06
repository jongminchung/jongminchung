// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React from "react";

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

// 하네스 ablation 실측 결과(정적 SVG). 쉬운 과제 세트와 어려운 과제 세트를 나란히 비교한다.
// 실측: 쉬운 세트 n=15/arm, 어려운 세트 n=9/arm (Claude Haiku).
const DATA = [
  { arm: "전체", sub: "도구 전부 + 검증 규칙", easy: 93, hard: 89, base: true },
  { arm: "bash 없음", sub: "테스트 실행 불가", easy: 93, hard: 78, base: false },
  { arm: "검증 규칙 없음", sub: "검증 지시 제거", easy: 100, hard: 100, base: false },
];

const EASY_COLOR = "#adb5bd"; // 쉬운 세트
const HARD_COLOR = "#228be6"; // 어려운 세트(효과가 드러나는 쪽)

const STYLE = `
.bca-abl-card {
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 20px;
  margin: 24px 0;
  background: #fff;
}
.bca-abl-caption {
  text-align: center;
  font-size: 12px;
  color: #637381;
  margin-top: 14px;
  font-family: ${FONT};
}
`;

export const AblationChart = ({ caption }: { caption?: string }) => {
  const barMaxW = 260;
  const labelW = 118;
  const chartX = labelW + 12;
  const barH = 15;
  const barGap = 5;
  const groupH = barH * 2 + barGap;
  const groupPad = 26;
  const W = chartX + barMaxW + 52;
  const top = 26;
  const H = top + DATA.length * (groupH + groupPad) + 4;

  const legend = [
    { c: EASY_COLOR, t: "쉬운 과제 (n=15)" },
    { c: HARD_COLOR, t: "어려운 과제 (n=9)" },
  ];

  return (
    <div className="bca-abl-card" style={{ fontFamily: FONT }}>
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label="쉬운 과제와 어려운 과제에서의 하네스 ablation 통과율 비교"
      >
        {/* 범례 */}
        {legend.map((l, i) => (
          <g key={l.t}>
            <rect x={chartX + i * 150} y={4} width={11} height={11} rx={2} fill={l.c} />
            <text x={chartX + i * 150 + 16} y={13} fontFamily={FONT} fontSize={11} fill="#868e96">
              {l.t}
            </text>
          </g>
        ))}

        {/* 100% 눈금 */}
        <line x1={chartX} y1={top} x2={chartX} y2={H - 4} stroke="#e9ecef" strokeWidth={1} />
        <line
          x1={chartX + barMaxW}
          y1={top}
          x2={chartX + barMaxW}
          y2={H - 4}
          stroke="#e9ecef"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
        <text x={chartX + barMaxW} y={top - 4} fontFamily={FONT} fontSize={9} fill="#ced4da">
          100%
        </text>

        {DATA.map((d, i) => {
          const gy = top + i * (groupH + groupPad);
          const rows = [
            { v: d.easy, color: EASY_COLOR },
            { v: d.hard, color: HARD_COLOR },
          ];
          return (
            <g key={d.arm}>
              {/* arm 이름 + 부가 설명 */}
              <text
                x={labelW}
                y={gy + barH + 2}
                textAnchor="end"
                fontFamily={FONT}
                fontSize={12}
                fontWeight={d.base ? 700 : 500}
                fill={d.base ? "#1971c2" : "#495057"}
              >
                {d.arm}
              </text>
              <text
                x={labelW}
                y={gy + barH + 17}
                textAnchor="end"
                fontFamily={FONT}
                fontSize={9}
                fill="#adb5bd"
              >
                {d.sub}
              </text>

              {rows.map((r, j) => {
                const y = gy + j * (barH + barGap);
                const w = (r.v / 100) * barMaxW;
                return (
                  <g key={j}>
                    <rect x={chartX} y={y} width={barMaxW} height={barH} rx={3} fill="#f1f3f5" />
                    <rect
                      x={chartX}
                      y={y}
                      width={Math.max(w, 2)}
                      height={barH}
                      rx={3}
                      fill={r.color}
                    />
                    <text
                      x={chartX + w + 7}
                      y={y + barH - 3}
                      fontFamily={MONO}
                      fontSize={11}
                      fontWeight={700}
                      fill={r.color}
                    >
                      {r.v}%
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      {caption && <div className="bca-abl-caption">{caption}</div>}
    </div>
  );
};
