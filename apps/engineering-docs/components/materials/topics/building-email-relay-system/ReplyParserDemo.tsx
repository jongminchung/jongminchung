"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
    cancelMaterialFrame,
    scheduleMaterialFrame,
} from "#components/materials/runtime/scheduler";
import {
    classifyLines,
    extractReply,
    type ClassifiedLine,
    type LineKind,
} from "./replyParser";

const FONT =
    "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

const PRESETS: Array<{ name: string; body: string }> = [
    {
        name: "Gmail 답장",
        body: "안녕하세요, 빠른 답변 감사합니다!\n\n서울시 강남구 테헤란로 123, 45층 (주)어썸커머스 앞으로 부탁드립니다.\n수령인은 그대로 두시면 됩니다.\n\n-- \n김한나 드림\n\n2026년 7월 10일 (금) 오후 2:07, 박상담 (도움말센터) <notify@relay.example.com>님이 작성:\n\n> 안녕하세요 김한나 님, 도움말센터 박상담입니다.\n>\n> 아직 출고 전이라 배송지 변경이 가능합니다. 변경하실 주소를 이 메일에 답장으로\n> 보내주세요.\n>\n> 감사합니다.",
    },
    {
        name: "Outlook 답장",
        body: "네 확인했습니다. 회사 주소로 변경해주세요.\n\n보낸 사람: 박상담 (도움말센터) <notify@relay.example.com>\n보낸 날짜: 2026년 7월 10일 금요일 오후 2:07\n받는 사람: 김한나 <hanna.kim@gmail.com>\n제목: Re: [티켓 #42] 주문한 상품 배송지를 바꾸고 싶어요\n\n안녕하세요 김한나 님, 도움말센터 박상담입니다.\n\n아직 출고 전이라 배송지 변경이 가능합니다.",
    },
    {
        name: "인라인 답장",
        body: "> 변경하실 주소를 알려주세요.\n\n테헤란로 123입니다.\n\n> 수령인도 바뀌나요?\n\n아니요, 그대로입니다.\n\n2026년 7월 10일 (금) 오후 2:07, 박상담 (도움말센터) <notify@relay.example.com>님이 작성:\n> 안녕하세요 김한나 님, 도움말센터 박상담입니다.",
    },
    {
        name: "모바일 답장",
        body: "회사 주소로 부탁드려요\n\niPhone에서 보냄",
    },
];

const KIND_COLOR: Record<LineKind, string> = {
    content: "#212529",
    quote: "#adb5bd",
    "quote-header": "#e8590c",
    signature: "#7048e8",
};

const LEGEND: Array<{ color: string; label: string }> = [
    { color: "#212529", label: "본문" },
    { color: "#adb5bd", label: "인용" },
    { color: "#e8590c", label: "인용 헤더" },
    { color: "#7048e8", label: "시그니처" },
];

// ---- 타임라인 (프리셋마다 줄 수가 달라 길이를 각각 계산한다) ----
const REVEAL_MS = 500; // ① 원문 등장 (전체)
const CLASSIFY_PER_LINE = 120; // ② 분류: 줄당
const SWEEP_PER_LINE = 200; // ③ 걷어내기: 줄당
const PAUSE = 300; // 단계 사이 숨 고르기
const MIN_TOTAL = 7000; // 프리셋 하나가 최소 7초는 보이게

interface PresetData {
    name: string;
    lines: ClassifiedLine[];
    reply: string;
    sweepCount: number; // 아래에서 위로 스캔하는 줄 수 (멈추는 본문 줄 포함)
    classifyStart: number;
    sweepStart: number;
    resultStart: number;
    total: number;
}

// 순수 함수라 모듈 로드(SSR 포함) 시점에 미리 계산해도 안전하다
const DATA: PresetData[] = PRESETS.map((p) => {
    const lines = classifyLines(p.body);
    const n = lines.length;
    const hiddenCount = lines.filter((l) => l.hidden).length;
    const sweepCount = hiddenCount < n ? hiddenCount + 1 : n;
    const classifyStart = REVEAL_MS + PAUSE;
    const sweepStart = classifyStart + n * CLASSIFY_PER_LINE + PAUSE;
    const resultStart = sweepStart + sweepCount * SWEEP_PER_LINE + PAUSE;
    const total = resultStart + Math.max(2000, MIN_TOTAL - resultStart);
    return {
        name: p.name,
        lines,
        reply: extractReply(p.body),
        sweepCount,
        classifyStart,
        sweepStart,
        resultStart,
        total,
    };
});

