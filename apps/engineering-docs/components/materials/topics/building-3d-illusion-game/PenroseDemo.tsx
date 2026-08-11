// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useEffect, useRef, useState } from "react";
import { seededMaterialRandom } from "#components/materials/runtime/random";
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
import { FONT, PALETTE, CUBE_FACES, drawCube, type ProjectFn } from "./draw";
import {
  penroseCubes,
  penroseGapOnScreen,
  orthoProject,
  perspectiveProject,
  paintersOrder,
  ISO_YAW,
  ISO_PITCH,
  vec3,
  type Vec3,
} from "./engine";

const N = 4; // penroseCubes(4) — 큐브 13개
const CAM_DIST = 12; // 원근 투영 카메라 거리
const DEG = Math.PI / 180;
const PITCH_MIN = 5 * DEG;
const PITCH_MAX = 80 * DEG;

// 팔 색 구분: 안쪽 팔(+z) 보라, 기둥 팔(+y) 파랑, 바닥 팔(+x) 회색
const facesFor = (c: Vec3): [string, string, string] =>
  c.z > 0 ? CUBE_FACES.purple : c.y > 0 ? CUBE_FACES.blue : CUBE_FACES.gray;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

interface CamAnim {
  fromYaw: number;
  fromPitch: number;
  toYaw: number;
  toPitch: number;
  start: number;
  dur: number;
}

