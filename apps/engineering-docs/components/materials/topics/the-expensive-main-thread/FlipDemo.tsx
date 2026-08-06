// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useRef, useEffect, useState } from "react";
import { seededMaterialRandom } from "@/components/materials/runtime/random";
import { useVisible } from "./useVisible";

// 같은 순위 변동 애니메이션을 두 방식으로 동시에 돌린다.
// 왼쪽은 top 트랜지션(매 프레임 레이아웃 — 메인 스레드), 오른쪽은 FLIP(transform — 컴포지터).
type Lang = "ko" | "en";

const STRINGS = {
  ko: {
    items: ["무선 이어폰", "캠핑 의자", "러닝화", "제습기", "스탠딩 책상", "단백질 쉐이크"],
    caption: "같은 순위 변동을 두 방식으로 동시에 재생한다",
    leftHead: "top 트랜지션",
    leftSub: "· 메인 스레드",
    rightHead: "FLIP",
    rightSub: "· 컴포지터",
    play: "순위 변동 재생",
    loadOn: "메인 스레드 부하 주기",
    loadOff: "메인 스레드 부하 끄기",
  },
  en: {
    items: [
      "Wireless earbuds",
      "Camping chair",
      "Running shoes",
      "Dehumidifier",
      "Standing desk",
      "Protein shake",
    ],
    caption: "The same rank shuffle plays in both modes at once",
    leftHead: "top transition",
    leftSub: "· main thread",
    rightHead: "FLIP",
    rightSub: "· compositor",
    play: "Play rank shuffle",
    loadOn: "Load the main thread",
    loadOff: "Stop the load",
  },
} as const;

const COLORS = ["#228be6", "#40c057", "#fab005", "#e64980", "#7950f2", "#15aabf"];
const ROW = 44; // 항목 간격(px)
const DURATION = 900;

export const FlipDemo = ({ locale: lang = "ko" }: { locale?: Lang }) => {
  const t = STRINGS[lang];
  const leftEls = useRef<(HTMLDivElement | null)[]>([]);
  const rightEls = useRef<(HTMLDivElement | null)[]>([]);
  const leftRanks = useRef<(HTMLSpanElement | null)[]>([]);
  const rightRanks = useRef<(HTMLSpanElement | null)[]>([]);
  const orderRef = useRef<number[]>(t.items.map((_, i) => i)); // orderRef[순위] = 항목 id
  const playLockRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const [load, setLoad] = useState(false);
  const { ref: rootRef, visible } = useVisible<HTMLDivElement>();

  useEffect(() => {
    if (load && visible) {
      // 50ms짜리 롱 태스크를 연속으로 돌린다 — 렌더링 기회가 태스크 사이에만 생겨 화면이 ~18fps로 떨어진다
      timerRef.current = window.setInterval(() => {
        const end = performance.now() + 50;
        while (performance.now() < end) {
          /* busy */
        }
      }, 0);
    }
    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [load, visible]);

  const play = () => {
    const now = performance.now();
    if (now - playLockRef.current < DURATION) return; // 애니메이션 중 연타 방지
    playLockRef.current = now;

    // 새 순위: 항목이 반드시 움직이도록 뒤섞는다
    const order = orderRef.current;
    const next = [...order];
    for (let k = next.length - 1; k > 0; k--) {
      const j = Math.floor(seededMaterialRandom("the-expensive-main-thread/FlipDemo") * (k + 1));
      [next[k], next[j]] = [next[j], next[k]];
    }
    orderRef.current = next;

    next.forEach((id, rank) => {
      const top = `${rank * ROW}px`;

      // 왼쪽: top을 트랜지션으로 애니메이션 — 매 프레임 레이아웃이 메인 스레드에서 돈다
      const leftEl = leftEls.current[id];
      if (leftEl) leftEl.style.top = top;
      const leftRank = leftRanks.current[id];
      if (leftRank) leftRank.textContent = String(rank + 1);

      // 오른쪽: FLIP — 레이아웃 변경은 한 번, 이동은 transform으로
      const rightEl = rightEls.current[id];
      if (rightEl) {
        const first = rightEl.getBoundingClientRect(); // First: 지금 위치
        rightEl.style.top = top; // 레이아웃 변경은 단 한 번
        const last = rightEl.getBoundingClientRect(); // Last: 새 위치
        const dy = first.top - last.top;
        // Invert → Play: 이전 위치로 되돌려 놓은 것처럼 보이게 한 뒤 풀어낸다
        rightEl.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], {
          duration: DURATION,
          easing: "ease-in-out",
        });
      }
      const rightRank = rightRanks.current[id];
      if (rightRank) rightRank.textContent = String(rank + 1);
    });
  };

  // 두 방식을 나란히 놓고 동시에 봐야 하는 데모라 모바일에서도 두 열을 유지한다
  const listStyle: React.CSSProperties = {
    position: "relative",
    height: t.items.length * ROW - 8,
    background: "#f8f9fa",
    borderRadius: 8,
  };

  const headStyle = (color: string): React.CSSProperties => ({
    fontSize: 12,
    fontWeight: 600,
    color,
    marginBottom: 6,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  });

  const renderList = (
    els: React.MutableRefObject<(HTMLDivElement | null)[]>,
    ranks: React.MutableRefObject<(HTMLSpanElement | null)[]>,
    transitionTop: boolean,
  ) => (
    <div style={listStyle}>
      {t.items.map((label, id) => (
        <div
          key={id}
          ref={(el) => {
            els.current[id] = el;
          }}
          style={{
            position: "absolute",
            top: id * ROW,
            left: 8,
            right: 8,
            height: ROW - 8,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 10px",
            background: "#fff",
            border: "1px solid #e9ecef",
            borderRadius: 6,
            boxSizing: "border-box",
            transition: transitionTop ? `top ${DURATION}ms ease-in-out` : undefined,
          }}
        >
          <span
            ref={(el) => {
              ranks.current[id] = el;
            }}
            style={{ fontSize: 12, fontWeight: 800, color: COLORS[id], width: 14, flexShrink: 0 }}
          >
            {id + 1}
          </span>
          <span
            style={{
              fontSize: 12,
              color: "#495057",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <div
      ref={rootRef}
      style={{
        border: "1px solid #dee2e6",
        borderRadius: 8,
        padding: 20,
        margin: "24px 0",
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 11, color: "#868e96", marginBottom: 10 }}>{t.caption}</div>

      {/* 두 목록 */}
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={headStyle("#e8590c")}>
            {t.leftHead} <span style={{ fontWeight: 400, color: "#868e96" }}>{t.leftSub}</span>
          </div>
          {renderList(leftEls, leftRanks, true)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={headStyle("#2f9e44")}>
            {t.rightHead} <span style={{ fontWeight: 400, color: "#868e96" }}>{t.rightSub}</span>
          </div>
          {renderList(rightEls, rightRanks, false)}
        </div>
      </div>

      {/* 재생 + 부하 */}
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14 }}>
        <button
          onClick={play}
          style={{
            padding: "8px 20px",
            border: "none",
            borderRadius: 6,
            background: "#228be6",
            color: "#fff",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {t.play}
        </button>
        <button
          onClick={() => setLoad((v) => !v)}
          style={{
            padding: "8px 18px",
            border: "none",
            borderRadius: 6,
            background: load ? "#fa5252" : "#868e96",
            color: "#fff",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {load ? t.loadOff : t.loadOn}
        </button>
      </div>
    </div>
  );
};
