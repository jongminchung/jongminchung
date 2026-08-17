"use client";

import React from "react";

const FONT =
    "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

// Beaver의 다섯 도구를 카드로 나열한다. 각 카드는 심플한 SVG 글리프 +
// 도구명(MONO) + 한 줄 설명. 반응형 그리드.

const ACCENT = "#1864ab";

// 24x24 뷰박스 안의 간단한 라인 글리프
const glyphs: Record<string, React.ReactNode> = {
    read: (
        // 문서 + 확대
        <>
            <path
                d="M6 3 h8 l4 4 v14 h-12 z"
                fill="#e7f5ff"
                stroke={ACCENT}
                strokeWidth={1.4}
                strokeLinejoin="round"
            />
            <path
                d="M14 3 v4 h4"
                fill="none"
                stroke={ACCENT}
                strokeWidth={1.4}
                strokeLinejoin="round"
            />
            <line
                x1={8}
                y1={12}
                x2={15}
                y2={12}
                stroke={ACCENT}
                strokeWidth={1.2}
            />
            <line
                x1={8}
                y1={15}
                x2={15}
                y2={15}
                stroke={ACCENT}
                strokeWidth={1.2}
            />
            <line
                x1={8}
                y1={18}
                x2={12}
                y2={18}
                stroke={ACCENT}
                strokeWidth={1.2}
            />
        </>
    ),
    list: (
        // 목록 (점 + 선)
        <>
            {[6, 12, 18].map((y) => (
                <g key={y}>
                    <circle cx={6} cy={y} r={1.6} fill={ACCENT} />
                    <line
                        x1={10}
                        y1={y}
                        x2={19}
                        y2={y}
                        stroke={ACCENT}
                        strokeWidth={1.4}
                        strokeLinecap="round"
                    />
                </g>
            ))}
        </>
    ),
    edit: (
        // 연필로 문자열 치환
        <>
            <path
                d="M4 20 l1 -4 l10 -10 l3 3 l-10 10 z"
                fill="#e7f5ff"
                stroke={ACCENT}
                strokeWidth={1.4}
                strokeLinejoin="round"
            />
            <line
                x1={13}
                y1={7}
                x2={16}
                y2={10}
                stroke={ACCENT}
                strokeWidth={1.4}
            />
            <line
                x1={4}
                y1={20}
                x2={5}
                y2={16}
                stroke={ACCENT}
                strokeWidth={1.4}
            />
        </>
    ),
    write: (
        // 전체를 새로 쓰는 문서
        <>
            <path
                d="M6 3 h9 l3 3 v15 h-12 z"
                fill={ACCENT}
                stroke={ACCENT}
                strokeWidth={1.4}
                strokeLinejoin="round"
                opacity={0.15}
            />
            <path
                d="M6 3 h9 l3 3 v15 h-12 z"
                fill="none"
                stroke={ACCENT}
                strokeWidth={1.4}
                strokeLinejoin="round"
            />
            <line
                x1={9}
                y1={10}
                x2={15}
                y2={10}
                stroke={ACCENT}
                strokeWidth={1.2}
            />
            <line
                x1={9}
                y1={13}
                x2={15}
                y2={13}
                stroke={ACCENT}
                strokeWidth={1.2}
            />
            <line
                x1={9}
                y1={16}
                x2={15}
                y2={16}
                stroke={ACCENT}
                strokeWidth={1.2}
            />
        </>
    ),
    bash: (
        // 터미널 프롬프트
        <>
            <rect
                x={3}
                y={5}
                width={18}
                height={14}
                rx={2}
                fill="#e7f5ff"
                stroke={ACCENT}
                strokeWidth={1.4}
            />
            <path
                d="M6 9 l3 2.5 l-3 2.5"
                fill="none"
                stroke={ACCENT}
                strokeWidth={1.4}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <line
                x1={11}
                y1={15}
                x2={16}
                y2={15}
                stroke={ACCENT}
                strokeWidth={1.4}
                strokeLinecap="round"
            />
        </>
    ),
};

const TOOLS = [
    {
        key: "read",
        name: "read_file",
        ko: "읽기",
        desc: "파일 내용을 읽어 모델에게 준다",
    },
    {
        key: "list",
        name: "list_files",
        ko: "목록",
        desc: "디렉터리의 파일 목록을 나열한다",
    },
    {
        key: "edit",
        name: "edit_file",
        ko: "편집",
        desc: "문자열을 찾아 바꿔 부분 수정한다",
    },
    {
        key: "write",
        name: "write_file",
        ko: "쓰기",
        desc: "파일을 통째로 새로 쓴다",
    },
    {
        key: "bash",
        name: "bash",
        ko: "셸",
        desc: "셸 명령을 실행해 테스트를 돌린다",
    },
];

const STYLE = `
.bca-tools-card {
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 20px;
  margin: 24px 0;
  background: #fff;
}
.bca-tools-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
}
@media (max-width: 720px) {
  .bca-tools-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 440px) {
  .bca-tools-grid { grid-template-columns: repeat(2, 1fr); }
}
.bca-tool {
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 12px 10px;
  background: #f8f9fa;
  text-align: center;
}
.bca-tool-name {
  font-family: ${MONO};
  font-size: 11px;
  font-weight: 700;
  color: #1971c2;
  margin-top: 8px;
  word-break: break-all;
}
.bca-tool-ko {
  font-family: ${FONT};
  font-size: 10px;
  color: #5c636a;
  margin-top: 1px;
}
.bca-tool-desc {
  font-family: ${FONT};
  font-size: 10.5px;
  line-height: 1.45;
  color: #495057;
  margin-top: 6px;
}
.bca-tools-caption {
  text-align: center;
  font-size: 12px;
  color: #637381;
  margin-top: 14px;
  font-family: ${FONT};
}
`;

export const ToolAnatomyDiagram = ({ caption }: { caption?: string }) => (
    <div className="bca-tools-card" style={{ fontFamily: FONT }}>
        <style dangerouslySetInnerHTML={{ __html: STYLE }} />
        <div className="bca-tools-grid">
            {TOOLS.map((t) => (
                <div className="bca-tool" key={t.key}>
                    <svg
                        viewBox="0 0 24 24"
                        width={30}
                        height={30}
                        role="img"
                        aria-label={t.ko}
                    >
                        {glyphs[t.key]}
                    </svg>
                    <div className="bca-tool-name">{t.name}</div>
                    <div className="bca-tool-ko">{t.ko}</div>
                    <div className="bca-tool-desc">{t.desc}</div>
                </div>
            ))}
        </div>
        {caption && <div className="bca-tools-caption">{caption}</div>}
    </div>
);
