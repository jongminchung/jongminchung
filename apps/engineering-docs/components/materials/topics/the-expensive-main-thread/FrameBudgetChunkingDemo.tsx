// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useRef, useEffect, useState } from "react";
import { seededMaterialRandom } from "@/components/materials/runtime/random";
import {
  cancelMaterialFrame,
  scheduleMaterialFrame,
} from "@/components/materials/runtime/scheduler";
import {
  SvgCanvas,
  type SvgCanvasHandle,
  type SvgDrawingContext,
  type SvgGradient,
} from "@/components/materials/runtime/svg-canvas";
import { useVisible } from "./useVisible";

type Lang = "ko" | "en";

const STRINGS = {
  ko: {
    statPrefix: "파티클 ",
    statSuffix: "개 · 이번 프레임 방향 계산",
    hint: "이 위에서 마우스나 손가락을 움직이면 파티클이 커서를 피해 흩어진다",
    once: "통째로 계산",
    sliced: "프레임당 5ms씩",
  },
  en: {
    statPrefix: "",
    statSuffix: " particles · steering cost this frame",
    hint: "Move your mouse or finger here and the particles scatter away from the cursor",
    once: "Compute all at once",
    sliced: "5ms per frame",
  },
} as const;

const COLORS = ["#228be6", "#40c057", "#fab005", "#e64980", "#7950f2", "#15aabf"];
const PARTICLES = 4000; // 파티클 수 — 방향 계산이 O(N²)이라 통째로 계산하면 예산을 훌쩍 넘는다
const REPEL_DIST2 = 900; // 30px 이내의 파티클끼리 서로 밀어낸다
const MOUSE_DIST2 = 12000; // 커서 주변 ~110px의 파티클을 밀어낸다
const BUDGET_MS = 5; // '프레임당 5ms씩' 모드의 프레임당 계산 예산
const IDLE_DRIFT = 0.2; // 입력이 없을 때 파티클이 유영하는 속도(px/frame)

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  r: number;
  color: number; // COLORS 인덱스
};

// 파티클 하나의 진행 방향을 계산한다.
// 가까운 파티클끼리 서로 밀어내므로 다른 모든 파티클과의 거리를 확인해야 한다.
// 파티클 하나에 O(N), 전체로는 O(N²) — 이 계산이 진짜 무거운 부분이다.
function steerParticle(
  i: number,
  ps: Particle[],
  energy: number,
  mx: number,
  my: number,
  t: number,
) {
  const p = ps[i];
  let fx = 0;
  let fy = 0;
  for (let j = 0; j < ps.length; j++) {
    if (j === i) continue;
    const q = ps[j];
    const dx = p.x - q.x;
    const dy = p.y - q.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > 0 && d2 < REPEL_DIST2) {
      const d2c = Math.max(d2, 100); // 너무 가까울 때 힘이 폭주하지 않도록
      fx += dx / d2c;
      fy += dy / d2c;
    }
  }
  // 커서가 파티클을 밀어낸다 (이 힘 자체는 싸다 — 무거운 것은 위의 상호작용이다)
  const dxm = p.x - mx;
  const dym = p.y - my;
  const d2m = dxm * dxm + dym * dym;
  if (d2m < MOUSE_DIST2) {
    const f = 60 / (d2m + 200);
    fx += dxm * f;
    fy += dym * f;
  }

  // 계산된 힘을 즉시 대입하지 않고 섞어서, 방향이 홱홱 뒤집히지 않게 한다
  const targetVx = fx * 10 * energy + Math.sin(p.phase + t * 0.002) * energy * 0.6;
  const targetVy = fy * 10 * energy + Math.cos(p.phase * 1.3) * energy * 0.6;
  p.vx = p.vx * 0.7 + targetVx * 0.3;
  p.vy = p.vy * 0.7 + targetVy * 0.3;
}

