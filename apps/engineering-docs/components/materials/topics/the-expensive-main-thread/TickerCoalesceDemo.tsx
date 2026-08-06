// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useRef, useEffect, useState } from "react";
import { seededMaterialRandom } from "@/components/materials/runtime/random";
import {
  cancelMaterialFrame,
  scheduleMaterialFrame,
} from "@/components/materials/runtime/scheduler";
import { useVisible } from "./useVisible";

// 웹소켓 시세 틱이 프레임 주기와 무관하게 쏟아질 때, 그리기를 프레임당 한 번으로 모으는 효과를 본다.
// 데이터는 두 모드 모두 전부 반영한다 — 다른 것은 renderBoard()를 몇 번 부르느냐뿐이다.
type Lang = "ko" | "en";

const STRINGS = {
  ko: {
    smoothness: "부드러움 지표 (JS 애니메이션)",
    modeEvery: "틱마다 그리기",
    modeFrame: "프레임당 한 번",
    stop: "시세 멈추기",
    start: "시세 받기 시작",
  },
  en: {
    smoothness: "Smoothness meter (JS animation)",
    modeEvery: "Render every tick",
    modeFrame: "Once per frame",
    stop: "Stop price feed",
    start: "Start price feed",
  },
} as const;

const COINS: [string, string, string, number][] = [
  ["비트코인", "Bitcoin", "BTC", 98000000],
  ["이더리움", "Ethereum", "ETH", 5200000],
  ["솔라나", "Solana", "SOL", 310000],
  ["리플", "XRP", "XRP", 3400],
  ["도지코인", "Dogecoin", "DOGE", 480],
  ["에이다", "Cardano", "ADA", 1500],
  ["아발란체", "Avalanche", "AVAX", 62000],
  ["체인링크", "Chainlink", "LINK", 32000],
  ["폴카닷", "Polkadot", "DOT", 11000],
  ["트론", "TRON", "TRX", 380],
  ["라이트코인", "Litecoin", "LTC", 160000],
  ["스텔라루멘", "Stellar", "XLM", 620],
  ["니어프로토콜", "NEAR Protocol", "NEAR", 8200],
  ["앱토스", "Aptos", "APT", 13500],
  ["수이", "Sui", "SUI", 5600],
  ["아비트럼", "Arbitrum", "ARB", 1900],
  ["옵티미즘", "Optimism", "OP", 3100],
  ["폴리곤", "Polygon", "POL", 700],
  ["코스모스", "Cosmos", "ATOM", 9800],
  ["이더리움클래식", "Ethereum Classic", "ETC", 38000],
  ["비트코인캐시", "Bitcoin Cash", "BCH", 680000],
  ["유니스왑", "Uniswap", "UNI", 14000],
  ["에이브", "Aave", "AAVE", 240000],
  ["알고랜드", "Algorand", "ALGO", 520],
  ["비체인", "VeChain", "VET", 65],
  ["인터넷컴퓨터", "Internet Computer", "ICP", 15000],
  ["파일코인", "Filecoin", "FIL", 7800],
  ["샌드박스", "The Sandbox", "SAND", 720],
  ["디센트럴랜드", "Decentraland", "MANA", 830],
  ["엑시인피니티", "Axie Infinity", "AXS", 9200],
  ["세타토큰", "Theta", "THETA", 2900],
  ["이오스", "EOS", "EOS", 1100],
  ["테조스", "Tezos", "XTZ", 1800],
  ["네오", "NEO", "NEO", 21000],
  ["카이아", "Kaia", "KAIA", 250],
  ["헤데라", "Hedera", "HBAR", 380],
  ["멀티버스엑스", "MultiversX", "EGLD", 45000],
  ["플로우", "Flow", "FLOW", 1300],
  ["칠리즈", "Chiliz", "CHZ", 160],
  ["엔진코인", "Enjin Coin", "ENJ", 420],
  ["질리카", "Zilliqa", "ZIL", 35],
  ["퀀텀", "Qtum", "QTUM", 4200],
  ["온톨로지", "Ontology", "ONT", 350],
  ["아이콘", "ICON", "ICX", 260],
  ["웨이브", "Waves", "WAVES", 1900],
  ["카이버네트워크", "Kyber Network", "KNC", 800],
  ["제로엑스", "0x", "ZRX", 620],
  ["베이직어텐션토큰", "Basic Attention Token", "BAT", 340],
  ["신세틱스", "Synthetix", "SNX", 2400],
  ["커브", "Curve", "CRV", 1100],
  ["컴파운드", "Compound", "COMP", 78000],
  ["메이커", "Maker", "MKR", 2400000],
  ["연파이낸스", "Yearn Finance", "YFI", 11000000],
  ["스시스왑", "SushiSwap", "SUSHI", 1500],
  ["더그래프", "The Graph", "GRT", 310],
  ["원인치", "1inch", "1INCH", 580],
  ["앵커", "Ankr", "ANKR", 55],
  ["스토리지", "Storj", "STORJ", 720],
  ["펀디엑스", "Pundi X", "PUNDIX", 610],
  ["스테이터스네트워크", "Status", "SNT", 48],
];
const SYMBOLS = COINS.map(([name, nameEn, code, base]) => ({ name, nameEn, code, base }));
const HISTORY = 240; // 스파크라인 점 수 — 매 렌더마다 종목 수 × 이 점 수만큼 경로 문자열을 다시 만든다
const TICK_MS = 4; // 세팅 가능한 최소 주기
const BURST = 5; // 소켓 메시지는 묶음으로 도착한다 — 초당 약 1,250건

