"use client";

import { useEffect, useRef } from "react";
import {
    cancelMaterialFrame,
    scheduleMaterialFrame,
} from "#components/materials/runtime/scheduler";
import {
    SvgCanvas,
    type SvgCanvasHandle,
    type SvgDrawingContext,
} from "#components/materials/runtime/svg-canvas";

const FONT =
    "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

// 시나리오 타임라인 (ms)
const SLOW_START = 3000; // ② DB 슬로 쿼리 발생
const RECOVER = 7000; // ④ DB 회복
const CYCLE = 11000;

// 시뮬레이션 상수 (결정론적: 난수 없음)
const THREADS = 8;
const ARRIVE_START = 200; // 첫 요청 도착
const ARRIVE_INTERVAL = 180; // 요청 유입 간격 (사이클 내내 일정)
const ARRIVE_END = 9400; // 마지막 요청 도착
const NORMAL_HOLD = 500; // 정상 시 슬롯 점유 시간 (연출용 배속)
const SLOW_HOLD = 2000; // 슬로 쿼리 시 슬롯 점유 시간
const TRAVEL = 450; // 유입 도트가 큐까지 이동하는 시간
const FLASH = 180; // 슬롯 반납 직후 초록 플래시 시간

interface Req {
    arrive: number;
    start: number;
    end: number;
    slot: number;
}

// 8칸 스레드 풀 + FIFO 대기 큐를 미리 시뮬레이션해 둔다.
// 입력이 모두 상수이므로 매 사이클 같은 그림이 나온다.
function simulate(): Req[] {
    const freeAt = Array.from<number>({ length: THREADS }).fill(0);
    const reqs: Req[] = [];
    for (let a = ARRIVE_START; a <= ARRIVE_END; a += ARRIVE_INTERVAL) {
        let slot = 0;
        for (let i = 1; i < THREADS; i += 1) {
            if (freeAt[i]! < freeAt[slot]!) slot = i;
        }
        const start = Math.max(a, freeAt[slot]!);
        let end: number;
        if (start < SLOW_START) {
            end = start + NORMAL_HOLD;
        } else if (start < RECOVER) {
            // 회복 시점에는 물려 있던 슬로 쿼리도 순차적으로 빠르게 반환된다
            end = Math.min(start + SLOW_HOLD, RECOVER + 150 + slot * 40);
        } else {
            end = start + NORMAL_HOLD;
        }
        freeAt[slot] = end;
        reqs.push({ arrive: a, start, end, slot });
    }
    return reqs;
}

const REQS = simulate();
// 처음으로 대기가 발생하는 시점 = 풀 고갈(③) 시작
const EXHAUST_T = REQS.find((r) => r.start - r.arrive > 30)?.arrive ?? 4500;

function clamp01(t: number) {
    return Math.min(1, Math.max(0, t));
}
function easeOut(t: number) {
    return 1 - Math.pow(1 - clamp01(t), 3);
}
function formatMs(n: number) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// 화면에 표시할 "체감 응답 시간".
// 정상 점유(연출용 500ms)는 실제로는 DB 20ms짜리 요청이므로 40ms로 환산하고,
// 슬로 쿼리 점유·대기 시간은 시뮬레이션 시간을 그대로 스토리 시간으로 쓴다.
function storyLatency(e: number): number {
    const dbNow = e >= SLOW_START && e < RECOVER ? 2000 : 20;
    let completed = 40; // 가장 최근에 응답을 끝낸 요청의 지연
    let lastEnd = -1;
    let estimate = 0; // 아직 처리 중인 요청이 겪게 될 지연의 하한
    for (const r of REQS) {
        if (r.end <= e) {
            if (r.end > lastEnd) {
                lastEnd = r.end;
                const db = r.end - r.start > NORMAL_HOLD ? r.end - r.start : 20;
                completed = Math.max(40, r.start - r.arrive + db + 20);
            }
        } else if (r.arrive <= e && r.start > e) {
            // 큐에서 대기 중: 지금까지 기다린 시간 + 앞으로 걸릴 DB 시간
            estimate = Math.max(estimate, e - r.arrive + dbNow + 40);
        } else if (r.start <= e && r.end - r.start > NORMAL_HOLD) {
            // 슬로 쿼리를 물고 있는 중
            estimate = Math.max(estimate, e - r.arrive + 40);
        }
    }
    return Math.round(Math.max(completed, estimate) / 10) * 10;
}

