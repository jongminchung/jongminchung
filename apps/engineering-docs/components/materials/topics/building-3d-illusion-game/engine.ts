// 3D 착시 게임 엔진 — 본문에서 만드는 바로 그 코드.
// 투영, 화면공간 인접 그래프, 길찾기, 그리기 순서까지 게임 로직 전부가 여기 있다.
// 데모 컴포넌트들은 이 엔진을 import해서 그대로 돌린다.

// ---------------------------------------------------------------------------
// 벡터와 회전
// ---------------------------------------------------------------------------

export interface Vec3 {
    x: number; // 오른쪽
    y: number; // 위
    z: number; // 화면 안쪽
}

export const vec3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

// y축(수직축) 중심 회전. 위에서 내려다봤을 때 시계 방향.
export function rotateY(v: Vec3, angle: number): Vec3 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return { x: v.x * c - v.z * s, y: v.y, z: v.x * s + v.z * c };
}

// x축(가로축) 중심 회전. 카메라를 위아래로 기울일 때 쓴다.
export function rotateX(v: Vec3, angle: number): Vec3 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c };
}

// ---------------------------------------------------------------------------
// 투영: 3D 점 하나를 화면 위 2D 점으로 만든다
// ---------------------------------------------------------------------------

export interface Projected {
    x: number; // 화면 가로 (타일 단위)
    y: number; // 화면 세로 (타일 단위, 아래로 증가)
    depth: number; // 카메라로부터의 깊이 (클수록 멀다) — 그리기 순서에 쓴다
}

// 카메라 방향으로 세계를 돌려 눕힌다. yaw는 좌우 회전, pitch는 내려다보는 각도.
export function viewTransform(v: Vec3, yaw: number, pitch: number): Vec3 {
    return rotateX(rotateY(v, yaw), pitch);
}

// 평행 투영(직교 투영): 깊이를 그냥 버린다. 멀어도 작아지지 않는다.
export function orthoProject(v: Vec3, yaw: number, pitch: number): Projected {
    const t = viewTransform(v, yaw, pitch);
    return { x: t.x, y: -t.y, depth: -t.z };
}

// 원근 투영: 깊이로 나눈다. 멀수록 작게 보인다.
// camDist는 카메라와 원점 사이 거리. 반환된 scale은 그 점에서의 축소 배율.
export function perspectiveProject(
    v: Vec3,
    yaw: number,
    pitch: number,
    camDist: number,
): Projected & { scale: number } {
    const t = viewTransform(v, yaw, pitch);
    const d = camDist - t.z; // 카메라에서 이 점까지의 깊이
    const scale = camDist / Math.max(d, 0.001);
    return { x: t.x * scale, y: -t.y * scale, depth: -t.z, scale };
}

// 게임에서 쓰는 고전 아이소메트릭 카메라 각도.
// yaw 45도 + 내려다보기 약 35.26도(atan(1/√2)). 이 각도에서 정육면체의
// 세 면이 같은 넓이로 보이고, x·y·z 세 축이 화면에서 정확히 120도로 벌어진다.
export const ISO_YAW = Math.PI / 4;
export const ISO_PITCH = Math.atan(1 / Math.SQRT2);

// ---------------------------------------------------------------------------
// 블록 월드: 정수 격자 위의 육면체들
// ---------------------------------------------------------------------------

// 블록 하나. (x, y, z) 격자 칸을 차지하는 정육면체.
// group이 있으면 크랭크로 함께 회전하는 덩어리에 속한다.
export interface Block {
    x: number;
    y: number;
    z: number;
    group?: string;
}

// 회전 그룹: pivot을 중심으로 y축 회전한다.
export interface Group {
    pivot: Vec3;
}

export interface LevelDef {
    blocks: Block[];
    groups?: Record<string, Group>;
    start: Vec3; // 캐릭터가 서는 칸 (블록 위 칸)
    goal: Vec3;
}

// 그룹 회전을 반영한 블록의 실제 월드 좌표.
// rotations는 그룹 이름 → 회전각(라디안).
export function blockWorldPos(
    b: Block,
    groups: Record<string, Group> | undefined,
    rotations: Record<string, number>,
): Vec3 {
    if (!b.group || !groups?.[b.group]) return vec3(b.x, b.y, b.z);
    const g = groups[b.group]!;
    const angle = rotations[b.group] ?? 0;
    const rel = vec3(b.x - g.pivot.x, b.y - g.pivot.y, b.z - g.pivot.z);
    const r = rotateY(rel, angle);
    return vec3(
        Math.round((r.x + g.pivot.x) * 1000) / 1000,
        Math.round((r.y + g.pivot.y) * 1000) / 1000,
        Math.round((r.z + g.pivot.z) * 1000) / 1000,
    );
}

// ---------------------------------------------------------------------------
// 걷기 노드: 캐릭터가 설 수 있는 칸
// ---------------------------------------------------------------------------

