"use client";

import { useSwitch } from "./useSwitch";

const FONT =
    "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

const STYLE = `
.hswd-item { display: flex; flex-direction: column; align-items: center; gap: 10px; flex: 1 1 140px; min-width: 140px; }
.hswd-label { font-size: 12px; color: #868e96; }
.hswd-attrs { font-family: ${MONO}; font-size: 10px; color: #adb5bd; text-align: center; line-height: 1.6; }
.hswd-attrs b { color: #495057; font-weight: 600; }

/* 스킨 1: iOS 스타일 */
.hswd-ios { border: none; padding: 3px; width: 52px; height: 30px; border-radius: 15px; background: #dee2e6; cursor: pointer; transition: background 0.15s ease; display: inline-flex; }
.hswd-ios[data-state='checked'] { background: #40c057; }
.hswd-ios::before { content: ''; width: 24px; height: 24px; border-radius: 12px; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25); transition: transform 0.15s ease; }
.hswd-ios[data-state='checked']::before { transform: translateX(22px); }
.hswd-ios:focus-visible { outline: 2px solid #228be6; outline-offset: 2px; }

/* 스킨 2: 체크박스 스타일 */
.hswd-check { border: none; background: none; padding: 6px 10px; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font-family: ${FONT}; font-size: 14px; color: #495057; border-radius: 6px; }
.hswd-check .hswd-box { width: 20px; height: 20px; border-radius: 5px; border: 2px solid #adb5bd; display: inline-flex; align-items: center; justify-content: center; color: transparent; font-size: 13px; font-weight: 700; transition: all 0.12s ease; }
.hswd-check[data-state='checked'] .hswd-box { background: #228be6; border-color: #228be6; color: #fff; }
.hswd-check:focus-visible { outline: 2px solid #228be6; outline-offset: 2px; }

/* 스킨 3: 터미널 스타일 (div로 렌더링) */
.hswd-term { font-family: ${MONO}; font-size: 14px; padding: 8px 14px; background: #1a1b26; color: #565f89; border-radius: 4px; cursor: pointer; user-select: none; letter-spacing: 1px; }
.hswd-term[data-state='checked'] { color: #9ece6a; text-shadow: 0 0 8px rgba(158, 206, 106, 0.5); }
.hswd-term:focus-visible { outline: 2px solid #9ece6a; outline-offset: 2px; }
`;

const AttrReadout = ({ checked }: { checked: boolean }) => (
    <div className="hswd-attrs">
        aria-checked=<b>"{String(checked)}"</b>
        <br />
        data-state=<b>"{checked ? "checked" : "unchecked"}"</b>
    </div>
);

const IosSwitch = () => {
    const { checked, getSwitchProps } = useSwitch();
    return (
        <div className="hswd-item">
            <button
                {...getSwitchProps({ className: "hswd-ios" })}
                aria-label="iOS 스타일 스위치"
            />
            <AttrReadout checked={checked} />
            <div className="hswd-label">iOS 스타일 · button</div>
        </div>
    );
};

const CheckboxSwitch = () => {
    const { checked, getSwitchProps } = useSwitch({ defaultChecked: true });
    return (
        <div className="hswd-item">
            <button {...getSwitchProps({ className: "hswd-check" })}>
                <span className="hswd-box" aria-hidden>
                    ✓
                </span>
                알림 받기
            </button>
            <AttrReadout checked={checked} />
            <div className="hswd-label">체크박스 스타일 · button</div>
        </div>
    );
};

const TerminalSwitch = () => {
    const { checked, getSwitchProps } = useSwitch();
    return (
        <div className="hswd-item">
            <div {...getSwitchProps({ className: "hswd-term" })}>
                {checked ? "[ ON  ]" : "[ OFF ]"}
            </div>
            <AttrReadout checked={checked} />
            <div className="hswd-label">터미널 스타일 · div</div>
        </div>
    );
};

export const SwitchSkinDemo = () => {
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
            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 16,
                    justifyContent: "center",
                }}
            >
                <IosSwitch />
                <CheckboxSwitch />
                <TerminalSwitch />
            </div>
            <div
                style={{
                    fontSize: 11,
                    color: "#adb5bd",
                    textAlign: "center",
                    marginTop: 16,
                }}
            >
                셋 다 같은 useSwitch를 사용한다 — 클릭하거나 Tab으로 포커스한 뒤
                Space, Enter로 조작해보자
            </div>
        </div>
    );
};
