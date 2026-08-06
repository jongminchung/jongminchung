// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useRef, useEffect, useState } from "react";
import { seededMaterialRandom } from "@/components/materials/runtime/random";
import {
  cancelMaterialFrame,
  scheduleMaterialFrame,
} from "@/components/materials/runtime/scheduler";
import { useVisible } from "./useVisible";

type Lang = "ko" | "en";

const USERS_KO = [
  "철수",
  "영희",
  "민수",
  "지연",
  "gamer",
  "sunhyoup",
  "냥냥펀치",
  "방장러버",
  "kciter",
  "xX다크나이트Xx",
  "치킨마려운자",
  "오늘도출근",
  "무지성클릭",
  "고인물주의",
  "뉴비인데요",
  "시청자",
  "해외시청자",
  "광고안봄",
  "별풍선요정",
  "자막봇",
  "지나가던행인1",
  "야호",
  "수면중",
  "핵과금러",
  "갓반인",
  "월급루팡",
  "눈팅만10년",
  "인방러",
  "배고프다",
  "그냥사람",
];
const USERS_EN = [
  "mike",
  "sarah",
  "dave",
  "jenny",
  "gamer",
  "sunhyoup",
  "catpuncher",
  "mod_lover",
  "kciter",
  "xXDarkKnightXx",
  "cravingwings",
  "work_tomorrow",
  "mindless_clicker",
  "veteran_alert",
  "newbie_here",
  "just_a_viewer",
  "overseas_fan",
  "ad_skipper",
  "donation_fairy",
  "caption_bot",
  "passerby1",
  "woohoo",
  "half_asleep",
  "whale_spender",
  "normie_god",
  "salary_thief",
  "lurker_10yrs",
  "stream_addict",
  "so_hungry",
  "just_some_guy",
];
const TEXTS_KO = [
  "ㅋㅋㅋㅋㅋ",
  "ㅋㅋㅋㅋㅋㅋㅋㅋㅋ",
  "오 대박",
  "ㄷㄷㄷ",
  "이거 실화냐",
  "방장 사랑해요",
  "고고고",
  "ㅇㅈ",
  "와...",
  "레전드",
  "가보자고",
  "?????",
  "ㅠㅠㅠ",
  "ㄹㅇ 인정",
  "개웃기네",
  "지금 들어옴",
  "어? 방금 뭐임",
  "님들 이거 봄?",
  "와 소름",
  "역대급이다 진짜",
  "첫방 축하해요",
  "오늘 컨디션 좋으시네",
  "ㅋㅋ 그건 좀",
  "아 배고파",
  "치킨 시켰다",
  "방장 목소리 좋음",
  "노래 신청 받아요?",
  "이 게임 뭐예요?",
  "나만 렉걸림?",
  "화면 왜 멈춤",
  "컴 사양이 어케됨",
  "00:00 다시보기 ㄱ",
  "방금 그거 클립각",
  "ㅇㅇ 맞음",
  "ㄴㄴ 그거 아님",
  "헐",
  "미쳤다ㄷㄷ",
  "개꿀잼",
  "나가지마세요",
  "오늘 몇시까지 함?",
  "구독 눌렀어요",
  "알림 설정 완료",
  "와 이걸 이겨?",
  "지렸다",
  "ㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋ",
  "이게 되네",
  "방장 손 빠르다",
  "ㅋㅋㅋ 웃겨죽음",
  "슬슬 자야지",
  "내일 출근인데 왜 보고있지",
];
const TEXTS_EN = [
  "LOL",
  "LMAOOO",
  "oh wow",
  "whoa",
  "is this real",
  "love you streamer",
  "go go go",
  "true",
  "wow...",
  "legendary",
  "let's gooo",
  "?????",
  "T_T",
  "so true",
  "that's hilarious",
  "just got here",
  "wait what was that",
  "yall seeing this?",
  "chills",
  "best one yet fr",
  "congrats on the first stream",
  "you're on fire today",
  "lol thats a bit much",
  "im hungry",
  "just ordered wings",
  "nice voice today",
  "taking song requests?",
  "what game is this?",
  "anyone else lagging?",
  "why did the screen freeze",
  "what are your PC specs",
  "00:00 replay this",
  "clip that",
  "yeah thats right",
  "nah thats not it",
  "omg",
  "insane",
  "so fun",
  "don't leave",
  "how long are you live today?",
  "just subscribed",
  "notifications on",
  "how did you win that?",
  "clutch",
  "HAHAHAHAHA",
  "it actually worked",
  "those hands are fast",
  "dying laughing",
  "should sleep soon",
  "work tomorrow but here I am",
];

