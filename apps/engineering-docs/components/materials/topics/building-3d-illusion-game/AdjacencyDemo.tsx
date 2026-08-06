// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

// 화면공간 인접 판정 데모 — 3D에서는 뚝 떨어진 두 플랫폼이 yaw 45°에서
// 화면상 이어져 보이고, 그 순간 그래프에 착시 엣지가 생겨 건너갈 수 있게 된다.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { CUBE_FACES, FONT, PALETTE, drawCharacter, drawCube, drawFlag, makeOrthoCam } from "./draw";
import {
  ISO_PITCH,
  ISO_YAW,
  buildScreenGraph,
  buildWorldGraph,
  findPath,
  nodeKey,
  orthoProject,
  paintersOrder,
  parseKey,
  vec3,
  walkableNodes,
  type Vec3,
} from "./engine";

const DEG = Math.PI / 180;
const ISO_YAW_DEG = Math.round(ISO_YAW / DEG); // 45
const YAW_MIN_DEG = ISO_YAW_DEG - 20;
const YAW_MAX_DEG = ISO_YAW_DEG + 20;
const YAW_INIT_DEG = ISO_YAW_DEG - 12;
const STEP_MS = 250; // 한 칸 걷는 시간

// 장면: 플랫폼 A(회색)와 B(파랑)는 3D에서 (1,1,1)+α만큼 떨어져 있다.
// (1,1,1) 오프셋은 yaw 45°에서 화면에 안 보이므로 그 각도에서만 이어져 보인다.
const BLOCK_DEFS: { pos: Vec3; color: "gray" | "blue" }[] = [
  { pos: vec3(0, 0, 0), color: "gray" },
  { pos: vec3(1, 0, 0), color: "gray" },
  { pos: vec3(2, 0, 0), color: "gray" },
  { pos: vec3(4, 1, 1), color: "blue" },
  { pos: vec3(5, 1, 1), color: "blue" },
];
const BLOCK_POSITIONS = BLOCK_DEFS.map((b) => b.pos);
const START = vec3(0, 1, 0); // 캐릭터 시작 노드
const GOAL = vec3(5, 2, 1); // 목표 노드
const START_KEY = nodeKey(START);
const GOAL_KEY = nodeKey(GOAL);

// yaw 슬라이더 전 구간에서 장면이 캔버스를 벗어나지 않도록 투영 범위를 미리 잰다.
function sceneBounds() {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let deg = YAW_MIN_DEG; deg <= YAW_MAX_DEG + 1e-6; deg += 1) {
    const yaw = deg * DEG;
    for (const b of BLOCK_POSITIONS) {
      for (let dx = 0; dx <= 1; dx++) {
        for (let dy = 0; dy <= 1; dy++) {
          for (let dz = 0; dz <= 1; dz++) {
            const p = orthoProject(vec3(b.x + dx, b.y + dy, b.z + dz), yaw, ISO_PITCH);
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
          }
        }
      }
    }
  }
  return { minX, maxX, minY, maxY };
}
const BOUNDS = sceneBounds();

interface EdgeInfo {
  a: Vec3;
  b: Vec3;
  illusion: boolean; // 화면 그래프에만 있고 월드 그래프에는 없는 엣지
}