export const TickerCoalesceDemo = ({ locale: lang = "ko" }: { locale?: Lang }) => {
  const t = STRINGS[lang];
  const fpsRef = useRef<HTMLSpanElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const priceRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const pctRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const areaRefs = useRef<(SVGPathElement | null)[]>([]);
  const rafRef = useRef<number>(0);
  const framesRef = useRef<number[]>([]);
  const historyRef = useRef<number[][] | null>(null);
  if (historyRef.current === null) {
    // 하루치 시세를 미리 채워 차트가 처음부터 가득 차 있게 한다
    historyRef.current = SYMBOLS.map((s) => {
      const h = [s.base];
      for (let k = 1; k < HISTORY; k++)
        h.push(
          Math.max(
            s.base * 0.5,
            h[k - 1] *
              (1 +
                (seededMaterialRandom("the-expensive-main-thread/TickerCoalesceDemo") - 0.5) *
                  0.006),
          ),
        );
      return h;
    });
  }
  const timerRef = useRef<number | null>(null);
  const scheduledRef = useRef(false);
  const modeRef = useRef<"every" | "frame">("every");
  const [mode, setMode] = useState<"every" | "frame">("every");
  const [running, setRunning] = useState(false);
  const { ref: rootRef, visible } = useVisible<HTMLDivElement>();

  // 보드 전체를 다시 그린다 — 가격·등락률 갱신 + 종목마다 스파크라인 선·영역 경로 재구성
  const renderBoard = () => {
    for (let s = 0; s < SYMBOLS.length; s++) {
      const h = historyRef.current![s];
      const last = h[h.length - 1];
      let min = Infinity;
      let max = -Infinity;
      for (let k = 0; k < h.length; k++) {
        if (h[k] < min) min = h[k];
        if (h[k] > max) max = h[k];
      }
      const span = max - min || 1;
      let d = "";
      for (let k = 0; k < h.length; k++) {
        const y = 36 - ((h[k] - min) / span) * 32 + 2;
        d += (k === 0 ? "M" : "L") + k + " " + y.toFixed(1);
      }
      const pct = ((last - SYMBOLS[s].base) / SYMBOLS[s].base) * 100;
      const priceEl = priceRefs.current[s];
      const pctEl = pctRefs.current[s];
      const pathEl = pathRefs.current[s];
      const areaEl = areaRefs.current[s];
      if (priceEl) priceEl.textContent = Math.round(last).toLocaleString();
      if (pctEl) {
        pctEl.textContent = `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
        pctEl.style.color = pct >= 0 ? "#f03e3e" : "#1c7ed6";
      }
      if (pathEl) {
        pathEl.setAttribute("d", d);
        pathEl.style.stroke = pct >= 0 ? "#f03e3e" : "#1c7ed6";
      }
      if (areaEl) {
        areaEl.setAttribute("d", `${d}L${h.length - 1} 40L0 40Z`);
        areaEl.style.fill = pct >= 0 ? "rgba(240,62,62,0.08)" : "rgba(28,126,214,0.08)";
      }
    }
  };

  const onTick = () => {
    // 소켓 메시지는 묶음으로 도착한다 — 메시지 하나 = 무작위 종목 하나의 체결
    for (let m = 0; m < BURST; m++) {
      const s = Math.floor(
        seededMaterialRandom("the-expensive-main-thread/TickerCoalesceDemo") * SYMBOLS.length,
      );
      const h = historyRef.current![s];
      const last = h[h.length - 1];
      h.push(
        Math.max(
          SYMBOLS[s].base * 0.5,
          last *
            (1 +
              (seededMaterialRandom("the-expensive-main-thread/TickerCoalesceDemo") - 0.5) * 0.006),
        ),
      );
      if (h.length > HISTORY) h.shift();

      if (modeRef.current === "every") {
        renderBoard(); // 메시지마다 그리기 — chart.update()를 메시지마다 부르는 흔한 실수
      }
    }
    if (modeRef.current === "frame") {
      if (scheduledRef.current) return; // 이번 프레임의 그리기는 이미 예약되어 있다
      scheduledRef.current = true;
      scheduleMaterialFrame(() => {
        renderBoard(); // 그리기는 프레임당 한 번
        scheduledRef.current = false;
      });
    }
  };

  // 타이머 정리는 언마운트 시에만
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      // 화면 밖으로 나가면 시세 스트림도 함께 멈춘다
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        setRunning(false);
      }
      return;
    }
    renderBoard(); // 처음 보일 때 보드를 한 번 그려둔다
    const animate = (t: number) => {
      const frames = framesRef.current;
      frames.push(t);
      while (frames.length && t - frames[0] > 1000) frames.shift();
      if (fpsRef.current) fpsRef.current.textContent = String(frames.length);

      if (knobRef.current) {
        const p = (Math.sin(t * 0.004) + 1) / 2;
        const track = knobRef.current.parentElement;
        const range = track ? track.clientWidth - 14 : 100;
        knobRef.current.style.transform = `translateX(${p * range}px)`;
      }
      rafRef.current = scheduleMaterialFrame(animate);
    };
    rafRef.current = scheduleMaterialFrame(animate);
    return () => cancelMaterialFrame(rafRef.current);
  }, [visible]);

  const toggleRun = () => {
    if (running) {
      if (timerRef.current !== null) clearInterval(timerRef.current);
      timerRef.current = null;
      setRunning(false);
    } else {
      timerRef.current = window.setInterval(onTick, TICK_MS);
      setRunning(true);
    }
  };

  const switchMode = (m: "every" | "frame") => {
    modeRef.current = m;
    setMode(m);
  };

  const modeBtn = (m: "every" | "frame", label: string) => (
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
          fontSize: 11,
          color: "#868e96",
          marginBottom: 8,
        }}
      >
        <span>{t.smoothness}</span>
        <span>
          <span ref={fpsRef} style={{ fontWeight: 700, color: "#495057" }}>
            60
          </span>{" "}
          fps
        </span>
      </div>
      <div
        style={{
          position: "relative",
          height: 14,
          background: "#f1f3f5",
          borderRadius: 7,
          marginBottom: 12,
        }}
      >
        <div
          ref={knobRef}
          style={{ width: 14, height: 14, borderRadius: "50%", background: "#228be6" }}
        />
      </div>

      {/* 시세 보드 */}
      <div
        style={{
          border: "1px solid #e9ecef",
          borderRadius: 6,
          padding: "2px 12px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          columnGap: 20,
          alignContent: "start",
          maxHeight: 320,
          overflowY: "auto",
        }}
      >
        {SYMBOLS.map((s, i) => (
          <div
            key={s.code}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 0",
              borderBottom: "1px solid #f1f3f5",
            }}
          >
            <div style={{ width: 76, flexShrink: 0 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#495057",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {lang === "ko" ? s.name : s.nameEn}
              </div>
              <div style={{ fontSize: 9, color: "#adb5bd" }}>{s.code}</div>
            </div>
            <svg
              viewBox={`0 0 ${HISTORY} 40`}
              preserveAspectRatio="none"
              style={{ flex: 1, minWidth: 0, height: 24, display: "block" }}
            >
              <path
                ref={(el) => {
                  areaRefs.current[i] = el;
                }}
                stroke="none"
                fill="rgba(173,181,189,0.08)"
              />
              <path
                ref={(el) => {
                  pathRefs.current[i] = el;
                }}
                fill="none"
                stroke="#adb5bd"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <div style={{ width: 84, flexShrink: 0, textAlign: "right" }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#495057",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <span
                  ref={(el) => {
                    priceRefs.current[i] = el;
                  }}
                >
                  {s.base.toLocaleString()}
                </span>
              </div>
              <div style={{ fontSize: 9, fontVariantNumeric: "tabular-nums" }}>
                <span
                  ref={(el) => {
                    pctRefs.current[i] = el;
                  }}
                  style={{ color: "#adb5bd" }}
                >
                  0.00%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 모드 + 시작 */}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {modeBtn("every", t.modeEvery)}
        {modeBtn("frame", t.modeFrame)}
      </div>
      <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
        <button
          onClick={toggleRun}
          style={{
            padding: "8px 20px",
            border: "none",
            borderRadius: 6,
            background: running ? "#fa5252" : "#40c057",
            color: "#fff",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {running ? t.stop : t.start}
        </button>
      </div>
    </div>
  );
};
