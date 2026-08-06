// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useEffect, useRef, useState } from "react";
// 슈퍼리미널의 강제 원근(forced perspective) 데모 — 두 패널 직접 대비.
// 같은 슬라이더로 두 패널의 물체를 동시에 밀어낸다.
// 왼쪽(일반 물리)은 멀어질수록 화면에서 작아지지만,
// 오른쪽(착시 모드)은 실제 크기를 d/4배로 키워 화면 크기가 그대로다(s/d 일정).
// 각 패널에 키 1.7칸짜리 사람을 세워, 착시 패널 큐브의 실제 크기를 본편 안에서 폭로한다.
// 원근 투영을 직접 구현한다 — engine의 직교 투영과 무관하다.
import {
  SvgCanvas,
  type SvgCanvasHandle,
  type SvgDrawingContext,
  type SvgGradient,
} from "@/components/materials/runtime/svg-canvas";
import { FONT, PALETTE } from "./draw";

const EYE_Y = 1.5; // 눈높이
const D_MIN = 3;
const D_MAX = 12;
const D_INIT = 4;
const PERSON_H = 1.7; // 사람 실제 키(칸)
const PERSON_X = 1.7; // 사람이 서 있는 x — 큐브와 같은 거리 z=d에 나란히 선다
const CUBE_X = -0.9; // 큐브 중심 x
const WARN_S = 1.5; // HUD를 붉게 물들이는 실제 한 변 기준

