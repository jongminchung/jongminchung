// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import { motion, useReducedMotion } from "motion/react";
import React, { useEffect, useState } from "react";
import {
  cancelMaterialFrame,
  scheduleMaterialFrame,
} from "@/components/materials/runtime/scheduler";

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

type ScreenKey = "feed" | "a" | "b";

const TABS: Array<{ key: ScreenKey; label: string }> = [
  { key: "feed", label: "피드" },
  { key: "a", label: "글 A" },
  { key: "b", label: "글 B" },
];

const SCREEN_META: Record<ScreenKey, { title: string; lines: number[] }> = {
  feed: { title: "피드", lines: [92, 70, 84] },
  a: { title: "글 A — 캐시 이야기", lines: [78, 95, 60] },
  b: { title: "글 B — 스피너의 최후", lines: [88, 64, 76] },
};

// 내비게이션 스크립트: 피드 → 글 A → 피드 → 글 B → 피드 → 글 A → 피드
const SCRIPT: ScreenKey[] = ["feed", "a", "feed", "b", "feed", "a", "feed"];

const STEP_MS = 1600; // 스텝 간격
const FETCH_MS = 700; // 스피너/백그라운드 갱신 시간
const RESULT_MS = 2000; // 결과 강조 시간
const NAV_MS = SCRIPT.length * STEP_MS;
const CYCLE = NAV_MS + RESULT_MS;

// 스텝별 정보 미리 계산
const STEP_INFO = SCRIPT.map((screen, i) => {
  const prevStep = SCRIPT.slice(0, i).lastIndexOf(screen);
  return {
    screen,
    firstVisit: prevStep === -1,
    prevStep, // 직전 방문 스텝 (staleTime 0: 매번 갱신되므로 데이터 나이 기준)
    firstStep: SCRIPT.indexOf(screen), // 첫 방문 스텝 (staleTime 5분: 그때 데이터 그대로)
  };
});

// 스텝 시작 시점에 카운터가 오른 뒤의 값
function countersAt(step: number) {
  const firstVisits = STEP_INFO.slice(0, step + 1).filter((s) => s.firstVisit).length;
  return {
    leftNet: step + 1, // staleTime 0: 첫 방문 + 재방문 백그라운드 갱신 = 매 스텝 +1
    rightNet: firstVisits, // staleTime 5분: 첫 방문만 +1
    spin: firstVisits, // 스피너는 양쪽 모두 첫 방문에만
  };
}

const FINAL = countersAt(SCRIPT.length - 1); // 요청 7 vs 3, 스피너 3

type Variant = "zero" | "five";

function ageText(step: number, sub: number, variant: Variant): string {
  const info = STEP_INFO[step];
  if (info.firstVisit) return "방금 받은 데이터";
  if (variant === "zero") {
    if (sub === 1) return "방금 갱신된 데이터";
    return `${Math.round((step - info.prevStep) * (STEP_MS / 1000))}초 전 데이터`;
  }
  return `${Math.round((step - info.firstStep) * (STEP_MS / 1000))}초 전 데이터`;
}

