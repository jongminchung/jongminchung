// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useRef, useEffect, useState } from "react";
import {
  cancelMaterialFrame,
  scheduleMaterialFrame,
} from "@/components/materials/runtime/scheduler";
import { useVisible } from "./useVisible";

// SNS 피드 탭 복귀 — 게시물이 잔뜩 쌓인 피드를 keep-alive(display 토글)로 숨겼다가 다시 보일 때,
// 전체를 재레이아웃하느냐(그대로) 화면 근처만 채워두느냐(IntersectionObserver)를 비교한다.
const POSTS = 1500;
const ITEM_HEIGHT = 270; // 게시물 셸의 고정 높이 — 비어 있을 때도 같은 자리를 차지한다
const BUILD_CHUNK = 300; // 데모 구축도 배운 대로 잘게 나눠 양보하며 한다
const FILL_MARGIN = "400px 0px"; // 스크롤이 닿기 전에 미리 채워둘 여유분

// 빈 셸에 보여줄 스켈레톤 — 자식 노드 없이 배경만으로 그린다
const SKELETON =
  "linear-gradient(#f1f3f5 0 0) 2px 14px / 55% 14px no-repeat, linear-gradient(#f6f7f8 0 0) 2px 40px / 100% 130px no-repeat";

type Lang = "ko" | "en";

const STRINGS = {
  ko: {
    names: ["민준", "서연", "도윤", "지우", "하은", "시우", "서준", "지아", "하준", "수아"],
    texts: [
      "오늘 점심 여기 어떤가요. 웨이팅 40분이었는데 인정합니다",
      "드디어 프로젝트 끝! 고생한 나에게 치킨을 선물했다",
      "주말에 간 전시회. 사진으로는 반도 안 담긴다",
      "3개월 만에 다시 시작한 러닝, 5km 완주 성공",
      "이 책 진짜 추천. 밤새서 다 읽어버림",
      "베란다 텃밭 첫 수확. 방울토마토 세 알",
      "고양이가 또 키보드 위에서 잔다. 오늘 업무 종료",
      "새벽 감성으로 올려보는 하늘 사진",
      "이사 완료. 박스 지옥에서 살아남는 중",
      "커피를 줄이기로 했다. 내일부터.",
    ],
    hoursAgo: (h: number) => `${h}시간 전`,
    postActions: (likes: number, comments: number) =>
      `좋아요 ${likes} · 댓글 ${comments}개 모두 보기 · 공유`,
    notifRow: (name: string, shared: boolean, hours: number) =>
      `${name}님이 회원님의 게시물을 ${shared ? "공유했습니다" : "좋아합니다"} · ${hours}시간 전`,
    header: (count: string) => `게시물 ${count}개가 쌓인 피드 — 알림 탭에 다녀와 보자`,
    modeIo: "보일 때만 렌더",
    modeOff: "그대로 렌더",
    returnLabel: "피드로 돌아오는 데 걸린 시간",
    tabFeed: "피드",
    tabNotif: "알림",
    footerOff: (count: string) =>
      `그대로 렌더: 피드로 돌아올 때마다 게시물 ${count}개 전체를 다시 레이아웃한다 — 복귀 순간 지표가 얼어붙는다`,
    footerIo:
      "보일 때만 렌더: IntersectionObserver가 화면 근처의 게시물만 채워둔다 — 쌓인 양과 무관하게 복귀가 빠르다",
  },
  en: {
    names: ["Mia", "Noah", "Liam", "Emma", "Ava", "Ethan", "Lucas", "Sophia", "Owen", "Chloe"],
    texts: [
      "Lunch spot today. 40-minute wait, but honestly worth it",
      "Project finally done! Treated myself to fried chicken",
      "Weekend exhibition. Photos capture barely half of it",
      "Back to running after three months, finished a full 5k",
      "Seriously recommend this book. Stayed up all night finishing it",
      "First harvest from the balcony garden. Three cherry tomatoes",
      "The cat is sleeping on my keyboard again. Done working for today",
      "A sky photo posted in a late-night mood",
      "Move complete. Surviving box hell",
      "Decided to cut back on coffee. Starting tomorrow.",
    ],
    hoursAgo: (h: number) => `${h}h ago`,
    postActions: (likes: number, comments: number) =>
      `${likes} likes · View all ${comments} comments · Share`,
    notifRow: (name: string, shared: boolean, hours: number) =>
      `${name} ${shared ? "shared" : "liked"} your post · ${hours}h ago`,
    header: (count: string) =>
      `A feed with ${count} posts piled up — try visiting the notifications tab`,
    modeIo: "Render only when visible",
    modeOff: "Render everything",
    returnLabel: "Time to get back to the feed",
    tabFeed: "Feed",
    tabNotif: "Notifications",
    footerOff: (count: string) =>
      `Render everything: every time you return to the feed, all ${count} posts are laid out again — the meters freeze the moment you come back`,
    footerIo:
      "Render only when visible: IntersectionObserver fills only the posts near the viewport — returning is fast no matter how much has piled up",
  },
} as const;

