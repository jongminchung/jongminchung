"use client";

import React, { useEffect, useRef } from "react";
import {
    SvgCanvas,
    type SvgCanvasHandle,
} from "#components/materials/runtime/svg-canvas";
import {
    CUBE_FACES,
    drawCube,
    FONT,
    makeOrthoCam,
    PALETTE,
    type ProjectFn,
} from "./draw";
import {
    ISO_PITCH,
    ISO_YAW,
    orthoProject,
    paintersOrder,
    perspectiveProject,
    vec3,
    type Vec3,
} from "./engine";

// z축을 따라 늘어선 정육면체 5개. 카메라가 +(1,1,1) 방향에 있으므로 i=4가 가장 가깝다.
const CELLS: Vec3[] = [0, 1, 2, 3, 4].map((i) => vec3(0, 0, i));
const CELL_FACES: [string, string, string][] = CELLS.map((_, i) =>
    i === 4 ? CUBE_FACES.blue : i === 0 ? CUBE_FACES.purple : CUBE_FACES.gray,
);

const NEAR_CELL = CELLS[4]!;
const FAR_CELL = CELLS[0]!;

const CAM_DIST = 10; // 원근 카메라 거리
const YAW_RANGE = Math.PI / 6; // ISO ± 30도
const YAW_MIN = ISO_YAW - YAW_RANGE;
const YAW_MAX = ISO_YAW + YAW_RANGE;

// HUD에 쓰는 큐브 화면 높이: 여덟 꼭짓점을 전부 투영해 세로 범위를 잰다.
// (원근에서는 꼭짓점마다 배율이 달라서, 모서리 하나만 재면 왜곡된 값이 나온다)
function cubeScreenHeight(project: ProjectFn, cell: Vec3): number {
    let minY = Infinity;
    let maxY = -Infinity;
    for (let dx = 0; dx <= 1; dx++) {
        for (let dy = 0; dy <= 1; dy++) {
            for (let dz = 0; dz <= 1; dz++) {
                const p = project(vec3(cell.x + dx, cell.y + dy, cell.z + dz));
                if (p.y < minY) minY = p.y;
                if (p.y > maxY) maxY = p.y;
            }
        }
    }
    return maxY - minY;
}

interface Bounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

// yaw 가동 범위 전체에서 장면이 차지하는 화면 영역(타일 단위)을 미리 계산한다.
// 드래그 중에 타일 크기를 다시 맞추면 직교 투영마저 커졌다 작아졌다 해 보여서,
// 범위 전체를 덮는 고정 프레임을 쓴다.
function computeBounds(kind: "persp" | "ortho"): Bounds {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    const STEPS = 24;
    for (let s = 0; s <= STEPS; s++) {
        const yaw = YAW_MIN + ((YAW_MAX - YAW_MIN) * s) / STEPS;
        for (const c of CELLS) {
            for (let dx = 0; dx <= 1; dx++) {
                for (let dy = 0; dy <= 1; dy++) {
                    for (let dz = 0; dz <= 1; dz++) {
                        const v = vec3(c.x + dx, c.y + dy, c.z + dz);
                        const p =
                            kind === "persp"
                                ? perspectiveProject(
                                      v,
                                      yaw,
                                      ISO_PITCH,
                                      CAM_DIST,
                                  )
                                : orthoProject(v, yaw, ISO_PITCH);
                        if (p.x < minX) minX = p.x;
                        if (p.x > maxX) maxX = p.x;
                        if (p.y < minY) minY = p.y;
                        if (p.y > maxY) maxY = p.y;
                    }
                }
            }
        }
    }
    return { minX, maxX, minY, maxY };
}

const BOUNDS: Record<"persp" | "ortho", Bounds> = {
    persp: computeBounds("persp"),
    ortho: computeBounds("ortho"),
};

const clampYaw = (y: number) => Math.min(YAW_MAX, Math.max(YAW_MIN, y));