export const ForcedPerspectiveDemo = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<SvgCanvasHandle>(null);
  const [d, setD] = useState(D_INIT); // 눈으로부터 물체 앞면까지의 거리 (두 패널 공유)

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
      const panelH = Math.max(240, Math.min(330, Math.round(panelW * 0.78)));
      const h = stacked ? panelH * 2 + gap : panelH;

      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // 패널 하나를 그린다. s는 큐브의 실제 한 변, illusion은 착시 패널 여부.
      const panel = (px: number, py: number, label: string, s: number, illusion: boolean) => {
        // ---- 패널 배경 ----
        ctx.beginPath();
        ctx.roundRect(px + 0.5, py + 0.5, panelW - 1, panelH - 1, 6);
        ctx.fillStyle = PALETTE.bg;
        ctx.fill();
        ctx.strokeStyle = PALETTE.border;
        ctx.lineWidth = 1;
        ctx.stroke();

        // ---- 원근 투영 (패널마다 독립된 cx/cy) ----
        // 사람이 x=+1.7에 서 있으므로 중심을 살짝 왼쪽에 둬서 d가 작아도 잘리지 않게 한다.
        // f는 패널 폭 기준이되, 가까운 물체의 바닥이 패널 아래로 넘치지 않게 높이로도 제한한다.
        const f = Math.min(panelW * 0.9, panelH * 1.4 - 56);
        const cx = px + panelW * 0.42;
        const cy = py + panelH * 0.3; // 지평선 높이
        const proj = (x: number, y: number, z: number) => ({
          x: cx + (x / z) * f,
          y: cy + ((EYE_Y - y) / z) * f,
        });

        // ---- 장면 (패널 안쪽으로 클리핑) ----
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(px + 1, py + 1, panelW - 2, panelH - 2, 6);
        ctx.clip();

        // 바닥 격자 (y=0, x=-4..4, z=2..14) — 멀수록 옅게
        ctx.lineWidth = 1;
        ctx.strokeStyle = PALETTE.border;
        for (let gx = -4; gx <= 4; gx++) {
          const a = proj(gx, 0, 2);
          const b = proj(gx, 0, 14);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
        for (let gz = 2; gz <= 14; gz++) {
          ctx.globalAlpha = Math.max(0.15, 1 - (gz - 2) / 13);
          const a = proj(-4, 0, gz);
          const b = proj(4, 0, gz);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // ---- 큐브: 중심 x=CUBE_X, 앞면 z=d, 한 변 s, 바닥 위 ----
        const quad = (pts: { x: number; y: number }[], fill: string) => {
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
          ctx.closePath();
          ctx.fillStyle = fill;
          ctx.fill();
          ctx.strokeStyle = "rgba(73, 80, 87, 0.35)";
          ctx.lineWidth = 1;
          ctx.stroke();
        };
        const xl = CUBE_X - s / 2;
        const xr = CUBE_X + s / 2;
        // 윗면은 눈높이보다 낮을 때만 보인다
        if (s < EYE_Y) {
          quad([proj(xl, s, d), proj(xr, s, d), proj(xr, s, d + s), proj(xl, s, d + s)], "#a5d8ff");
        }
        // 옆면: 큐브가 카메라 축(x=0)을 벗어나 있으면 안쪽을 향한 옆면이 보인다.
        // 큐브가 커져 카메라 정면을 가로막으면(xl<0<xr) 옆면은 둘 다 안 보인다.
        if (xr < 0) {
          quad([proj(xr, 0, d), proj(xr, 0, d + s), proj(xr, s, d + s), proj(xr, s, d)], "#74c0fc");
        } else if (xl > 0) {
          quad([proj(xl, 0, d), proj(xl, 0, d + s), proj(xl, s, d + s), proj(xl, s, d)], "#74c0fc");
        }
        quad([proj(xl, 0, d), proj(xr, 0, d), proj(xr, s, d), proj(xl, s, d)], "#4dabf7");

        // ---- 사람 실루엣: 실제 키 1.7칸, (x=PERSON_X, z=d) 바닥에 선다 ----
        // 실제 키는 불변 — 원근에 따라 화면에서만 커지고 작아진다.
        const u = f / d; // 이 거리에서의 픽셀/칸 배율
        const foot = proj(PERSON_X, 0, d);
        const yAt = (worldY: number) => foot.y - worldY * u;
        ctx.fillStyle = "#868e96";
        ctx.strokeStyle = "#868e96";
        // 다리 두 줄
        ctx.lineCap = "round";
        ctx.lineWidth = Math.max(1, 0.09 * u);
        for (const off of [-0.085, 0.085]) {
          ctx.beginPath();
          ctx.moveTo(foot.x + off * u, yAt(0.03));
          ctx.lineTo(foot.x + off * u, yAt(0.76));
          ctx.stroke();
        }
        ctx.lineCap = "butt";
        // 몸통 (둥근 사각)
        const bodyW = 0.34 * u;
        const bodyH = (1.4 - 0.72) * u;
        ctx.beginPath();
        ctx.roundRect(foot.x - bodyW / 2, yAt(1.4), bodyW, bodyH, bodyW / 2);
        ctx.fill();
        // 머리 원 — 정수리가 정확히 y=1.7
        const headR = 0.14 * u;
        ctx.beginPath();
        ctx.arc(foot.x, yAt(PERSON_H - 0.14), headR, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore(); // 클리핑 해제

        // ---- 상단 라벨 ----
        ctx.font = `600 13px ${FONT}`;
        ctx.fillStyle = PALETTE.text;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(label, px + 12, py + 10);

        // 착시 패널: 큐브 실제 높이가 사람 키를 넘는 순간 배지를 띄운다
        if (illusion && s > PERSON_H) {
          const labelW = ctx.measureText(label).width;
          const badge = "사람보다 크다!";
          ctx.font = `600 10px ${FONT}`;
          const bw = ctx.measureText(badge).width + 12;
          const bx = px + 12 + labelW + 8;
          ctx.beginPath();
          ctx.roundRect(bx, py + 9, bw, 16, 8);
          ctx.fillStyle = PALETTE.redBg;
          ctx.fill();
          ctx.strokeStyle = PALETTE.red;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = PALETTE.red;
          ctx.fillText(badge, bx + 6, py + 12);
        }

        // ---- 하단 HUD ----
        // 화면 높이: 앞면의 투영 높이 = (s/d)·f
        const screenH = Math.round((s / d) * f);
        const warn = illusion && s > WARN_S;
        ctx.font = `11px ${FONT}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        const hudY = py + panelH - 10;
        let hx = px + 12;
        const seg = (text: string, color: string) => {
          ctx.fillStyle = color;
          ctx.fillText(text, hx, hudY);
          hx += ctx.measureText(text).width;
        };
        seg("실제 한 변 ", PALETTE.subtext);
        seg(`${s.toFixed(2)}칸`, warn ? PALETTE.red : PALETTE.subtext);
        seg(` · 화면 높이 ${screenH}px`, PALETTE.subtext);
      };

      // 왼쪽 s=1 고정, 오른쪽 s = 1 × (d/4) — 초기 d=4에서 양쪽이 완전히 같은 그림
      panel(0, 0, "일반 물리", 1, false);
      panel(stacked ? 0 : panelW + gap, stacked ? panelH + gap : 0, "착시 모드", d / D_INIT, true);
    };

    const ro = new ResizeObserver(() => {
      try {
        draw();
      } catch {
        // 그리기 예외가 observer를 죽이지 않게 한다
      }
    });
    ro.observe(container);
    draw();
    return () => ro.disconnect();
  }, [d]);

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
    whiteSpace: "nowrap",
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
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#495057", whiteSpace: "nowrap" }}>
          물체를 놓는 거리
        </span>
        <input
          type="range"
          min={D_MIN}
          max={D_MAX}
          step={0.1}
          value={d}
          onChange={(e) => setD(Number(e.target.value))}
          style={{ flex: 1, accentColor: "#228be6" }}
        />
        <span
          style={{
            fontSize: 12,
            color: "#868e96",
            width: 34,
            textAlign: "right",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {d.toFixed(1)}
        </span>
        <button style={btn} onClick={() => setD(D_INIT)}>
          리셋
        </button>
      </div>

      <div ref={containerRef}>
        <SvgCanvas ref={canvasRef} style={{ display: "block", width: "100%" }} />
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: "#adb5bd", textAlign: "center" }}>
        슬라이더를 밀어보세요 — 착시 모드의 큐브는 화면에서 꿈쩍도 않지만, 옆에 선 사람이 정체를
        폭로한다
      </div>
    </div>
  );
};