function drawArrow(ctx: SvgDrawingContext, x1: number, x2: number, y: number) {
    ctx.strokeStyle = "#adb5bd";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2 - 5, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y);
    ctx.lineTo(x2 - 6, y - 4);
    ctx.lineTo(x2 - 6, y + 4);
    ctx.closePath();
    ctx.fillStyle = "#adb5bd";
    ctx.fill();
}

function colHeader(
    ctx: SvgDrawingContext,
    text: string,
    x: number,
    y: number,
    fs: number,
) {
    ctx.font = `700 ${fs}px ${FONT}`;
    ctx.fillStyle = "#868e96";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(text, x, y);
}

export const ThreadPoolDemo = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<SvgCanvasHandle>(null);

    useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;

        let raf = 0;
        const start = performance.now();

        const render = (now: number) => {
            const w = container.clientWidth;
            const dpr = window.devicePixelRatio || 1;
            const e = Math.max(0, (now - start) % CYCLE);
            const s = w / 640;
            const mobile = w < 480;

            // --- 레이아웃 ---
            const pad = 10;
            const cellW = Math.max(30, 46 * s);
            const cellH = Math.max(24, 36 * s);
            const cellGap = Math.max(4, 6 * s);
            const poolPad = Math.max(6, 8 * s);
            const poolW = cellW * 4 + cellGap * 3 + poolPad * 2;
            const poolH = cellH * 2 + cellGap + poolPad * 2;
            const dbW = Math.max(52, 74 * s);
            const dbH = Math.max(44, 56 * s);
            const arrowW = Math.max(14, 22 * s);
            const inflowW = mobile ? 30 : Math.max(48, 70 * s);
            const queueW = Math.max(
                44,
                w - pad * 2 - inflowW - poolW - dbW - arrowW * 2,
            );

            const statsFs = Math.max(10, 12.5 * s);
            const labelFs = Math.max(9, 11 * s);
            const statsY = 14;
            const labelY = statsY + Math.max(22, 26 * s);
            const top = labelY + 10;
            const midY = top + poolH / 2;
            const capFs = Math.max(10, 12 * s);
            const h = top + poolH + 36;

            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;

            const ctx = canvas.getContext("2d")!;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.scale(dpr, dpr);

            const queueX = pad + inflowW;
            const poolX = queueX + queueW + arrowW;
            const dbX = poolX + poolW + arrowW;

            const slow = e >= SLOW_START && e < RECOVER;
            const waiting = REQS.filter((r) => r.arrive <= e && r.start > e); // 도착 순 = 큐 순서
            const active = REQS.filter((r) => r.start <= e && r.end > e);

            // --- 상단 실시간 수치 ---
            const lat = storyLatency(e);
            const segs: Array<[string, string, boolean]> = [
                ["활성 스레드 ", "#868e96", false],
                [
                    `${active.length}/${THREADS}`,
                    active.length >= THREADS ? "#fa5252" : "#228be6",
                    true,
                ],
                ["  ·  대기 큐 ", "#868e96", false],
                [
                    `${waiting.length}`,
                    waiting.length > 0 ? "#fa5252" : "#228be6",
                    true,
                ],
                ["  ·  체감 응답 시간 ", "#868e96", false],
                [`${formatMs(lat)}ms`, lat > 500 ? "#fa5252" : "#228be6", true],
            ];
            ctx.textBaseline = "middle";
            ctx.textAlign = "left";
            const widths = segs.map(([text, , bold]) => {
                ctx.font = `${bold ? "700 " : ""}${statsFs}px ${FONT}`;
                return ctx.measureText(text).width;
            });
            let sx = w / 2 - widths.reduce((a, b) => a + b, 0) / 2;
            segs.forEach(([text, color, bold], i) => {
                ctx.font = `${bold ? "700 " : ""}${statsFs}px ${FONT}`;
                ctx.fillStyle = color;
                ctx.fillText(text, sx, statsY);
                sx += widths[i]!;
            });

            // --- 구역 라벨 ---
            if (!mobile) colHeader(ctx, "유입 요청", pad, labelY, labelFs);
            colHeader(ctx, "대기 큐", queueX + 2, labelY, labelFs);
            colHeader(ctx, `스레드 풀 (${THREADS}칸)`, poolX, labelY, labelFs);

            // --- 유입 경로 (점선 가이드) ---
            ctx.strokeStyle = "#dee2e6";
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 4]);
            ctx.beginPath();
            ctx.moveTo(pad, midY);
            ctx.lineTo(queueX - 2, midY);
            ctx.stroke();
            ctx.setLineDash([]);

            // --- 대기 큐 (가로 슬롯, 오른쪽이 맨 앞) ---
            const slotSize = Math.max(14, 20 * s);
            const slotGap = 4;
            const visible = Math.max(
                2,
                Math.min(8, Math.floor((queueW - 6) / (slotSize + slotGap))),
            );
            const slotX = (i: number) =>
                queueX + queueW - (i + 1) * (slotSize + slotGap) + slotGap;
            const slotY = midY - slotSize / 2;
            for (let i = 0; i < visible; i += 1) {
                ctx.beginPath();
                ctx.roundRect(slotX(i), slotY, slotSize, slotSize, 3);
                ctx.fillStyle = "#f8f9fa";
                ctx.fill();
                ctx.strokeStyle = "#dee2e6";
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            waiting.forEach((r, i) => {
                if (i >= visible) return;
                const pop = easeOut((e - r.arrive) / 150);
                ctx.beginPath();
                ctx.arc(
                    slotX(i) + slotSize / 2,
                    midY,
                    slotSize * 0.32 * pop,
                    0,
                    Math.PI * 2,
                );
                ctx.fillStyle = "#fab005";
                ctx.fill();
            });
            if (waiting.length > visible) {
                ctx.font = `700 ${Math.max(9, labelFs - 1)}px ${FONT}`;
                ctx.fillStyle = "#fa5252";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(
                    `+${waiting.length - visible}`,
                    slotX(visible - 1) + slotSize / 2,
                    slotY + slotSize + 9,
                );
            }

            // --- 유입 도트 (큐를 향해 이동 중인 요청) ---
            const dotR = Math.max(3.5, 5 * s);
            const destX = slotX(Math.min(waiting.length, visible - 1));
            for (const r of REQS) {
                if (e < r.arrive - TRAVEL || e >= r.arrive) continue;
                const p = (e - (r.arrive - TRAVEL)) / TRAVEL;
                ctx.beginPath();
                ctx.arc(
                    pad + 4 + (destX - 6 - pad) * p,
                    midY,
                    dotR,
                    0,
                    Math.PI * 2,
                );
                ctx.fillStyle = "#228be6";
                ctx.fill();
            }

            // --- 화살표: 큐 → 풀 → DB ---
            drawArrow(ctx, queueX + queueW + 3, poolX - 3, midY);
            drawArrow(ctx, poolX + poolW + 3, dbX - 3, midY);

            // --- 스레드 풀 (2×4 비둘기집) ---
            ctx.beginPath();
            ctx.roundRect(poolX, top, poolW, poolH, 6);
            ctx.fillStyle = "#f8f9fa";
            ctx.fill();
            ctx.strokeStyle = "#dee2e6";
            ctx.lineWidth = 1;
            ctx.stroke();
            for (let slot = 0; slot < THREADS; slot += 1) {
                const cx = poolX + poolPad + (slot % 4) * (cellW + cellGap);
                const cy = top + poolPad + (slot < 4 ? 0 : cellH + cellGap);
                const occ = active.find((r) => r.slot === slot);
                ctx.beginPath();
                ctx.roundRect(cx, cy, cellW, cellH, 4);
                if (occ) {
                    ctx.fillStyle = "#e7f5ff";
                    ctx.fill();
                    ctx.globalAlpha = easeOut((e - occ.start) / 150);
                    ctx.fillStyle = "#228be6";
                    ctx.fill();
                    ctx.globalAlpha = 1;
                    ctx.strokeStyle = "#1c7ed6";
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    // 점유 시간에 비례한 프로그레스
                    const p = clamp01((e - occ.start) / (occ.end - occ.start));
                    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
                    ctx.fillRect(cx + 3, cy + cellH - 6, (cellW - 6) * p, 3);
                } else {
                    ctx.fillStyle = "#fff";
                    ctx.fill();
                    ctx.strokeStyle = "#adb5bd";
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    // 방금 반납된 칸은 초록으로 잠깐 빛난다
                    let flashA = 0;
                    for (const r of REQS) {
                        if (
                            r.slot === slot &&
                            e >= r.end &&
                            e - r.end < FLASH
                        ) {
                            flashA = Math.max(flashA, 1 - (e - r.end) / FLASH);
                        }
                    }
                    if (flashA > 0.01) {
                        ctx.globalAlpha = flashA;
                        ctx.strokeStyle = "#40c057";
                        ctx.lineWidth = 2;
                        ctx.stroke();
                        ctx.globalAlpha = 1;
                    }
                }
            }

            // --- DB 박스 ---
            const dbY = midY - dbH / 2;
            ctx.beginPath();
            ctx.roundRect(dbX, dbY, dbW, dbH, 6);
            ctx.fillStyle = slow ? "#fff5f5" : "#fff";
            ctx.fill();
            ctx.strokeStyle = slow ? "#fa5252" : "#40c057";
            ctx.lineWidth = 2;
            ctx.globalAlpha = slow ? 0.75 + 0.25 * Math.sin(e / 120) : 1;
            ctx.stroke();
            ctx.globalAlpha = 1;
            const dbFs = Math.max(11, 13 * s);
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = `700 ${dbFs}px ${FONT}`;
            ctx.fillStyle = "#495057";
            ctx.fillText("DB", dbX + dbW / 2, midY - dbFs * 0.55);
            ctx.font = `700 ${Math.max(9, 11 * s)}px ${FONT}`;
            ctx.fillStyle = slow ? "#fa5252" : "#2f9e44";
            ctx.fillText(
                slow ? "2,000ms" : "20ms",
                dbX + dbW / 2,
                midY + dbFs * 0.6,
            );

            // --- 하단 단계 설명 ---
            let caption =
                "① 정상: DB가 20ms에 응답해 스레드 8개가 여유 있게 순환한다";
            if (e >= RECOVER) {
                caption =
                    "④ DB 회복: 밀린 대기 큐가 빠르게 소화되고 응답 시간이 정상으로 돌아온다";
            } else if (e >= EXHAUST_T) {
                caption =
                    "③ 스레드 8개에 처리 중 요청이 8개를 넘는 순간, 누군가는 반드시 기다린다";
            } else if (e >= SLOW_START) {
                caption =
                    "② DB에 슬로 쿼리 발생: 반납이 느려져 슬롯 8칸이 순식간에 가득 찬다";
            }
            ctx.font = `${capFs}px ${FONT}`;
            ctx.fillStyle = "#868e96";
            ctx.textAlign = "center";
            ctx.textBaseline = "alphabetic";
            ctx.fillText(caption, w / 2, h - 10);
            ctx.textAlign = "left";

            raf = scheduleMaterialFrame(render);
        };

        raf = scheduleMaterialFrame(render);
        return () => cancelMaterialFrame(raf);
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
                <SvgCanvas
                    ref={canvasRef}
                    style={{ display: "block", width: "100%" }}
                />
            </div>
        </div>
    );
};