export const FeedReturnDemo = ({ locale: lang = "ko" }: { locale?: Lang }) => {
  const t = STRINGS[lang];
  const fpsRef = useRef<HTMLSpanElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const framesRef = useRef<number[]>([]);
  const builtRef = useRef(false);
  const buildTimerRef = useRef<number | null>(null);
  const fillTimerRef = useRef<number | null>(null);
  const ioRef = useRef<IntersectionObserver | null>(null);
  const scrollTopRef = useRef(0);
  const modeRef = useRef<"off" | "io">("io");
  const [tab, setTab] = useState<"feed" | "notif">("feed");
  const [mode, setMode] = useState<"off" | "io">("io");
  const [returnMs, setReturnMs] = useState<number | null>(null);
  const { ref: rootRef, visible } = useVisible<HTMLDivElement>();

  useEffect(() => {
    return () => {
      if (buildTimerRef.current !== null) clearTimeout(buildTimerRef.current);
      if (fillTimerRef.current !== null) clearTimeout(fillTimerRef.current);
      ioRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!visible) return; // 화면 밖에서는 루프를 돌리지 않는다
    if (!builtRef.current) {
      builtRef.current = true;
      buildFeed();
      buildNotifs();
    }
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

  // 게시물 하나의 실제 콘텐츠 — 셸이 화면에 가까워졌을 때에야 만들어 채운다
  const buildPostContent = (i: number): DocumentFragment => {
    const hue = (i * 47) % 360;
    const frag = document.createDocumentFragment();

    const header = document.createElement("div");
    header.style.cssText = "display:flex;align-items:center;gap:8px;";
    const avatar = document.createElement("div");
    avatar.textContent = t.names[i % t.names.length][0];
    avatar.style.cssText = `width:30px;height:30px;border-radius:50%;background:hsl(${hue},55%,55%);color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;`;
    const meta = document.createElement("div");
    const name = document.createElement("div");
    name.textContent = `${t.names[i % t.names.length]}${(i * 7) % 100}`;
    name.style.cssText = "font-size:12px;font-weight:700;color:#495057;";
    const time = document.createElement("div");
    time.textContent = t.hoursAgo((i % 47) + 1);
    time.style.cssText = "font-size:10px;color:#adb5bd;";
    meta.appendChild(name);
    meta.appendChild(time);
    header.appendChild(avatar);
    header.appendChild(meta);

    const text = document.createElement("div");
    // 절반쯤은 두 문장짜리 긴 글 — 줄바꿈 계산이 레이아웃 비용의 큰 몫이다
    text.textContent =
      i % 2 === 0
        ? t.texts[(i * 13) % t.texts.length]
        : `${t.texts[(i * 13) % t.texts.length]} ${t.texts[(i * 7 + 3) % t.texts.length]}`;
    // 셸의 높이가 고정이므로 본문은 두 줄까지만 보여준다
    text.style.cssText =
      "font-size:12px;line-height:1.5;color:#495057;margin:6px 0;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;";

    // 이미지 1~3장 타일
    const images = document.createElement("div");
    images.style.cssText = "display:flex;gap:4px;";
    const tiles = 1 + (i % 3);
    for (let k = 0; k < tiles; k++) {
      const tile = document.createElement("div");
      tile.style.cssText = `flex:1;height:120px;border-radius:8px;background:linear-gradient(135deg, hsl(${(hue + k * 40) % 360},45%,72%), hsl(${(hue + k * 40 + 70) % 360},45%,60%));`;
      images.appendChild(tile);
    }

    const comment = document.createElement("div");
    comment.textContent = `${t.names[(i * 3) % t.names.length]}${(i * 11) % 100}: ${t.texts[(i * 5 + 2) % t.texts.length]}`;
    comment.style.cssText =
      "font-size:11px;color:#868e96;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";

    const actions = document.createElement("div");
    actions.textContent = t.postActions((i * 37) % 900, (i * 11) % 120);
    actions.style.cssText = "font-size:11px;color:#868e96;margin-top:4px;";

    frag.appendChild(header);
    frag.appendChild(text);
    frag.appendChild(images);
    frag.appendChild(comment);
    frag.appendChild(actions);
    return frag;
  };

  const fillShell = (shell: HTMLElement) => {
    if (shell.firstChild) return; // 이미 채워져 있다
    shell.appendChild(buildPostContent(Number(shell.dataset.idx)));
    shell.style.background = "none";
  };

  const emptyShell = (shell: HTMLElement) => {
    if (!shell.firstChild) return;
    shell.textContent = "";
    shell.style.background = SKELETON;
  };

  const ensureObserver = (): IntersectionObserver => {
    if (ioRef.current) return ioRef.current;
    const feed = feedRef.current!;
    ioRef.current = new IntersectionObserver(
      (entries) => {
        // 알림 탭에 가 있는 동안(display: none)의 이탈 알림은 무시한다 — 돌아오는 순간 눈앞이 비어 있지 않도록
        if (feed.style.display === "none") return;
        for (const e of entries) {
          const shell = e.target as HTMLElement;
          if (e.isIntersecting) fillShell(shell);
          else emptyShell(shell);
        }
      },
      { root: feed, rootMargin: FILL_MARGIN },
    );
    return ioRef.current;
  };

  // '그대로 렌더'로 바꿀 때 1,500개를 한 번에 채우면 얼어붙으니 잘게 나눠 양보하며 채운다
  const fillAll = (shells: HTMLElement[], from: number) => {
    const to = Math.min(from + BUILD_CHUNK, shells.length);
    for (let i = from; i < to; i++) fillShell(shells[i]);
    if (to < shells.length) {
      fillTimerRef.current = window.setTimeout(() => fillAll(shells, to), 0);
    }
  };

  const applyMode = (m: "off" | "io") => {
    const feed = feedRef.current;
    if (!feed) return;
    const shells = Array.from(feed.children) as HTMLElement[];
    if (m === "io") {
      const io = ensureObserver();
      for (const shell of shells) io.observe(shell); // 관찰 시작 콜백이 화면 밖 셸을 비워준다
    } else {
      ioRef.current?.disconnect();
      ioRef.current = null;
      fillAll(shells, 0);
    }
  };

  // 셸은 높이만 차지하는 빈 껍데기다 — 콘텐츠는 화면에 가까워질 때 채운다
  const buildShell = (i: number): HTMLDivElement => {
    const shell = document.createElement("div");
    shell.dataset.idx = String(i);
    shell.style.cssText = `height:${ITEM_HEIGHT}px;box-sizing:border-box;overflow:hidden;padding:12px 2px;border-bottom:1px solid #f1f3f5;background:${SKELETON};`;
    return shell;
  };

  const buildFeed = () => {
    const feed = feedRef.current;
    if (!feed) return;
    const buildChunk = (from: number) => {
      const to = Math.min(from + BUILD_CHUNK, POSTS);
      const frag = document.createDocumentFragment();
      for (let i = from; i < to; i++) frag.appendChild(buildShell(i));
      feed.appendChild(frag);
      if (to < POSTS) {
        buildTimerRef.current = window.setTimeout(() => buildChunk(to), 0);
      } else {
        // 한참 스크롤해 둔 상태를 가정한다
        feed.scrollTop = feed.scrollHeight * 0.4;
        scrollTopRef.current = feed.scrollTop;
        applyMode(modeRef.current);
      }
    };
    buildChunk(0);
  };

  const buildNotifs = () => {
    const notif = notifRef.current;
    if (!notif) return;
    for (let i = 0; i < 14; i++) {
      const row = document.createElement("div");
      row.textContent = t.notifRow(
        `${t.names[(i * 3) % t.names.length]}${(i * 13) % 100}`,
        i % 3 === 0,
        i + 1,
      );
      row.style.cssText =
        "padding:12px 2px;border-bottom:1px solid #f1f3f5;font-size:12px;color:#495057;";
      notif.appendChild(row);
    }
  };

  const switchTab = (next: "feed" | "notif") => {
    if (next === tab) return;
    const feed = feedRef.current;
    const notif = notifRef.current;
    if (!feed || !notif) return;
    if (next === "notif") {
      scrollTopRef.current = feed.scrollTop; // 떠나기 전 스크롤 위치를 기억해 둔다
      feed.style.display = "none"; // keep-alive: DOM은 그대로 두고 숨기기만 한다
      notif.style.display = "block";
      setTab("notif");
      return;
    }
    // 피드로 복귀 — 숨겨져 있던 게시물 전체가 다시 렌더링 대상이 된다
    const t0 = performance.now();
    notif.style.display = "none";
    feed.style.display = "block";
    feed.scrollTop = scrollTopRef.current; // 보던 위치 복원
    setTab("feed");
    scheduleMaterialFrame(() => {
      scheduleMaterialFrame(() => {
        setReturnMs(Math.round(performance.now() - t0));
      });
    });
  };

  const switchMode = (m: "off" | "io") => {
    if (m === modeRef.current) return;
    modeRef.current = m;
    setMode(m);
    setReturnMs(null);
    if (fillTimerRef.current !== null) clearTimeout(fillTimerRef.current);
    applyMode(m);
  };

  const modeBtn = (m: "off" | "io", label: string) => (
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

  const tabBtn = (t: "feed" | "notif", label: string) => (
    <button
      onClick={() => switchTab(t)}
      style={{
        flex: 1,
        padding: "9px 10px",
        border: "none",
        borderBottom: tab === t ? "2px solid #228be6" : "2px solid transparent",
        background: "none",
        color: tab === t ? "#1971c2" : "#868e96",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: tab === t ? 700 : 500,
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
          marginBottom: 8,
        }}
      >
        <span>{t.header(POSTS.toLocaleString())}</span>
        <span style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
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

      {/* 모드 선택 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {modeBtn("io", t.modeIo)}
        {modeBtn("off", t.modeOff)}
      </div>

      {/* 지표 */}
      <div
        style={{
          background: "#f8f9fa",
          borderRadius: 8,
          padding: "8px 12px",
          textAlign: "center",
          marginBottom: 10,
        }}
      >
        <div style={{ fontSize: 11, color: "#868e96" }}>{t.returnLabel}</div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: returnMs !== null && returnMs > 100 ? "#e8590c" : "#495057",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {returnMs !== null ? `${returnMs}ms` : "−"}
        </div>
      </div>

      {/* 미니 SNS 앱 */}
      <div style={{ border: "1px solid #e9ecef", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ display: "flex", borderBottom: "1px solid #e9ecef", background: "#f8f9fa" }}>
          {tabBtn("feed", t.tabFeed)}
          {tabBtn("notif", t.tabNotif)}
        </div>
        <div ref={feedRef} style={{ height: 300, overflowY: "auto", padding: "0 12px" }} />
        <div
          ref={notifRef}
          style={{ height: 300, overflowY: "auto", padding: "0 12px", display: "none" }}
        />
      </div>

      <div style={{ fontSize: 11, color: "#adb5bd", textAlign: "center", marginTop: 12 }}>
        {mode === "off" ? t.footerOff(POSTS.toLocaleString()) : t.footerIo}
      </div>
    </div>
  );
};
