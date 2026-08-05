import React, { useEffect, useRef } from "react";

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

// 시나리오 타임라인 (ms)
const T_CPU_IN = 3400; // CPU 작업이 루프로 들어가기 시작
const T_BLOCK = 4000; // 루프 정지
const T_UNBLOCK = 7000; // CPU 작업 종료, 루프 재개
const CYCLE = 10000;

// 4000ms 시점에 마커가 정확히 입구(왼쪽, θ=π)에서 멈추도록 잡은 속도 (8π/4000)
const BASE_SPEED = (8 * Math.PI) / 4000;

// 요청 도트의 수명 (processAt 기준 상대 시간)
const D_ARRIVE = 300; // 큐 진입 연출
const D_TO_LOOP = 250; // 큐 → 루프 입구
const D_RING = 350; // 루프 궤도 통과
const D_EXIT = 400; // 루프 → 응답
const D_IO_DWELL = 500; // libuv 체류
const NORMAL_LIFE = D_TO_LOOP + D_RING + D_EXIT; // 1000
const IO_LIFE = D_TO_LOOP + D_RING + D_IO_DWELL + D_RING + D_EXIT; // 1850

interface Req {
  t: number; // 발생 시각
  io: boolean;
  p: number; // 루프가 처리를 시작하는 시각
}

// 결정론적 스케줄: 정상 구간은 도착 후 즉시(t+450) 처리,
// 정지 구간(4000~7000)에 도착한 요청은 7150부터 150ms 간격으로 한꺼번에 소화된다.
const REQS: Req[] = (() => {
  const spawns: Array<[number, boolean]> = [
    [300, false],
    [700, true],
    [1200, false],
    [1800, true],
    [2300, false],
    [2900, false],
    [4300, false],
    [4750, false],
    [5200, false],
    [5650, false],
    [6100, false],
    [6550, false],
    [7000, false],
    [8500, false],
  ];
  let drain = 7150;
  return spawns.map(([t, io]) => {
    if (t <= 2900 || t >= 8000) return { t, io, p: t + 450 };
    const p = drain;
    drain += 150;
    return { t, io, p };
  });
})();

function clamp01(t: number) {
  return Math.min(1, Math.max(0, t));
}
function easeOut(t: number) {
  return 1 - Math.pow(1 - clamp01(t), 3);
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function quad(
  p0: [number, number],
  cp: [number, number],
  p1: [number, number],
  t: number,
): [number, number] {
  const u = 1 - t;
  return [
    u * u * p0[0] + 2 * u * t * cp[0] + t * t * p1[0],
    u * u * p0[1] + 2 * u * t * cp[1] + t * t * p1[1],
  ];
}

function fmtMs(v: number) {
  if (v >= 100) return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (v >= 10) return v.toFixed(0);
  return v.toFixed(1);
}

function drawDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  alpha: number,
) {
  if (alpha <= 0.01) return;
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.strokeStyle = "#dee2e6";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2 - 6, y2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#dee2e6";
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 7, y2 - 4);
  ctx.lineTo(x2 - 7, y2 + 4);
  ctx.closePath();
  ctx.fill();
}