export const AdjacencyDemo = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<SvgCanvasHandle>(null);
  const [yawDeg, setYawDeg] = useState(YAW_INIT_DEG);
  const [walking, setWalking] = useState(false);
  const charPosRef = useRef<Vec3>({ ...START });
  const rafRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const yaw = yawDeg * DEG;

  // yaw가 바뀔 때마다 그래프를 새로 만든다.
  const scene = useMemo(() => {
    const nodes = walkableNodes(BLOCK_POSITIONS);
    const screenGraph = buildScreenGraph(nodes, yaw, ISO_PITCH, 0.05);
    const worldGraph = buildWorldGraph(nodes);
    const seen = new Set<string>();
    const edges: EdgeInfo[] = [];
    for (const [id, neighbors] of screenGraph) {
      for (const nb of neighbors) {
        const k = id < nb ? `${id}|${nb}` : `${nb}|${id}`;
        if (seen.has(k)) continue;
        seen.add(k);
        edges.push({
          a: parseKey(id),
          b: parseKey(nb),
          illusion: !(worldGraph.get(id) ?? []).includes(nb),
        });
      }
    }
    const illusionCount = edges.filter((e) => e.illusion).length;
    const path = findPath(screenGraph, START_KEY, GOAL_KEY);
    return { nodes, edges, illusionCount, path };
  }, [yaw]);

  // 최신 상태를 읽는 그리기 함수. rAF/리사이즈에서 재사용한다.
  const drawRef = useRef<() => void>(() => {});
  drawRef.current = () => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = container.clientWidth;
    if (w <= 0) return;
    const isMobile = w < 480;
    const pad = isMobile ? 12 : 20;
    const topPad = 36; // 배지 + 캐릭터 머리 여유
    const spanX = BOUNDS.maxX - BOUNDS.minX;
    const spanY = BOUNDS.maxY - BOUNDS.minY;
    const tile = Math.min(52, (w - pad * 2) / spanX);
    const h = Math.ceil(spanY * tile + topPad + pad);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const originX = (w - spanX * tile) / 2 - BOUNDS.minX * tile;
    const originY = topPad - BOUNDS.minY * tile;
    const project = makeOrthoCam(yaw, ISO_PITCH, tile, originX, originY);

    // 블록: 먼 것부터 (화가 알고리즘)
    const order = paintersOrder(BLOCK_POSITIONS, yaw, ISO_PITCH);
    for (const i of order) {
      drawCube(ctx, project, BLOCK_DEFS[i].pos, CUBE_FACES[BLOCK_DEFS[i].color]);
    }

    // 그래프 오버레이: 노드 점은 칸 중심 바닥 (x+0.5, y, z+0.5)
    const nodeCenter = (p: Vec3) => project(vec3(p.x + 0.5, p.y, p.z + 0.5));
    for (const e of scene.edges) {
      const a = nodeCenter(e.a);
      const b = nodeCenter(e.b);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = e.illusion ? PALETTE.red : PALETTE.gray;
      ctx.lineWidth = e.illusion ? 3 : 1.5;
      ctx.stroke();
    }
    for (const n of scene.nodes) {
      const c = nodeCenter(n.pos);
      ctx.beginPath();
      ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.text;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    drawFlag(ctx, project, GOAL, tile);
    drawCharacter(ctx, project, charPosRef.current, tile, PALETTE.blue);

    // 착시 엣지가 살아있는 순간 배지
    if (scene.illusionCount > 0) {
      ctx.font = `700 ${isMobile ? 12 : 13}px ${FONT}`;
      ctx.fillStyle = PALETTE.red;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("착시 연결!", 4, 4);
    }
  };

  // 상태가 바뀔 때마다 다시 그린다.
  useEffect(() => {
    drawRef.current();
  });

  // 컨테이너 크기 변화 대응
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => drawRef.current());
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const cancelWalk = useCallback(() => {
    cancelMaterialFrame(rafRef.current);
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // 언마운트 시 애니메이션 정리
  useEffect(() => cancelWalk, [cancelWalk]);

  // 슬라이더를 움직이면 걷기를 취소하고 시작 노드로 리셋한다.
  const onYawChange = (deg: number) => {
    cancelWalk();
    charPosRef.current = { ...START };
    setWalking(false);
    setYawDeg(deg);
  };

  const startWalk = () => {
    const path = scene.path;
    if (!path || path.length < 2 || walking) return;
    cancelWalk();
    setWalking(true);
    const pts = path.map(parseKey);
    const startTime = performance.now();
    const total = (pts.length - 1) * STEP_MS;

    const tick = (now: number) => {
      const elapsed = Math.max(0, now - startTime);
      if (elapsed >= total) {
        // 도착: 1초 뒤 시작 노드로 리셋
        charPosRef.current = { ...pts[pts.length - 1] };
        drawRef.current();
        timeoutRef.current = setTimeout(() => {
          timeoutRef.current = null;
          charPosRef.current = { ...START };
          setWalking(false);
          drawRef.current();
        }, 1000);
        return;
      }
      const seg = Math.min(pts.length - 2, Math.max(0, Math.floor(elapsed / STEP_MS)));
      const a = pts[seg];
      const b = pts[seg + 1];
      const f = Math.min(1, Math.max(0, (elapsed - seg * STEP_MS) / STEP_MS));
      // 월드 좌표 선형 보간 — 직교 투영이 선형이라 화면에서도 직선으로 걷는다.
      charPosRef.current = vec3(
        a.x + (b.x - a.x) * f,
        a.y + (b.y - a.y) * f,
        a.z + (b.z - a.z) * f,
      );
      drawRef.current();
      rafRef.current = scheduleMaterialFrame(tick);
    };
    rafRef.current = scheduleMaterialFrame(tick);
  };

  const canWalk = scene.path !== null && !walking;
  const hasPath = scene.path !== null;

  const btn: React.CSSProperties = {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: 600,
    padding: "5px 12px",
    borderRadius: 6,
    border: "1px solid #dee2e6",
    background: "#fff",
    color: "#495057",
    cursor: "pointer",
  };

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
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flex: "1 1 220px",
            minWidth: 200,
            fontSize: 12,
            color: PALETTE.text,
          }}
        >
          <span style={{ whiteSpace: "nowrap", fontWeight: 600 }}>
            카메라 각도: {yawDeg.toFixed(1)}°
          </span>
          <input
            type="range"
            min={YAW_MIN_DEG}
            max={YAW_MAX_DEG}
            step={0.1}
            value={yawDeg}
            onChange={(e) => onYawChange(Number(e.target.value))}
            style={{ flex: 1, minWidth: 80, accentColor: "#228be6" }}
          />
        </label>
        <button style={btn} onClick={() => onYawChange(ISO_YAW_DEG)}>
          45°로 스냅
        </button>
        <button
          style={{
            ...btn,
            opacity: canWalk ? 1 : 0.45,
            cursor: canWalk ? "pointer" : "not-allowed",
          }}
          disabled={!canWalk}
          onClick={startWalk}
        >
          건너가기
        </button>
      </div>
      <div ref={containerRef}>
        <SvgCanvas ref={canvasRef} style={{ display: "block", width: "100%" }} />
      </div>
      <div style={{ fontSize: 12, color: PALETTE.text, marginTop: 10 }}>
        화면 그래프 엣지 {scene.edges.length}개 ·{" "}
        <span
          style={{
            color: scene.illusionCount > 0 ? PALETTE.red : PALETTE.text,
            fontWeight: scene.illusionCount > 0 ? 700 : 400,
          }}
        >
          착시 엣지 {scene.illusionCount}개
        </span>{" "}
        · A→B 경로:{" "}
        <span style={{ fontWeight: 700, color: hasPath ? PALETTE.green : PALETTE.subtext }}>
          {hasPath ? "있음" : "없음"}
        </span>
      </div>
      <div style={{ fontSize: 12, color: PALETTE.subtext, marginTop: 6 }}>
        슬라이더로 카메라를 돌려보세요 — 45°가 되는 순간 없던 길이 생긴다
      </div>
    </div>
  );
};
