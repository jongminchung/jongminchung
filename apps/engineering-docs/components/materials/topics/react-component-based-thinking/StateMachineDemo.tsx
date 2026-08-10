"use client";

import { motion, useReducedMotion } from "motion/react";
import React, { useEffect, useRef, useState } from "react";

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

type Status = "idle" | "loading" | "added";
type EdgeId = "CLICK" | "SUCCESS" | "RESET";

const STYLE = `
.rcbt-smd-spinner {
  display: inline-block;
  width: 13px;
  height: 13px;
  border: 2px solid rgba(134, 142, 150, 0.35);
  border-top-color: #868e96;
  border-radius: 50%;
}
`;

const CHIP_COLORS: Record<Status, { bg: string; text: string; border: string }> = {
  idle: { bg: "#e7f5ff", text: "#228be6", border: "#a5d8ff" },
  loading: { bg: "#fff9db", text: "#b08900", border: "#ffe066" },
  added: { bg: "#ebfbee", text: "#40c057", border: "#b2f2bb" },
};

// ---- 상태 그래프 (SVG) ----

interface NodeSpec {
  cx: number;
  cy: number;
  w: number;
  label: Status;
}

const NODE_H = 34;
const NODES: Record<Status, NodeSpec> = {
  idle: { cx: 130, cy: 34, w: 84, label: "idle" },
  loading: { cx: 198, cy: 156, w: 96, label: "loading" },
  added: { cx: 62, cy: 156, w: 84, label: "added" },
};