export const PenroseDemo = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<SvgCanvasHandle>(null);
  const [persp, setPersp] = useState(false);
  const perspRef = useRef(false);
  perspRef.current = persp;

  // 일부러 어긋난 각도에서 시작 — 구조물의 3D 정체가 보인다
  const yawRef = useRef(ISO_YAW + 28 * DEG);
  const pitchRef = useRef(ISO_PITCH + 12 * DEG);
  const animRef = useRef<CamAnim | null>(null);
  const dragRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const widthRef = useRef(0);
  // 프레임 간 부드러운 화면 맞춤(스케일·중심) 상태
  const viewRef = useRef<{ tile: number; cx: number; cy: number } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const cubes = penroseCubes(N);
    widthRef.current = container.clientWidth;

    const ro = new ResizeObserver((entries) => {
      const cw = entries[0]?.contentRect.width;
      if (cw) widthRef.current = cw;
    });
    ro.observe(container);

    let raf = 0;

    const render = () => {
      try {
        const now = performance.now();

        // 카메라 보간 애니메이션 (드래그가 시작되면 animRef가 비워진다)
        const anim = animRef.current;
        if (anim) {
          const t = Math.min(1, Math.max(0, now - anim.start) / anim.dur);
          const e = easeOutCubic(t);
          yawRef.current = anim.fromYaw + (anim.toYaw - anim.fromYaw) * e;
          pitchRef.current = anim.fromPitch + (anim.toPitch - anim.fromPitch) * e;
          if (t >= 1) animRef.current = null;
        }

        const yaw = yawRef.current;
        const pitch = pitchRef.current;
        const usePersp = perspRef.current;

        const w = Math.max(200, widthRef.current || container.clientWidth);
        const isMobile = w < 480;
        const h = Math.round(isMobile ? w * 0.92 : w * 0.66);
        const dpr = window.devicePixelRatio || 1;
        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
          canvas.width = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
          canvas.style.width = `${w}px`;
          canvas.style.height = `${h}px`;
        }
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          raf = scheduleMaterialFrame(render);
          return;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = PALETTE.bg;
        ctx.fillRect(0, 0, w, h);

        // 현재 모드의 투영 (타일 단위)
        const proj = (v: Vec3) =>
          usePersp ? perspectiveProject(v, yaw, pitch, CAM_DIST) : orthoProject(v, yaw, pitch);

        // 화면 맞춤: 구조물 경계 상자(0~5)^3의 여덟 꼭짓점을 투영해 스케일 계산
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        for (let i = 0; i < 8; i++) {
          const p = proj(vec3(i & 1 ? N + 1 : 0, i & 2 ? N + 1 : 0, i & 4 ? N + 1 : 0));
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }
        const hudH = isMobile ? 46 : 42;
        const pad = 16;
        const targetTile = Math.min(
          (w - pad * 2) / Math.max(0.001, maxX - minX),
          (h - hudH - pad * 2) / Math.max(0.001, maxY - minY),
        );
        const tcx = (minX + maxX) / 2;
        const tcy = (minY + maxY) / 2;
        let view = viewRef.current;
        if (!view) {
          view = { tile: targetTile, cx: tcx, cy: tcy };
          viewRef.current = view;
        } else {
          view.tile += (targetTile - view.tile) * 0.2;
          view.cx += (tcx - view.cx) * 0.2;
          view.cy += (tcy - view.cy) * 0.2;
        }
        const tile = view.tile;
        const ox = w / 2 - view.cx * tile;
        const oy = hudH + (h - hudH) / 2 - view.cy * tile;

        const project: ProjectFn = (v) => {
          const p = proj(v);
          return { x: ox + p.x * tile, y: oy + p.y * tile };
        };

        // 화가 알고리즘: 먼 큐브부터. ISO 각도에서 끝 큐브 (4,4,4)가 카메라에
        // 더 가까워 나중에 그려지고, 같은 화면 위치의 시작 큐브 (0,0,0)을
        // 자연스럽게 덮으면서 삼각형이 닫혀 보인다 — 의도된 착시.
        for (const i of paintersOrder(cubes, yaw, pitch)) {
          drawCube(ctx, project, cubes[i], facesFor(cubes[i]));
        }

        // HUD
        const gapPx = penroseGapOnScreen(N, yaw, pitch) * tile;
        const closed = gapPx < 1;
        const fs = isMobile ? 12 : 13;
        ctx.textBaseline = "top";
        ctx.textAlign = "left";
        ctx.font = `700 ${fs}px ${FONT}`;
        ctx.fillStyle = PALETTE.text;
        ctx.fillText(`이음새 벌어짐: ${gapPx.toFixed(1)}px`, 12, 10);
        ctx.textAlign = "right";
        ctx.font = closed ? `700 ${fs}px ${FONT}` : `${fs}px ${FONT}`;
        ctx.fillStyle = closed ? PALETTE.green : PALETTE.subtext;
        ctx.fillText(closed ? "펜로즈 삼각형 완성!" : "각도를 맞춰보세요", w - 12, 10);
        if (usePersp) {
          const near = perspectiveProject(vec3(N, N, N), yaw, pitch, CAM_DIST).scale;
          const far = perspectiveProject(vec3(0, 0, 0), yaw, pitch, CAM_DIST).scale;
          ctx.textAlign = "left";
          ctx.font = `${fs - 1}px ${FONT}`;
          ctx.fillStyle = PALETTE.subtext;
          ctx.fillText(`가까운 팔이 약 ${(near / far).toFixed(1)}배 두껍게 보임`, 12, 10 + fs + 6);
        }

        // 현재 각도 표시
        const yawDeg = (((yaw / DEG) % 360) + 360) % 360;
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.font = `${fs - 2}px ${FONT}`;
        ctx.fillStyle = PALETTE.subtext;
        ctx.fillText(`yaw ${yawDeg.toFixed(1)}° · pitch ${(pitch / DEG).toFixed(1)}°`, 12, h - 8);
      } catch {
        // 그리다 예외가 나도 루프는 계속 돈다
      }
      raf = scheduleMaterialFrame(render);
    };

    raf = scheduleMaterialFrame(render);
    return () => {
      cancelMaterialFrame(raf);
      ro.disconnect();
    };
  }, []);

  const startAnim = (toYaw: number, toPitch: number, dur: number) => {
    animRef.current = {
      fromYaw: yawRef.current,
      fromPitch: pitchRef.current,
      toYaw,
      toPitch,
      start: performance.now(),
      dur,
    };
  };

  // 정답 각도로: yaw는 가장 가까운 등가 각도(45° + k·360°)로 이동
  const goAnswer = () => {
    const k = Math.round((yawRef.current - ISO_YAW) / (Math.PI * 2));
    startAnim(ISO_YAW + k * Math.PI * 2, ISO_PITCH, 800);
  };

  // 아무 각도나: 정답에서 크게 벗어난 무작위 각도로 짧게 보간
  const goRandom = () => {
    const sign = seededMaterialRandom("building-3d-illusion-game/PenroseDemo") < 0.5 ? -1 : 1;
    const toYaw =
      yawRef.current +
      sign *
        (Math.PI / 3 +
          seededMaterialRandom("building-3d-illusion-game/PenroseDemo") * Math.PI * 0.8);
    let toPitch = (12 + seededMaterialRandom("building-3d-illusion-game/PenroseDemo") * 60) * DEG;
    if (Math.abs(toPitch - ISO_PITCH) < 8 * DEG) {
      toPitch =
        ISO_PITCH +
        sign * (14 + seededMaterialRandom("building-3d-illusion-game/PenroseDemo") * 12) * DEG;
    }
    toPitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, toPitch));
    startAnim(toYaw, toPitch, 350);
  };

  const onPointerDown = (e: React.PointerEvent<SvgCanvasHandle>) => {
    animRef.current = null; // 드래그하면 보간 애니메이션 취소
    dragRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<SvgCanvasHandle>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.x = e.clientX;
    d.y = e.clientY;
    yawRef.current += dx * (Math.PI / 360); // yaw는 자유
    pitchRef.current = Math.min(
      PITCH_MAX,
      Math.max(PITCH_MIN, pitchRef.current - dy * (Math.PI / 420)),
    );
  };

  // 자석 스냅: 정답 근처에서 손을 놓으면 정확한 각도로 빨려 들어간다.
  // 픽셀 하나까지 손으로 맞추기는 불가능하므로, 완성의 손맛은 이 스냅이 담당한다.
  const MAGNET = 6 * DEG;
  const onPointerUp = (e: React.PointerEvent<SvgCanvasHandle>) => {
    if (dragRef.current?.id !== e.pointerId) return;
    dragRef.current = null;
    const k = Math.round((yawRef.current - ISO_YAW) / (Math.PI * 2));
    const nearestYaw = ISO_YAW + k * Math.PI * 2; // 가장 가까운 등가 정답 yaw
    if (
      Math.abs(yawRef.current - nearestYaw) < MAGNET &&
      Math.abs(pitchRef.current - ISO_PITCH) < MAGNET
    ) {
      startAnim(nearestYaw, ISO_PITCH, 250);
    }
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
          flexWrap: "wrap",
        }}
      >
        <button style={btn} onClick={goAnswer}>
          정답 각도로
        </button>
        <button style={btn} onClick={goRandom}>
          아무 각도나
        </button>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 12,
            color: "#495057",
            cursor: "pointer",
            marginLeft: 4,
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={persp}
            onChange={(e) => setPersp(e.target.checked)}
            style={{ margin: 0 }}
          />
          원근 투영으로 보기
        </label>
      </div>
      <div ref={containerRef}>
        <SvgCanvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            display: "block",
            width: "100%",
            cursor: "grab",
            touchAction: "none",
            borderRadius: 6,
          }}
        />
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: "#868e96", textAlign: "center" }}>
        드래그해서 구조물을 돌려보세요 — 이 삼각형은 단 하나의 각도에서만 존재한다
      </div>
    </div>
  );
};
