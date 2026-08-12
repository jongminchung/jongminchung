"use client";

const FONT =
    "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

// 에이전트 루프의 한 왕복을 보여주는 정적 시퀀스 다이어그램.
// tool_use 요청과 tool_result 응답이 같은 id로 짝지어진다는 걸 강조한다.

const ID_COLOR = "#6741d9"; // 같은 id를 잇는 보라색

const STYLE = `
.bca-call-card {
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 20px;
  margin: 24px 0;
  background: #fff;
}
.bca-call-caption {
  text-align: center;
  font-size: 12px;
  color: #637381;
  margin-top: 14px;
  font-family: ${FONT};
}
`;

// 두 세로 레인(모델 / 우리 코드) 사이를 왕복하는 시퀀스
export const ToolCallDiagram = ({ caption }: { caption?: string }) => {
    const W = 520;
    const laneL = 110; // 모델 레인 x
    const laneR = 410; // 실행기 레인 x
    const top = 44;
    const bottom = 250;

    return (
        <div className="bca-call-card" style={{ fontFamily: FONT }}>
            <style dangerouslySetInnerHTML={{ __html: STYLE }} />
            <svg
                viewBox={`0 0 ${W} 280`}
                style={{ width: "100%", height: "auto", display: "block" }}
                role="img"
                aria-label="tool_use와 tool_result 한 왕복"
            >
                <defs>
                    <marker
                        id="bca-call-arrow"
                        markerWidth="8"
                        markerHeight="8"
                        refX="6"
                        refY="3.5"
                        orient="auto"
                    >
                        <path d="M0 0 L7 3.5 L0 7 z" fill="#495057" />
                    </marker>
                </defs>

                {/* 레인 헤더 */}
                <g>
                    <rect
                        x={laneL - 60}
                        y={10}
                        width={120}
                        height={26}
                        rx={5}
                        fill="#fff5f5"
                        stroke="#c92a2a"
                        strokeWidth={1.2}
                    />
                    <text
                        x={laneL}
                        y={27}
                        textAnchor="middle"
                        fontFamily={FONT}
                        fontSize={12}
                        fontWeight={700}
                        fill="#c92a2a"
                    >
                        모델
                    </text>

                    <rect
                        x={laneR - 66}
                        y={10}
                        width={132}
                        height={26}
                        rx={5}
                        fill="#ebfbee"
                        stroke="#237032"
                        strokeWidth={1.2}
                    />
                    <text
                        x={laneR}
                        y={27}
                        textAnchor="middle"
                        fontFamily={FONT}
                        fontSize={12}
                        fontWeight={700}
                        fill="#237032"
                    >
                        우리 코드 · 실행기
                    </text>
                </g>

                {/* 생명선 */}
                <line
                    x1={laneL}
                    y1={top}
                    x2={laneL}
                    y2={bottom}
                    stroke="#dee2e6"
                    strokeWidth={1.2}
                    strokeDasharray="3 4"
                />
                <line
                    x1={laneR}
                    y1={top}
                    x2={laneR}
                    y2={bottom}
                    stroke="#dee2e6"
                    strokeWidth={1.2}
                    strokeDasharray="3 4"
                />

                {/* 1) tool_use 요청 (모델 -> 실행기) */}
                <g>
                    <line
                        x1={laneL}
                        y1={90}
                        x2={laneR - 4}
                        y2={90}
                        stroke="#495057"
                        strokeWidth={1.4}
                        markerEnd="url(#bca-call-arrow)"
                    />
                    <text
                        x={(laneL + laneR) / 2}
                        y={82}
                        textAnchor="middle"
                        fontFamily={MONO}
                        fontSize={11}
                        fontWeight={700}
                        fill="#343a40"
                    >
                        tool_use
                    </text>
                    <text
                        x={(laneL + laneR) / 2}
                        y={105}
                        textAnchor="middle"
                        fontFamily={MONO}
                        fontSize={10}
                        fill="#495057"
                    >
                        name: read_file
                    </text>
                </g>

                {/* id 배지 (요청 쪽) */}
                <g>
                    <rect
                        x={(laneL + laneR) / 2 - 62}
                        y={112}
                        width={124}
                        height={18}
                        rx={9}
                        fill="#f3f0ff"
                        stroke={ID_COLOR}
                        strokeWidth={1}
                    />
                    <text
                        x={(laneL + laneR) / 2}
                        y={124.5}
                        textAnchor="middle"
                        fontFamily={MONO}
                        fontSize={9.5}
                        fill="#7048e8"
                    >
                        id = toolu_01ab
                    </text>
                </g>

                {/* 실행기 처리 표시 */}
                <g>
                    <rect
                        x={laneR - 44}
                        y={140}
                        width={88}
                        height={22}
                        rx={4}
                        fill="#f8f9fa"
                        stroke="#5f666d"
                        strokeWidth={1}
                    />
                    <text
                        x={laneR}
                        y={155}
                        textAnchor="middle"
                        fontFamily={FONT}
                        fontSize={10}
                        fill="#495057"
                    >
                        파일을 읽음
                    </text>
                </g>

                {/* 2) tool_result 응답 (실행기 -> 모델) */}
                <g>
                    <line
                        x1={laneR}
                        y1={195}
                        x2={laneL + 4}
                        y2={195}
                        stroke="#495057"
                        strokeWidth={1.4}
                        markerEnd="url(#bca-call-arrow)"
                    />
                    <text
                        x={(laneL + laneR) / 2}
                        y={187}
                        textAnchor="middle"
                        fontFamily={MONO}
                        fontSize={11}
                        fontWeight={700}
                        fill="#343a40"
                    >
                        tool_result
                    </text>
                    <text
                        x={(laneL + laneR) / 2}
                        y={210}
                        textAnchor="middle"
                        fontFamily={MONO}
                        fontSize={10}
                        fill="#495057"
                    >
                        content: 파일 내용…
                    </text>
                </g>

                {/* id 배지 (응답 쪽) — 같은 색/같은 값 */}
                <g>
                    <rect
                        x={(laneL + laneR) / 2 - 62}
                        y={217}
                        width={124}
                        height={18}
                        rx={9}
                        fill="#f3f0ff"
                        stroke={ID_COLOR}
                        strokeWidth={1}
                    />
                    <text
                        x={(laneL + laneR) / 2}
                        y={229.5}
                        textAnchor="middle"
                        fontFamily={MONO}
                        fontSize={9.5}
                        fill="#7048e8"
                    >
                        tool_use_id = toolu_01ab
                    </text>
                </g>

                {/* 같은 id를 잇는 점선 (요청 배지 -> 응답 배지) */}
                <path
                    d={`M ${(laneL + laneR) / 2 + 62} 121 C ${W - 24} 121, ${W - 24} 226, ${(laneL + laneR) / 2 + 62} 226`}
                    fill="none"
                    stroke={ID_COLOR}
                    strokeWidth={1.2}
                    strokeDasharray="3 3"
                    opacity={0.7}
                />
                <text
                    x={W - 30}
                    y={176}
                    textAnchor="middle"
                    fontFamily={FONT}
                    fontSize={9.5}
                    fill={ID_COLOR}
                    transform={`rotate(90 ${W - 30} 173)`}
                >
                    같은 id로 짝지음
                </text>
            </svg>
            {caption && <div className="bca-call-caption">{caption}</div>}
        </div>
    );
};
