// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useRef, useState } from "react";

const TILES = 60;
const FETCH = 800; // 받아오는 원본 사진 크기
const DEST = 160; // 만들어낼 미리보기 크기
const BLOCK = FETCH / DEST; // 미리보기 픽셀 하나가 평균 낼 원본 픽셀 블록

// 모바일에서는 10열이면 타일이 손가락으로 누르기 어려울 만큼 작아지므로 열 수를 줄인다
const GRID_CSS = `
.emt-priority-grid { display: grid; grid-template-columns: repeat(10, 1fr); gap: 4px; }
@media (max-width: 480px) { .emt-priority-grid { grid-template-columns: repeat(6, 1fr); gap: 6px; } }
`;

type Lang = "ko" | "en";

const STRINGS = {
  ko: {
    header: (n: number) => `첨부한 사진 ${n}장의 미리보기를 차례로 만든다`,
    tileLabel: (n: number) => `미리보기 ${n}`,
    modeFifo: "순서대로",
    modePriority: "클릭한 것 먼저",
    loading: "사진 읽는 중...",
    running: "미리보기 생성 중... (회색 타일을 클릭해보자)",
    start: (n: number) => `사진 ${n}장 첨부하기`,
  },
  en: {
    header: (n: number) => `Building previews for the ${n} attached photos, one at a time`,
    tileLabel: (n: number) => `Preview ${n}`,
    modeFifo: "In order",
    modePriority: "Clicked first",
    loading: "Loading photos...",
    running: "Generating previews... (try clicking a gray tile)",
    start: (n: number) => `Attach ${n} photos`,
  },
} as const;

// 원본 사진을 JS 픽셀 루프로 영역 평균 다운스케일해서 미리보기를 만든다.
// 이 계산이 미리보기 생성의 실제 메인 스레드 비용이다.
function makeThumbnail(img: HTMLImageElement | null): string {
  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = FETCH;
  srcCanvas.height = FETCH;
  const sctx = srcCanvas.getContext("2d")!;
  if (img) {
    sctx.drawImage(img, 0, 0, FETCH, FETCH);
  } else {
    // 사진을 못 받아온 경우의 대체 이미지
    const g = sctx.createLinearGradient(0, 0, FETCH, FETCH);
    g.addColorStop(0, "#adb5bd");
    g.addColorStop(1, "#dee2e6");
    sctx.fillStyle = g;
    sctx.fillRect(0, 0, FETCH, FETCH);
  }
  const src = sctx.getImageData(0, 0, FETCH, FETCH).data;

  // 픽셀 값을 그대로 평균 내면 결과가 어두워지므로,
  // 감마 보정(선형 공간 변환)을 거쳐 평균 내는 고품질 축소를 한다.
  const GAMMA = 2.2;
  const out = new ImageData(DEST, DEST);
  const dst = out.data;
  for (let y = 0; y < DEST; y++) {
    for (let x = 0; x < DEST; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let by = 0; by < BLOCK; by++) {
        for (let bx = 0; bx < BLOCK; bx++) {
          const si = ((y * BLOCK + by) * FETCH + x * BLOCK + bx) * 4;
          r += Math.pow(src[si] / 255, GAMMA);
          g += Math.pow(src[si + 1] / 255, GAMMA);
          b += Math.pow(src[si + 2] / 255, GAMMA);
        }
      }
      const n = BLOCK * BLOCK;
      const di = (y * DEST + x) * 4;
      dst[di] = Math.pow(r / n, 1 / GAMMA) * 255;
      dst[di + 1] = Math.pow(g / n, 1 / GAMMA) * 255;
      dst[di + 2] = Math.pow(b / n, 1 / GAMMA) * 255;
      dst[di + 3] = 255;
    }
  }

  const destCanvas = document.createElement("canvas");
  destCanvas.width = DEST;
  destCanvas.height = DEST;
  destCanvas.getContext("2d")!.putImageData(out, 0, 0);
  return destCanvas.toDataURL();
}

// 사진 한 장을 받아온다 — 이 대기는 네트워크의 몫이라 메인 스레드와 무관하다
function loadImage(i: number): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = "/materials/samples/main-thread.jpg";
  });
}

