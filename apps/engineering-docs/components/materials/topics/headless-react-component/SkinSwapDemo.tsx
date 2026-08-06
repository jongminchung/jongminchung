// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useState } from "react";
import { Select } from "./Select";

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

type SkinId = "saas" | "commerce" | "terminal";

const SKINS: Array<{ id: SkinId; label: string }> = [
  { id: "saas", label: "SaaS 대시보드" },
  { id: "commerce", label: "커머스" },
  { id: "terminal", label: "어드민 콘솔" },
];

const STYLE = `
.hsd-stage { border-radius: 8px; padding: 24px 20px; min-height: 240px; transition: background 0.2s ease; }
.hsd-root { position: relative; display: inline-block; }
.hsd-listbox { position: absolute; top: calc(100% + 6px); left: 0; min-width: 100%; margin: 0; padding: 0; list-style: none; z-index: 10; }
.hsd-option { cursor: pointer; white-space: nowrap; }
.hsd-chevron { display: inline-block; transition: transform 0.15s ease; margin-left: 10px; }
.hsd-trigger[data-state='open'] .hsd-chevron { transform: rotate(180deg); }

/* 스킨 1: SaaS 대시보드 — 밝고 절제된 톤 */
.hsd-saas.hsd-stage { background: #f8f9fa; }
.hsd-saas .hsd-trigger { display: inline-flex; align-items: center; justify-content: space-between; min-width: 180px; font-family: ${FONT}; font-size: 14px; color: #495057; background: #fff; border: 1px solid #dee2e6; border-radius: 8px; padding: 9px 14px; cursor: pointer; }
.hsd-saas .hsd-trigger:focus-visible { outline: none; border-color: #228be6; box-shadow: 0 0 0 3px rgba(34, 139, 230, 0.2); }
.hsd-saas .hsd-trigger [data-placeholder] { color: #adb5bd; }
.hsd-saas .hsd-listbox { background: #fff; border: 1px solid #dee2e6; border-radius: 8px; padding: 4px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); }
.hsd-saas .hsd-option { font-family: ${FONT}; font-size: 14px; color: #495057; padding: 8px 12px; border-radius: 6px; }
.hsd-saas .hsd-option[data-highlighted] { background: #e7f5ff; color: #1971c2; }
.hsd-saas .hsd-option[data-state='checked'] { font-weight: 600; }
.hsd-saas .hsd-option[data-state='checked']::after { content: ' ✓'; color: #228be6; }

/* 스킨 2: 커머스 — 둥글고 따뜻한 톤 */
.hsd-commerce.hsd-stage { background: #fff4e6; }
.hsd-commerce .hsd-trigger { display: inline-flex; align-items: center; justify-content: space-between; min-width: 180px; font-family: ${FONT}; font-size: 14px; font-weight: 700; color: #d9480f; background: #fff; border: 2px solid #ffa94d; border-radius: 999px; padding: 10px 18px; cursor: pointer; box-shadow: 0 2px 8px rgba(217, 72, 15, 0.12); }
.hsd-commerce .hsd-trigger:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(255, 146, 43, 0.35); }
.hsd-commerce .hsd-trigger [data-placeholder] { color: #ffa94d; }
.hsd-commerce .hsd-listbox { background: #fff; border-radius: 20px; padding: 8px; box-shadow: 0 8px 24px rgba(217, 72, 15, 0.18); }
.hsd-commerce .hsd-option { font-family: ${FONT}; font-size: 14px; color: #495057; padding: 9px 16px; border-radius: 999px; }
.hsd-commerce .hsd-option[data-highlighted] { background: #ffe8cc; color: #d9480f; }
.hsd-commerce .hsd-option[data-state='checked'] { background: #fd7e14; color: #fff; font-weight: 700; }

/* 스킨 3: 어드민 콘솔 — 어둡고 기계적인 톤 */
.hsd-terminal.hsd-stage { background: #1a1b26; }
.hsd-terminal .hsd-trigger { display: inline-flex; align-items: center; justify-content: space-between; min-width: 200px; font-family: ${MONO}; font-size: 13px; color: #9ece6a; background: #16161e; border: 1px solid #3b4261; border-radius: 2px; padding: 9px 12px; cursor: pointer; }
.hsd-terminal .hsd-trigger::before { content: '$ '; color: #565f89; }
.hsd-terminal .hsd-trigger:focus-visible { outline: 1px solid #9ece6a; outline-offset: 2px; }
.hsd-terminal .hsd-trigger [data-placeholder] { color: #565f89; }
.hsd-terminal .hsd-listbox { background: #16161e; border: 1px solid #3b4261; border-radius: 2px; padding: 2px; }
.hsd-terminal .hsd-option { font-family: ${MONO}; font-size: 13px; color: #a9b1d6; padding: 7px 12px; }
.hsd-terminal .hsd-option[data-highlighted] { background: #9ece6a; color: #16161e; }
.hsd-terminal .hsd-option[data-state='checked']::before { content: '* '; color: #e0af68; }
.hsd-terminal .hsd-option[data-highlighted][data-state='checked']::before { color: #16161e; }
`;

const OPTIONS = [
  { value: "latest", label: "최신순" },
  { value: "popular", label: "인기순" },
  { value: "price-asc", label: "낮은 가격순" },
  { value: "price-desc", label: "높은 가격순" },
];

export const SkinSwapDemo = () => {
  const [skin, setSkin] = useState<SkinId>("saas");
  const [value, setValue] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

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
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {SKINS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSkin(s.id)}
            style={{
              fontFamily: FONT,
              fontSize: 12,
              padding: "6px 12px",
              borderRadius: 6,
              border: `1px solid ${skin === s.id ? "#228be6" : "#dee2e6"}`,
              background: skin === s.id ? "#e7f5ff" : "#fff",
              color: skin === s.id ? "#1971c2" : "#868e96",
              fontWeight: skin === s.id ? 600 : 400,
              cursor: "pointer",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className={`hsd-stage hsd-${skin}`}>
        <Select.Root
          key={skin} // 스킨 전환 시 실제로 리마운트시킨다 — 값은 제어 모드라 데모 쪽에 남는다
          value={value}
          onValueChange={setValue}
          open={open}
          onOpenChange={setOpen}
          className="hsd-root"
        >
          <Select.Trigger className="hsd-trigger">
            <Select.Value placeholder="정렬 기준 선택" />
            <span className="hsd-chevron" aria-hidden>
              ▾
            </span>
          </Select.Trigger>
          <Select.Listbox className="hsd-listbox">
            {OPTIONS.map((option) => (
              <Select.Option key={option.value} className="hsd-option" value={option.value}>
                {option.label}
              </Select.Option>
            ))}
          </Select.Listbox>
        </Select.Root>
      </div>

      <div
        style={{
          fontFamily: MONO,
          fontSize: 11,
          color: "#868e96",
          marginTop: 12,
          textAlign: "center",
        }}
      >
        value: {value === null ? "null" : `"${value}"`} · open: {String(open)}
      </div>
      <div style={{ fontSize: 11, color: "#adb5bd", textAlign: "center", marginTop: 6 }}>
        세 스킨 모두 같은 Select 코어가 렌더링한다 — 스킨을 바꿔도 선택한 값이 유지되고, ↑ ↓ Enter
        Esc 키보드로도 조작할 수 있다
      </div>
    </div>
  );
};