export const EventLoopDemo = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let raf = 0;
    const start = performance.now();

    // 앞선 요청들이 큐를 빠져나가는 진행도를 반영한 부드러운 대기 순번
    const queueIndex = (i: number, e: number) => {
      const current = REQS[i];
      if (current === undefined) return 0;
      let idx = 0;
      for (let j = 0; j < REQS.length; j++) {
        if (j === i) continue;
        const r = REQS[j];
        if (r === undefined || r.t >= current.t || e < r.t) continue;
        idx += e < r.p ? 1 : 1 - easeOut((e - r.p) / D_TO_LOOP);
      }
      return idx;
    };

    const render = (now: number) => {
      const w = container.clientWidth;
      const dpr = window.devicePixelRatio || 1;
      const e = Math.max(0, (now - start) % CYCLE);
      const s = w / 640;

      // --- 레이아웃 ---
      const R = Math.max(62 * s, 42);
      const cx = w * 0.5;
      const cy = 58 + R;
      const queueX = w * 0.13;
      const respX = w * 0.87;
      const dotR = Math.max(5 * s, 4);
      const slotGap = Math.max(15 * s, 12);
      const boxW = Math.max(170 * s, 128);
      const boxH = Math.max(30 * s, 26);
      const boxY = cy + R + 34; // libuv 박스 top
      const lagY = boxY + boxH + 30;
      const capFs = Math.max(11 * s, 10);
      const h = lagY + 22 + capFs * 2.7;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      const labelFs = Math.max(11 * s, 10);
      const smallFs = Math.max(10 * s, 9);

      // 루프가 빨갛게 물드는 정도
      const redness =
        e < T_BLOCK
          ? clamp01((e - T_CPU_IN) / (T_BLOCK - T_CPU_IN)) * 0.3
          : e < T_UNBLOCK
            ? clamp01((e - T_BLOCK) / 400)
            : 1 - easeOut((e - T_UNBLOCK) / 500);

      // --- 프로세스 경계 ---
      const bx1 = cx - R - 26;
      const bx2 = cx + R + 26;
      const by1 = 30;
      const by2 = cy + R + 14;
      ctx.beginPath();
      ctx.roundRect(bx1, by1, bx2 - bx1, by2 - by1, 10);
      if (redness > 0.01) {
        ctx.globalAlpha = redness * 0.5;
        ctx.fillStyle = "#fff5f5";
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = redness > 0.5 ? "#fa5252" : "#adb5bd";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = `700 ${smallFs}px ${FONT}`;
      ctx.fillStyle = redness > 0.5 ? "#fa5252" : "#868e96";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("Node.js 프로세스 (싱글 스레드)", cx, by1 + 15);

      // --- 컬럼 헤더 ---
      ctx.font = `700 ${labelFs}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.fillText("대기 큐", queueX, 20);
      ctx.fillText("응답", respX, 20);

      const doneCount = REQS.filter((r) => e > r.p + (r.io ? IO_LIFE : NORMAL_LIFE)).length;
      ctx.font = `${smallFs}px ${FONT}`;
      ctx.fillStyle = "#adb5bd";
      ctx.fillText(`${doneCount}건 완료`, respX, 36);

      // --- 흐름 화살표 ---
      drawArrow(ctx, queueX + 24, cy, bx1 - 6, cy);
      drawArrow(ctx, bx2 + 6, cy, respX - 24, cy);

      // --- OS / libuv 박스 ---
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "#adb5bd";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, by2);
      ctx.lineTo(cx, boxY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.roundRect(cx - boxW / 2, boxY, boxW, boxH, 6);
      ctx.fillStyle = "#f8f9fa";
      ctx.fill();
      ctx.strokeStyle = "#adb5bd";
      ctx.stroke();
      ctx.font = `${smallFs}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      ctx.textBaseline = "middle";
      ctx.fillText("OS / libuv 스레드 풀", cx, boxY + boxH / 2 + 0.5);

      // --- 이벤트 루프 링 ---
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = "#e7f5ff";
      ctx.globalAlpha = 0.6;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#228be6";
      ctx.lineWidth = 3;
      ctx.stroke();
      if (redness > 0.01) {
        ctx.globalAlpha = redness;
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.fillStyle = "#fff5f5";
        ctx.fill();
        ctx.strokeStyle = "#fa5252";
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // CPU 블록이 중앙을 차지하는 동안 중앙 라벨은 숨긴다
      const cpuIn = easeOut((e - T_CPU_IN) / (T_BLOCK - T_CPU_IN));
      const cpuOut = easeOut((e - T_UNBLOCK) / 350);
      const cpuAlpha = e < T_CPU_IN ? 0 : e < T_UNBLOCK ? Math.min(1, cpuIn * 2) : 1 - cpuOut;
      ctx.globalAlpha = 1 - Math.min(1, cpuAlpha * 1.5);
      ctx.font = `700 ${labelFs}px ${FONT}`;
      ctx.fillStyle = "#1971c2";
      ctx.fillText("이벤트 루프", cx, cy + 0.5);
      ctx.globalAlpha = 1;

      // --- 궤도 마커 ---
      const spin = (t: number) => {
        const tt = ((t % CYCLE) + CYCLE) % CYCLE;
        if (tt < T_BLOCK) return tt * BASE_SPEED;
        if (tt < T_UNBLOCK) return T_BLOCK * BASE_SPEED;
        return T_BLOCK * BASE_SPEED + (tt - T_UNBLOCK) * BASE_SPEED * 1.4;
      };
      const markerPos = (t: number): [number, number] => {
        const th = Math.PI - spin(t);
        return [cx + R * Math.cos(th), cy - R * Math.sin(th)];
      };
      const spinning = e < T_BLOCK || e >= T_UNBLOCK;
      if (spinning) {
        for (let k = 5; k >= 1; k--) {
          const [tx, ty] = markerPos(e - k * 28);
          drawDot(ctx, tx, ty, dotR * 0.7, "#228be6", 0.3 - k * 0.045);
        }
      }
      const [mx, my] = markerPos(e);
      drawDot(ctx, mx, my, dotR + 1.5, redness > 0.5 ? "#fa5252" : "#228be6", 1);

      // --- 요청 도트 ---
      const loopEntry: [number, number] = [cx - R, cy];
      const loopExit: [number, number] = [cx + R, cy];
      const libuvTop: [number, number] = [cx, boxY - 4];

      REQS.forEach((r, i) => {
        const life = r.io ? IO_LIFE : NORMAL_LIFE;
        if (e < r.t || e > r.p + life) return;
        const color = r.io ? "#fab005" : "#228be6";
        const slotY = cy + queueIndex(i, e) * slotGap + Math.sin(e / 300 + i * 1.7) * 1.2;

        let x: number;
        let y: number;
        let alpha = 1;

        if (e < r.p) {
          // 큐 진입 및 대기
          const q = easeOut((e - r.t) / D_ARRIVE);
          x = lerp(queueX - 34, queueX, q);
          y = slotY;
          alpha = q;
        } else if (e < r.p + D_TO_LOOP) {
          // 큐 → 루프 입구
          const q = easeOut((e - r.p) / D_TO_LOOP);
          x = lerp(queueX, loopEntry[0], q);
          y = lerp(slotY, loopEntry[1], q);
        } else if (e < r.p + D_TO_LOOP + D_RING) {
          const q = easeOut((e - r.p - D_TO_LOOP) / D_RING);
          if (r.io) {
            // 루프 → libuv로 위임
            [x, y] = quad(loopEntry, [cx - R, cy + R], libuvTop, q);
          } else {
            // 궤도 위쪽을 타고 통과
            const th = Math.PI * (1 - q);
            x = cx + R * Math.cos(th);
            y = cy - R * Math.sin(th);
          }
        } else if (r.io && e < r.p + D_TO_LOOP + D_RING + D_IO_DWELL) {
          // libuv 체류 (I/O 진행 중)
          x = libuvTop[0];
          y = libuvTop[1];
        } else if (r.io && e < r.p + D_TO_LOOP + D_RING + D_IO_DWELL + D_RING) {
          // 콜백으로 루프에 복귀
          const q = easeOut((e - r.p - D_TO_LOOP - D_RING - D_IO_DWELL) / D_RING);
          [x, y] = quad(libuvTop, [cx + R, cy + R], loopExit, q);
        } else {
          // 루프 → 응답
          const q = easeOut((e - (r.p + life - D_EXIT)) / D_EXIT);
          const yOff = (((i * 47) % 60) - 30) * s;
          x = lerp(loopExit[0], respX + 10, q);
          y = lerp(loopExit[1], cy + yOff, q);
          alpha = 1 - clamp01((q - 0.55) / 0.45);
        }
        drawDot(ctx, x, y, dotR, color, alpha);

        // I/O 위임/콜백 라벨
        if (r.io) {
          const seg = e - r.p - D_TO_LOOP;
          ctx.font = `700 ${smallFs}px ${FONT}`;
          ctx.fillStyle = "#f08c00";
          if (seg >= 0 && seg < D_RING + D_IO_DWELL) {
            ctx.textAlign = "right";
            ctx.fillText("I/O 위임", cx - R * 0.75, cy + R * 0.85);
          } else if (seg >= D_RING + D_IO_DWELL && seg < D_RING + D_IO_DWELL + D_RING) {
            ctx.textAlign = "left";
            ctx.fillText("콜백", cx + R * 0.75, cy + R * 0.85);
          }
          ctx.textAlign = "center";
        }
      });

      // --- CPU 작업 블록 ---
      if (cpuAlpha > 0.01) {
        const bw = Math.max(150 * s, 118);
        const bh = Math.max(36 * s, 32);
        let px: number;
        let py: number;
        if (e < T_BLOCK) {
          px = lerp(queueX + 20, cx, cpuIn);
          py = lerp(cy - R - 34, cy, cpuIn);
        } else if (e < T_UNBLOCK) {
          px = cx;
          py = cy;
        } else {
          px = lerp(cx, cx + R + 50, cpuOut);
          py = lerp(cy, cy - 20, cpuOut);
        }
        ctx.globalAlpha = cpuAlpha;
        ctx.beginPath();
        ctx.roundRect(px - bw / 2, py - bh / 2, bw, bh, 6);
        ctx.fillStyle = "#fa5252";
        ctx.fill();
        ctx.strokeStyle = "#e03131";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.font = `700 ${smallFs}px ${FONT}`;
        ctx.fillText("CPU 작업 1.5s", px, py - bh * 0.18);
        ctx.font = `${Math.max(smallFs - 1, 8)}px ${FONT}`;
        ctx.fillText("이미지 리사이즈", px, py + bh * 0.24);
        ctx.globalAlpha = 1;
      }

      // --- 이벤트 루프 지연 수치 ---
      let lag: number;
      if (e < T_BLOCK) {
        lag = 0.25 + 0.15 * Math.sin(e * 0.004);
      } else if (e < T_UNBLOCK) {
        lag = ((e - T_BLOCK) / (T_UNBLOCK - T_BLOCK)) * 1500;
      } else {
        lag = Math.max(
          1500 * (1 - easeOut((e - T_UNBLOCK) / 900)),
          0.25 + 0.15 * Math.sin(e * 0.004),
        );
      }
      const lagHigh = lag >= 10;
      const lagLabel = "이벤트 루프 지연(event loop lag): ";
      const lagValue = `${fmtMs(lag)} ms`;
      const lagFs = Math.max(12 * s, 11);
      ctx.font = `${lagFs}px ${FONT}`;
      const lw1 = ctx.measureText(lagLabel).width;
      ctx.font = `700 ${lagFs}px ${FONT}`;
      const lw2 = ctx.measureText(lagValue).width;
      const lagX = cx - (lw1 + lw2) / 2;
      ctx.textAlign = "left";
      ctx.font = `${lagFs}px ${FONT}`;
      ctx.fillStyle = "#495057";
      ctx.fillText(lagLabel, lagX, lagY);
      ctx.font = `700 ${lagFs}px ${FONT}`;
      ctx.fillStyle = lagHigh ? "#fa5252" : "#2f9e44";
      ctx.fillText(lagValue, lagX + lw1, lagY);
      ctx.textAlign = "center";

      // --- 하단 단계 설명 ---
      let caption =
        "① I/O는 위임하고 루프는 계속 돈다 — 싱글 스레드로도 수천 개의 동시 연결을 처리한다";
      if (e >= T_UNBLOCK) {
        caption = "④ 작업이 끝난 뒤에야 밀린 큐가 한꺼번에 처리된다 — 루프 지연이 곧 응답 지연이다";
      } else if (e >= T_BLOCK + 800) {
        caption =
          "③ 스레드 풀 서버라면 스레드 1개가 느려질 뿐이지만, Node는 프로세스 전체가 멈춘다";
      } else if (e >= T_CPU_IN) {
        caption = "② 무거운 CPU 작업이 들어오면 루프가 그 자리에서 멈춘다";
      }
      ctx.font = `${capFs}px ${FONT}`;
      ctx.fillStyle = "#868e96";
      const maxW = w - 16;
      const words = caption.split(" ");
      const lines: string[] = [];
      let line = "";
      words.forEach((word) => {
        const next = line ? `${line} ${word}` : word;
        if (ctx.measureText(next).width > maxW && line) {
          lines.push(line);
          line = word;
        } else {
          line = next;
        }
      });
      if (line) lines.push(line);
      const lh = capFs * 1.35;
      lines.forEach((l, k) => {
        ctx.fillText(l, cx, h - 8 - (lines.length - 1 - k) * lh);
      });

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, []);

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
      <div ref={containerRef}>
        <canvas ref={canvasRef} style={{ display: "block", width: "100%" }} />
      </div>
    </div>
  );
};
