"use client";

import { motion, useReducedMotion } from "motion/react";
import React, { useEffect, useState } from "react";
import {
  cancelMaterialFrame,
  scheduleMaterialFrame,
} from "@/components/materials/runtime/scheduler";

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

const SECRET = "relay-secret-please-change";
const NOW = 1783000000; // 데모 고정 "현재 시각" (2026-07-02 무렵)

const TICKET_VALID = 42;
const TICKET_FORGED = 43;
const USER_ID = 7;
const EXP_VALID = 1784209600; // 2026-07-16 무렵
const EXP_PAST = 1782000000; // 2026-06-21 무렵

const PAYLOAD_VALID = `${TICKET_VALID}.${USER_ID}.${EXP_VALID}`; // "42.7.1784209600" → a58f8f3c9a6a265e
const PAYLOAD_FORGED = `${TICKET_FORGED}.${USER_ID}.${EXP_VALID}`; // "43.7.1784209600" → c30d45ac646e94da
const PAYLOAD_EXPIRED = `${TICKET_VALID}.${USER_ID}.${EXP_PAST}`; // "42.7.1782000000" → e8e28681c67b827d

// 시나리오 내부 타임라인 (ms)
const T_MUTATE = 1100; // 주소 조작이 일어나는 순간 (시나리오 ②③)
const T_ROW1 = 1900; // 재계산 서명
const T_ROW2 = 2600; // 실려온 서명
const T_ROW3 = 3300; // 일치 여부
const T_ROW4 = 4000; // 만료 검사
const T_FINAL = 4700; // 최종 판정
const SCEN_MS = 5800; // 시나리오 하나의 길이
const TOTAL = SCEN_MS * 3;

interface ScenarioDef {
  name: string;
  ticketId: number;
  exp: number;
  expLabel: string;
  explain: string;
}

const SCENARIOS: ScenarioDef[] = [
  {
    name: "정상 주소",
    ticketId: TICKET_VALID,
    exp: EXP_VALID,
    expLabel: "2026-07-16 무렵",
    explain:
      "정상 상태 — 서버가 SECRET으로 재계산한 서명이 주소에 실려온 서명과 일치하고, 만료 시각도 아직 지나지 않았다.",
  },
  {
    name: "바꿔치기",
    ticketId: TICKET_FORGED,
    exp: EXP_VALID,
    expLabel: "2026-07-16 무렵",
    explain:
      "바꿔치기 상태 — 페이로드가 한 글자라도 달라지면 서버가 재계산한 서명이 통째로 달라진다. 공격자는 SECRET이 없으니 43번 티켓에 맞는 서명을 만들 수 없다.",
  },
  {
    name: "만료된 주소",
    ticketId: TICKET_VALID,
    exp: EXP_PAST,
    expLabel: "2026-06-21 무렵",
    explain:
      "만료 상태 — 서명은 유효하지만 기한이 지났다. 만료 시각이 페이로드에 박혀 서명으로 봉인되어 있으므로, 공격자가 기한만 늘려 적을 수도 없다.",
  },
];

function scenarioAt(index: number): ScenarioDef {
  const scenario = SCENARIOS[index];
  if (scenario === undefined) throw new Error(`Missing token scenario ${index}.`);
  return scenario;
}