// 노드는 "블록 바로 위의 빈 칸"이다. 블록 위에 다른 블록이 있으면 설 수 없다.
export interface WalkNode {
    id: string;
    pos: Vec3; // 캐릭터가 서는 칸의 좌표 (받침 블록 좌표 + y 1)
}

const keyOf = (v: Vec3) => `${v.x},${v.y},${v.z}`;

export function walkableNodes(blockPositions: Vec3[]): WalkNode[] {
    const occupied = new Set(blockPositions.map(keyOf));
    const nodes: WalkNode[] = [];
    for (const b of blockPositions) {
        const above = vec3(b.x, b.y + 1, b.z);
        if (!occupied.has(keyOf(above))) {
            nodes.push({ id: keyOf(above), pos: above });
        }
    }
    return nodes;
}

// ---------------------------------------------------------------------------
// 핵심: 화면공간 인접 그래프
// ---------------------------------------------------------------------------

// 4방향 한 칸 이동 (수평)
const DIRS: Vec3[] = [
    vec3(1, 0, 0),
    vec3(-1, 0, 0),
    vec3(0, 0, 1),
    vec3(0, 0, -1),
];

// 두 노드를 잇는 규칙은 단 하나다.
// "A의 이웃 칸이 있어야 할 화면 위치에, 어떤 노드 B가 보이면 연결한다."
// 3D에서 실제로 붙어 있는 이웃은 이 규칙의 특수한 경우일 뿐이다.
// (투영은 선형이라, 진짜 이웃 B = A + d는 정확히 그 위치에 투영된다)
export function buildScreenGraph(
    nodes: WalkNode[],
    yaw: number,
    pitch: number,
    epsilon = 0.05, // 화면에서 이 거리(타일 단위) 안에 있으면 "같은 자리"로 본다
): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    const projected = nodes.map((n) => orthoProject(n.pos, yaw, pitch));

    for (let i = 0; i < nodes.length; i++) {
        const edges: string[] = [];
        for (const d of DIRS) {
            // A의 이웃 칸이 화면 어디에 보여야 하는지 계산하고,
            const target = orthoProject(
                vec3(
                    nodes[i]!.pos.x + d.x,
                    nodes[i]!.pos.y + d.y,
                    nodes[i]!.pos.z + d.z,
                ),
                yaw,
                pitch,
            );
            // 그 자리에 보이는 노드를 찾는다. 3D 거리는 따지지 않는다.
            let found = -1;
            for (let j = 0; j < nodes.length; j++) {
                if (j === i) continue;
                const dx = projected[j]!.x - target.x;
                const dy = projected[j]!.y - target.y;
                if (Math.hypot(dx, dy) < epsilon) {
                    // 같은 자리에 여러 노드가 겹쳐 보이면 카메라에 가까운 쪽이 이긴다
                    if (
                        found < 0 ||
                        projected[j]!.depth < projected[found]!.depth
                    )
                        found = j;
                }
            }
            if (found >= 0) edges.push(nodes[found]!.id);
        }
        graph.set(nodes[i]!.id, edges);
    }
    return graph;
}

// 비교용: 화면을 보지 않고 3D 좌표로만 잇는 "정직한" 그래프
export function buildWorldGraph(nodes: WalkNode[]): Map<string, string[]> {
    const byKey = new Map(nodes.map((n) => [n.id, n]));
    const graph = new Map<string, string[]>();
    for (const n of nodes) {
        const edges: string[] = [];
        for (const d of DIRS) {
            const neighbor = keyOf(
                vec3(n.pos.x + d.x, n.pos.y + d.y, n.pos.z + d.z),
            );
            if (byKey.has(neighbor)) edges.push(neighbor);
        }
        graph.set(n.id, edges);
    }
    return graph;
}

// ---------------------------------------------------------------------------
// 길찾기: 그래프 위 너비 우선 탐색(BFS)
// ---------------------------------------------------------------------------

export function findPath(
    graph: Map<string, string[]>,
    from: string,
    to: string,
): string[] | null {
    if (from === to) return [from];
    const cameFrom = new Map<string, string>([[from, from]]);
    const queue = [from];
    while (queue.length > 0) {
        const cur = queue.shift()!;
        for (const next of graph.get(cur) ?? []) {
            if (cameFrom.has(next)) continue;
            cameFrom.set(next, cur);
            if (next === to) {
                // 도착. 왔던 길을 거슬러 올라가 경로를 복원한다.
                const path = [to];
                let p = to;
                while (p !== from) {
                    p = cameFrom.get(p)!;
                    path.push(p);
                }
                return path.reverse();
            }
            queue.push(next);
        }
    }
    return null; // 길이 없다
}

// ---------------------------------------------------------------------------
// 그리기 순서: 화가 알고리즘
// ---------------------------------------------------------------------------

