// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  cancelMaterialFrame,
  scheduleMaterialFrame,
} from "#components/materials/runtime/scheduler";

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

type Speaker = "S" | "C";
type Line = [Speaker, string];

interface SessionState {
  mode: "command" | "data";
  mailFrom: string;
  rcptTo: string;
}

interface Step {
  lines: Line[];
  desc: string;
  state: SessionState;
}

const EMPTY: SessionState = { mode: "command", mailFrom: "", rcptTo: "" };

const STEPS: Step[] = [
  {
    lines: [["S", "220 relay.example.com ESMTP ready"]],
    desc: "TCP 접속이 열리면 서버가 먼저 인사한다. 220은 준비 완료라는 뜻이다.",
    state: EMPTY,
  },
  {
    lines: [
      ["C", "EHLO mail-yb1-f171.google.com"],
      ["S", "250 relay.example.com"],
    ],
    desc: "클라이언트(보내는 서버)가 자신을 밝힌다.",
    state: EMPTY,
  },
  {
    lines: [
      ["C", "MAIL FROM:<hanna.kim@gmail.com>"],
      ["S", "250 OK"],
    ],
    desc: "봉투에 발신자를 적는다. 검증 없는 자기 신고 값이다.",
    state: { mode: "command", mailFrom: "hanna.kim@gmail.com", rcptTo: "" },
  },
  {
    lines: [
      ["C", "RCPT TO:<reply+42.7.1784209600.a58f8f3c9a6a265e@relay.example.com>"],
      ["S", "250 OK"],
    ],
    desc: "봉투에 수신자를 적는다. reply+로 시작하지 않으면 550으로 거절된다.",
    state: {
      mode: "command",
      mailFrom: "hanna.kim@gmail.com",
      rcptTo: "reply+42.7.1784209600.a58f8f3c9a6a265e@relay.example.com",
    },
  },
  {
    lines: [
      ["C", "DATA"],
      ["S", "354 End data with <CR><LF>.<CR><LF>"],
    ],
    desc: "이제부터는 명령이 아니라 메일 원문이다. 서버가 수신 모드로 전환된다.",
    state: {
      mode: "data",
      mailFrom: "hanna.kim@gmail.com",
      rcptTo: "reply+42.7.1784209600.a58f8f3c9a6a265e@relay.example.com",
    },
  },
  {
    lines: [
      ["C", "From: =?UTF-8?B?6rmA7ZWc64KY?= <hanna.kim@gmail.com>"],
      ["C", "Subject: =?UTF-8?B?UmU6IFvti7DsvJMgIzQyXSAuLi4=?="],
      ["C", ""],
      ["C", "(quoted-printable로 포장된 본문…)"],
    ],
    desc: "헤더와 본문이 그대로 흘러 들어온다. 한글은 encoded-word로 포장되어 있다.",
    state: {
      mode: "data",
      mailFrom: "hanna.kim@gmail.com",
      rcptTo: "reply+42.7.1784209600.a58f8f3c9a6a265e@relay.example.com",
    },
  },
  {
    lines: [
      ["C", "."],
      ["S", "250 OK: queued"],
    ],
    desc: "마침표 하나만 있는 줄이 끝 신호다. 본문에 있는 마침표 줄은 dot-stuffing으로 이스케이프된다.",
    state: EMPTY,
  },
  {
    lines: [
      ["C", "QUIT"],
      ["S", "221 Bye"],
    ],
    desc: "대화 종료. 메일 한 통이 배달되는 데 필요한 전부다.",
    state: EMPTY,
  },
];

// --- 자동 재생 타임라인 -------------------------------------------------
// 각 줄이 나타나는 절대 시각(ms)을 미리 계산해 둔다.
const LINE_STAGGER = 450; // 같은 단계 안에서 줄이 하나씩 나타나는 간격
const MIN_STEP_DUR = 1900; // 단계당 최소 체류 시간
const STEP_TAIL = 1500; // 마지막 줄이 나온 뒤 다음 단계까지의 여유
const END_HOLD = 3000; // 마지막 단계 후 정지 시간

interface FlatLine {
  speaker: Speaker;
  text: string;
  stepIndex: number;
}

const FLAT_LINES: FlatLine[] = [];
const LINE_TIMES: number[] = [];
const STEP_STARTS: number[] = [];

let cursor = 0;
STEPS.forEach((step, si) => {
  STEP_STARTS.push(cursor);
  step.lines.forEach(([speaker, text], li) => {
    LINE_TIMES.push(cursor + li * LINE_STAGGER);
    FLAT_LINES.push({ speaker, text, stepIndex: si });
  });
  const span = (step.lines.length - 1) * LINE_STAGGER;
  const isLast = si === STEPS.length - 1;
  cursor += isLast ? span + END_HOLD : Math.max(MIN_STEP_DUR, span + STEP_TAIL);
});
const CYCLE = cursor;

