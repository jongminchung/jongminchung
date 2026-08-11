// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

// 최종 보스 데모: 실제로 플레이 가능한 미니 착시 퍼즐 게임.
// 크랭크를 돌려 다리를 회전시키면 3D에서는 절대 만나지 않는 다리가
// "화면에서 이어져 보이는" 순간이 오고, 그 순간 캐릭터는 그 위를 걸어간다.
import React, { useEffect, useRef, useState } from "react";
import {
  cancelMaterialFrame,
  scheduleMaterialFrame,
} from "#components/materials/runtime/scheduler";
import {
  SvgCanvas,
  type SvgCanvasHandle,
  type SvgDrawingContext,
  type SvgGradient,
} from "#components/materials/runtime/svg-canvas";
import { CUBE_FACES, drawCharacter, drawCube, drawFlag, FONT, makeOrthoCam, PALETTE } from "./draw";
import {
  blockWorldPos,
  buildScreenGraph,
  buildWorldGraph,
  findPath,
  ISO_PITCH,
  ISO_YAW,
  nodeKey,
  orthoProject,
  paintersOrder,
  parseKey,
  vec3,
  walkableNodes,
  type Block,
  type Group,
  type Vec3,
  type WalkNode,
} from "./engine";

// ---------------------------------------------------------------------------
// 레벨 데이터 (본문에서 검증한 그대로)
// ---------------------------------------------------------------------------

const GROUPS: Record<string, Group> = { crank: { pivot: vec3(6, 2, 4) } };
const BLOCKS: Block[] = [
  // 바닥 복도 (gray)
  { x: 0, y: 0, z: 0 },
  { x: 1, y: 0, z: 0 },
  { x: 2, y: 0, z: 0 },
  { x: 3, y: 0, z: 0 },
  { x: 4, y: 0, z: 0 },
  // 회전 다리 — crank 그룹 (purple)
  { x: 6, y: 2, z: 3, group: "crank" },
  { x: 6, y: 2, z: 4, group: "crank" },
  { x: 6, y: 2, z: 5, group: "crank" },
  // 도착 발판 (blue)
  { x: 6, y: 2, z: 6 },
  { x: 6, y: 2, z: 7 },
];
const START = vec3(0, 1, 0); // 캐릭터 시작 노드
const GOAL = vec3(6, 3, 7); // 깃발 노드

const GOAL_KEY = nodeKey(GOAL);
const START_BLOCK = Math.max(
  0,
  BLOCKS.findIndex((b) => b.x === START.x && b.y === START.y - 1 && b.z === START.z),
);
const GOAL_BLOCK = BLOCKS.findIndex((b) => b.x === GOAL.x && b.y === GOAL.y - 1 && b.z === GOAL.z);

const HALF_PI = Math.PI / 2;
const STEP_MS = 220; // 걷기 한 걸음
const SNAP_MS = 300; // 크랭크 스냅 애니메이션
const EPS = 0.05; // 화면공간 그래프 허용 오차

const colorOf = (b: Block): [string, string, string] =>
  b.group ? CUBE_FACES.purple : b.y > 0 ? CUBE_FACES.blue : CUBE_FACES.gray;

// 레벨 전체(회전 스윕 포함)가 화면에 들어가도록 투영 경계를 미리 계산해 둔다.
const BOUNDS = (() => {
  const pts: Vec3[] = [];
  for (const deg of [0, 90]) {
    const rad = (deg * Math.PI) / 180;
    for (const b of BLOCKS) {
      const p = blockWorldPos(b, GROUPS, { crank: rad });
      for (const dx of [0, 1]) {
        for (const dy of [0, 1]) {
          for (const dz of [0, 1]) pts.push(vec3(p.x + dx, p.y + dy, p.z + dz));
        }
      }
      pts.push(vec3(p.x + 0.5, p.y + 2, p.z + 0.5)); // 그 위에 선 캐릭터 머리 여유
    }
  }
  // 크랭크 회전 중 다리 끝이 지나는 원 궤적
  const pivot = GROUPS.crank.pivot;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const px = pivot.x + 2.3 * Math.cos(a);
    const pz = pivot.z + 2.3 * Math.sin(a);
    pts.push(vec3(px, pivot.y, pz), vec3(px, pivot.y + 1, pz));
  }
  pts.push(vec3(GOAL.x + 0.5, GOAL.y + 1, GOAL.z + 0.5)); // 깃발 꼭대기
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const v of pts) {
    const p = orthoProject(v, ISO_YAW, ISO_PITCH);
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, maxX, minY, maxY };
})();