export const ProjectionDemo = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<SvgCanvasHandle>(null);
    const yawRef = useRef(ISO_YAW);
    const drawRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;

        const draw = () => {
            const w = container.clientWidth;
            if (w <= 0) return;
            const dpr = window.devicePixelRatio || 1;
            const stacked = w < 480; // 모바일은 상하 스택
            const gap = 12;
            const panelW = stacked ? w : (w - gap) / 2;
            const panelH = stacked
                ? Math.min(250, Math.max(190, Math.round(w * 0.62)))
                : 250;
            const h = stacked ? panelH * 2 + gap : panelH;

            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;

            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, w, h);

            const yaw = yawRef.current;
            const order = paintersOrder(CELLS, yaw, ISO_PITCH); // 먼 것부터

            const panel = (
                px: number,
                py: number,
                label: string,
                kind: "persp" | "ortho",
            ) => {
                // 패널 배경
                ctx.beginPath();
                ctx.roundRect(px + 0.5, py + 0.5, panelW - 1, panelH - 1, 6);
                ctx.fillStyle = PALETTE.bg;
                ctx.fill();
                ctx.strokeStyle = PALETTE.border;
                ctx.lineWidth = 1;
                ctx.stroke();

                // 상단 라벨
                ctx.font = `600 13px ${FONT}`;
                ctx.fillStyle = PALETTE.text;
                ctx.textAlign = "left";
                ctx.textBaseline = "top";
                ctx.fillText(label, px + 12, py + 10);

                // 장면을 패널 안에 맞춘다 (yaw 전 범위를 덮는 고정 프레임)
                const labelH = 32;
                const hudH = 26;
                const pad = 12;
                const sceneW = panelW - pad * 2;
                const sceneH = panelH - labelH - hudH;
                const b = BOUNDS[kind];
                const spanX = b.maxX - b.minX;
                const spanY = b.maxY - b.minY;
                const tile = Math.min(
                    sceneW / (spanX + 0.3),
                    sceneH / (spanY + 0.3),
                );
                const originX =
                    px + panelW / 2 - ((b.minX + b.maxX) / 2) * tile;
                const originY =
                    py + labelH + sceneH / 2 - ((b.minY + b.maxY) / 2) * tile;

                const project: ProjectFn =
                    kind === "ortho"
                        ? makeOrthoCam(yaw, ISO_PITCH, tile, originX, originY)
                        : (v: Vec3) => {
                              const p = perspectiveProject(
                                  v,
                                  yaw,
                                  ISO_PITCH,
                                  CAM_DIST,
                              );
                              return {
                                  x: originX + p.x * tile,
                                  y: originY + p.y * tile,
                              };
                          };

                for (const i of order) {
                    drawCube(ctx, project, CELLS[i]!, CELL_FACES[i]!);
                }

                // HUD: 가장 가까운/먼 큐브의 화면상 높이(px)
                const near = Math.round(cubeScreenHeight(project, NEAR_CELL));
                const far = Math.round(cubeScreenHeight(project, FAR_CELL));
                ctx.font = `11px ${FONT}`;
                ctx.fillStyle = PALETTE.subtext;
                ctx.textAlign = "left";
                ctx.textBaseline = "alphabetic";
                ctx.fillText(
                    `가까운 칸 ${near}px · 먼 칸 ${far}px`,
                    px + 12,
                    py + panelH - 10,
                );
            };

            panel(0, 0, "원근 투영", "persp");
            panel(
                stacked ? 0 : panelW + gap,
                stacked ? panelH + gap : 0,
                "평행 투영",
                "ortho",
            );
        };
        drawRef.current = draw;

        // --- 드래그로 yaw 조절 (두 패널이 같은 yaw를 공유) ---
        const SENS = 0.006; // 픽셀 → 라디안
        let dragging = false;
        let startX = 0;
        let startY = 0;
        let startYaw = ISO_YAW;
        let touchAxis: "h" | "v" | null = null;

        const onMouseDown = (e: MouseEvent) => {
            dragging = true;
            startX = e.clientX;
            startYaw = yawRef.current;
            canvas.style.cursor = "grabbing";
            e.preventDefault();
        };
        const onMouseMove = (e: MouseEvent) => {
            if (!dragging) return;
            yawRef.current = clampYaw(startYaw - (e.clientX - startX) * SENS);
            draw();
        };
        const onMouseUp = () => {
            if (!dragging) return;
            dragging = false;
            canvas.style.cursor = "grab";
        };

        const onTouchStart = (e: TouchEvent) => {
            if (e.touches.length !== 1) return;
            touchAxis = null;
            startX = e.touches[0]!.clientX;
            startY = e.touches[0]!.clientY;
            startYaw = yawRef.current;
        };
        const onTouchMove = (e: TouchEvent) => {
            if (e.touches.length !== 1) return;
            const dx = e.touches[0]!.clientX - startX;
            const dy = e.touches[0]!.clientY - startY;
            // 방향이 정해지기 전엔 판정만 한다. 세로가 우세하면 스크롤에 양보.
            if (touchAxis === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
                touchAxis = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
            }
            if (touchAxis === "h") {
                if (e.cancelable) e.preventDefault(); // 가로 드래그일 때만 스크롤을 막는다
                yawRef.current = clampYaw(startYaw - dx * SENS);
                draw();
            }
        };
        const onTouchEnd = () => {
            touchAxis = null;
        };

        canvas.style.cursor = "grab";
        canvas.style.touchAction = "pan-y"; // 세로 스크롤은 브라우저에 맡긴다
        canvas.addEventListener("mousedown", onMouseDown);
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        canvas.addEventListener("touchstart", onTouchStart, { passive: true });
        canvas.addEventListener("touchmove", onTouchMove, { passive: false });
        canvas.addEventListener("touchend", onTouchEnd);
        canvas.addEventListener("touchcancel", onTouchEnd);

        const ro = new ResizeObserver(() => {
            try {
                draw();
            } catch {
                // 그리기 예외가 observer를 죽이지 않게 한다
            }
        });
        ro.observe(container);
        draw();

        return () => {
            ro.disconnect();
            canvas.removeEventListener("mousedown", onMouseDown);
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
            canvas.removeEventListener("touchstart", onTouchStart);
            canvas.removeEventListener("touchmove", onTouchMove);
            canvas.removeEventListener("touchend", onTouchEnd);
            canvas.removeEventListener("touchcancel", onTouchEnd);
            drawRef.current = null;
        };
    }, []);

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
                <button
                    style={btn}
                    onClick={() => {
                        yawRef.current = ISO_YAW;
                        drawRef.current?.();
                    }}
                >
                    ISO 각도로 리셋
                </button>
            </div>
            <div ref={containerRef}>
                <SvgCanvas
                    ref={canvasRef}
                    style={{ display: "block", width: "100%" }}
                />
            </div>
            <div
                style={{
                    marginTop: 10,
                    fontSize: 11,
                    color: "#adb5bd",
                    textAlign: "center",
                }}
            >
                드래그해서 카메라를 돌려보세요 — 직교 투영에서는 아무리 돌려도
                크기가 변하지 않는다
            </div>
        </div>
    );
};
