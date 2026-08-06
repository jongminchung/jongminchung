// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import { motion, useReducedMotion } from "motion/react";
import React, { useEffect, useState } from "react";

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

type Status = "fresh" | "stale" | "revalidating";

interface CardDef {
  id: string;
  title: string;
  tags: string[];
}

const CARDS: CardDef[] = [
  { id: "detail", title: "상품 42 상세", tags: ["product:42", "products"] },
  { id: "category", title: "카테고리 목록", tags: ["products", "category:3"] },
  { id: "main", title: "메인 추천 목록", tags: ["products"] },
  { id: "cart", title: "장바구니", tags: ["cart", "product:42"] },
];

const EVENTS = [
  { label: "상품 42 가격 수정", tag: "product:42" },
  { label: "신상품 등록", tag: "products" },
  { label: "장바구니 담기", tag: "cart" },
];

// 이벤트 하나의 타임라인 (ms)
const FLASH_MS = 900; // 이벤트 행·태그 칩 강조 시간
const STALE_AT = 350; // 매칭 카드가 낡음으로 전이
const REVALIDATE_AT = 950; // 재검증 시작
const FRESH_AT = 1750; // 재검증 완료 (0.8초 소요), 버전 +1
const EVENT_GAP_MS = 2500; // 다음 이벤트까지의 간격
const FIRST_DELAY_MS = 1000; // 첫 이벤트까지의 대기

const STATUS_META: Record<
  Status,
  { label: string; border: string; badgeBg: string; badgeColor: string }
> = {
  fresh: { label: "신선", border: "#40c057", badgeBg: "#d3f9d8", badgeColor: "#2f9e44" },
  stale: { label: "낡음", border: "#fab005", badgeBg: "#fff9db", badgeColor: "#e67700" },
  revalidating: {
    label: "재검증 중",
    border: "#228be6",
    badgeBg: "#e7f5ff",
    badgeColor: "#1971c2",
  },
};

const initialCards = () =>
  Object.fromEntries(CARDS.map((c) => [c.id, { status: "fresh" as Status, version: 1 }])) as Record<
    string,
    { status: Status; version: number }
  >;

export const TagInvalidationDemo = () => {
  const [cards, setCards] =
    useState<Record<string, { status: Status; version: number }>>(initialCards);
  const [activeEvent, setActiveEvent] = useState<number | null>(null);
  const [eventFlash, setEventFlash] = useState(false);
  const [flashTag, setFlashTag] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 480);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const timers: number[] = [];
    const at = (fn: () => void, ms: number) => {
      timers.push(window.setTimeout(fn, ms));
    };

    const patch = (tag: string, status: Status, bump = false) => {
      setCards((prev) => {
        const next = { ...prev };
        CARDS.filter((c) => c.tags.includes(tag)).forEach((c) => {
          next[c.id] = {
            status,
            version: prev[c.id].version + (bump ? 1 : 0),
          };
        });
        return next;
      });
    };

    const fireEvent = (index: number) => {
      const ev = EVENTS[index];

      // 이벤트 발생: 이벤트 행과 해당 태그 칩을 강조
      setActiveEvent(index);
      setEventFlash(true);
      setFlashTag(ev.tag);
      at(() => setEventFlash(false), FLASH_MS);
      at(() => setFlashTag(null), FLASH_MS);

      // 매칭된 카드의 상태 전이: 낡음 → 재검증 중 → 신선(버전 +1)
      at(() => patch(ev.tag, "stale"), STALE_AT);
      at(() => patch(ev.tag, "revalidating"), REVALIDATE_AT);
      at(() => patch(ev.tag, "fresh", true), FRESH_AT);

      at(() => {
        if (index === EVENTS.length - 1) {
          // 한 바퀴가 끝났을 때 버전이 v9에 닿았으면 조용히 v1로 리셋
          setCards((prev) =>
            Object.values(prev).some((s) => s.version >= 9) ? initialCards() : prev,
          );
        }
        fireEvent((index + 1) % EVENTS.length);
      }, EVENT_GAP_MS);
    };

    at(() => fireEvent(0), FIRST_DELAY_MS);
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

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
      <div style={{ fontSize: 11, fontWeight: 700, color: "#868e96", marginBottom: 10 }}>
        캐시 저장소
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: 10,
        }}
      >
        {CARDS.map((card) => {
          const state = cards[card.id];
          const meta = STATUS_META[state.status];
          return (
            <div
              key={card.id}
              style={{
                border: `1.5px solid ${meta.border}`,
                borderRadius: 8,
                padding: "12px 14px",
                background: "#fff",
                transition: "border-color 0.25s",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  marginBottom: 9,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: "#495057" }}>
                  {card.title}
                  <span
                    style={{
                      marginLeft: 6,
                      fontFamily: MONO,
                      fontSize: 11,
                      fontWeight: 400,
                      color: "#868e96",
                    }}
                  >
                    v{state.version}
                  </span>
                </div>
                <motion.span
                  animate={{
                    opacity: state.status === "revalidating" && !reducedMotion ? [1, 0.35, 1] : 1,
                  }}
                  transition={{ duration: 0.7, ease: "easeInOut", repeat: Infinity }}
                  style={{
                    flexShrink: 0,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 4,
                    background: meta.badgeBg,
                    color: meta.badgeColor,
                  }}
                >
                  {meta.label}
                </motion.span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {card.tags.map((tag) => {
                  const flashed = flashTag === tag;
                  return (
                    <span
                      key={tag}
                      style={{
                        fontFamily: MONO,
                        fontSize: 11,
                        padding: "2px 7px",
                        borderRadius: 4,
                        border: `1px solid ${flashed ? "#fab005" : "#dee2e6"}`,
                        background: flashed ? "#fff9db" : "#f8f9fa",
                        color: flashed ? "#e67700" : "#868e96",
                        transition: "background 0.25s, border-color 0.25s, color 0.25s",
                      }}
                    >
                      {tag}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: "#868e96", margin: "16px 0 10px" }}>
        변경 이벤트
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {EVENTS.map((ev, i) => {
          const active = activeEvent === i;
          const flashing = active && eventFlash;
          return (
            <div
              key={ev.tag}
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "4px 10px",
                border: `1px solid ${active ? "#228be6" : "#dee2e6"}`,
                borderRadius: 6,
                padding: "7px 12px",
                background: flashing ? "#e7f5ff" : active ? "#fff" : "#f8f9fa",
                transition: "background 0.3s, border-color 0.3s",
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: active ? "#495057" : "#adb5bd",
                  transition: "color 0.3s",
                }}
              >
                {ev.label}
              </span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 12,
                  whiteSpace: "nowrap",
                  color: active ? "#495057" : "#adb5bd",
                  transition: "color 0.3s",
                }}
              >
                revalidateTag(
                <span style={{ color: active ? "#228be6" : "#adb5bd" }}>&apos;{ev.tag}&apos;</span>)
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 14, fontSize: 11, color: "#adb5bd", textAlign: "center" }}>
        저장할 때 의존하는 데이터를 태그로 기록해두면, 변경은 태그를 조준하는 것으로 끝난다
      </div>
    </div>
  );
};