function dataAt(index: number): PresetData {
    const data = DATA[index];
    if (data === undefined)
        throw new Error(`Missing reply parser preset ${index}.`);
    return data;
}

const OFFSETS = DATA.reduce<number[]>(
    (acc, _d, i) => [
        ...acc,
        (acc[i - 1] ?? 0) + (i === 0 ? 0 : dataAt(i - 1).total),
    ],
    [],
);
const CYCLE = (OFFSETS.at(-1) ?? 0) + dataAt(DATA.length - 1).total;

const LINE_H = 19.2; // 12px * 1.6
const MAX_LINES = Math.max(...DATA.map((d) => d.lines.length));
const MAX_REPLY_LINES = Math.max(
    ...DATA.map((d) => (d.reply === "" ? 1 : d.reply.split("\n").length)),
);
const LINES_MIN_H = Math.ceil(MAX_LINES * LINE_H + 20); // 프리셋 전환 시 레이아웃이 덜컹거리지 않게
const RESULT_MIN_H = Math.ceil(MAX_REPLY_LINES * LINE_H + 49);

const CAPTIONS = [
    "① 답장 원문이 줄 단위로 들어온다",
    "② 줄마다 종류를 분류한다",
    "③ 아래에서 위로 걷어내다 본문을 만나면 멈춘다",
    "④ 남은 본문만 코멘트로 저장한다",
];

const STYLE = `
.rpd-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.rpd-preset { font-family: ${FONT}; font-size: 12px; font-weight: 700; color: #868e96; }
.rpd-legend { display: flex; flex-wrap: wrap; gap: 4px 12px; font-family: ${FONT}; font-size: 11px; color: #868e96; margin-bottom: 6px; }
.rpd-legend-item { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.rpd-legend-swatch { width: 9px; height: 9px; border-radius: 2px; display: inline-block; }
.rpd-lines { border: 1px solid #dee2e6; border-radius: 6px; background: #f8f9fa; padding: 10px 10px 10px 6px; font-family: ${MONO}; font-size: 12px; line-height: 1.6; overflow-x: auto; min-height: ${LINES_MIN_H}px; }
.rpd-line { padding-left: 8px; border-left: 3px solid transparent; white-space: pre; min-height: 1.6em; opacity: 0; transition: color 0.18s ease, opacity 0.25s ease, background 0.15s ease; }
.rpd-line[data-visible='true'] { opacity: 1; }
.rpd-line[data-kind='content'][data-struck='false'] { border-left-color: #40c057; }
.rpd-line[data-struck='true'] { text-decoration: line-through; opacity: 0.4; }
.rpd-line[data-scan='true'] { background: #fff3bf; }
.rpd-result-slot { min-height: ${RESULT_MIN_H}px; margin-top: 14px; }
.rpd-result { border-radius: 6px; padding: 12px 14px; font-family: ${FONT}; }
.rpd-result-label { font-size: 11px; font-weight: 700; margin-bottom: 6px; }
.rpd-result-body { font-family: ${MONO}; font-size: 12px; line-height: 1.6; white-space: pre-wrap; word-break: break-all; color: #212529; }
.rpd-caption { font-family: ${FONT}; font-size: 12px; color: #868e96; text-align: center; margin-top: 12px; min-height: 1.5em; }
`;

interface View {
    preset: number;
    phase: number; // 0 등장 / 1 분류 / 2 걷어내기 / 3 결과
    prog: number; // 단계 내 진행 줄 수
}