const STYLE = `
.smtpd-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.smtpd-progress-label {
  flex: none;
  font-size: 11.5px;
  color: #868e96;
  font-variant-numeric: tabular-nums;
}
.smtpd-progress-track {
  flex: 1;
  height: 3px;
  border-radius: 2px;
  background: #e9ecef;
  overflow: hidden;
}
.smtpd-progress-fill {
  height: 100%;
  background: #adb5bd;
  border-radius: 2px;
  transition: width 0.4s ease;
}
.smtpd-term {
  background: #212529;
  border-radius: 6px;
  padding: 14px 16px;
  max-height: 260px;
  overflow-y: auto;
  overflow-x: auto;
  font-family: ${MONO};
  font-size: 12.5px;
  line-height: 1.9;
}
.smtpd-line { white-space: pre; border-radius: 3px; padding: 0 4px; margin: 0 -4px; width: max-content; min-width: 100%; box-sizing: border-box; }
.smtpd-line-s { color: #74c0fc; }
.smtpd-line-c { color: #8ce99a; }
.smtpd-line-new { background: rgba(255, 255, 255, 0.09); }
.smtpd-bottom { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 14px; align-items: stretch; }
.smtpd-desc {
  flex: 2 1 220px;
  min-width: 0;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 12px 14px;
  font-size: 13px;
  color: #495057;
  line-height: 1.6;
}
.smtpd-status { flex: 1 1 180px; min-width: 0; display: flex; flex-direction: column; gap: 6px; justify-content: center; }
.smtpd-chip {
  display: flex;
  align-items: baseline;
  gap: 6px;
  border-radius: 5px;
  padding: 5px 10px;
  font-size: 11.5px;
  border: 1px solid #dee2e6;
  background: #f8f9fa;
  color: #868e96;
  min-width: 0;
  transition: background 0.3s ease, border-color 0.3s ease, color 0.3s ease;
}
.smtpd-chip-label { flex: none; font-weight: 600; }
.smtpd-chip-value {
  font-family: ${MONO};
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.smtpd-chip-filled { background: #ebfbee; border-color: #8ce99a; color: #2b8a3e; }
.smtpd-chip-data { background: #fff3bf; border-color: #ffd43b; color: #e8590c; }
`;

const Chip = ({
  label,
  value,
  filled,
  dataMode,
}: {
  label: string;
  value: string;
  filled: boolean;
  dataMode?: boolean;
}) => (
  <div
    className={"smtpd-chip" + (dataMode ? " smtpd-chip-data" : filled ? " smtpd-chip-filled" : "")}
  >
    <span className="smtpd-chip-label">{label}</span>
    <span className="smtpd-chip-value">{value}</span>
  </div>
);

export const SmtpSessionDemo = () => {
  // SSR 첫 렌더와 동일해야 하므로 초기 상태는 0단계(첫 줄 하나)로 고정한다.
  const [view, setView] = useState({ step: 0, lineCount: 1 });
  const termRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();

    const tick = (now: number) => {
      // rAF의 첫 타임스탬프가 start보다 이를 수 있으므로 반드시 0으로 클램프한다.
      const e = Math.max(0, now - start) % CYCLE;

      let lineCount = 0;
      for (const t of LINE_TIMES) {
        if (t <= e) lineCount++;
        else break;
      }
      let step = 0;
      for (let i = 0; i < STEP_STARTS.length; i++) {
        if (e >= STEP_STARTS[i]) step = i;
      }
      setView((v) => (v.step === step && v.lineCount === lineCount ? v : { step, lineCount }));
      raf = scheduleMaterialFrame(tick);
    };

    raf = scheduleMaterialFrame(tick);
    return () => cancelMaterialFrame(raf);
  }, []);

  useEffect(() => {
    const term = termRef.current;
    if (term) term.scrollTop = term.scrollHeight;
  }, [view.lineCount]);

  const current = STEPS[view.step];
  const { mode, mailFrom, rcptTo } = current.state;

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
      <div className="smtpd-progress">
        <span className="smtpd-progress-label">
          단계 {view.step + 1}/{STEPS.length}
        </span>
        <div className="smtpd-progress-track">
          <div
            className="smtpd-progress-fill"
            style={{ width: `${((view.step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>
      <div className="smtpd-term" ref={termRef}>
        {FLAT_LINES.slice(0, view.lineCount).map((line, i) => (
          <div
            key={i}
            className={
              "smtpd-line " +
              (line.speaker === "S" ? "smtpd-line-s" : "smtpd-line-c") +
              (line.stepIndex === view.step ? " smtpd-line-new" : "")
            }
          >
            {line.speaker}: {line.text}
          </div>
        ))}
      </div>
      <div className="smtpd-bottom">
        <div className="smtpd-desc">{current.desc}</div>
        <div className="smtpd-status">
          <Chip
            label="모드"
            value={mode === "data" ? "DATA 수신" : "명령"}
            filled={false}
            dataMode={mode === "data"}
          />
          <Chip label="봉투 발신자" value={mailFrom || "—"} filled={!!mailFrom} />
          <Chip label="봉투 수신자" value={rcptTo || "—"} filled={!!rcptTo} />
        </div>
      </div>
    </div>
  );
};