const GraphNode = ({ spec, current }: { spec: NodeSpec; current: boolean }) => {
  const dashed = current && spec.label === "loading";
  const reducedMotion = useReducedMotion();
  return (
    <g>
      <motion.rect
        x={spec.cx - spec.w / 2}
        y={spec.cy - NODE_H / 2}
        width={spec.w}
        height={NODE_H}
        rx={17}
        fill={current ? "#228be6" : "#fff"}
        stroke={current ? "#228be6" : "#adb5bd"}
        strokeWidth={current ? 2 : 1.5}
        strokeDasharray={dashed ? "5 4" : undefined}
        animate={{ strokeDashoffset: dashed && !reducedMotion ? -16 : 0 }}
        transition={{ duration: 0.8, ease: "linear", repeat: dashed ? Infinity : 0 }}
        style={{ transition: "fill 0.2s ease, stroke 0.2s ease" }}
      />
      <text
        x={spec.cx}
        y={spec.cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily={MONO}
        fontSize={13}
        fontWeight={600}
        fill={current ? "#fff" : "#495057"}
        style={{ transition: "fill 0.2s ease" }}
      >
        {spec.label}
      </text>
    </g>
  );
};

interface EdgeSpec {
  id: EdgeId;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  lx: number;
  ly: number;
}

const EDGES: EdgeSpec[] = [
  { id: "CLICK", x1: 156, y1: 54, x2: 192, y2: 134, label: "CLICK", lx: 194, ly: 90 },
  { id: "SUCCESS", x1: 146, y1: 156, x2: 110, y2: 156, label: "성공", lx: 128, ly: 178 },
  { id: "RESET", x1: 68, y1: 134, x2: 104, y2: 54, label: "RESET", lx: 64, ly: 90 },
];

const GraphEdge = ({ spec, active }: { spec: EdgeSpec; active: boolean }) => {
  const color = active ? "#fab005" : "#adb5bd";
  return (
    <g>
      <line
        x1={spec.x1}
        y1={spec.y1}
        x2={spec.x2}
        y2={spec.y2}
        stroke={color}
        strokeWidth={active ? 2.5 : 1.5}
        markerEnd={active ? "url(#rcbt-smd-arrow-active)" : "url(#rcbt-smd-arrow)"}
        style={{ transition: "stroke 0.25s ease, stroke-width 0.25s ease" }}
      />
      <text
        x={spec.lx}
        y={spec.ly}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily={MONO}
        fontSize={10.5}
        fontWeight={active ? 700 : 500}
        fill={active ? "#b08900" : "#868e96"}
        style={{ transition: "fill 0.25s ease" }}
      >
        {spec.label}
      </text>
    </g>
  );
};

const StateGraph = ({ status, activeEdge }: { status: Status; activeEdge: EdgeId | null }) => (
  <svg
    viewBox="0 0 260 192"
    style={{ display: "block", width: "100%", maxWidth: 300, margin: "0 auto" }}
    role="img"
    aria-label={`상태 그래프 — 현재 상태 ${status}`}
  >
    <defs>
      <marker
        id="rcbt-smd-arrow"
        viewBox="0 0 10 10"
        refX={9}
        refY={5}
        markerWidth={7}
        markerHeight={7}
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#adb5bd" />
      </marker>
      <marker
        id="rcbt-smd-arrow-active"
        viewBox="0 0 10 10"
        refX={9}
        refY={5}
        markerWidth={7}
        markerHeight={7}
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#fab005" />
      </marker>
    </defs>
    {EDGES.map((e) => (
      <GraphEdge key={e.id} spec={e} active={activeEdge === e.id} />
    ))}
    {(Object.keys(NODES) as Status[]).map((s) => (
      <GraphNode key={s} spec={NODES[s]} current={status === s} />
    ))}
  </svg>
);

// ---- 데모 본체 ----

export const StateMachineDemo = () => {
  const [status, setStatus] = useState<Status>("idle");
  const [activeEdge, setActiveEdge] = useState<EdgeId | null>(null);
  const [pressed, setPressed] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const reducedMotion = useReducedMotion();

  const containerRef = useRef<HTMLDivElement>(null);
  const edgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const check = () => setIsNarrow(container.clientWidth < 480);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  useEffect(
    () => () => {
      if (edgeTimerRef.current) clearTimeout(edgeTimerRef.current);
    },
    [],
  );

  const flashEdge = (edge: EdgeId) => {
    if (edgeTimerRef.current) clearTimeout(edgeTimerRef.current);
    setActiveEdge(edge);
    edgeTimerRef.current = setTimeout(() => setActiveEdge(null), 900);
  };

  // 자동 재생 루프: idle --CLICK--> loading --성공--> added --RESET--> idle
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    if (status === "idle") {
      // 잠시 뒤 가상의 클릭이 들어온다
      timers.push(
        setTimeout(() => {
          setPressed(true);
          timers.push(setTimeout(() => setPressed(false), 200));
          flashEdge("CLICK");
          setStatus("loading");
        }, 1700),
      );
    } else if (status === "loading") {
      timers.push(
        setTimeout(() => {
          setStatus("added");
          flashEdge("SUCCESS");
        }, 1300),
      );
    } else {
      timers.push(
        setTimeout(() => {
          setStatus("idle");
          flashEdge("RESET");
        }, 1900),
      );
    }

    return () => timers.forEach(clearTimeout);
  }, [status]);

  const buttonStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minWidth: 160,
    padding: "11px 22px",
    border: "none",
    borderRadius: 8,
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: 600,
    pointerEvents: "none",
    transform: pressed ? "scale(0.94)" : "scale(1)",
    transition: "background 0.2s ease, color 0.2s ease, transform 0.15s ease",
    ...(status === "idle" && { background: "#228be6", color: "#fff" }),
    ...(status === "loading" && { background: "#dee2e6", color: "#868e96" }),
    ...(status === "added" && { background: "#40c057", color: "#fff" }),
  };

  const chip = CHIP_COLORS[status];

  return (
    <div
      ref={containerRef}
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
          flexDirection: isNarrow ? "column" : "row",
          alignItems: "center",
          justifyContent: "center",
          gap: isNarrow ? 24 : 32,
        }}
      >
        {/* 왼쪽: 실제 동작하는 버튼 */}
        <div
          style={{
            flex: isNarrow ? undefined : "0 0 auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            minHeight: 118,
          }}
        >
          <div role="presentation" aria-hidden style={buttonStyle}>
            {status === "idle" && "장바구니 담기"}
            {status === "loading" && (
              <>
                <motion.span
                  className="rcbt-smd-spinner"
                  aria-hidden
                  animate={{ rotate: reducedMotion ? 0 : 360 }}
                  transition={{ duration: 0.7, ease: "linear", repeat: Infinity }}
                />
                담는 중...
              </>
            )}
            {status === "added" && "담김 ✓"}
          </div>
          <div style={{ height: 20, display: "flex", alignItems: "center" }}>
            <span style={{ fontFamily: FONT, fontSize: 12, color: "#adb5bd" }}>
              {status === "idle" && "클릭 대기 중..."}
              {status === "loading" && "요청이 처리되는 중"}
              {status === "added" && "잠시 뒤 처음으로 (RESET)"}
            </span>
          </div>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 6,
              background: chip.bg,
              color: chip.text,
              border: `1px solid ${chip.border}`,
              transition: "background 0.2s ease, color 0.2s ease, border-color 0.2s ease",
            }}
          >
            status: '{status}'
          </span>
        </div>

        {/* 오른쪽: 상태 그래프 */}
        <div
          style={{ flex: isNarrow ? undefined : "0 1 300px", width: isNarrow ? "100%" : undefined }}
        >
          <StateGraph status={status} activeEdge={activeEdge} />
        </div>
      </div>
      <div style={{ fontSize: 11, color: "#adb5bd", textAlign: "center", marginTop: 16 }}>
        버튼의 한살이가 자동으로 반복된다 — 왼쪽 UI와 오른쪽 상태 그래프는 같은 상태 머신의 두
        표현이다
      </div>
    </div>
  );
};