export const FrameBudgetChunkingDemo = ({ locale: lang = "ko" }: { locale?: Lang }) => {
  const t = STRINGS[lang];
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<SvgCanvasHandle>(null);
  const fpsRef = useRef<HTMLSpanElement>(null);
  const costRef = useRef<HTMLSpanElement>(null);
  const rafRef = useRef<number>(0);
  const framesRef = useRef<number[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const colorGroupsRef = useRef<number[][]>([]);
  const cursorRef = useRef(0); // '5ms씩' 모드의 라운드 로빈 위치
  const mouseRef = useRef({ x: -9999, y: -9999, px: -9999, py: -9999 });
  const energyRef = useRef(0); // 커서 움직임이 만드는 에너지 (서서히 감쇠)
  const modeRef = useRef<"once" | "sliced">("once");
  const lastTRef = useRef(0);
  const [mode, setMode] = useState<"once" | "sliced">("once");
  const { ref: rootRef, visible } = useVisible<HTMLDivElement>();

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas || !visible) return; // 화면 밖에서는 루프를 돌리지 않는다

    // 고정 파티클 풀 생성 + 색깔별 그룹 (그리기 배칭용)
    if (particlesRef.current.length === 0) {
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      const ps: Particle[] = [];
      const groups: number[][] = COLORS.map(() => []);
      for (let i = 0; i < PARTICLES; i++) {
        const color = Math.floor(
          seededMaterialRandom("the-expensive-main-thread/FrameBudgetChunkingDemo") * COLORS.length,
        );
        ps.push({
          x: seededMaterialRandom("the-expensive-main-thread/FrameBudgetChunkingDemo") * w,
          y: seededMaterialRandom("the-expensive-main-thread/FrameBudgetChunkingDemo") * h,
          vx: 0,
          vy: 0,
          phase:
            seededMaterialRandom("the-expensive-main-thread/FrameBudgetChunkingDemo") * Math.PI * 2,
          r: 1 + seededMaterialRandom("the-expensive-main-thread/FrameBudgetChunkingDemo") * 1.6,
          color,
        });
        groups[color].push(i);
      }
      particlesRef.current = ps;
      colorGroupsRef.current = groups;
    }

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = stage.clientWidth * dpr;
      canvas.height = stage.clientHeight * dpr;
      canvas.style.width = `${stage.clientWidth}px`;
      canvas.style.height = `${stage.clientHeight}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(stage);

    const animate = (t: number) => {
      const frames = framesRef.current;
      frames.push(t);
      while (frames.length && t - frames[0] > 1000) frames.shift();
      if (fpsRef.current) fpsRef.current.textContent = String(frames.length);

      const w = stage.clientWidth;
      const h = stage.clientHeight;
      const ps = particlesRef.current;
      const mouse = mouseRef.current;
      const energy = energyRef.current;
      // 커서가 멈추면 서서히 잦아든다 — 프레임 수가 아니라 경과 시간 기준으로 감쇠해야
      // 프레임이 느린 '통째로' 모드에서만 여운이 몇 초씩 길게 남는 왜곡이 없다
      const dt = lastTRef.current ? Math.min(t - lastTRef.current, 100) : 16.7;
      lastTRef.current = t;
      energyRef.current *= Math.pow(0.92, dt / 16.7);
      const active = energy > 0.05;

      // ① 방향 계산 (무거움) — 여기가 두 모드의 차이다
      const t0 = performance.now();
      if (active) {
        if (modeRef.current === "once") {
          // 통째로: 매 프레임 모든 파티클의 방향을 다시 계산한다
          for (let i = 0; i < ps.length; i++) steerParticle(i, ps, energy, mouse.x, mouse.y, t);
        } else {
          // 5ms씩: 예산 안에서 계산하고, 나머지는 다음 프레임으로 미룬다
          let count = 0;
          while (performance.now() - t0 < BUDGET_MS && count < ps.length) {
            steerParticle(cursorRef.current, ps, energy, mouse.x, mouse.y, t);
            cursorRef.current = (cursorRef.current + 1) % ps.length;
            count++;
          }
        }
      }
      const cost = performance.now() - t0;
      if (costRef.current) costRef.current.textContent = `${cost.toFixed(1)}ms`;

      // ② 이동 (쌈) — 모든 파티클이 매 프레임 한 걸음씩 움직인다.
      // 일부러 프레임당 고정 걸음이라, fps가 떨어지면 움직임도 그만큼 느려지고 끊겨 보인다.
      for (const p of ps) {
        p.x += p.vx;
        p.y += p.vy;
        if (!active) {
          // 입력이 없을 때는 반발력 계산 없이(O(N)) 잔잔한 유영만 남긴다 — 화면이 죽은 듯 멈추지 않도록
          p.vx = p.vx * 0.9 + Math.sin(p.phase + t * 0.0012) * IDLE_DRIFT * 0.1;
          p.vy = p.vy * 0.9 + Math.cos(p.phase * 1.3 + t * 0.0009) * IDLE_DRIFT * 0.1;
        }
        if (p.x < 0) p.x += w;
        else if (p.x > w) p.x -= w;
        if (p.y < 0) p.y += h;
        else if (p.y > h) p.y -= h;
      }

      // ③ 그리기 — 색깔별로 묶어 fillStyle 변경을 최소화한다.
      const ctx = canvas.getContext("2d")!;
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 0.8;
      const groups = colorGroupsRef.current;
      for (let c = 0; c < groups.length; c++) {
        ctx.fillStyle = COLORS[c];
        const group = groups[c];
        for (let gi = 0; gi < group.length; gi++) {
          const p = ps[group[gi]];
          ctx.fillRect(p.x, p.y, p.r, p.r);
        }
      }
      ctx.globalAlpha = 1;

      rafRef.current = scheduleMaterialFrame(animate);
    };
    rafRef.current = scheduleMaterialFrame(animate);
    return () => {
      cancelMaterialFrame(rafRef.current);
      ro.disconnect();
    };
  }, [visible]);

  // 커서의 움직임이 파티클에 에너지를 불어넣는다
  const onPointerMove = (clientX: number, clientY: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const m = mouseRef.current;
    m.px = m.x;
    m.py = m.y;
    m.x = clientX - rect.left;
    m.y = clientY - rect.top;
    if (m.px > -9999) {
      const moved = Math.hypot(m.x - m.px, m.y - m.py);
      energyRef.current = Math.min(3, energyRef.current + moved * 0.01);
    }
  };

  const switchMode = (m: "once" | "sliced") => {
    modeRef.current = m;
    setMode(m);
  };

  const modeBtn = (m: "once" | "sliced", label: string) => (
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
          marginBottom: 6,
        }}
      >
        <span>
          {t.statPrefix}
          {PARTICLES.toLocaleString()}
          {t.statSuffix}{" "}
          <span ref={costRef} style={{ fontWeight: 700, color: "#495057" }}>
            0.0ms
          </span>
        </span>
        <span style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
          <span ref={fpsRef} style={{ fontWeight: 700, color: "#495057" }}>
            60
          </span>{" "}
          fps
        </span>
      </div>

      {/* 파티클 스테이지 */}
      <div
        ref={stageRef}
        onMouseMove={(e) => onPointerMove(e.clientX, e.clientY)}
        onTouchMove={(e) => {
          const touch = e.touches[0];
          if (touch) onPointerMove(touch.clientX, touch.clientY);
        }}
        style={{
          position: "relative",
          height: 240,
          border: "1px solid #e9ecef",
          borderRadius: 6,
          overflow: "hidden",
          background: "#f8f9fa",
          cursor: "crosshair",
          touchAction: "none",
        }}
      >
        <SvgCanvas ref={canvasRef} style={{ position: "absolute", inset: 0, display: "block" }} />
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: 11,
            color: "rgba(73, 80, 87, 0.4)",
            pointerEvents: "none",
          }}
        >
          {t.hint}
        </div>
      </div>

      {/* 모드 선택 */}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {modeBtn("once", t.once)}
        {modeBtn("sliced", t.sliced)}
      </div>
    </div>
  );
};
