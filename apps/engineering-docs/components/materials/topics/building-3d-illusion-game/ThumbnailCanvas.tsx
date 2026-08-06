// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useEffect, useRef } from "react";
import {
  SvgCanvas,
  type SvgCanvasHandle,
  type SvgDrawingContext,
  type SvgGradient,
} from "@/components/materials/runtime/svg-canvas";
import { drawCube, makeOrthoCam, CUBE_FACES, FONT } from "./draw";
import { penroseCubes, paintersOrder, ISO_YAW, ISO_PITCH, vec3, type Vec3 } from "./engine";

// 16:10 썸네일 (3200×2000 PNG로 다운로드). 발행 전 임시 컴포넌트.
const W = 1600;
const H = 1000;
const SCALE = 2;

const PENROSE_N = 4;

// 팔별 색: 바닥 팔(+x) gray, 기둥 팔(+y) blue, 안쪽 팔(+z) purple
function armColor(index: number): [string, string, string] {
  if (index <= PENROSE_N) return CUBE_FACES.gray; // 바닥 팔: 0..n
  if (index <= PENROSE_N * 2) return CUBE_FACES.blue; // 기둥 팔: n+1..2n
  return CUBE_FACES.purple; // 안쪽 팔: 2n+1..3n
}

// 셀 목록의 화면 투영 바운딩 박스(타일 단위). 큐브 8꼭짓점을 전부 투영해서 잰다.
function projectedBounds(cells: Vec3[]) {
  const probe = makeOrthoCam(ISO_YAW, ISO_PITCH, 1, 0, 0);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const cell of cells) {
    for (let dx = 0; dx <= 1; dx++) {
      for (let dy = 0; dy <= 1; dy++) {
        for (let dz = 0; dz <= 1; dz++) {
          const p = probe(vec3(cell.x + dx, cell.y + dy, cell.z + dz));
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y);
          maxY = Math.max(maxY, p.y);
        }
      }
    }
  }
  return { minX, maxX, minY, maxY };
}

// 배경 장식: 옅은 아이소메트릭 격자 (y=0 평면의 격자선)
function drawIsoGrid(ctx: SvgDrawingContext, project: (v: Vec3) => { x: number; y: number }) {
  ctx.save();
  ctx.strokeStyle = "#dee2e6";
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.55;
  const R = 24; // 캔버스를 넉넉히 덮을 만큼
  for (let i = -R; i <= R; i++) {
    // +x 방향 선 (z 고정)
    let a = project(vec3(-R, 0, i));
    let b = project(vec3(R, 0, i));
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    // +z 방향 선 (x 고정)
    a = project(vec3(i, 0, -R));
    b = project(vec3(i, 0, R));
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

// 배경 장식: 구석에 떠 있는 작은 큐브 하나
function drawAccentCube(
  ctx: SvgDrawingContext,
  cx: number,
  cy: number,
  tile: number,
  faces: [string, string, string],
  alpha: number,
) {
  const cam = makeOrthoCam(ISO_YAW, ISO_PITCH, tile, cx, cy);
  drawCube(ctx, cam, vec3(0, 0, 0), faces, { alpha, lineWidth: 1.5 });
}

function draw(ctx: SvgDrawingContext) {
  // 배경 그라데이션 (기존 썸네일과 같은 톤)
  const bg = ctx.createLinearGradient(0, 0, W * 0.4, H);
  bg.addColorStop(0, "#f4f7fa");
  bg.addColorStop(1, "#e7ebf1");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 펜로즈 삼각형 배치: 투영 바운딩 박스를 재서 캔버스 중앙에 맞춘다
  const cubes = penroseCubes(PENROSE_N);
  const bounds = projectedBounds(cubes);
  const bw = bounds.maxX - bounds.minX;
  const bh = bounds.maxY - bounds.minY;
  const availW = W - 560; // 좌우 여백 넉넉히 — 삼각형이 주인공
  const availH = H - 250;
  const tile = Math.min(availW / bw, availH / bh);
  const originX = W / 2 - ((bounds.minX + bounds.maxX) / 2) * tile;
  const originY = H / 2 - ((bounds.minY + bounds.maxY) / 2) * tile;
  const cam = makeOrthoCam(ISO_YAW, ISO_PITCH, tile, originX, originY);

  // 옅은 아이소 격자 (삼각형과 같은 카메라 — 격자도 정확히 ISO 각도)
  drawIsoGrid(ctx, makeOrthoCam(ISO_YAW, ISO_PITCH, tile * 0.5, W / 2, H / 2));

  // 구석 장식 큐브 (과하지 않게 세 개만)
  drawAccentCube(ctx, W * 0.13, H * 0.2, 44, CUBE_FACES.yellow, 0.85);
  drawAccentCube(ctx, W * 0.87, H * 0.72, 52, CUBE_FACES.green, 0.85);
  drawAccentCube(ctx, W * 0.82, H * 0.14, 32, CUBE_FACES.gray, 0.7);

  // 펜로즈 삼각형: 먼 큐브부터 그리면(화가 알고리즘) 안쪽 팔 끝 큐브가
  // 시작 큐브 위를 정확히 덮으면서 불가능 삼각형이 완성된다.
  for (const i of paintersOrder(cubes, ISO_YAW, ISO_PITCH)) {
    drawCube(ctx, cam, cubes[i], armColor(i), {
      stroke: "rgba(73, 80, 87, 0.45)",
      lineWidth: 2.5,
    });
  }
}

export const ThumbnailCanvas = () => {
  const canvasRef = useRef<SvgCanvasHandle>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = W * SCALE;
    canvas.height = H * SCALE;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(SCALE, SCALE);
    draw(ctx);
  }, []);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "thumbnail.png";
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  return (
    <div style={{ margin: "24px 0" }}>
      <SvgCanvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", borderRadius: 8, border: "1px solid #dee2e6" }}
      />
      <div style={{ textAlign: "center", marginTop: 8 }}>
        <button
          onClick={download}
          style={{
            fontFamily: FONT,
            fontSize: 13,
            padding: "8px 16px",
            borderRadius: 6,
            border: "1px solid #228be6",
            background: "#e7f5ff",
            color: "#228be6",
            cursor: "pointer",
          }}
        >
          썸네일 PNG 다운로드 (3200×2000)
        </button>
      </div>
    </div>
  );
};
