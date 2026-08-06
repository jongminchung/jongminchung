// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
import {
  SvgCanvas,
  type SvgCanvasHandle,
  type SvgDrawingContext,
  type SvgGradient,
} from "@/components/materials/runtime/svg-canvas";
// 데모 공용 그리기 도우미 — 모든 데모가 같은 시각 언어를 쓰도록 묶어둔다.
// 게임 로직은 전부 engine.ts에 있고, 여기는 캔버스에 픽셀을 찍는 코드만 있다.
import { orthoProject, vec3, type Vec3 } from "./engine";

export const FONT =
  "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

export const PALETTE = {
  blue: "#228be6",
  red: "#fa5252",
  yellow: "#fab005",
  green: "#40c057",
  purple: "#845ef7",
  bg: "#f8f9fa",
  border: "#dee2e6",
  gray: "#adb5bd",
  text: "#495057",
  subtext: "#868e96",
  blueBg: "#e7f5ff",
  redBg: "#fff5f5",
};

// 큐브 면 색 세트: [윗면, 왼쪽면(+z), 오른쪽면(+x)]
export const CUBE_FACES: Record<string, [string, string, string]> = {
  gray: ["#e9ecef", "#ced4da", "#adb5bd"],
  blue: ["#a5d8ff", "#74c0fc", "#4dabf7"],
  purple: ["#d0bfff", "#b197fc", "#9775fa"],
  yellow: ["#ffec99", "#ffe066", "#ffd43b"],
  green: ["#b2f2bb", "#8ce99a", "#69db7c"],
};

// 3D 점 → 캔버스 픽셀 함수. 데모마다 카메라가 달라서 함수로 주입받는다.
export type ProjectFn = (v: Vec3) => { x: number; y: number };

// 직교 카메라 하나를 만들어 ProjectFn으로 돌려준다.
export function makeOrthoCam(
  yaw: number,
  pitch: number,
  tile: number, // 타일 하나의 픽셀 크기
  originX: number, // 월드 (0,0,0)이 놓일 캔버스 x
  originY: number,
): ProjectFn {
  return (v: Vec3) => {
    const p = orthoProject(v, yaw, pitch);
    return { x: originX + p.x * tile, y: originY + p.y * tile };
  };
}

function facePath(ctx: SvgDrawingContext, pts: { x: number; y: number }[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

// 다각형의 부호 있는 넓이 (신발끈 공식). 화면 좌표(y 아래로 증가) 기준.
function signedArea(pts: { x: number; y: number }[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

// 정육면체의 여섯 면. 꼭짓점은 바깥에서 봤을 때 일관된 방향으로 감기게 배열했다.
// kind: 'top' 윗면(+y), 'bottom' 아랫면(−y), 'side' 옆면 4개.
const CUBE_FACE_DEFS: { kind: "top" | "bottom" | "side"; corners: [number, number, number][] }[] = [
  {
    kind: "top",
    corners: [
      [0, 1, 0],
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
    ],
  }, // +y
  {
    kind: "bottom",
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
  }, // −y
  {
    kind: "side",
    corners: [
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
      [1, 0, 1],
    ],
  }, // +x
  {
    kind: "side",
    corners: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
  }, // −x
  {
    kind: "side",
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
  }, // +z
  {
    kind: "side",
    corners: [
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
      [1, 0, 0],
    ],
  }, // −z
];

// (x,y,z) 칸을 차지하는 정육면체 하나를 그린다.
// 어느 면이 보이는지는 투영된 다각형의 감김 방향으로 판별하므로,
// 카메라가 어느 방향에 있어도(구조물 뒤로 돌아가도) 올바른 면이 그려진다.
export function drawCube(
  ctx: SvgDrawingContext,
  project: ProjectFn,
  cell: Vec3,
  faces: [string, string, string],
  opts: { alpha?: number; stroke?: string; lineWidth?: number } = {},
) {
  const { x, y, z } = cell;
  const c = (dx: number, dy: number, dz: number) => project(vec3(x + dx, y + dy, z + dz));

  const prevAlpha = ctx.globalAlpha;
  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
  const stroke = opts.stroke ?? "rgba(73, 80, 87, 0.35)";
  const lw = opts.lineWidth ?? 1;

  const centerX = c(0.5, 0.5, 0.5).x;
  for (const def of CUBE_FACE_DEFS) {
    const pts = def.corners.map(([dx, dy, dz]) => c(dx, dy, dz));
    if (signedArea(pts) >= 0) continue; // 카메라 반대쪽을 향한 면은 건너뛴다

    // 색: 윗면은 밝게, 옆면은 화면 왼쪽이면 중간, 오른쪽이면 어둡게
    let fill: string;
    if (def.kind === "top") fill = faces[0];
    else if (def.kind === "bottom") fill = faces[2];
    else {
      const faceX = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4;
      fill = faceX <= centerX ? faces[1] : faces[2];
    }
    facePath(ctx, pts);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }

  ctx.globalAlpha = prevAlpha;
}

// 캐릭터: 노드 칸(pos)에 서 있는 작은 사람. 몸통 + 머리.
export function drawCharacter(
  ctx: SvgDrawingContext,
  project: ProjectFn,
  pos: Vec3, // 서 있는 칸 (블록 위 칸). 발은 칸 바닥 중앙에 붙는다.
  tile: number,
  color = PALETTE.red,
) {
  const foot = project(vec3(pos.x + 0.5, pos.y, pos.z + 0.5));
  const bodyH = tile * 0.42;
  const bodyW = tile * 0.2;
  const headR = tile * 0.13;

  // 그림자
  ctx.beginPath();
  ctx.ellipse(foot.x, foot.y, tile * 0.18, tile * 0.08, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.fill();

  // 몸통 (둥근 사각형)
  ctx.beginPath();
  ctx.roundRect(foot.x - bodyW / 2, foot.y - bodyH, bodyW, bodyH * 0.95, bodyW / 2);
  ctx.fillStyle = color;
  ctx.fill();

  // 머리
  ctx.beginPath();
  ctx.arc(foot.x, foot.y - bodyH - headR * 0.6, headR, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1;
  ctx.stroke();
}

// 목표 깃발: 노드 칸(pos)에 꽂힌 깃발.
export function drawFlag(
  ctx: SvgDrawingContext,
  project: ProjectFn,
  pos: Vec3,
  tile: number,
  color = PALETTE.green,
) {
  const base = project(vec3(pos.x + 0.5, pos.y, pos.z + 0.5));
  const h = tile * 0.62;
  ctx.beginPath();
  ctx.moveTo(base.x, base.y);
  ctx.lineTo(base.x, base.y - h);
  ctx.strokeStyle = PALETTE.text;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(base.x, base.y - h);
  ctx.lineTo(base.x + tile * 0.32, base.y - h + tile * 0.12);
  ctx.lineTo(base.x, base.y - h + tile * 0.24);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}
