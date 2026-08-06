// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useRef, useEffect, useState } from "react";
import {
  cancelMaterialFrame,
  scheduleMaterialFrame,
} from "@/components/materials/runtime/scheduler";
import { useVisible } from "./useVisible";

// 마크다운 에디터의 실시간 미리보기 — 키 입력마다 문서 전체를 파싱해 미리보기를 다시 만든다.
// 디바운스는 이 "키 입력마다"를 "타이핑이 멈춘 뒤 한 번"으로 모은다.
const RELEASES = 300; // 릴리스 수 — 문서 약 2,000줄

const MODULES = [
  "ChatList",
  "VideoPlayer",
  "useSocket",
  "ImageUploader",
  "EmotePicker",
  "ThemeProvider",
  "LiveBadge",
  "Overlay",
];

type Lang = "ko" | "en";

const STRINGS = {
  ko: {
    header: "약 2,000줄짜리 CHANGELOG.md",
    modeOff: "디바운스 없음",
    modeOn: "디바운스 300ms",
    placeholder: "여기에 빠르게 타이핑해보세요",
    features: [
      "가상 스크롤 도입",
      "다크 모드 대응",
      "자동 재연결 옵션 추가",
      "이모티콘 검색 지원",
      "썸네일 미리 생성",
      "키보드 단축키 지원",
      "오프라인 캐시 도입",
      "알림 설정 세분화",
    ],
    fixes: [
      "메모리 누수 수정",
      "중복 구독 문제 해결",
      "스크롤 위치가 초기화되는 문제 수정",
      "사파리에서 레이아웃이 깨지는 문제 수정",
      "타이머 정리 누락 수정",
      "탭을 빠르게 전환하면 멈추는 문제 수정",
      "입력 포커스를 잃는 문제 수정",
    ],
    notes: ["내부 리팩토링", "번들 크기 축소", "의존성 정리", "접근성 개선", "문서 보강"],
    added: "추가",
    fixed: "수정",
    notice: (m: string) =>
      `> **주의**: \`${m}\` API가 변경되었다. 마이그레이션 가이드를 참고할 것.`,
    misc: (a: string, b: string) => `기타: ${a} 및 ${b}.`,
  },
  en: {
    header: "A ~2,000-line CHANGELOG.md",
    modeOff: "No debounce",
    modeOn: "Debounce 300ms",
    placeholder: "Try typing quickly here",
    features: [
      "virtual scrolling",
      "dark mode support",
      "auto-reconnect option",
      "emote search",
      "thumbnail pregeneration",
      "keyboard shortcuts",
      "offline cache",
      "granular notification settings",
    ],
    fixes: [
      "memory leak",
      "duplicate subscriptions",
      "scroll position resetting",
      "broken layout in Safari",
      "missing timer cleanup",
      "freeze when switching tabs quickly",
      "input losing focus",
    ],
    notes: [
      "internal refactoring",
      "smaller bundle size",
      "dependency cleanup",
      "accessibility improvements",
      "documentation updates",
    ],
    added: "Added",
    fixed: "Fixed",
    notice: (m: string) => `> **Note**: the \`${m}\` API has changed. See the migration guide.`,
    misc: (a: string, b: string) => `Misc: ${a} and ${b}.`,
  },
};

// 실제 프로젝트의 CHANGELOG.md처럼 최신 버전이 위로 오는 릴리스 노트를 만든다
function buildDoc(lang: Lang): string {
  const t = STRINGS[lang];
  const parts: string[] = ["# CHANGELOG", ""];
  for (let i = 0; i < RELEASES; i++) {
    const v = RELEASES - i;
    const version = `v${1 + Math.floor(v / 100)}.${Math.floor(v / 10) % 10}.${v % 10}`;
    const date = `${2026 - Math.floor(i / 60)}-${String(1 + (i % 12)).padStart(2, "0")}-${String(1 + ((i * 7) % 28)).padStart(2, "0")}`;
    const pr = 3200 - i * 9;
    parts.push(`## ${version} (${date})`);
    if (i % 10 === 0) parts.push(t.notice(MODULES[i % MODULES.length]));
    parts.push(
      `- ${t.added}: \`${MODULES[(i * 3) % MODULES.length]}\` ${t.features[i % t.features.length]} ([#${pr}](https://github.com/example/app/pull/${pr}))`,
    );
    parts.push(
      `- ${t.fixed}: \`${MODULES[(i * 5 + 1) % MODULES.length]}\` ${t.fixes[i % t.fixes.length]} ([#${pr - 3}](https://github.com/example/app/pull/${pr - 3}))`,
    );
    parts.push(`- ${t.fixed}: ${t.fixes[(i * 3 + 2) % t.fixes.length]}`);
    parts.push(t.misc(t.notes[i % t.notes.length], t.notes[(i + 2) % t.notes.length]));
    parts.push("");
  }
  return parts.join("\n");
}
const DOCS: Record<Lang, string> = { ko: buildDoc("ko"), en: buildDoc("en") };

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function inline(s: string): string {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
}

