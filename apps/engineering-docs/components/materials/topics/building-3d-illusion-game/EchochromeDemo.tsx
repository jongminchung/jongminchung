"use client";

import React, { useEffect, useRef, useState } from "react";
// 무한회랑(echochrome) 축소 재현: 세계는 고정, 카메라(yaw)를 드래그로 돌린다.
// 부재의 법칙 — 복도의 구멍은 화면에 보일 때만 존재한다.
// 기둥에 가려지면 없는 셈이 되어 건널 수 있고, 다시 보이는 순간 그 위의 캐릭터는 떨어진다.
import {
    cancelMaterialFrame,
    scheduleMaterialFrame,
} from "#components/materials/runtime/scheduler";
import {
    SvgCanvas,
    type SvgCanvasHandle,
} from "#components/materials/runtime/svg-canvas";
import {
    CUBE_FACES,
    drawCharacter,
    drawCube,
    drawFlag,
    FONT,
    makeOrthoCam,
    PALETTE,
} from "./draw";
import {
    buildScreenGraph,
    buildWorldGraph,
    findPath,
    ISO_PITCH,
    nodeKey,
    orthoProject,
    paintersOrder,
    parseKey,
    pointHidden,
    vec3,
    walkableNodes,
    type Vec3,
} from "./engine";

// ---------------------------------------------------------------------------
// 레벨 데이터 (실측 검증 완료)
// ---------------------------------------------------------------------------

const WALKWAY: Vec3[] = [0, 1, 2, 3, 4].map((x) => vec3(x, 0, 0)); // 회색 복도
// 노란 기둥. (3,·,3)에 두면 가림 창(약 10.5~27.5°)과 정렬 창(약 44~46°)이 분리되고,
// 45°에서 착시 이음새(복도 끝 → 도착 발판)의 화면 경로를 가로막지 않는다.
// (기둥이 이음새 위에 서 있으면 캐릭터가 벽을 뚫는 것처럼 보인다 — 실측으로 배치 검증)
const PILLAR: Vec3[] = [vec3(3, 0, 3), vec3(3, 1, 3), vec3(3, 2, 3)];
const GOAL_BLOCKS: Vec3[] = [vec3(7, 2, 2), vec3(7, 2, 3)]; // 파란 도착 발판
const ALL_BLOCKS: Vec3[] = [...WALKWAY, ...PILLAR, ...GOAL_BLOCKS];

const HOLE_BLOCK = vec3(2, 0, 0); // 이 블록 윗면에 구멍이 뚫려 있다
const HOLE_NODE = vec3(2, 1, 0); // 구멍 노드 — 보이면 지나갈 수 없다
const HOLE_POINT = vec3(2.5, 1, 0.5); // 가림 판정에 쓰는 구멍 중심점
const START = vec3(0, 1, 0);
const GOAL = vec3(7, 3, 3);

const HOLE_KEY = nodeKey(HOLE_NODE);
const GOAL_KEY = nodeKey(GOAL);
const HOLE_INDEX = ALL_BLOCKS.findIndex(
    (b) => b.x === HOLE_BLOCK.x && b.y === HOLE_BLOCK.y && b.z === HOLE_BLOCK.z,
);
const GOAL_SUPPORT_INDEX = ALL_BLOCKS.findIndex(
    (b) => b.x === GOAL.x && b.y === GOAL.y - 1 && b.z === GOAL.z,
);
// 구멍 자체가 뚫린 블록은 구멍을 가릴 수 없다
const OCCLUDERS = ALL_BLOCKS.filter((_, i) => i !== HOLE_INDEX);
// 걷기 노드 후보는 yaw와 무관 — 한 번만 계산해 두고 매 프레임 필터만 한다
const BASE_NODES = walkableNodes(ALL_BLOCKS);

const facesOf = (i: number): [string, string, string] =>
    i < WALKWAY.length
        ? CUBE_FACES.gray
        : i < WALKWAY.length + PILLAR.length
          ? CUBE_FACES.yellow
          : CUBE_FACES.blue;