// ---------------------------------------------------------------------------
// 컴포넌트
// ---------------------------------------------------------------------------

export const IllusionGameDemo = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<SvgCanvasHandle>(null);
  const [cleared, setCleared] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    interface WalkState {
      ids: string[]; // 지나는 노드 id들 (시작 포함)
      pts: Vec3[]; // 각 노드의 월드 좌표 (스냅 각도 기준)
      t0: number;
    }

    // 게임 상태 — 전부 이 객체(클로저) 안에서만 산다.
    const st = {
      angle: HALF_PI, // 현재 크랭크 각도 (라디안, 화면 표시용)
      snappedDeg: 90 as number | null, // 90° 배수에 스냅된 상태면 그 각도, 회전 중이면 null
      supportIdx: START_BLOCK, // 캐릭터가 서 있는 "받침 블록"의 인덱스
      walk: null as WalkState | null,
      snapAnim: null as { from: number; to: number; t0: number } | null,
      dragging: false,
      dragPointer: -1,
      dragOffset: 0,
      done: false,
      // 스냅 시점에 재계산되는 파생 상태
      nodes: [] as WalkNode[],
      graph: new Map<string, string[]>(),
      nodeToBlock: new Map<string, number>(),
      illusionEdges: [] as [Vec3, Vec3][],
      reachable: new Set<string>(),
      pathToGoal: false,
    };

    // 캔버스/카메라 배치 — 렌더 때 갱신하고 히트 테스트가 같이 쓴다.
    const cam = { tile: 24, ox: 0, oy: 0, dialX: 0, dialY: 0, dialR: 26 };
    const widthRef = { current: container.clientWidth };

    const snappedPositions = () => {
      const rad = ((st.snappedDeg ?? 0) * Math.PI) / 180;
      return BLOCKS.map((b) => blockWorldPos(b, GROUPS, { crank: rad }));
    };

    const charNodeId = () => {
      const p = snappedPositions()[st.supportIdx] ?? snappedPositions()[0];
      return nodeKey(vec3(p.x, p.y + 1, p.z));
    };

    // 스냅 완료 시에만 호출: 걷기 노드, 화면공간 그래프, 착시 엣지, 도달 집합 재계산
    const recompute = () => {
      const positions = snappedPositions();
      st.nodes = walkableNodes(positions);
      st.nodeToBlock = new Map();
      positions.forEach((p, i) => {
        st.nodeToBlock.set(nodeKey(vec3(p.x, p.y + 1, p.z)), i);
      });
      st.graph = buildScreenGraph(st.nodes, ISO_YAW, ISO_PITCH, EPS);

      // 화면 그래프에는 있는데 월드 그래프에는 없는 엣지 = 착시 엣지
      const world = buildWorldGraph(st.nodes);
      st.illusionEdges = [];
      const seen = new Set<string>();
      for (const [id, edges] of st.graph) {
        for (const e of edges) {
          const k = id < e ? `${id}|${e}` : `${e}|${id}`;
          if (seen.has(k)) continue;
          seen.add(k);
          if (!(world.get(id) ?? []).includes(e)) {
            st.illusionEdges.push([parseKey(id), parseKey(e)]);
          }
        }
      }

      // 캐릭터가 지금 갈 수 있는 노드들 (BFS)
      const from = charNodeId();
      st.reachable = new Set([from]);
      const queue = [from];
      while (queue.length > 0) {
        const cur = queue.shift()!;
        for (const next of st.graph.get(cur) ?? []) {
          if (!st.reachable.has(next)) {
            st.reachable.add(next);
            queue.push(next);
          }
        }
      }
      st.reachable.delete(from);
      st.pathToGoal = findPath(st.graph, from, GOAL_KEY) !== null;
    };
    recompute();

    // -- 입력 --------------------------------------------------------------

    const ptFromEvent = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const onPointerDown = (e: PointerEvent) => {
      if (st.done) return;
      const p = ptFromEvent(e);
      const toDial = Math.hypot(p.x - cam.dialX, p.y - cam.dialY);

      // 1) 다이얼 잡기 (걷는 중에는 크랭크 조작 불가)
      if (toDial <= cam.dialR + 14) {
        if (st.walk || st.snapAnim) return;
        e.preventDefault();
        st.dragging = true;
        st.dragPointer = e.pointerId;
        st.snappedDeg = null; // 회전 중 — 이동 잠금
        st.dragOffset = st.angle - Math.atan2(p.y - cam.dialY, p.x - cam.dialX);
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch {
          /* 캡처 실패해도 드래그는 동작한다 */
        }
        return;
      }

      // 2) 블록 클릭 이동 (스냅 상태에서만)
      if (st.snappedDeg === null || st.walk || st.snapAnim) return;
      let best = -1;
      let bestD = cam.tile * 0.7;
      for (let i = 0; i < st.nodes.length; i++) {
        const n = st.nodes[i];
        const q = orthoProject(vec3(n.pos.x + 0.5, n.pos.y, n.pos.z + 0.5), ISO_YAW, ISO_PITCH);
        const d = Math.hypot(cam.ox + q.x * cam.tile - p.x, cam.oy + q.y * cam.tile - p.y);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      if (best < 0) return;
      const target = st.nodes[best].id;
      const from = charNodeId();
      if (target === from) return;
      const path = findPath(st.graph, from, target);
      if (!path || path.length < 2) return;
      const byId = new Map(st.nodes.map((n) => [n.id, n.pos]));
      const pts: Vec3[] = [];
      for (const id of path) {
        const v = byId.get(id);
        if (!v) return;
        pts.push(v);
      }
      st.walk = { ids: path, pts, t0: performance.now() };
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!st.dragging || e.pointerId !== st.dragPointer) return;
      e.preventDefault();
      const p = ptFromEvent(e);
      // 다이얼 중심 기준 포인터 각도를 그대로 크랭크 각도로 (연속 회전)
      st.angle = Math.atan2(p.y - cam.dialY, p.x - cam.dialX) + st.dragOffset;
    };

    const endDrag = (e: PointerEvent) => {
      if (!st.dragging || e.pointerId !== st.dragPointer) return;
      st.dragging = false;
      st.dragPointer = -1;
      // 가장 가까운 90° 배수로 스냅
      const to = Math.round(st.angle / HALF_PI) * HALF_PI;
      st.snapAnim = { from: st.angle, to, t0: performance.now() };
    };

    // -- 렌더 루프 ----------------------------------------------------------

    const render = (now: number) => {
      // 스냅 애니메이션 진행
      if (st.snapAnim) {
        const el = Math.max(0, now - st.snapAnim.t0);
        const t = Math.min(1, el / SNAP_MS);
        const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
        st.angle = st.snapAnim.from + (st.snapAnim.to - st.snapAnim.from) * ease;
        if (t >= 1) {
          const deg = (((Math.round(st.snapAnim.to / HALF_PI) * 90) % 360) + 360) % 360;
          st.angle = (deg * Math.PI) / 180;
          st.snapAnim = null;
          st.snappedDeg = deg;
          recompute(); // 스냅 완료 시에만 그래프 재계산
        }
      }

      // 걷기 진행: 지나온 노드마다 받침 블록 인덱스를 갱신
      if (st.walk) {
        const el = Math.max(0, now - st.walk.t0);
        const total = st.walk.pts.length - 1;
        if (el / STEP_MS >= total) {
          const lastId = st.walk.ids[st.walk.ids.length - 1];
          st.supportIdx = st.nodeToBlock.get(lastId) ?? st.supportIdx;
          st.walk = null;
          recompute();
          if (lastId === GOAL_KEY && !st.done) {
            st.done = true;
            setCleared(true);
          }
        } else {
          const step = Math.min(total - 1, Math.max(0, Math.floor(el / STEP_MS)));
          st.supportIdx = st.nodeToBlock.get(st.walk.ids[step]) ?? st.supportIdx;
        }
      }

      // 캔버스 크기 (DPR 대응)
      const w = Math.max(300, widthRef.current || container.clientWidth || 300);
      const isMobile = w < 480;
      const h = isMobile ? 300 : 360;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = PALETTE.bg;
      ctx.fillRect(0, 0, w, h);

      // 카메라 배치: 레벨 전체가 들어가게 tile/origin 계산 (오른쪽은 다이얼 자리)
      const dialR = isMobile ? 22 : 26;
      cam.dialR = dialR;
      cam.dialX = w - dialR - 16;
      cam.dialY = h - dialR - 16;
      const padL = 14;
      const padT = 34;
      const padB = 16;
      const padR = dialR * 2 + 30;
      const spanX = BOUNDS.maxX - BOUNDS.minX;
      const spanY = BOUNDS.maxY - BOUNDS.minY;
      const tile = Math.max(6, Math.min((w - padL - padR) / spanX, (h - padT - padB) / spanY, 46));
      cam.tile = tile;
      cam.ox = padL + (w - padL - padR - spanX * tile) / 2 - BOUNDS.minX * tile;
      cam.oy = padT + (h - padT - padB - spanY * tile) / 2 - BOUNDS.minY * tile;
      const project = makeOrthoCam(ISO_YAW, ISO_PITCH, tile, cam.ox, cam.oy);

      // 현재 크랭크 각도를 반영한 블록 실좌표
      const positions = BLOCKS.map((b) => blockWorldPos(b, GROUPS, { crank: st.angle }));

      // 캐릭터 위치: 받침 블록 위 칸 (다리에 타고 있으면 크랭크와 함께 돈다)
      let charPos: Vec3;
      let walkAB: [Vec3, Vec3] | null = null; // 걷는 중인 스텝의 양 끝
      if (st.walk) {
        const el = Math.max(0, now - st.walk.t0);
        const total = st.walk.pts.length - 1;
        const step = Math.min(total - 1, Math.max(0, Math.floor(el / STEP_MS)));
        const t = Math.min(1, Math.max(0, (el - step * STEP_MS) / STEP_MS));
        const a = st.walk.pts[step];
        const b = st.walk.pts[step + 1];
        charPos = vec3(
          a.x + (b.x - a.x) * t,
          a.y + (b.y - a.y) * t + Math.sin(Math.PI * t) * 0.1, // 작은 총총걸음
          a.z + (b.z - a.z) * t,
        );
        walkAB = [a, b];
      } else {
        const bp = positions[Math.min(st.supportIdx, positions.length - 1)];
        charPos = vec3(bp.x, bp.y + 1, bp.z);
      }

      // 화가 알고리즘 + 캐릭터 depth 끼워넣기
      const depthOf = (v: Vec3) =>
        orthoProject(vec3(v.x + 0.5, v.y + 0.5, v.z + 0.5), ISO_YAW, ISO_PITCH).depth;
      // 착시 간선을 건너는 스텝에서는 양 끝 중 가까운 쪽 깊이를 쓴다.
      // 보간 깊이를 그대로 쓰면 걸음 중간에 다른 블록 앞으로 튀어나와 뚫는 것처럼 보인다.
      const charDepth =
        (walkAB ? Math.min(depthOf(walkAB[0]), depthOf(walkAB[1])) : depthOf(charPos)) - 0.4;
      const order = paintersOrder(positions, ISO_YAW, ISO_PITCH);
      const showHelpers = st.snappedDeg !== null && !st.walk && !st.done;

      let charDrawn = false;
      for (const i of order) {
        const bp = positions[i];
        const def = BLOCKS[i];
        if (!bp || !def) continue;
        if (!charDrawn && depthOf(bp) <= charDepth) {
          drawCharacter(ctx, project, charPos, tile);
          charDrawn = true;
        }
        drawCube(ctx, project, bp, colorOf(def));
        // 도달 가능한 노드의 윗면에 옅은 파란 하이라이트
        if (showHelpers && st.reachable.has(nodeKey(vec3(bp.x, bp.y + 1, bp.z)))) {
          const c = (dx: number, dz: number) => project(vec3(bp.x + dx, bp.y + 1, bp.z + dz));
          const quad = [c(0, 0), c(1, 0), c(1, 1), c(0, 1)];
          ctx.beginPath();
          ctx.moveTo(quad[0].x, quad[0].y);
          for (let k = 1; k < quad.length; k++) ctx.lineTo(quad[k].x, quad[k].y);
          ctx.closePath();
          ctx.fillStyle = "rgba(34,139,230,0.25)";
          ctx.fill();
        }
        if (i === GOAL_BLOCK) drawFlag(ctx, project, GOAL, tile);
      }
      if (!charDrawn) drawCharacter(ctx, project, charPos, tile);

      // 착시 엣지: 화면에서만 이어진 두 노드를 빨간 점선으로
      if (st.snappedDeg !== null) {
        for (const [a, b] of st.illusionEdges) {
          const pa = project(vec3(a.x + 0.5, a.y, a.z + 0.5));
          const pb = project(vec3(b.x + 0.5, b.y, b.z + 0.5));
          ctx.beginPath();
          ctx.setLineDash([5, 4]);
          ctx.moveTo(pa.x, pa.y);
          ctx.lineTo(pb.x, pb.y);
          ctx.strokeStyle = PALETTE.red;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.setLineDash([]);
          for (const q of [pa, pb]) {
            ctx.beginPath();
            ctx.arc(q.x, q.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = PALETTE.red;
            ctx.fill();
          }
        }
      }

      // HUD
      const degLive = ((Math.round((st.angle * 180) / Math.PI) % 360) + 360) % 360;
      let hud: string;
      if (st.done) hud = "클리어!";
      else if (st.walk) hud = `크랭크: ${st.snappedDeg ?? degLive}° · 이동 중…`;
      else if (st.snappedDeg === null) hud = `크랭크: ${degLive}° · 회전 중…`;
      else
        hud = `크랭크: ${st.snappedDeg}° · ${
          st.pathToGoal ? "경로 발견! 클릭해서 이동" : "목표까지 경로 없음"
        }`;
      ctx.font = `600 ${isMobile ? 12 : 13}px ${FONT}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(hud, 12, 10);

      // 크랭크 다이얼
      const disabled = st.walk !== null || st.done;
      ctx.globalAlpha = disabled ? 0.45 : 1;
      ctx.beginPath();
      ctx.arc(cam.dialX, cam.dialY, dialR, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.strokeStyle = st.dragging ? PALETTE.purple : PALETTE.border;
      ctx.lineWidth = st.dragging ? 2 : 1.5;
      ctx.stroke();
      for (let k = 0; k < 4; k++) {
        const a = k * HALF_PI - HALF_PI;
        ctx.beginPath();
        ctx.moveTo(cam.dialX + Math.cos(a) * (dialR - 5), cam.dialY + Math.sin(a) * (dialR - 5));
        ctx.lineTo(cam.dialX + Math.cos(a) * (dialR - 1), cam.dialY + Math.sin(a) * (dialR - 1));
        ctx.strokeStyle = PALETTE.gray;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      const ha = st.angle - HALF_PI; // 0°일 때 손잡이가 위를 향한다
      const hx = cam.dialX + Math.cos(ha) * dialR * 0.6;
      const hy = cam.dialY + Math.sin(ha) * dialR * 0.6;
      ctx.beginPath();
      ctx.moveTo(cam.dialX, cam.dialY);
      ctx.lineTo(hx, hy);
      ctx.strokeStyle = PALETTE.purple;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(hx, hy, 5, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.purple;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = `10px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillStyle = PALETTE.subtext;
      ctx.fillText("크랭크", cam.dialX, cam.dialY - dialR - 14);
      ctx.globalAlpha = 1;
    };

    let raf = 0;
    let disposed = false;
    const loop = (now: number) => {
      if (disposed) return;
      try {
        render(now);
      } catch {
        /* 렌더 예외로 루프가 죽지 않게 한다 */
      }
      raf = scheduleMaterialFrame(loop);
    };
    raf = scheduleMaterialFrame(loop);

    const ro = new ResizeObserver(() => {
      widthRef.current = container.clientWidth;
    });
    ro.observe(container);

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);

    return () => {
      disposed = true;
      cancelMaterialFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", endDrag);
      canvas.removeEventListener("pointercancel", endDrag);
    };
  }, [resetKey]);

  const reset = () => {
    setCleared(false);
    setResetKey((k) => k + 1);
  };

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
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <button style={btn} onClick={reset}>
          다시 하기
        </button>
      </div>
      <div ref={containerRef} style={{ position: "relative" }}>
        <SvgCanvas
          ref={canvasRef}
          style={{
            display: "block",
            width: "100%",
            touchAction: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        />
        {cleared && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,255,255,0.78)",
              borderRadius: 6,
            }}
          >
            <div style={{ fontSize: 26, fontWeight: 700, color: PALETTE.text }}>클리어!</div>
            <button style={btn} onClick={reset}>
              다시 하기
            </button>
          </div>
        )}
      </div>
      <p style={{ fontSize: 12, color: PALETTE.subtext, margin: "10px 0 0", lineHeight: 1.6 }}>
        다이얼을 돌려 다리를 잇고, 블록을 클릭해 캐릭터를 움직여보세요 — 3D에서 이 다리는 복도와
        만나지 않는다
      </p>
    </div>
  );
};