// 깊이가 큰(먼) 블록부터 그리면 가까운 블록이 자연스럽게 그 위를 덮는다.
export function paintersOrder(
    positions: Vec3[],
    yaw: number,
    pitch: number,
): number[] {
    const depths = positions.map(
        (p) =>
            orthoProject(vec3(p.x + 0.5, p.y + 0.5, p.z + 0.5), yaw, pitch)
                .depth,
    );
    return positions.map((_, i) => i).sort((a, b) => depths[b]! - depths[a]!); // 먼 것부터
}

// ---------------------------------------------------------------------------
// 유틸: 노드 id ↔ 좌표
// ---------------------------------------------------------------------------

export const nodeKey = keyOf;

export function parseKey(id: string): Vec3 {
    const [x, y, z] = id.split(",").map(Number);
    return vec3(x!, y!, z!);
}

// ---------------------------------------------------------------------------
// 부재의 법칙: 가림 판정 (무한회랑)
// ---------------------------------------------------------------------------

// 점(px, py)이 다각형 안에 있는가. even-odd 레이캐스팅.
function pointInPolygon(
    px: number,
    py: number,
    poly: { x: number; y: number }[],
): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i]!.x;
        const yi = poly[i]!.y;
        const xj = poly[j]!.x;
        const yj = poly[j]!.y;
        if (
            yi > py !== yj > py &&
            px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
        )
            inside = !inside;
    }
    return inside;
}

// 단위 큐브의 여섯 면 (꼭짓점 오프셋)
const UNIT_FACES: [number, number, number][][] = [
    [
        [0, 1, 0],
        [0, 1, 1],
        [1, 1, 1],
        [1, 1, 0],
    ], // +y
    [
        [0, 0, 0],
        [1, 0, 0],
        [1, 0, 1],
        [0, 0, 1],
    ], // -y
    [
        [1, 0, 0],
        [1, 1, 0],
        [1, 1, 1],
        [1, 0, 1],
    ], // +x
    [
        [0, 0, 0],
        [0, 0, 1],
        [0, 1, 1],
        [0, 1, 0],
    ], // -x
    [
        [0, 0, 1],
        [1, 0, 1],
        [1, 1, 1],
        [0, 1, 1],
    ], // +z
    [
        [0, 0, 0],
        [0, 1, 0],
        [1, 1, 0],
        [1, 0, 0],
    ], // -z
];

// 이 블록이 화면에서 이 점을 가리는가.
// 조건은 둘: 블록이 점보다 카메라에 가깝고, 점의 투영이 블록 실루엣 안에 있다.
export function blockCovers(
    block: Vec3,
    point: Vec3,
    yaw: number,
    pitch: number,
): boolean {
    const p = orthoProject(point, yaw, pitch);
    const center = orthoProject(
        vec3(block.x + 0.5, block.y + 0.5, block.z + 0.5),
        yaw,
        pitch,
    );
    if (center.depth >= p.depth - 0.05) return false; // 점 뒤에 있는 블록은 가릴 수 없다
    for (const face of UNIT_FACES) {
        const quad = face.map(([dx, dy, dz]) =>
            orthoProject(
                vec3(block.x + dx, block.y + dy, block.z + dz),
                yaw,
                pitch,
            ),
        );
        if (pointInPolygon(p.x, p.y, quad)) return true;
    }
    return false;
}

// 점이 블록 무리 중 하나에라도 가려져 있는가.
export function pointHidden(
    point: Vec3,
    blocks: Vec3[],
    yaw: number,
    pitch: number,
): boolean {
    return blocks.some((b) => blockCovers(b, point, yaw, pitch));
}

// ---------------------------------------------------------------------------
// 펜로즈 삼각형: 불가능 도형의 3D 정체
// ---------------------------------------------------------------------------

// 큐브를 x축으로 n개, y축으로 n개, z축으로 n개 이어 붙인 ㄷ자 구조물.
// 3D에서 시작점 (0,0,0)과 끝점 (n,n,n)은 공간 대각선만큼 떨어져 있지만,
// 아이소메트릭 각도에서는 정확히 같은 화면 위치에 투영된다.
export function penroseCubes(n: number): Vec3[] {
    const cubes: Vec3[] = [];
    for (let i = 0; i <= n; i++) cubes.push(vec3(i, 0, 0)); // 바닥 팔: +x
    for (let i = 1; i <= n; i++) cubes.push(vec3(n, i, 0)); // 기둥 팔: +y
    for (let i = 1; i <= n; i++) cubes.push(vec3(n, n, i)); // 안쪽 팔: +z
    return cubes;
}

// 이음새가 화면에서 얼마나 벌어져 보이는지(타일 단위).
// 정확히 ISO 각도라면 0이 나온다.
export function penroseGapOnScreen(
    n: number,
    yaw: number,
    pitch: number,
): number {
    const a = orthoProject(vec3(0, 0, 0), yaw, pitch); // 시작점
    const b = orthoProject(vec3(n, n, n), yaw, pitch); // 끝점
    return Math.hypot(b.x - a.x, b.y - a.y);
}