const STEP_MS = 220; // 걷기 한 걸음
const FALL_MS = 500; // 낙하 애니메이션
const SNAP_MS = 250; // 45° 자석 스냅
const EPS = 0.05; // 화면공간 그래프 허용 오차
const YAW_MIN = 5;
const YAW_MAX = 85;
const YAW_INIT = 34; // 두 "가능의 창"(10.5~27.5°, 44~46°) 사이에서 시작한다
const SNAP_DEG = 45; // 착시 정렬 각도
const SNAP_RANGE = 4; // 이 안에서 손을 놓으면 흡착
const DEG_PER_PX = 0.4; // 드래그 감도

// 레벨 전체(x 0~8, y 0~4, z 0~4 + 머리 여유)가 yaw 5~85° 전 구간에서
// 화면에 들어가도록 투영 경계를 미리 계산해 둔다.
const BOUNDS = (() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let deg = YAW_MIN; deg <= YAW_MAX; deg += 1) {
        const yaw = (deg * Math.PI) / 180;
        for (const x of [0, 8]) {
            for (const y of [0, 4.3]) {
                for (const z of [0, 4]) {
                    const p = orthoProject(vec3(x, y, z), yaw, ISO_PITCH);
                    minX = Math.min(minX, p.x);
                    maxX = Math.max(maxX, p.x);
                    minY = Math.min(minY, p.y);
                    maxY = Math.max(maxY, p.y);
                }
            }
        }
    }
    return { minX, maxX, minY, maxY };
})();

// ---------------------------------------------------------------------------
// 컴포넌트
// ---------------------------------------------------------------------------