async function hmacHex16(payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

interface Sigs {
  valid: string; // HMAC("42.7.1784209600") 앞 16자
  forged: string; // HMAC("43.7.1784209600") 앞 16자
  expired: string; // HMAC("42.7.1782000000") 앞 16자
}

interface Step {
  scen: number; // 0 | 1 | 2
  mutated: boolean; // 시나리오 ②③에서 조작이 일어난 뒤인가
  rows: number; // 순차 공개된 검증 행 수 (0~5)
}

const INITIAL_STEP: Step = { scen: 0, mutated: false, rows: 0 };

const STYLE = `
.tad-addr { font-family: ${MONO}; font-size: 14px; line-height: 1.7; word-break: break-all; background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 14px 16px; }
.tad-legend { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 10px; font-size: 11px; color: #868e96; }
.tad-legend span::before { content: ''; display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 5px; background: var(--c); }
.tad-panel { border: 1px solid #e9ecef; border-radius: 8px; padding: 14px 16px; font-size: 13px; margin-top: 16px; }
.tad-row { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; padding: 3px 0; color: #495057; opacity: 0; transition: opacity 0.35s ease; }
.tad-row[data-shown='true'] { opacity: 1; }
.tad-row .tad-k { min-width: 168px; color: #868e96; font-size: 12px; }
.tad-mono { font-family: ${MONO}; font-size: 12px; word-break: break-all; }
.tad-final { margin-top: 10px; padding: 10px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; transition: background 0.35s ease, color 0.35s ease; }
.tad-flash { border-radius: 3px; }
.tad-foot { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; margin-top: 12px; }
.tad-progress { flex-shrink: 0; font-size: 11px; color: #adb5bd; font-variant-numeric: tabular-nums; }
.tad-explain { flex: 1 1 240px; font-size: 12px; color: #868e96; line-height: 1.6; }
@media (max-width: 420px) {
  .tad-addr { font-size: 12px; }
  .tad-row .tad-k { min-width: 100%; }
}
`;

export const TokenAnatomyDemo = () => {
  // 세 시나리오의 HMAC은 마운트 시 한 번에 실제 계산해 둔다 (SSR에서는 null → "계산 중…")
  const [sigs, setSigs] = useState<Sigs | null>(null);
  const [step, setStep] = useState<Step>(INITIAL_STEP);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    let cancelled = false;
    let raf = 0;

    void Promise.all([
      hmacHex16(PAYLOAD_VALID),
      hmacHex16(PAYLOAD_FORGED),
      hmacHex16(PAYLOAD_EXPIRED),
    ]).then(([valid, forged, expired]) => {
      if (cancelled) return;
      setSigs({ valid, forged, expired });

      // 계산이 끝난 시점부터 애니메이션 시작 — 표시만 담당한다
      const start = performance.now();
      const tick = (now: number) => {
        if (cancelled) return;
        const e = Math.max(0, now - start) % TOTAL;
        const scen = Math.min(2, Math.floor(e / SCEN_MS));
        const t = e - scen * SCEN_MS;
        const mutated = scen > 0 && t >= T_MUTATE;
        let rows = 0;
        if (t >= T_FINAL) rows = 5;
        else if (t >= T_ROW4) rows = 4;
        else if (t >= T_ROW3) rows = 3;
        else if (t >= T_ROW2) rows = 2;
        else if (t >= T_ROW1) rows = 1;
        setStep((prev) =>
          prev.scen === scen && prev.mutated === mutated && prev.rows === rows
            ? prev
            : { scen, mutated, rows },
        );
        raf = scheduleMaterialFrame(tick);
      };
      raf = scheduleMaterialFrame(tick);
    });

    return () => {
      cancelled = true;
      cancelMaterialFrame(raf);
    };
  }, []);

  const { scen, mutated, rows } = step;
  const def = scenarioAt(scen);

  // 화면에 보이는 주소 — 조작 전에는 정상 주소, 조작 후에는 해당 시나리오의 값
  const shownTicket = mutated ? def.ticketId : TICKET_VALID;
  const shownExp = mutated || scen === 0 ? def.exp : EXP_VALID;
  const ticketMutated = mutated && scen === 1;
  const expMutated = mutated && scen === 2;

  // 주소에 실려온 서명: ①② → 정상 페이로드의 서명, ③ → 그 (만료된) 페이로드에 유효한 서명
  const carriedSig = sigs === null ? null : scen === 2 && mutated ? sigs.expired : sigs.valid;
  // 서버가 현재 페이로드로 재계산한 서명
  const payload = `${shownTicket}.${USER_ID}.${shownExp}`;
  const serverSig =
    sigs === null
      ? null
      : scen === 1 && mutated
        ? sigs.forged
        : scen === 2 && mutated
          ? sigs.expired
          : sigs.valid;

  const computing = serverSig === null || carriedSig === null;
  const sigMatch = !computing && serverSig === carriedSig;
  const notExpired = shownExp > NOW;

  let finalBg = "#f1f3f5";
  let finalColor = "#868e96";
  let finalText = computing ? "계산 중…" : "검증 중…";
  if (!computing && rows >= 5) {
    if (sigMatch && notExpired) {
      finalBg = "#d3f9d8";
      finalColor = "#2b8a3e";
      finalText = `✅ 티켓 #${shownTicket}에 사용자 ${USER_ID}의 코멘트로 저장`;
    } else if (!sigMatch) {
      finalBg = "#ffe3e3";
      finalColor = "#c92a2a";
      finalText = "❌ 거절: 서명 불일치";
    } else {
      finalBg = "#ffe3e3";
      finalColor = "#c92a2a";
      finalText = "❌ 거절: 만료된 주소";
    }
  }

  const seg = (text: string, color: string, flash = false) => (
    <motion.span
      className={flash ? "tad-flash" : undefined}
      animate={
        flash && !reducedMotion
          ? {
              backgroundColor: ["#fa5252", "transparent", "#fa5252", "transparent"],
              color: ["#ffffff", color, "#ffffff", color],
            }
          : { backgroundColor: "transparent", color }
      }
      transition={{ duration: 1.1, ease: "easeInOut", times: [0, 0.3, 0.55, 1] }}
      style={{ color, fontWeight: color === "#868e96" ? 400 : 700 }}
    >
      {text}
    </motion.span>
  );
  const dot = <span style={{ color: "#adb5bd" }}>.</span>;

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

      {/* 1. 주소 해부 */}
      <div className="tad-addr">
        {seg("reply+", "#868e96")}
        {seg(String(shownTicket), ticketMutated ? "#fa5252" : "#228be6", ticketMutated)}
        {dot}
        {seg(String(USER_ID), "#40c057")}
        {dot}
        {seg(String(shownExp), expMutated ? "#fa5252" : "#f59f00", expMutated)}
        {dot}
        {seg(carriedSig ?? "계산 중…", "#7048e8")}
        {seg("@relay.example.com", "#868e96")}
      </div>
      <div className="tad-legend">
        <span style={{ "--c": "#228be6" } as React.CSSProperties}>티켓</span>
        <span style={{ "--c": "#40c057" } as React.CSSProperties}>사용자</span>
        <span style={{ "--c": "#f59f00" } as React.CSSProperties}>만료</span>
        <span style={{ "--c": "#7048e8" } as React.CSSProperties}>서명</span>
      </div>

      {/* 2. 검증 결과 — 행이 순차적으로 나타난다 */}
      <div className="tad-panel">
        <div className="tad-row" data-shown={rows >= 1}>
          <span className="tad-k">서버가 다시 계산한 서명</span>
          <span className="tad-mono" style={{ color: "#7048e8" }}>
            {serverSig ?? "계산 중…"}
          </span>
          <span className="tad-mono" style={{ color: "#adb5bd", fontSize: 11 }}>
            = HMAC(&quot;{payload}&quot;, SECRET)
          </span>
        </div>
        <div className="tad-row" data-shown={rows >= 2}>
          <span className="tad-k">주소에 실려온 서명</span>
          <span className="tad-mono" style={{ color: "#7048e8" }}>
            {carriedSig ?? "계산 중…"}
          </span>
        </div>
        <div className="tad-row" data-shown={rows >= 3}>
          <span className="tad-k">서명 일치 여부</span>
          {computing ? (
            <span style={{ color: "#868e96" }}>계산 중…</span>
          ) : sigMatch ? (
            <span style={{ color: "#2f9e44", fontWeight: 700 }}>✓ 일치</span>
          ) : (
            <span style={{ color: "#fa5252", fontWeight: 700 }}>✗ 불일치</span>
          )}
        </div>
        <div className="tad-row" data-shown={rows >= 4}>
          <span className="tad-k">만료 검사 (지금: {NOW})</span>
          {notExpired ? (
            <span style={{ color: "#2f9e44", fontWeight: 700 }}>
              ✓ 통과{" "}
              <span style={{ fontWeight: 400, fontSize: 11 }}>— {def.expLabel}까지 유효</span>
            </span>
          ) : (
            <span style={{ color: "#fa5252", fontWeight: 700 }}>
              ✗ 만료 <span style={{ fontWeight: 400, fontSize: 11 }}>— {def.expLabel}에 지남</span>
            </span>
          )}
        </div>
        <div className="tad-final" style={{ background: finalBg, color: finalColor }}>
          {finalText}
        </div>
      </div>

      {/* 3. 진행 표시 + 시나리오 설명 */}
      <div className="tad-foot">
        <span className="tad-progress">
          시나리오 {scen + 1}/3 — {def.name}
        </span>
        <span className="tad-explain">{def.explain}</span>
      </div>
    </div>
  );
};
