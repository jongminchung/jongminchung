// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React from "react";

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

// 턴이 쌓일수록 매 턴 전송하는 컨텍스트가 커지는 걸 보여주는 정적 막대 다이어그램.
// 도구 결과(특히 파일 내용)가 컨텍스트 대부분을 차지한다는 게 한눈에 보이게 한다.

// 각 층의 상대 크기(임의 단위). 도구 결과가 게걸스럽게 먹는다.
type Layer = { key: string; label: string; color: string };
const LAYERS: Record<string, Layer> = {
  system: { key: "system", label: "시스템 프롬프트", color: "#adb5bd" },
  user: { key: "user", label: "사용자 요청", color: "#228be6" },
  tool: { key: "tool", label: "도구 결과 (파일 내용 등)", color: "#f76707" },
};

// 턴별 층 구성. 도구 결과가 턴마다 누적되며 커진다.
const TURNS: { turn: number; segments: { layer: string; size: number }[] }[] = [
  {
    turn: 1,
    segments: [
      { layer: "system", size: 8 },
      { layer: "user", size: 6 },
    ],
  },
  {
    turn: 2,
    segments: [
      { layer: "system", size: 8 },
      { layer: "user", size: 6 },
      { layer: "tool", size: 20 },
    ],
  },
  {
    turn: 3,
    segments: [
      { layer: "system", size: 8 },
      { layer: "user", size: 6 },
      { layer: "tool", size: 44 },
    ],
  },
  {
    turn: 4,
    segments: [
      { layer: "system", size: 8 },
      { layer: "user", size: 6 },
      { layer: "tool", size: 76 },
    ],
  },
  {
    turn: 5,
    segments: [
      { layer: "system", size: 8 },
      { layer: "user", size: 6 },
      { layer: "tool", size: 118 },
    ],
  },
];

const STYLE = `
.bca-ctx-card {
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 20px;
  margin: 24px 0;
  background: #fff;
}
.bca-ctx-caption {
  text-align: center;
  font-size: 12px;
  color: #637381;
  margin-top: 14px;
  font-family: ${FONT};
}
`;

export const ContextGrowthDiagram = ({ caption }: { caption?: string }) => {
  const rowH = 30;
  const gap = 12;
  const labelW = 52;
  const chartX = labelW + 8;
  const maxUnits = Math.max(...TURNS.map((t) => t.segments.reduce((s, x) => s + x.size, 0)));
  const chartW = 400; // 유닛 -> px 스케일용 기준폭
  const scale = chartW / maxUnits;
  const W = chartX + chartW + 40;
  const legendY = TURNS.length * (rowH + gap) + 16;
  const H = legendY + 26;

  return (
    <div className="bca-ctx-card" style={{ fontFamily: FONT }}>
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label="턴이 쌓일수록 커지는 컨텍스트"
      >
        {TURNS.map((t, i) => {
          const y = i * (rowH + gap);
          let cursor = chartX;
          const total = t.segments.reduce((s, x) => s + x.size, 0);
          return (
            <g key={t.turn}>
              <text
                x={labelW}
                y={y + rowH / 2 + 4}
                textAnchor="end"
                fontFamily={FONT}
                fontSize={12}
                fill="#495057"
              >
                턴 {t.turn}
              </text>
              {t.segments.map((seg) => {
                const w = seg.size * scale;
                const x = cursor;
                cursor += w;
                return (
                  <rect
                    key={seg.layer}
                    x={x}
                    y={y}
                    width={Math.max(w, 1)}
                    height={rowH}
                    fill={LAYERS[seg.layer].color}
                    rx={2}
                    opacity={seg.layer === "tool" ? 0.9 : 0.85}
                  />
                );
              })}
              {/* 총량 배지 */}
              <text
                x={cursor + 6}
                y={y + rowH / 2 + 4}
                fontFamily={MONO}
                fontSize={10}
                fill="#868e96"
              >
                ×{(total / TURNS[0].segments.reduce((s, x) => s + x.size, 0)).toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* 범례 */}
        {Object.values(LAYERS).map((l, i) => {
          const cols = W < 420 ? 1 : 3;
          const colW = (W - chartX) / cols;
          const cx = chartX + (i % cols) * colW;
          const cy = legendY + Math.floor(i / cols) * 16;
          return (
            <g key={l.key}>
              <rect x={cx} y={cy} width={11} height={11} rx={2} fill={l.color} opacity={0.9} />
              <text x={cx + 16} y={cy + 9.5} fontFamily={FONT} fontSize={10.5} fill="#868e96">
                {l.label}
              </text>
            </g>
          );
        })}
      </svg>
      {caption && <div className="bca-ctx-caption">{caption}</div>}
    </div>
  );
};