export const EchochromeDemo = () => {
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

        // 게임 상태 — 전부 이 클로저 안에서만 산다.
        const st = {
            yaw: YAW_INIT, // 도(degree). pitch는 ISO_PITCH 고정.
            dragging: false,
            dragPointer: -1,
            lastX: 0,
            moved: 0, // 드래그 vs 탭 판별용 누적 이동량
            snapAnim: null as { from: number; to: number; t0: number } | null,
            charNode: vec3(START.x, START.y, START.z), // 캐릭터가 서 있는 노드
            walk: null as { ids: string[]; step: number; t0: number } | null,
            fall: null as { pos: Vec3; t0: number } | null,
            done: false,
            // 매 프레임 현재 yaw로 재계산되는 파생 상태
            holeHidden: false,
            reachable: new Set<string>(), // 캐릭터가 지금 갈 수 있는 노드 (하이라이트용)
            nodes: BASE_NODES,
            graph: new Map<string, string[]>(),
            illusionEdges: [] as [Vec3, Vec3][],
        };

        // 캔버스/카메라 배치 — 렌더가 갱신하고 클릭 히트 테스트가 같이 쓴다.
        const cam = { tile: 24, ox: 0, oy: 0 };
        const widthRef = { current: container.clientWidth };

        // 부재의 법칙: 구멍이 가려졌으면 구멍 노드가 존재하고, 보이면 없다.
        const recompute = () => {
            const yawRad = (st.yaw * Math.PI) / 180;
            st.holeHidden = pointHidden(
                HOLE_POINT,
                OCCLUDERS,
                yawRad,
                ISO_PITCH,
            );
            st.nodes = st.holeHidden
                ? BASE_NODES
                : BASE_NODES.filter((n) => n.id !== HOLE_KEY);
            st.graph = buildScreenGraph(st.nodes, yawRad, ISO_PITCH, EPS);

            // 화면 그래프에는 있는데 월드 그래프에는 없는 간선 = 착시 간선
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

            // 캐릭터 위치에서 지금 갈 수 있는 노드들 (BFS 플러드)
            st.reachable = new Set([nodeKey(st.charNode)]);
            const queue = [nodeKey(st.charNode)];
            while (queue.length > 0) {
                const cur = queue.shift()!;
                for (const next of st.graph.get(cur) ?? []) {
                    if (!st.reachable.has(next)) {
                        st.reachable.add(next);
                        queue.push(next);
                    }
                }
            }
        };
        recompute();

        // -- 입력 --------------------------------------------------------------

        const ptFromEvent = (e: PointerEvent) => {
            const r = canvas.getBoundingClientRect();
            return { x: e.clientX - r.left, y: e.clientY - r.top };
        };

        const onPointerDown = (e: PointerEvent) => {
            if (st.done || st.dragging) return;
            e.preventDefault();
            const p = ptFromEvent(e);
            st.dragging = true;
            st.dragPointer = e.pointerId;
            st.lastX = p.x;
            st.moved = 0;
            st.snapAnim = null; // 손을 대면 흡착 중단 — 카메라는 언제나 플레이어 것
            try {
                canvas.setPointerCapture(e.pointerId);
            } catch {
                /* 캡처 실패해도 드래그는 동작한다 */
            }
        };

        const onPointerMove = (e: PointerEvent) => {
            if (!st.dragging || e.pointerId !== st.dragPointer) return;
            e.preventDefault();
            const p = ptFromEvent(e);
            const dx = p.x - st.lastX;
            st.lastX = p.x;
            st.moved += Math.abs(dx);
            // 오른쪽으로 끌면 세계가 오른쪽으로 도는 "잡아 돌리기" 감각
            st.yaw = Math.min(
                YAW_MAX,
                Math.max(YAW_MIN, st.yaw - dx * DEG_PER_PX),
            );
        };

        // 탭(거의 안 움직인 포인터)이면 클릭 이동으로 처리
        const handleClick = (px: number, py: number) => {
            if (st.walk || st.fall || st.done) return;
            const yawRad = (st.yaw * Math.PI) / 180;
            let best = -1;
            let bestD = cam.tile * 0.7;
            for (let i = 0; i < st.nodes.length; i++) {
                const n = st.nodes[i]!;
                const q = orthoProject(
                    vec3(n.pos.x + 0.5, n.pos.y, n.pos.z + 0.5),
                    yawRad,
                    ISO_PITCH,
                );
                const d = Math.hypot(
                    cam.ox + q.x * cam.tile - px,
                    cam.oy + q.y * cam.tile - py,
                );
                if (d < bestD) {
                    bestD = d;
                    best = i;
                }
            }
            if (best < 0) return;
            const target = st.nodes[best]!.id;
            const from = nodeKey(st.charNode);
            if (target === from) return;
            const path = findPath(st.graph, from, target);
            if (!path || path.length < 2) return;
            st.walk = { ids: path, step: 0, t0: performance.now() };
        };

        const endDrag = (e: PointerEvent) => {
            if (!st.dragging || e.pointerId !== st.dragPointer) return;
            st.dragging = false;
            st.dragPointer = -1;
            const p = ptFromEvent(e);
            if (st.moved < 5) handleClick(p.x, p.y);
            // 자석 스냅: 착시 정렬 구간(±1.5°)은 맨손으론 고문이라 45° 근처에서 흡착
            if (
                Math.abs(st.yaw - SNAP_DEG) <= SNAP_RANGE &&
                st.yaw !== SNAP_DEG
            ) {
                st.snapAnim = {
                    from: st.yaw,
                    to: SNAP_DEG,
                    t0: performance.now(),
                };
            }
        };

        // -- 렌더 루프 ----------------------------------------------------------

        const render = (now: number) => {
            // 자석 스냅 진행
            if (st.snapAnim) {
                const el = Math.max(0, now - st.snapAnim.t0);
                const t = Math.min(1, el / SNAP_MS);
                const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
                st.yaw =
                    st.snapAnim.from +
                    (st.snapAnim.to - st.snapAnim.from) * ease;
                if (t >= 1) {
                    st.yaw = st.snapAnim.to;
                    st.snapAnim = null;
                }
            }

            // 매 프레임 현재 yaw로 판정 — 걷는 중에도 세계가 바뀐다
            recompute();
            const yawRad = (st.yaw * Math.PI) / 180;

            // 걷기 진행: 스텝이 끝날 때마다 다음 간선이 아직 존재하는지 확인
            if (st.walk && !st.fall) {
                let guard = 0;
                while (st.walk && guard++ < 64) {
                    const el = Math.max(0, now - st.walk.t0);
                    if (el < STEP_MS) break;
                    const arriveId = st.walk.ids[st.walk.step + 1];
                    if (!arriveId) {
                        st.walk = null;
                        break;
                    }
                    st.charNode = parseKey(arriveId);
                    st.walk.step += 1;
                    st.walk.t0 += STEP_MS;
                    if (st.walk.step >= st.walk.ids.length - 1) {
                        st.walk = null;
                        if (arriveId === GOAL_KEY && !st.done) {
                            st.done = true;
                            setCleared(true);
                        }
                        break;
                    }
                    const from = st.walk.ids[st.walk.step]!;
                    const to = st.walk.ids[st.walk.step + 1];
                    if (!to || !(st.graph.get(from) ?? []).includes(to)) {
                        st.walk = null; // 간선이 사라졌다 — 그 자리에 멈춘다
                        break;
                    }
                }
            }

            // 캐릭터 위치
            let charPos: Vec3;
            let charAlpha = 1;
            let walkAB: [Vec3, Vec3] | null = null; // 걷는 중인 스텝의 양 끝 노드
            if (st.fall) {
                const t = Math.min(1, Math.max(0, now - st.fall.t0) / FALL_MS);
                charPos = vec3(
                    st.fall.pos.x,
                    st.fall.pos.y - t * t * 1.8,
                    st.fall.pos.z,
                );
                charAlpha = 1 - t;
                if (t >= 1) {
                    st.fall = null;
                    st.charNode = vec3(START.x, START.y, START.z);
                    charPos = st.charNode;
                    charAlpha = 1;
                }
            } else if (st.walk) {
                const el = Math.max(0, now - st.walk.t0);
                const a = parseKey(
                    st.walk.ids[st.walk.step] ?? nodeKey(st.charNode),
                );
                const b = parseKey(
                    st.walk.ids[st.walk.step + 1] ??
                        st.walk.ids[st.walk.step] ??
                        nodeKey(st.charNode),
                );
                const t = Math.min(1, el / STEP_MS);
                charPos = vec3(
                    a.x + (b.x - a.x) * t,
                    a.y + (b.y - a.y) * t + Math.sin(Math.PI * t) * 0.1, // 작은 총총걸음
                    a.z + (b.z - a.z) * t,
                );
                walkAB = [a, b];
            } else {
                charPos = st.charNode;
            }

            // 부재의 법칙의 이빨: 구멍이 다시 보이는데 그 위에 있으면 떨어진다
            if (!st.done && !st.fall && !st.holeHidden) {
                const onHole = !st.walk && nodeKey(st.charNode) === HOLE_KEY;
                const walkingOnHole =
                    st.walk !== null &&
                    (st.walk.ids[st.walk.step] === HOLE_KEY ||
                        st.walk.ids[st.walk.step + 1] === HOLE_KEY);
                if (onHole || walkingOnHole) {
                    st.fall = { pos: charPos, t0: now };
                    st.walk = null;
                }
            }

            // 캔버스 크기 (DPR 대응)
            const w = Math.max(
                300,
                widthRef.current || container.clientWidth || 300,
            );
            const isMobile = w < 480;
            const h = isMobile ? 280 : 340;
            const dpr = window.devicePixelRatio || 1;
            if (
                canvas.width !== Math.round(w * dpr) ||
                canvas.height !== Math.round(h * dpr)
            ) {
                canvas.width = Math.round(w * dpr);
                canvas.height = Math.round(h * dpr);
                canvas.style.width = `${w}px`;
                canvas.style.height = `${h}px`;
            }
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = PALETTE.bg;
            ctx.fillRect(0, 0, w, h);

            // 카메라 배치: 사전 계산한 경계로 전 yaw 구간에서 레벨이 들어간다
            const padL = 14;
            const padT = 34;
            const padB = 16;
            const padR = 14;
            const spanX = BOUNDS.maxX - BOUNDS.minX;
            const spanY = BOUNDS.maxY - BOUNDS.minY;
            const tile = Math.max(
                6,
                Math.min(
                    (w - padL - padR) / spanX,
                    (h - padT - padB) / spanY,
                    44,
                ),
            );
            cam.tile = tile;
            cam.ox =
                padL +
                (w - padL - padR - spanX * tile) / 2 -
                BOUNDS.minX * tile;
            cam.oy =
                padT +
                (h - padT - padB - spanY * tile) / 2 -
                BOUNDS.minY * tile;
            const project = makeOrthoCam(
                yawRad,
                ISO_PITCH,
                tile,
                cam.ox,
                cam.oy,
            );

            // 화가 알고리즘 + 캐릭터 depth 끼워넣기
            const depthOf = (v: Vec3) =>
                orthoProject(
                    vec3(v.x + 0.5, v.y + 0.5, v.z + 0.5),
                    yawRad,
                    ISO_PITCH,
                ).depth;
            // 카메라 쪽 바이어스(-0.4)에 더해, 착시 간선을 건너는 스텝에서는
            // 양 끝 노드 중 카메라에 가까운 쪽의 깊이를 쓴다. 보간된 깊이를 그대로 쓰면
            // 걸음 중간에 캐릭터가 다른 블록(기둥)의 깊이를 통과하는 순간
            // 그 앞으로 튀어나와 벽을 뚫는 것처럼 보인다.
            const charDepth =
                (walkAB
                    ? Math.min(depthOf(walkAB[0]), depthOf(walkAB[1]))
                    : depthOf(charPos)) - 0.4;
            const order = paintersOrder(ALL_BLOCKS, yawRad, ISO_PITCH);

            const paintCharacter = () => {
                const prev = ctx.globalAlpha;
                ctx.globalAlpha = Math.max(0, charAlpha);
                drawCharacter(ctx, project, charPos, tile);
                ctx.globalAlpha = prev;
            };

            let charDrawn = false;
            for (const i of order) {
                const bp = ALL_BLOCKS[i];
                if (!bp) continue;
                if (!charDrawn && depthOf(bp) <= charDepth) {
                    paintCharacter();
                    charDrawn = true;
                }
                drawCube(ctx, project, bp, facesOf(i));
                // 이동 가능 하이라이트: 이 블록 위 칸이 지금 갈 수 있는 노드면 윗면을 파랗게.
                // 블록을 그린 직후 칠하므로 화가 순서를 그대로 따른다 (기둥 뒤 칸은 기둥에 가려진다).
                if (!st.done && !st.fall) {
                    const aboveId = nodeKey(vec3(bp.x, bp.y + 1, bp.z));
                    if (
                        st.reachable.has(aboveId) &&
                        aboveId !== nodeKey(st.charNode)
                    ) {
                        const q = [
                            project(vec3(bp.x, bp.y + 1, bp.z)),
                            project(vec3(bp.x + 1, bp.y + 1, bp.z)),
                            project(vec3(bp.x + 1, bp.y + 1, bp.z + 1)),
                            project(vec3(bp.x, bp.y + 1, bp.z + 1)),
                        ];
                        ctx.beginPath();
                        ctx.moveTo(q[0]!.x, q[0]!.y);
                        for (let k = 1; k < 4; k++)
                            ctx.lineTo(q[k]!.x, q[k]!.y);
                        ctx.closePath();
                        ctx.fillStyle = "rgba(34, 139, 230, 0.28)";
                        ctx.fill();
                    }
                }
                // 구멍: 블록을 그린 직후 그 윗면에 그린다.
                // 기둥이 나중에(더 가까이) 그려지면 자연스럽게 덮인다 —
                // 화가 알고리즘의 그리기 순서가 곧 부재 판정과 일치한다.
                if (i === HOLE_INDEX) {
                    const cen = project(
                        vec3(
                            HOLE_BLOCK.x + 0.5,
                            HOLE_BLOCK.y + 1,
                            HOLE_BLOCK.z + 0.5,
                        ),
                    );
                    const ex = project(
                        vec3(
                            HOLE_BLOCK.x + 1.5,
                            HOLE_BLOCK.y + 1,
                            HOLE_BLOCK.z + 0.5,
                        ),
                    );
                    const ez = project(
                        vec3(
                            HOLE_BLOCK.x + 0.5,
                            HOLE_BLOCK.y + 1,
                            HOLE_BLOCK.z + 1.5,
                        ),
                    );
                    ctx.save();
                    // 윗면 마름모의 기저 벡터로 변환해 그리면 어떤 yaw에서도 면에 딱 붙는 타원이 된다
                    ctx.transform(
                        ex.x - cen.x,
                        ex.y - cen.y,
                        ez.x - cen.x,
                        ez.y - cen.y,
                        cen.x,
                        cen.y,
                    );
                    ctx.beginPath();
                    // 판정은 구멍 중심점으로 하므로, 타원을 중심 근처로 좁혀야
                    // "가려졌다" 판정과 실제로 안 보이는 상태가 눈에도 일치한다
                    ctx.arc(0, 0, 0.21, 0, Math.PI * 2);
                    ctx.restore();
                    ctx.fillStyle = "#343a40";
                    ctx.fill();
                }
                if (i === GOAL_SUPPORT_INDEX)
                    drawFlag(ctx, project, GOAL, tile);
            }
            if (!charDrawn) paintCharacter();

            // 착시 간선: 화면에서만 이어진 두 노드를 빨간 점선으로
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

            // HUD — 우선순위: 정렬 > 가려짐 > 기본
            const deg = Math.round(st.yaw);
            let hud: string;
            const canReachGoal = st.reachable.has(GOAL_KEY);
            if (st.done) hud = "클리어!";
            else if (canReachGoal)
                hud = `yaw ${deg}° · 목표까지 길이 이어졌다 — 클릭해서 이동!`;
            else if (st.holeHidden)
                hud =
                    st.charNode.x > HOLE_NODE.x
                        ? `yaw ${deg}° · 구멍은 건넜다 — 이제 45° 근처로 돌려 다리를 놓자`
                        : `yaw ${deg}° · 구멍이 가려져 없는 셈이 됐다 — 파란 칸을 클릭해 미리 건너두자`;
            else if (st.illusionEdges.length > 0)
                hud = `yaw ${deg}° · 다리는 놓였는데 구멍이 길을 막는다 — 먼저 구멍부터`;
            else
                hud = `yaw ${deg}° · 길이 끊겨 있다 — 시점을 돌려 구멍을 가리거나 다리를 이어보자`;
            ctx.font = `600 ${isMobile ? 12 : 13}px ${FONT}`;
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            ctx.fillStyle = PALETTE.text;
            ctx.fillText(hud, 12, 10);

            canvas.style.cursor = st.dragging ? "grabbing" : "grab";
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
            <div
                style={{
                    display: "flex",
                    gap: 8,
                    marginBottom: 12,
                    alignItems: "center",
                }}
            >
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
                        cursor: "grab",
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
                        <div
                            style={{
                                fontSize: 26,
                                fontWeight: 700,
                                color: PALETTE.text,
                            }}
                        >
                            클리어!
                        </div>
                        <button style={btn} onClick={reset}>
                            다시 하기
                        </button>
                    </div>
                )}
            </div>
            <p
                style={{
                    fontSize: 12,
                    color: PALETTE.subtext,
                    margin: "10px 0 0",
                    lineHeight: 1.6,
                }}
            >
                드래그로 시점을 돌려보세요 — 구멍은 가려지면 없는 것이고, 길은
                이어져 보이면 이어진 것이다
            </p>
        </div>
    );
};
