// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
import {
  SvgCanvas,
  type SvgCanvasHandle,
  type SvgDrawingContext,
  type SvgGradient,
} from "@/components/materials/runtime/svg-canvas";
// 데모 공용 트랙 렌더링 헬퍼
import { WORLD_W, WORLD_H, HALF_W, type Track } from "./engine";

export const FONT =
  "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

export interface View {
  scale: number;
  ox: number;
  oy: number;
  wx(x: number): number; // world → canvas x
  wy(y: number): number;
}

// 트랙 월드 좌표를 캔버스 폭 cw, 높이 ch에 letterbox로 맞춘다
export function makeView(cw: number, ch: number, pad = 8): View {
  const scale = Math.min((cw - pad * 2) / WORLD_W, (ch - pad * 2) / WORLD_H);
  const ox = (cw - WORLD_W * scale) / 2;
  const oy = (ch - WORLD_H * scale) / 2;
  return {
    scale,
    ox,
    oy,
    wx(x: number) {
      return ox + x * scale;
    },
    wy(y: number) {
      return oy + y * scale;
    },
  };
}

// 캔버스 폭에 맞춰 트랙이 차지할 높이(WORLD 비율 유지)
export function trackHeightFor(cw: number, pad = 8): number {
  const scale = (cw - pad * 2) / WORLD_W;
  return WORLD_H * scale + pad * 2;
}

export function drawTrack(ctx: SvgDrawingContext, track: Track, view: View) {
  const { center } = track;
  const n = center.length;
  const w = HALF_W * view.scale;

  // 도로: 중심선을 따라 두꺼운 stroke로 그린다
  ctx.beginPath();
  ctx.moveTo(view.wx(center[0][0]), view.wy(center[0][1]));
  for (let i = 1; i <= n; i++) {
    const p = center[i % n];
    ctx.lineTo(view.wx(p[0]), view.wy(p[1]));
  }
  ctx.closePath();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = "#e9ecef";
  ctx.lineWidth = w * 2;
  ctx.stroke();

  // 도로 경계선(얇게)
  ctx.strokeStyle = "#ced4da";
  ctx.lineWidth = Math.max(1, view.scale * 3);
  // 안쪽/바깥쪽 경계는 생략하고 도로 위에 중앙 점선만
  ctx.setLineDash([view.scale * 14, view.scale * 12]);
  ctx.strokeStyle = "#adb5bd";
  ctx.lineWidth = Math.max(1, view.scale * 2);
  ctx.beginPath();
  ctx.moveTo(view.wx(center[0][0]), view.wy(center[0][1]));
  for (let i = 1; i <= n; i++) {
    const p = center[i % n];
    ctx.lineTo(view.wx(p[0]), view.wy(p[1]));
  }
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);

  // 출발선
  const a = center[0];
  const b = center[1];
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2;
  ctx.strokeStyle = "#868e96";
  ctx.lineWidth = Math.max(1.5, view.scale * 3);
  ctx.beginPath();
  ctx.moveTo(view.wx(a[0]) + Math.cos(ang) * w, view.wy(a[1]) + Math.sin(ang) * w);
  ctx.lineTo(view.wx(a[0]) - Math.cos(ang) * w, view.wy(a[1]) - Math.sin(ang) * w);
  ctx.stroke();
}

// 자동차 삼각형
export function drawCar(
  ctx: SvgDrawingContext,
  view: View,
  x: number,
  y: number,
  heading: number,
  color: string,
  alpha = 1,
  size = 9,
) {
  const cx = view.wx(x);
  const cy = view.wy(y);
  const s = size;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(heading);
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(s, 0);
  ctx.lineTo(-s * 0.7, s * 0.6);
  ctx.lineTo(-s * 0.7, -s * 0.6);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}