// 줄 단위 미니 마크다운 파서 — 매 실행마다 문서 전체를 처음부터 다시 파싱한다
function renderMarkdown(src: string): string {
  const lines = src.split("\n");
  let html = "";
  let inList = false;
  for (const line of lines) {
    if (line.startsWith("- ")) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${inline(line.slice(2))}</li>`;
      continue;
    }
    if (inList) {
      html += "</ul>";
      inList = false;
    }
    if (line.startsWith("## ")) html += `<h2>${inline(line.slice(3))}</h2>`;
    else if (line.startsWith("# ")) html += `<h1>${inline(line.slice(2))}</h1>`;
    else if (line.startsWith("> ")) html += `<blockquote>${inline(line.slice(2))}</blockquote>`;
    else if (line.trim() === "") continue;
    else html += `<p>${inline(line)}</p>`;
  }
  if (inList) html += "</ul>";
  return html;
}

export const DebounceDemo = ({ locale: lang = "ko" }: { locale?: Lang }) => {
  const t = STRINGS[lang];
  const doc = DOCS[lang];
  const fpsRef = useRef<HTMLSpanElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const rafRef = useRef<number>(0);
  const framesRef = useRef<number[]>([]);
  const timerRef = useRef<number | null>(null);
  const renderedRef = useRef(false);
  const modeRef = useRef<"off" | "on">("off");
  const [mode, setMode] = useState<"off" | "on">("off");
  const { ref: rootRef, visible } = useVisible<HTMLDivElement>();

  // 디바운스 타이머 정리는 언마운트 시에만
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!visible) return; // 화면 밖에서는 루프를 돌리지 않는다
    if (!renderedRef.current) {
      renderedRef.current = true;
      renderPreview(doc); // 처음 보일 때 미리보기를 한 번 만들어둔다
    }
    const animate = (t: number) => {
      const frames = framesRef.current;
      frames.push(t);
      while (frames.length && t - frames[0] > 1000) frames.shift();
      if (fpsRef.current) fpsRef.current.textContent = String(frames.length);
      rafRef.current = scheduleMaterialFrame(animate);
    };
    rafRef.current = scheduleMaterialFrame(animate);
    return () => cancelMaterialFrame(rafRef.current);
  }, [visible, lang]);

  // 문서 전체를 파싱하고 미리보기 DOM을 통째로 교체한다 — 나이브 에디터의 실제 동작
  const renderPreview = (src: string) => {
    const preview = previewRef.current;
    if (!preview) return;
    preview.innerHTML = renderMarkdown(src);
  };

  const onInput = (value: string) => {
    if (modeRef.current === "off") {
      renderPreview(value); // 디바운스 없음: 키 입력마다 전체 파싱 + 미리보기 재구축
    } else {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => renderPreview(value), 300); // 멈추고 300ms 뒤 한 번만
    }
  };

  const switchMode = (m: "off" | "on") => {
    modeRef.current = m;
    setMode(m);
    if (timerRef.current !== null) clearTimeout(timerRef.current);
  };

  const modeBtn = (m: "off" | "on", label: string) => (
    <button
      onClick={() => switchMode(m)}
      style={{
        flex: 1,
        padding: "7px 10px",
        border: mode === m ? "2px solid #228be6" : "1px solid #dee2e6",
        borderRadius: 6,
        background: mode === m ? "#e7f5ff" : "#fff",
        color: mode === m ? "#1971c2" : "#868e96",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: mode === m ? 700 : 500,
      }}
    >
      {label}
    </button>
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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          fontSize: 11,
          color: "#868e96",
          marginBottom: 10,
        }}
      >
        <span>{t.header}</span>
        <span style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
          <span ref={fpsRef} style={{ fontWeight: 700, color: "#495057" }}>
            60
          </span>{" "}
          fps
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {modeBtn("off", t.modeOff)}
        {modeBtn("on", t.modeOn)}
      </div>

      {/* 에디터 + 미리보기 */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <textarea
          ref={textareaRef}
          defaultValue={doc}
          onChange={(e) => onInput(e.target.value)}
          spellCheck={false}
          placeholder={t.placeholder}
          style={{
            flex: 1,
            minWidth: 220,
            height: 200,
            boxSizing: "border-box",
            padding: "10px 12px",
            border: "1px solid #dee2e6",
            borderRadius: 6,
            fontSize: 12,
            lineHeight: 1.6,
            fontFamily: "monospace",
            color: "#495057",
            outline: "none",
            resize: "none",
          }}
        />
        <div
          ref={previewRef}
          style={{
            flex: 1,
            minWidth: 220,
            height: 200,
            boxSizing: "border-box",
            overflowY: "auto",
            border: "1px solid #e9ecef",
            borderRadius: 6,
            padding: "4px 14px",
            fontSize: 12,
            lineHeight: 1.6,
            color: "#495057",
            background: "#f8f9fa",
          }}
        />
      </div>
    </div>
  );
};
