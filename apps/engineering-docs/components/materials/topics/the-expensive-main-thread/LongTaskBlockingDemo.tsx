"use client";

import { motion, useReducedMotion } from "motion/react";
import React, { useRef, useEffect, useState } from "react";
import {
  cancelMaterialFrame,
  scheduleMaterialFrame,
} from "@/components/materials/runtime/scheduler";
import { useVisible } from "./useVisible";

type Lang = "ko" | "en";

const STRINGS = {
  ko: {
    jsTitle: "JS 애니메이션",
    jsTag: "메인 스레드 · rAF",
    cssTitle: "CSS 애니메이션",
    cssTag: "컴포지터 · transform",
    placeholder: "여기에 타이핑해보세요",
    blockHalf: "0.5초 막기",
    blockTwo: "2초 막기",
    blockingCaption: "메인 스레드를 붙잡는 중 — JS 애니메이션과 입력이 멈춘다",
    idleCaption: "버튼을 누르면 JS 애니메이션과 입력은 멈추지만 CSS 애니메이션은 계속 돈다",
  },
  en: {
    jsTitle: "JS animation",
    jsTag: "Main thread · rAF",
    cssTitle: "CSS animation",
    cssTag: "Compositor · transform",
    placeholder: "Try typing here",
    blockHalf: "Block for 0.5s",
    blockTwo: "Block for 2s",
    blockingCaption: "Holding the main thread — the JS animation and typing freeze",
    idleCaption:
      "Press a button: the JS animation and typing freeze, but the CSS animation keeps spinning",
  },
} as const;

const boxStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 8,
  margin: "0 auto",
};

export const LongTaskBlockingDemo = ({ locale: lang = "ko" }: { locale?: Lang }) => {
  const t = STRINGS[lang];
  const jsBoxRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const angleRef = useRef(0);
  const lastRef = useRef(0);
  const [blocking, setBlocking] = useState(false);
  const reducedMotion = useReducedMotion();
  const { ref: rootRef, visible } = useVisible<HTMLDivElement>();

  useEffect(() => {
    if (!visible) return; // 화면 밖에서는 루프를 돌리지 않는다
    const animate = (t: number) => {
      if (lastRef.current) {
        const dt = t - lastRef.current;
        angleRef.current = (angleRef.current + dt * 0.24) % 360;
      }
      lastRef.current = t;
      if (jsBoxRef.current) jsBoxRef.current.style.transform = `rotate(${angleRef.current}deg)`;
      rafRef.current = scheduleMaterialFrame(animate);
    };
    rafRef.current = scheduleMaterialFrame(animate);
    return () => cancelMaterialFrame(rafRef.current);
  }, [visible]);

  const block = (ms: number) => {
    if (blocking) return;
    setBlocking(true);
    // 버튼 상태가 먼저 그려지도록 다음 태스크에서 메인 스레드를 붙잡는다
    setTimeout(() => {
      const end = performance.now() + ms;
      while (performance.now() < end) {
        /* 아무것도 안 하고 메인 스레드를 붙잡는 busy loop */
      }
      lastRef.current = 0; // 각도가 튀지 않도록 리셋
      setBlocking(false);
    }, 0);
  };

  const panel = (
    title: string,
    tag: string,
    tagColor: string,
    tagBg: string,
    boxRef: React.Ref<HTMLDivElement> | undefined,
    boxColor: string,
    animated: boolean,
  ) => (
    <div
      style={{
        flex: 1,
        minWidth: 120,
        background: "#f8f9fa",
        borderRadius: 8,
        padding: "16px 12px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: "#495057", marginBottom: 3 }}>
        {title}
      </div>
      <span
        style={{
          display: "inline-block",
          fontSize: 10,
          fontWeight: 600,
          color: tagColor,
          background: tagBg,
          borderRadius: 10,
          padding: "2px 8px",
          marginBottom: 14,
        }}
      >
        {tag}
      </span>
      <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <motion.div
          ref={boxRef}
          animate={{ rotate: animated && visible && !reducedMotion ? 360 : 0 }}
          transition={{ duration: 1.5, ease: "linear", repeat: animated ? Infinity : 0 }}
          style={{
            ...boxStyle,
            background: boxColor,
          }}
        />
      </div>
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
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {panel(t.jsTitle, t.jsTag, "#1971c2", "#e7f5ff", jsBoxRef, "#228be6", false)}
        {panel(t.cssTitle, t.cssTag, "#2f9e44", "#ebfbee", undefined, "#40c057", true)}
      </div>

      <input
        type="text"
        placeholder={t.placeholder}
        style={{
          width: "100%",
          boxSizing: "border-box",
          marginTop: 12,
          padding: "9px 12px",
          border: "1px solid #dee2e6",
          borderRadius: 6,
          fontSize: 13,
          color: "#495057",
          outline: "none",
        }}
      />

      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "center",
          marginTop: 14,
          flexWrap: "wrap",
        }}
      >
        {[
          { label: t.blockHalf, ms: 500 },
          { label: t.blockTwo, ms: 2000 },
        ].map(({ label, ms }) => (
          <button
            key={ms}
            onClick={() => block(ms)}
            disabled={blocking}
            style={{
              padding: "8px 18px",
              border: "none",
              borderRadius: 6,
              background: blocking ? "#ced4da" : "#fa5252",
              color: "#fff",
              cursor: blocking ? "default" : "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 11, color: "#adb5bd", textAlign: "center", marginTop: 12 }}>
        {blocking ? t.blockingCaption : t.idleCaption}
      </div>
    </div>
  );
};