export const StaleTimeSessionDemo = () => {
  // step 0~6: 내비게이션 스텝, step 7: 결과 강조. sub 0: 스텝 초반(스피너/갱신 중), sub 1: 완료.
  const [frame, setFrame] = useState({ step: 0, sub: 0 });
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    let lastKey = -1;

    const loop = (now: number) => {
      const e = (now - start) % CYCLE;
      let step: number;
      let sub: number;
      if (e >= NAV_MS) {
        step = SCRIPT.length;
        sub = 0;
      } else {
        step = Math.floor(e / STEP_MS);
        sub = e % STEP_MS >= FETCH_MS ? 1 : 0;
      }
      const key = step * 2 + sub;
      if (key !== lastKey) {
        lastKey = key;
        setFrame({ step, sub });
      }
      raf = scheduleMaterialFrame(loop);
    };

    raf = scheduleMaterialFrame(loop);
    return () => cancelMaterialFrame(raf);
  }, []);

  const { step, sub } = frame;
  const isResult = step >= SCRIPT.length;
  const navStep = isResult ? SCRIPT.length - 1 : step;
  const info = STEP_INFO[navStep];
  const counters = isResult ? FINAL : countersAt(step);
  const cached = new Set(SCRIPT.slice(0, navStep + 1)); // 방문한 화면 = 캐시된 화면 (양쪽 동일)

  const renderPanel = (variant: Variant) => {
    const title = variant === "zero" ? "staleTime: 0 (기본값)" : "staleTime: 5분";
    const net = variant === "zero" ? counters.leftNet : counters.rightNet;
    const loading = !isResult && info.firstVisit && sub === 0;
    const showBadge = !isResult && variant === "zero" && !info.firstVisit && sub === 0;
    const meta = SCREEN_META[info.screen];
    const counterBg = isResult ? (variant === "zero" ? "#fff5f5" : "#e7f5ff") : "#f8f9fa";
    const counterColor = variant === "zero" ? "#fa5252" : "#228be6";

    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#495057",
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          {title}
        </div>

        {/* 미니 앱 프레임 */}
        <div
          style={{
            border: "1px solid #adb5bd",
            borderRadius: 10,
            background: "#fff",
            overflow: "hidden",
          }}
        >
          <div
            style={{ display: "flex", borderBottom: "1px solid #dee2e6", background: "#f8f9fa" }}
          >
            {TABS.map((t) => {
              const active = info.screen === t.key;
              return (
                <div
                  key={t.key}
                  style={{
                    flex: 1,
                    padding: "6px 2px",
                    fontSize: 11,
                    fontWeight: 600,
                    textAlign: "center",
                    borderBottom: active ? "2px solid #228be6" : "2px solid transparent",
                    background: active ? "#e7f5ff" : "transparent",
                    color: active ? "#228be6" : "#868e96",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.label}
                  {cached.has(t.key) && (
                    <span
                      style={{
                        display: "inline-block",
                        width: 4,
                        height: 4,
                        borderRadius: "50%",
                        background: "#40c057",
                        marginLeft: 3,
                        verticalAlign: 2,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div
            style={{
              position: "relative",
              height: 110,
              padding: "10px 12px",
              boxSizing: "border-box",
            }}
          >
            {showBadge && (
              <motion.div
                animate={{ opacity: reducedMotion ? 1 : [1, 0.35, 1] }}
                transition={{ duration: 0.5, ease: "easeInOut", repeat: Infinity }}
                style={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                  fontSize: 9,
                  fontWeight: 700,
                  color: "#228be6",
                  background: "#e7f5ff",
                  borderRadius: 4,
                  padding: "2px 6px",
                  whiteSpace: "nowrap",
                }}
              >
                백그라운드 갱신
              </motion.div>
            )}

            {loading ? (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <motion.div
                  animate={{ rotate: reducedMotion ? 0 : 360 }}
                  transition={{ duration: 0.7, ease: "linear", repeat: Infinity }}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    border: "3px solid #dee2e6",
                    borderTopColor: "#228be6",
                  }}
                />
                <div style={{ fontSize: 11, color: "#868e96" }}>불러오는 중…</div>
              </div>
            ) : (
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#495057",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    paddingRight: showBadge ? 78 : 0,
                  }}
                >
                  {meta.title}
                </div>
                <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 6 }}>
                  {meta.lines.map((w, i) => (
                    <div
                      key={i}
                      style={{ height: 7, width: `${w}%`, borderRadius: 4, background: "#e9ecef" }}
                    />
                  ))}
                </div>
                <div style={{ marginTop: 10, fontSize: 10, color: "#868e96" }}>
                  {ageText(navStep, sub, variant)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 카운터 */}
        <div
          style={{
            marginTop: 8,
            padding: isResult ? "9px 8px" : "6px 8px",
            borderRadius: 6,
            background: counterBg,
            border: isResult ? `1px solid ${counterColor}` : "1px solid transparent",
            textAlign: "center",
            fontSize: isResult ? 15 : 12,
            fontWeight: isResult ? 700 : 400,
            color: "#495057",
            transition: "all 0.3s ease",
            whiteSpace: "nowrap",
          }}
        >
          {isResult ? "요청 " : "네트워크 요청 "}
          <b style={{ color: counterColor }}>{net}</b>
          <span style={{ color: "#adb5bd" }}> · </span>
          {"스피너 "}
          <b style={{ color: "#fab005" }}>{counters.spin}</b>
        </div>
      </div>
    );
  };

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
      <style
        dangerouslySetInnerHTML={{
          __html: `
.stsd-cols { display: flex; gap: 16px; }
@media (max-width: 479px) { .stsd-cols { flex-direction: column; } }
`,
        }}
      />

      <div className="stsd-cols">
        {renderPanel("zero")}
        {renderPanel("five")}
      </div>

      <div style={{ fontSize: 11, color: "#adb5bd", textAlign: "center", marginTop: 14 }}>
        스피너 횟수는 양쪽이 같다 — 달라지는 것은 네트워크 요청 수뿐이다
      </div>
    </div>
  );
};