const STRINGS = {
  ko: {
    users: USERS_KO,
    texts: TEXTS_KO,
    smoothness: "부드러움 지표 (JS 애니메이션)",
    immediate: "즉시 렌더",
    yielding: "양보 렌더",
    placeholder: "채팅이 쏟아지는 동안 여기에 타이핑해보세요",
    stop: "채팅 멈추기",
    flood: "채팅 쏟아지게 하기",
  },
  en: {
    users: USERS_EN,
    texts: TEXTS_EN,
    smoothness: "Smoothness indicator (JS animation)",
    immediate: "Immediate render",
    yielding: "Yielding render",
    placeholder: "Try typing here while the chat floods in",
    stop: "Stop the chat",
    flood: "Flood the chat",
  },
} as const;

const USER_COLORS = [
  "#1971c2",
  "#2f9e44",
  "#e8590c",
  "#9c36b5",
  "#c2255c",
  "#1098ad",
  "#f08c00",
  "#5f3dc4",
  "#0b7285",
  "#a61e4d",
];

const TICK_MS = 100; // 채팅이 도착하는 주기
const BURST = 100; // 한 주기에 도착하는 채팅 수 (채팅 수 자체가 부하가 된다)
const MAX_NODES = 1000; // 화면(DOM)에 유지할 채팅 노드 수 — 클수록 레이아웃 비용이 커진다
const MAX_BUFFER = 3000; // 버퍼가 무한히 자라지 않도록 오래된 채팅은 버린다

function randomLine(users: string[], texts: string[]): [string, string, string] {
  const u =
    users[
      Math.floor(
        seededMaterialRandom("the-expensive-main-thread/ChunkingCompareDemo") * users.length,
      )
    ];
  const t =
    texts[
      Math.floor(
        seededMaterialRandom("the-expensive-main-thread/ChunkingCompareDemo") * texts.length,
      )
    ];
  const c =
    USER_COLORS[
      Math.floor(
        seededMaterialRandom("the-expensive-main-thread/ChunkingCompareDemo") * USER_COLORS.length,
      )
    ];
  return [u, t, c];
}

function makeRow([u, t, c]: [string, string, string]): HTMLDivElement {
  const row = document.createElement("div");
  row.style.cssText = "padding:2px 0;font-size:12px;line-height:1.5;color:#495057;";
  const name = document.createElement("span");
  name.textContent = u;
  name.style.cssText = `font-weight:700;color:${c};margin-right:6px;`;
  const msg = document.createElement("span");
  msg.textContent = t;
  row.appendChild(name);
  row.appendChild(msg);
  return row;
}