export const DynamicPriorityDemo = ({ locale: lang = "ko" }: { locale?: Lang }) => {
  const t = STRINGS[lang];
  const queueRef = useRef<number[]>([]);
  const imagesRef = useRef<(HTMLImageElement | null)[]>([]);
  const runningRef = useRef(false);
  const modeRef = useRef<"fifo" | "priority">("fifo");
  const trackedRef = useRef<number | null>(null);
  const [previews, setPreviews] = useState<(string | null)[]>(() => Array(TILES).fill(null));
  const [tracked, setTracked] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<"fifo" | "priority">("fifo");

  const drain = async () => {
    while (runningRef.current && queueRef.current.length > 0) {
      const i = queueRef.current.shift()!;
      const url = makeThumbnail(imagesRef.current[i]); // 미리보기 하나를 실제로 만든다
      setPreviews((p) => {
        const next = [...p];
        next[i] = url;
        return next;
      });
      if (trackedRef.current === i) {
        trackedRef.current = null;
        setTracked(null);
      }
      await new Promise((resolve) => setTimeout(resolve, 0)); // 조각마다 양보한다
    }
    runningRef.current = false;
    setRunning(false);
  };

  const start = async () => {
    if (runningRef.current || loading) return;
    setPreviews(Array(TILES).fill(null));
    trackedRef.current = null;
    setTracked(null);

    // 사진 다운로드는 병렬로 — 네트워크의 일이다
    setLoading(true);
    imagesRef.current = await Promise.all(Array.from({ length: TILES }, (_, i) => loadImage(i)));
    setLoading(false);

    // 미리보기 생성은 메인 스레드의 일이라 한 줄로 선다
    queueRef.current = Array.from({ length: TILES }, (_, i) => i);
    runningRef.current = true;
    setRunning(true);
    drain();
  };

  const clickTile = (i: number) => {
    if (!queueRef.current.includes(i)) return; // 이미 준비된 타일은 무시

    trackedRef.current = i;
    setTracked(i);

    if (modeRef.current === "priority") {
      // 클릭한 타일의 작업을 큐 맨 앞으로 — setPriority('user-blocking')에 해당한다
      const q = queueRef.current;
      const pos = q.indexOf(i);
      if (pos > 0) {
        q.splice(pos, 1);
        q.unshift(i);
      }
    }
  };

  const switchMode = (m: "fifo" | "priority") => {
    modeRef.current = m;
    setMode(m);
  };

  const modeBtn = (m: "fifo" | "priority", label: string) => (
    <button
      onClick={() => switchMode(m)}
      style={{
        flex: 1,
        padding: "7px 10px",
        border: mode === m ? "2px solid #228be6" : "1px solid #dee2e6",
        borderRadius: 6,
        background: mode === m ? "#e7f5ff" : "#fff",
        color: mode === m ? "#1971c2" : "#495057",
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
      style={{
        border: "1px solid #dee2e6",
        borderRadius: 8,
        padding: 20,
        margin: "24px 0",
        background: "#fff",
      }}
    >
      <style>{GRID_CSS}</style>
      <div style={{ fontSize: 11, color: "#495057", marginBottom: 10 }}>{t.header(TILES)}</div>

      {/* 타일 그리드 */}
      <div className="emt-priority-grid">
        {Array.from({ length: TILES }, (_, i) => (
          <button
            key={i}
            onClick={() => clickTile(i)}
            style={{
              aspectRatio: "1",
              border: tracked === i ? "2px solid #228be6" : "1px solid #dee2e6",
              borderRadius: 4,
              background: previews[i] ? `url(${previews[i]}) center / cover` : "#e9ecef",
              cursor: previews[i] ? "default" : "pointer",
              padding: 0,
            }}
            aria-label={t.tileLabel(i + 1)}
          />
        ))}
      </div>

      {/* 모드 선택 */}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {modeBtn("fifo", t.modeFifo)}
        {modeBtn("priority", t.modePriority)}
      </div>

      {/* 시작 버튼 */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
        <button
          onClick={start}
          disabled={running || loading}
          style={{
            padding: "8px 20px",
            border: "none",
            borderRadius: 6,
            background: running || loading ? "#ced4da" : "#1971c2",
            color: "#fff",
            cursor: running || loading ? "default" : "pointer",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {loading ? t.loading : running ? t.running : t.start(TILES)}
        </button>
      </div>
    </div>
  );
};
