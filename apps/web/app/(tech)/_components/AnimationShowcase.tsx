"use client";

import { Button } from "@jongminchung/ui/components/button";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "#lib/content-model";

const DURATION = 6_000;

const copy = {
  ko: {
    interactive: {
      index: "01 / INTERACTIVE",
      tool: "Theatre.js 모델",
      title: "요청 타임라인을 직접 탐색",
      description:
        "키프레임과 상태를 연결해 사용자가 재생 위치와 속도를 제어하는 구조",
      play: "재생",
      pause: "일시정지",
      restart: "처음부터",
      timeline: "애니메이션 진행 위치",
      speed: "재생 속도",
      client: "클라이언트",
      gateway: "게이트웨이",
      database: "데이터베이스",
      request: "요청",
      response: "응답",
      fit: "적합한 경우",
      use: "클릭, 드래그, 스크롤, 상태 변화가 설명의 일부인 블로그",
      recipe: "sheet.object → keyframes → sequence.play",
    },
    rendered: {
      index: "02 / RENDERED",
      tool: "Motion Canvas 모델",
      title: "장면 순서로 요청 수명주기 설명",
      description:
        "코드로 정의한 장면을 일정한 시간축에 렌더링해 반복 재생하는 구조",
      scene: "자동 재생 장면",
      client: "CLIENT",
      api: "API",
      worker: "WORKER",
      store: "STORE",
      fit: "적합한 경우",
      use: "음성, 자막, 일정한 장면 전환이 중심인 설명 영상과 루프",
      recipe: "makeScene2D → yield* → render",
    },
  },
  en: {
    interactive: {
      index: "01 / INTERACTIVE",
      tool: "Theatre.js model",
      title: "Scrub through a request timeline",
      description:
        "Keyframes and state stay connected while the reader controls position and speed",
      play: "Play",
      pause: "Pause",
      restart: "Restart",
      timeline: "Animation progress",
      speed: "Playback speed",
      client: "Client",
      gateway: "Gateway",
      database: "Database",
      request: "Request",
      response: "Response",
      fit: "Best fit",
      use: "Articles where clicks, dragging, scrolling, and state changes are part of the explanation",
      recipe: "sheet.object → keyframes → sequence.play",
    },
    rendered: {
      index: "02 / RENDERED",
      tool: "Motion Canvas model",
      title: "Explain a request lifecycle as scenes",
      description:
        "Code-authored scenes render against a deterministic timeline and loop as one composition",
      scene: "Autoplay scene",
      client: "CLIENT",
      api: "API",
      worker: "WORKER",
      store: "STORE",
      fit: "Best fit",
      use: "Explanatory videos and loops built around narration, captions, and fixed scene transitions",
      recipe: "makeScene2D → yield* → render",
    },
  },
} as const;

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function InteractiveTimeline({ locale }: { readonly locale: Locale }) {
  const text = copy[locale].interactive;
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);
  const progressRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const previousRef = useRef<number | null>(null);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    if (!playing) {
      previousRef.current = null;
      return;
    }
    const tick = (now: number) => {
      const previous = previousRef.current ?? now;
      previousRef.current = now;
      const next = progressRef.current + ((now - previous) * speed) / DURATION;
      if (next >= 1) {
        progressRef.current = 0;
        setProgress(0);
      } else {
        progressRef.current = next;
        setProgress(next);
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [playing, speed]);

  const outbound = clamp(progress / 0.52);
  const inbound = clamp((progress - 0.62) / 0.38);
  const x = inbound > 0 ? 536 - inbound * 448 : 88 + outbound * 448;
  const isResponse = progress >= 0.62;
  const activeNode =
    progress < 0.24 || progress > 0.88
      ? "client"
      : progress < 0.48 || progress > 0.74
        ? "gateway"
        : "database";

  return (
    <article className="overflow-hidden rounded-[var(--radius)] border bg-card">
      <div className="border-b p-6 max-[560px]:p-5">
        <div className="mb-5 flex items-center justify-between gap-4 font-mono text-[10px] tracking-[.08em] uppercase">
          <span className="text-primary">{text.index}</span>
          <a
            className="text-muted-foreground hover:text-foreground"
            href="https://www.theatrejs.com/"
            rel="noreferrer"
            target="_blank"
          >
            {text.tool} ↗
          </a>
        </div>
        <h2 className="m-0 text-[clamp(25px,3vw,34px)] leading-[1.08] font-medium tracking-[-.035em]">
          {text.title}
        </h2>
        <p className="mt-3 mb-0 max-w-[580px] text-sm leading-6 text-muted-foreground">
          {text.description}
        </p>
      </div>

      <div
        className="relative overflow-hidden bg-[#080b13] p-4 text-white sm:p-6"
        data-showcase="theatre"
      >
        <svg
          aria-label={`${text.client}, ${text.gateway}, ${text.database} ${isResponse ? text.response : text.request}`}
          className="block aspect-[16/9] w-full"
          role="img"
          viewBox="0 0 624 350"
        >
          <defs>
            <linearGradient id="showcase-theatre-line" x1="0" x2="1">
              <stop stopColor="#4b57ff" />
              <stop offset=".5" stopColor="#62d8ff" />
              <stop offset="1" stopColor="#9b6cff" />
            </linearGradient>
            <filter
              id="showcase-theatre-glow"
              x="-100%"
              y="-100%"
              width="300%"
              height="300%"
            >
              <feGaussianBlur stdDeviation="7" />
            </filter>
          </defs>
          <path
            d="M42 70H582M42 175H582M42 280H582M132 34V316M312 34V316M492 34V316"
            fill="none"
            stroke="#263044"
            strokeDasharray="2 8"
          />
          <path
            d="M88 175H536"
            fill="none"
            stroke="url(#showcase-theatre-line)"
            strokeOpacity=".72"
            strokeWidth="2"
          />
          {[
            { id: "client", x: 88, label: text.client },
            { id: "gateway", x: 312, label: text.gateway },
            { id: "database", x: 536, label: text.database },
          ].map((node) => {
            const active = node.id === activeNode;
            return (
              <g key={node.id}>
                <rect
                  fill={active ? "#172351" : "#101624"}
                  height="82"
                  rx="14"
                  stroke={active ? "#65d7ff" : "#39445b"}
                  strokeWidth={active ? 2 : 1}
                  width="126"
                  x={node.x - 63}
                  y="134"
                />
                <circle
                  cx={node.x}
                  cy="166"
                  fill={active ? "#65d7ff" : "#657089"}
                  r="7"
                />
                <text
                  fill={active ? "#ffffff" : "#a4aec2"}
                  fontFamily="ui-monospace, monospace"
                  fontSize="11"
                  textAnchor="middle"
                  x={node.x}
                  y="197"
                >
                  {node.label}
                </text>
              </g>
            );
          })}
          <circle
            cx={x}
            cy="112"
            fill="#68ddff"
            filter="url(#showcase-theatre-glow)"
            opacity=".5"
            r="18"
          />
          <circle cx={x} cy="112" fill="#e8fbff" r="7" />
          <text
            fill="#7f8ba3"
            fontFamily="ui-monospace, monospace"
            fontSize="10"
            textAnchor="middle"
            x={x}
            y="92"
          >
            {isResponse ? text.response : text.request}
          </text>
          <text
            fill="#738099"
            fontFamily="ui-monospace, monospace"
            fontSize="10"
            x="26"
            y="330"
          >
            {String(Math.round(progress * 100)).padStart(3, "0")}%
          </text>
        </svg>
      </div>

      <div className="border-t p-5 sm:p-6">
        <label className="mb-4 grid gap-2 font-mono text-[10px] tracking-[.06em] text-muted-foreground uppercase">
          <span>{text.timeline}</span>
          <input
            aria-label={text.timeline}
            className="w-full accent-primary"
            max="1000"
            min="0"
            onChange={(event) => {
              const next = Number(event.target.value) / 1000;
              progressRef.current = next;
              setProgress(next);
            }}
            type="range"
            value={Math.round(progress * 1000)}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="border-foreground bg-foreground text-background hover:bg-foreground/90"
            onClick={() => setPlaying((value) => !value)}
            size="sm"
            type="button"
          >
            {playing ? text.pause : text.play}
          </Button>
          <Button
            onClick={() => {
              progressRef.current = 0;
              setProgress(0);
              setPlaying(false);
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            {text.restart}
          </Button>
          <label className="ml-auto flex items-center gap-2 font-mono text-[10px] text-muted-foreground uppercase">
            {text.speed}
            <select
              className="h-8 rounded-[var(--radius-xs)] border bg-background px-2 text-foreground"
              onChange={(event) => setSpeed(Number(event.target.value))}
              value={speed}
            >
              <option value="0.5">0.5×</option>
              <option value="1">1×</option>
              <option value="2">2×</option>
            </select>
          </label>
        </div>
      </div>

      <footer className="grid gap-2 border-t bg-muted/35 px-6 py-5 text-sm leading-6 sm:grid-cols-[110px_1fr]">
        <strong>{text.fit}</strong>
        <span className="text-muted-foreground">{text.use}</span>
        <span className="font-mono text-[10px] text-primary uppercase sm:col-start-2">
          {text.recipe}
        </span>
      </footer>
    </article>
  );
}

function RenderedSequence({ locale }: { readonly locale: Locale }) {
  const text = copy[locale].rendered;
  const nodes = [text.client, text.api, text.worker, text.store];
  return (
    <article className="overflow-hidden rounded-[var(--radius)] border bg-card">
      <div className="border-b p-6 max-[560px]:p-5">
        <div className="mb-5 flex items-center justify-between gap-4 font-mono text-[10px] tracking-[.08em] uppercase">
          <span className="text-primary">{text.index}</span>
          <a
            className="text-muted-foreground hover:text-foreground"
            href="https://motioncanvas.io/"
            rel="noreferrer"
            target="_blank"
          >
            {text.tool} ↗
          </a>
        </div>
        <h2 className="m-0 text-[clamp(25px,3vw,34px)] leading-[1.08] font-medium tracking-[-.035em]">
          {text.title}
        </h2>
        <p className="mt-3 mb-0 max-w-[580px] text-sm leading-6 text-muted-foreground">
          {text.description}
        </p>
      </div>

      <div
        aria-label={text.scene}
        className="showcase-motion-stage relative overflow-hidden bg-[#f0edff] p-4 text-[#171323] sm:p-6 dark:bg-[#100d1b] dark:text-[#f7f2ff]"
        data-showcase="motion-canvas"
        role="img"
      >
        <svg
          aria-hidden="true"
          className="block aspect-[16/9] w-full"
          viewBox="0 0 624 350"
        >
          <defs>
            <linearGradient id="showcase-motion-bg" x1="0" x2="1" y1="0" y2="1">
              <stop stopColor="#5a35ff" stopOpacity=".12" />
              <stop offset="1" stopColor="#dc49ff" stopOpacity=".04" />
            </linearGradient>
          </defs>
          <rect
            fill="url(#showcase-motion-bg)"
            height="350"
            rx="16"
            width="624"
          />
          <path
            d="M76 175H548"
            fill="none"
            stroke="currentColor"
            strokeDasharray="3 7"
            strokeOpacity=".24"
          />
          {nodes.map((label, index) => {
            const x = 76 + index * 157.3;
            return (
              <g
                className={`showcase-motion-node showcase-motion-node-${index + 1}`}
                key={label}
              >
                <rect
                  fill="currentColor"
                  fillOpacity=".04"
                  height="96"
                  rx="18"
                  stroke="currentColor"
                  strokeOpacity=".35"
                  width="114"
                  x={x - 57}
                  y="127"
                />
                <circle cx={x} cy="164" fill="#6a45ff" r="10" />
                <text
                  fill="currentColor"
                  fontFamily="ui-monospace, monospace"
                  fontSize="10"
                  textAnchor="middle"
                  x={x}
                  y="199"
                >
                  {label}
                </text>
              </g>
            );
          })}
          <g className="showcase-motion-token">
            <circle cx="0" cy="0" fill="#ef48c8" opacity=".28" r="22" />
            <circle cx="0" cy="0" fill="#ef48c8" r="8" />
          </g>
          <g className="showcase-motion-caption" fill="currentColor">
            <text
              fontFamily="ui-monospace, monospace"
              fontSize="11"
              textAnchor="middle"
              x="312"
              y="72"
            >
              SCENE 01 — REQUEST LIFECYCLE
            </text>
          </g>
          <rect
            className="showcase-motion-progress"
            fill="#6a45ff"
            height="3"
            rx="1.5"
            width="520"
            x="52"
            y="306"
          />
        </svg>
        <span className="absolute right-5 bottom-4 font-mono text-[9px] tracking-[.08em] uppercase">
          {text.scene}
        </span>
      </div>

      <footer className="grid gap-2 border-t bg-muted/35 px-6 py-5 text-sm leading-6 sm:grid-cols-[110px_1fr]">
        <strong>{text.fit}</strong>
        <span className="text-muted-foreground">{text.use}</span>
        <span className="font-mono text-[10px] text-primary uppercase sm:col-start-2">
          {text.recipe}
        </span>
      </footer>
    </article>
  );
}

/** 인터랙티브 타임라인과 렌더링 장면을 비교함 */
export function AnimationShowcase({
  locale,
}: {
  readonly locale: Locale;
}): React.JSX.Element {
  return (
    <div className="grid gap-7">
      <InteractiveTimeline locale={locale} />
      <RenderedSequence locale={locale} />
    </div>
  );
}