export const ChunkingCompareDemo = ({ locale: lang = "ko" }: { locale?: Lang }) => {
  const t = STRINGS[lang];
  const listRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const fpsRef = useRef<HTMLSpanElement>(null);
  const rafRef = useRef<number>(0);
  const framesRef = useRef<number[]>([]);
  const bufferRef = useRef<[string, string, string][]>([]);
  const streamRef = useRef<number | null>(null);
  const drainingRef = useRef(false);
  const modeRef = useRef<"naive" | "yield">("naive");
  const [mode, setMode] = useState<"naive" | "yield">("naive");
  const [running, setRunning] = useState(false);
  const { ref: rootRef, visible } = useVisible<HTMLDivElement>();

  const prune = (list: HTMLDivElement) => {
    while (list.childNodes.length > MAX_NODES && list.firstChild) {
      list.removeChild(list.firstChild);
    }
  };

  // naive: 채팅 하나하나를 붙이고 그때마다 맨 아래로 스크롤한다.
  // scrollTop을 읽는 순간 브라우저는 동기 레이아웃을 강제로 계산한다 → 채팅 수만큼 레이아웃이 반복된다.
  const appendOneByOne = (lines: [string, string, string][]) => {
    const list = listRef.current;
    if (!list) return;
    for (const line of lines) {
      list.appendChild(makeRow(line));
      prune(list);
      list.scrollTop = list.scrollHeight; // 매 채팅마다 레이아웃 강제
    }
  };

  // batch: 한 묶음을 프래그먼트로 한 번에 붙이고, 스크롤(레이아웃)은 딱 한 번만 한다.
  const appendBatch = (lines: [string, string, string][]) => {
    const list = listRef.current;
    if (!list || lines.length === 0) return;
    const frag = document.createDocumentFragment();
    for (const line of lines) frag.appendChild(makeRow(line));
    list.appendChild(frag);
    prune(list);
    list.scrollTop = list.scrollHeight; // 묶음당 한 번만
  };

  // yield: naive와 똑같이 한 개씩 그린다. 다만 20개마다 메인 스레드를 양보한다.
  const drain = async () => {
    if (drainingRef.current) return;
    drainingRef.current = true;
    while (modeRef.current === "yield" && bufferRef.current.length > 0) {
      const chunk = bufferRef.current.splice(0, 20);
      appendOneByOne(chunk); // 그리는 방식은 즉시 렌더와 완전히 같다
      await new Promise((resolve) => setTimeout(resolve, 0)); // 다른 것은 이 양보 한 줄뿐
    }
    drainingRef.current = false;
  };

  // 스트림 정리는 언마운트 시에만
  useEffect(() => {
    return () => {
      if (streamRef.current !== null) clearInterval(streamRef.current);
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      // 화면 밖으로 나가면 채팅 스트림도 함께 멈춘다
      if (streamRef.current !== null) {
        clearInterval(streamRef.current);
        streamRef.current = null;
        setRunning(false);
      }
      return;
    }
    const animate = (t: number) => {
      const frames = framesRef.current;
      frames.push(t);
      while (frames.length && t - frames[0] > 1000) frames.shift();
      if (fpsRef.current) fpsRef.current.textContent = String(frames.length);

      if (knobRef.current) {
        const p = (Math.sin(t * 0.004) + 1) / 2;
        const track = knobRef.current.parentElement;
        const range = track ? track.clientWidth - 18 : 100;
        knobRef.current.style.transform = `translateX(${p * range}px)`;
      }

      rafRef.current = scheduleMaterialFrame(animate);
    };
    rafRef.current = scheduleMaterialFrame(animate);
    return () => cancelMaterialFrame(rafRef.current);
  }, [visible]);

  const onTick = () => {
    const lines: [string, string, string][] = [];
    for (let i = 0; i < BURST; i++) lines.push(randomLine(t.users, t.texts));

    if (modeRef.current === "naive") {
      appendOneByOne(lines); // 도착한 채팅을 즉시, 하나씩 렌더 (양보 없음)
    } else {
      for (const line of lines) bufferRef.current.push(line); // 버퍼에만 쌓아두고
      const overflow = bufferRef.current.length - MAX_BUFFER;
      if (overflow > 0) bufferRef.current.splice(0, overflow); // 안전장치
      drain(); // 묶어 그리고 양보하기를 반복한다
    }
  };

  const toggleRun = () => {
    if (running) {
      if (streamRef.current !== null) clearInterval(streamRef.current);
      streamRef.current = null;
      setRunning(false);
    } else {
      streamRef.current = window.setInterval(onTick, TICK_MS);
      setRunning(true);
    }
  };

  const switchMode = (m: "naive" | "yield") => {
    // naive로 돌아갈 때 버퍼에 남은 채팅은 한 번에 그려서 비운다
    if (m === "naive" && bufferRef.current.length) {
      const rest = bufferRef.current;
      bufferRef.current = [];
      appendBatch(rest);
    }
    modeRef.current = m;
    setMode(m);
    if (m === "yield") drain();
  };

  const modeBtn = (m: "naive" | "yield", label: string) => (
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
      {/* 부드러움 지표 + fps */}
      <div style={{ background: "#f8f9fa", borderRadius: 8, padding: "12px 16px 14px" }}>
        <div
          style={{
            fontSize: 11,
            color: "#868e96",
            marginBottom: 8,
            display: "flex",
            justifyContent: "space-between",
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
        <div style={{ position: "relative", height: 18 }}>
          <div
            ref={knobRef}
            style={{ width: 18, height: 18, borderRadius: "50%", background: "#228be6" }}
          />
        </div>
      </div>

      {/* 모드 선택 */}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {modeBtn("naive", t.immediate)}
        {modeBtn("yield", t.yielding)}
      </div>

      {/* 채팅창 */}
      <div
        ref={listRef}
        style={{
          height: 150,
          overflowY: "scroll",
          background: "#fff",
          border: "1px solid #e9ecef",
          borderRadius: 6,
          padding: "8px 12px",
          marginTop: 10,
        }}
      />

      {/* 입력창 */}
      <input
        type="text"
        placeholder={t.placeholder}
        style={{
          width: "100%",
          boxSizing: "border-box",
          marginTop: 8,
          padding: "9px 12px",
          border: "1px solid #dee2e6",
          borderRadius: 6,
          fontSize: 13,
          color: "#495057",
          outline: "none",
        }}
      />

      <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
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
          {running ? t.stop : t.flood}
        </button>
      </div>
    </div>
  );
};