export const ReplyParserDemo = () => {
    // SSR과 클라이언트 첫 렌더가 동일하도록 첫 프리셋의 1단계 시작 상태로 둔다
    const [view, setView] = useState<View>({ preset: 0, phase: 0, prog: 0 });
    const reducedMotion = useReducedMotion();
    const lastKey = useRef("0-0-0");

    useEffect(() => {
        let raf = 0;
        const start = performance.now();

        const tick = (now: number) => {
            const e = (now - start) % CYCLE;
            let preset = 0;
            for (let i = DATA.length - 1; i >= 0; i--) {
                if (e >= (OFFSETS[i] ?? 0)) {
                    preset = i;
                    break;
                }
            }
            const d = dataAt(preset);
            const t = Math.max(0, e - (OFFSETS[preset] ?? 0));
            const n = d.lines.length;

            let phase: number;
            let prog: number;
            if (t < d.classifyStart) {
                phase = 0;
                prog = Math.min(
                    n,
                    Math.floor(Math.max(0, t) / (REVEAL_MS / n)) + 1,
                );
            } else if (t < d.sweepStart) {
                phase = 1;
                prog = Math.min(
                    n,
                    Math.floor(
                        Math.max(0, t - d.classifyStart) / CLASSIFY_PER_LINE,
                    ) + 1,
                );
            } else if (t < d.resultStart) {
                phase = 2;
                prog = Math.min(
                    d.sweepCount,
                    Math.floor(Math.max(0, t - d.sweepStart) / SWEEP_PER_LINE) +
                        1,
                );
            } else {
                phase = 3;
                prog = d.sweepCount;
            }

            const key = `${preset}-${phase}-${prog}`;
            if (key !== lastKey.current) {
                lastKey.current = key;
                setView({ preset, phase, prog });
            }
            raf = scheduleMaterialFrame(tick);
        };

        raf = scheduleMaterialFrame(tick);
        return () => cancelMaterialFrame(raf);
    }, []);

    const d = dataAt(view.preset);
    const n = d.lines.length;
    const { phase, prog } = view;

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
            <style dangerouslySetInnerHTML={{ __html: STYLE }} />

            <div className="rpd-head">
                <span className="rpd-preset">
                    {d.name} ({view.preset + 1}/{DATA.length})
                </span>
            </div>

            <div className="rpd-legend">
                {LEGEND.map((l) => (
                    <span key={l.label} className="rpd-legend-item">
                        <span
                            className="rpd-legend-swatch"
                            style={{ background: l.color }}
                        />
                        {l.label}
                    </span>
                ))}
                <span
                    className="rpd-legend-item"
                    style={{ textDecoration: "line-through" }}
                >
                    취소선 = 걷어냄
                </span>
            </div>

            <div className="rpd-lines">
                {d.lines.map((l, i) => {
                    const visible = phase > 0 || prog > i;
                    const classified = phase >= 2 || (phase === 1 && prog > i);
                    const struck =
                        l.hidden &&
                        (phase === 3 || (phase === 2 && i >= n - prog));
                    const scanning = phase === 2 && i === n - prog;
                    return (
                        <div
                            key={i}
                            className="rpd-line"
                            data-visible={visible}
                            data-kind={classified ? l.kind : "none"}
                            data-struck={struck}
                            data-scan={scanning}
                            style={{
                                color: classified
                                    ? KIND_COLOR[l.kind]
                                    : "#495057",
                            }}
                        >
                            {l.text === "" ? " " : l.text}
                        </div>
                    );
                })}
            </div>

            <div className="rpd-result-slot">
                {phase === 3 &&
                    (d.reply === "" ? (
                        <motion.div
                            className="rpd-result"
                            initial={
                                reducedMotion ? false : { opacity: 0, y: 4 }
                            }
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, ease: "easeOut" }}
                            style={{
                                background: "#fff5f5",
                                border: "1px solid #fa5252",
                            }}
                        >
                            <div
                                className="rpd-result-label"
                                style={{ color: "#c92a2a" }}
                            >
                                코멘트로 저장될 내용
                            </div>
                            <div
                                className="rpd-result-body"
                                style={{
                                    color: "#c92a2a",
                                    fontFamily: FONT,
                                    fontSize: 12,
                                }}
                            >
                                본문이 비어 있어 코멘트를 만들지 않는다
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            className="rpd-result"
                            initial={
                                reducedMotion ? false : { opacity: 0, y: 4 }
                            }
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, ease: "easeOut" }}
                            style={{
                                background: "#ebfbee",
                                border: "1px solid #40c057",
                            }}
                        >
                            <div
                                className="rpd-result-label"
                                style={{ color: "#2b8a3e" }}
                            >
                                코멘트로 저장될 내용
                            </div>
                            <div className="rpd-result-body">{d.reply}</div>
                        </motion.div>
                    ))}
            </div>

            <div className="rpd-caption">{CAPTIONS[phase] ?? ""}</div>
        </div>
    );
};
