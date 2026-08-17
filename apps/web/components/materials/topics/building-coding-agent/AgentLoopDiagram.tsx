"use client";

const FONT =
    "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

// 워크플로(고정 파이프라인) vs 에이전트(모델 중심 루프)를 나란히 대비하는
// 정적 SVG 다이어그램. 상호작용 없음, 설명이 목적이다.

const STYLE = `
.bca-loop-card {
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 20px;
  margin: 24px 0;
  background: #fff;
}
.bca-loop-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
@media (max-width: 560px) {
  .bca-loop-grid { grid-template-columns: 1fr; }
}
.bca-loop-panel-title {
  font-family: ${FONT};
  font-size: 13px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 4px;
}
.bca-loop-panel-desc {
  font-family: ${FONT};
  font-size: 11px;
  line-height: 1.5;
  color: #495057;
  text-align: center;
  margin-top: 8px;
}
.bca-loop-caption {
  text-align: center;
  font-size: 12px;
  color: #637381;
  margin-top: 14px;
  font-family: ${FONT};
}
`;

// 워크플로: 박스가 화살표로 일렬 연결된 고정 파이프라인
const WorkflowSVG = () => (
    <svg
        viewBox="0 0 200 150"
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label="고정된 파이프라인"
    >
        {["입력", "분류", "템플릿", "응답"].map((label, i) => {
            const y = 8 + i * 34;
            return (
                <g key={label}>
                    <rect
                        x={54}
                        y={y}
                        width={92}
                        height={24}
                        rx={5}
                        fill="#f1f3f5"
                        stroke="#5c636a"
                        strokeWidth={1.2}
                    />
                    <text
                        x={100}
                        y={y + 16}
                        textAnchor="middle"
                        fontFamily={FONT}
                        fontSize={11}
                        fill="#495057"
                    >
                        {label}
                    </text>
                    {i < 3 && (
                        <g stroke="#495057" strokeWidth={1.2} fill="#495057">
                            <line x1={100} y1={y + 24} x2={100} y2={y + 32} />
                            <path
                                d={`M100 ${y + 34} l-3.5 -5 h7 z`}
                                stroke="none"
                            />
                        </g>
                    )}
                </g>
            );
        })}
    </svg>
);

// 에이전트: 가운데 LLM에서 도구로 화살표가 뻗고 다시 돌아오는 루프
const AgentSVG = () => {
    const cx = 100;
    const cy = 75;
    const tools = [
        { x: 100, y: 18, label: "read" },
        { x: 168, y: 62, label: "edit" },
        { x: 150, y: 132, label: "bash" },
        { x: 50, y: 132, label: "write" },
        { x: 32, y: 62, label: "list" },
    ];
    return (
        <svg
            viewBox="0 0 200 150"
            style={{ width: "100%", height: "auto", display: "block" }}
            role="img"
            aria-label="모델 중심 루프"
        >
            <defs>
                <marker
                    id="bca-loop-arrow"
                    markerWidth="7"
                    markerHeight="7"
                    refX="5"
                    refY="3"
                    orient="auto"
                >
                    <path d="M0 0 L6 3 L0 6 z" fill="#1864ab" />
                </marker>
            </defs>
            {tools.map((t) => {
                // LLM -> 도구(요청), 도구 -> LLM(결과)을 살짝 벌린 두 곡선으로
                const dx = t.x - cx;
                const dy = t.y - cy;
                const len = Math.hypot(dx, dy);
                const ux = dx / len;
                const uy = dy / len;
                const px = -uy; // 수직 방향
                const py = ux;
                const off = 4;
                const startR = 24;
                const endR = 16;
                const sx = cx + ux * startR;
                const sy = cy + uy * startR;
                const ex = t.x - ux * endR;
                const ey = t.y - uy * endR;
                return (
                    <g key={t.label}>
                        <line
                            x1={sx + px * off}
                            y1={sy + py * off}
                            x2={ex + px * off}
                            y2={ey + py * off}
                            stroke="#1864ab"
                            strokeWidth={1.2}
                            markerEnd="url(#bca-loop-arrow)"
                            opacity={0.85}
                        />
                        <line
                            x1={ex - px * off}
                            y1={ey - py * off}
                            x2={sx - px * off}
                            y2={sy - py * off}
                            stroke="#5c636a"
                            strokeWidth={1.2}
                            strokeDasharray="2.5 2.5"
                            markerEnd="url(#bca-loop-arrow)"
                            opacity={0.7}
                        />
                        <rect
                            x={t.x - 18}
                            y={t.y - 9}
                            width={36}
                            height={18}
                            rx={4}
                            fill="#e7f5ff"
                            stroke="#1864ab"
                            strokeWidth={1}
                        />
                        <text
                            x={t.x}
                            y={t.y + 3.5}
                            textAnchor="middle"
                            fontFamily={MONO}
                            fontSize={8}
                            fill="#1971c2"
                        >
                            {t.label}
                        </text>
                    </g>
                );
            })}
            <circle
                cx={cx}
                cy={cy}
                r={24}
                fill="#fff5f5"
                stroke="#c92a2a"
                strokeWidth={1.4}
            />
            <text
                x={cx}
                y={cy + 4}
                textAnchor="middle"
                fontFamily={FONT}
                fontSize={12}
                fontWeight={700}
                fill="#c92a2a"
            >
                LLM
            </text>
        </svg>
    );
};

export const AgentLoopDiagram = ({ caption }: { caption?: string }) => (
    <div className="bca-loop-card" style={{ fontFamily: FONT }}>
        <style dangerouslySetInnerHTML={{ __html: STYLE }} />
        <div className="bca-loop-grid">
            <div>
                <div
                    className="bca-loop-panel-title"
                    style={{ color: "#495057" }}
                >
                    워크플로
                </div>
                <WorkflowSVG />
                <div className="bca-loop-panel-desc">
                    흐름이 코드에 박혀 있다.
                    <br />
                    순서는 사람이 미리 정한다.
                </div>
            </div>
            <div>
                <div
                    className="bca-loop-panel-title"
                    style={{ color: "#1864ab" }}
                >
                    에이전트
                </div>
                <AgentSVG />
                <div className="bca-loop-panel-desc">
                    흐름을 매 턴 모델이 결정한다.
                    <br />
                    도구를 쓰고 결과를 다시 받는다.
                </div>
            </div>
        </div>
        {caption && <div className="bca-loop-caption">{caption}</div>}
    </div>
);
