"use client";

import { useEffect, useRef } from "react";
import {
    cancelMaterialFrame,
    scheduleMaterialFrame,
} from "#components/materials/runtime/scheduler";
import {
    SvgCanvas,
    type SvgCanvasHandle,
} from "#components/materials/runtime/svg-canvas";

const FONT =
    "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";

type Mode = "simple" | "coalesce" | "swr";

// 타이밍 (ms) — 세 레인 모두 동일한 시계를 쓴다
const TTL = 3000; // 캐시가 신선한 시간
const FETCH = 1000; // 원본 응답에 걸리는 시간
const SPAWN_INTERVAL = 180; // 요청 발생 간격
const IN_DUR = 700; // 요청 → 캐시
const OUT_DUR = 700; // 캐시 → 요청 (응답)
const ORIGIN_DUR = 500; // 캐시 → 원본 (편도)
const GAUGE_FILL = 300; // TTL 게이지가 차오르는 시간
const RESET_CYCLES = 3; // 이 횟수만큼 TTL 주기가 지나면 카운터 리셋
const RESET_HOLD = 1000; // 리셋 직전 최종 숫자 강조 시간

type Phase = "in" | "toOrigin" | "fromOrigin" | "wait" | "out";

interface Dot {
    phase: Phase;
    t: number; // 현재 phase에서의 경과 시간 (음수면 출발 대기)
    jy: number; // 세로 흔들림 (-1 ~ 1)
    color: string;
    ghost?: boolean; // SWR의 백그라운드 갱신 요청
    qi?: number; // 대기열 순번
}

type CacheState = "fresh" | "expired" | "fetching";

interface Lane {
    mode: Mode;
    label: string;
    counterColor: string;
    dots: Dot[];
    cacheState: CacheState;
    cacheT: number; // 현재 상태에서의 경과 시간
    originHits: number;
    originFlash: number;
    counterPulse: number;
}

function clamp01(t: number) {
    return Math.min(1, Math.max(0, t));
}
function easeInOut(t: number) {
    const p = clamp01(t);
    return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
}

export const StampedeDemo = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<SvgCanvasHandle>(null);

    useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;

        let raf = 0;
        let last = -1;
        let spawnAcc = SPAWN_INTERVAL; // 시작하자마자 첫 요청 발생
        let spawnCount = 0;
        let completedCycles = 0; // 완료된 TTL 주기 수
        let resetTimer = -1; // > 0 이면 리셋 카운트다운(강조 구간)

        const makeLane = (
            mode: Mode,
            label: string,
            counterColor: string,
        ): Lane => ({
            mode,
            label,
            counterColor,
            dots: [],
            cacheState: "fresh",
            cacheT: 0,
            originHits: 0,
            originFlash: 0,
            counterPulse: 0,
        });

        const lanes: Lane[] = [
            makeLane("simple", "단순 TTL", "#fa5252"),
            makeLane("coalesce", "요청 병합", "#40c057"),
            makeLane("swr", "병합 + SWR", "#40c057"),
        ];

        const releaseWaiters = (lane: Lane) => {
            let i = 0;
            for (const d of lane.dots) {
                if (d.phase === "wait") {
                    d.phase = "out";
                    d.t = -i * 60; // 약간씩 시차를 두고 흩어진다
                    d.color = "#40c057";
                    i += 1;
                }
            }
        };

        const stepLane = (lane: Lane, li: number, dt: number, now: number) => {
            // 캐시 상태 진행 — 세 레인의 스폰·이동이 동일하므로 전이 시점도 동기화된다
            lane.cacheT += dt;
            if (lane.cacheState === "fresh" && lane.cacheT >= TTL) {
                lane.cacheState = "expired";
                lane.cacheT = 0;
            } else if (lane.cacheState === "fetching" && lane.cacheT >= FETCH) {
                lane.cacheState = "fresh";
                lane.cacheT = 0;
                releaseWaiters(lane);
                if (li === 0) completedCycles += 1; // 주기 카운트는 첫 레인 기준
            }

            // 점 이동
            const next: Dot[] = [];
            for (const d of lane.dots) {
                d.t += dt;

                if (d.phase === "in" && d.t >= IN_DUR) {
                    // 캐시 도착
                    if (lane.cacheState === "fresh") {
                        d.phase = "out";
                        d.t = 0;
                        d.color = "#40c057"; // HIT
                    } else if (lane.mode === "simple") {
                        // 만료/조회 중이면 전부 원본으로 관통 (스탬피드)
                        if (lane.cacheState === "expired") {
                            lane.cacheState = "fetching";
                            lane.cacheT = 0;
                        }
                        d.phase = "toOrigin";
                        d.t = 0;
                        d.color = "#fa5252";
                    } else if (lane.mode === "coalesce") {
                        if (lane.cacheState === "expired") {
                            // 첫 요청만 원본으로
                            lane.cacheState = "fetching";
                            lane.cacheT = 0;
                            d.phase = "toOrigin";
                            d.t = 0;
                            d.color = "#fa5252";
                        } else {
                            // 나머지는 캐시 앞에서 대기
                            d.phase = "wait";
                            d.t = 0;
                            d.qi = lane.dots.filter(
                                (o) => o.phase === "wait",
                            ).length;
                            d.color = "#adb5bd";
                        }
                    } else {
                        // SWR: 낡은 값으로 즉시 응답, 갱신용 점 1개만 원본 왕복
                        if (lane.cacheState === "expired") {
                            lane.cacheState = "fetching";
                            lane.cacheT = 0;
                            lane.dots.push({
                                phase: "toOrigin",
                                t: 0,
                                jy: 0,
                                color: "#845ef7",
                                ghost: true,
                            });
                        }
                        d.phase = "out";
                        d.t = 0;
                        d.color = "#fab005"; // stale 응답
                    }
                }

                if (d.phase === "toOrigin" && d.t >= ORIGIN_DUR) {
                    lane.originHits += 1;
                    lane.originFlash = 1;
                    lane.counterPulse = 1;
                    d.phase = "fromOrigin";
                    d.t = 0;
                }

                if (d.phase === "fromOrigin" && d.t >= ORIGIN_DUR) {
                    if (d.ghost) continue; // 갱신 요청은 캐시에 흡수되며 사라진다
                    d.phase = "out";
                    d.t = 0;
                    d.color = "#40c057";
                }

                if (d.phase === "out" && d.t >= OUT_DUR) continue; // 응답 완료, 제거
                next.push(d);
            }
            lane.dots = next;

            lane.originFlash = Math.max(0, lane.originFlash - dt / 450);
            lane.counterPulse = Math.max(0, lane.counterPulse - dt / 350);
            void now;
        };

        const stepSim = (dt: number, now: number) => {
            // 요청 생성 — 세 레인에 완전히 같은 순간, 같은 흔들림으로 투입
            spawnAcc += dt;
            while (spawnAcc >= SPAWN_INTERVAL) {
                spawnAcc -= SPAWN_INTERVAL;
                spawnCount += 1;
                const jy = Math.sin(spawnCount * 2.1);
                for (const lane of lanes) {
                    lane.dots.push({ phase: "in", t: 0, jy, color: "#228be6" });
                }
            }

            lanes.forEach((lane, li) => stepLane(lane, li, dt, now));

            // 3주기마다 카운터 리셋 (직전 1초는 최종 숫자를 강조)
            if (completedCycles >= RESET_CYCLES && resetTimer < 0) {
                resetTimer = RESET_HOLD;
            }
            if (resetTimer >= 0) {
                resetTimer -= dt;
                if (resetTimer < 0) {
                    for (const lane of lanes) {
                        lane.originHits = 0;
                        lane.counterPulse = 0;
                    }
                    completedCycles = 0;
                }
            }
        };

        const render = (now: number) => {
            if (last < 0) last = now;
            const dt = Math.min(64, Math.max(0, now - last));
            last = now;
            stepSim(dt, now);

            const w = container.clientWidth;
            if (w <= 0) {
                raf = scheduleMaterialFrame(render);
                return;
            }
            const dpr = window.devicePixelRatio || 1;
            const sc = Math.min(1, Math.max(0.55, w / 640));
            const mobile = w < 480;
            const laneH = mobile ? 96 : 126;
            const topPad = 4;
            const h = topPad + laneH * 3 + 6;

            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;

            const ctx = canvas.getContext("2d")!;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.scale(dpr, dpr);

            const fs = Math.max(10, 12 * sc);
            const dotR = Math.max(3, 4.5 * sc);
            const margin = Math.max(10, 16 * sc);
            const headerH = mobile ? 20 : 24;

            // 박스 배치 (모든 레인 공통 x 좌표)
            const bw = Math.max(58, 90 * sc);
            const bh = mobile ? 44 : Math.max(48, 58 * sc);
            const cacheCX = w * 0.5;
            const cacheL = cacheCX - bw / 2;
            const cacheR = cacheCX + bw / 2;
            const originL = w - margin - bw;
            const originR = w - margin;
            const spawnX = margin + dotR + 6;
            const highlight = resetTimer >= 0;

            lanes.forEach((lane, li) => {
                const laneTop = topPad + li * laneH;
                const laneY = laneTop + headerH + (laneH - headerH) * 0.52;
                const boxTop = laneY - bh / 2;
                const headerY = laneTop + headerH * 0.62;
                const jAmp = Math.max(8, 12 * sc);

                // 레인 구분선
                if (li > 0) {
                    ctx.strokeStyle = "#f1f3f5";
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(0, laneTop);
                    ctx.lineTo(w, laneTop);
                    ctx.stroke();
                }

                // --- 레인 라벨 ---
                ctx.textBaseline = "middle";
                ctx.textAlign = "left";
                const markR = Math.max(3, 4 * sc);
                ctx.beginPath();
                ctx.arc(margin + markR, headerY, markR, 0, Math.PI * 2);
                ctx.fillStyle = lane.counterColor;
                ctx.fill();
                ctx.font = `700 ${Math.max(11, fs + 1)}px ${FONT}`;
                ctx.fillStyle = "#495057";
                ctx.fillText(lane.label, margin + markR * 2 + 6, headerY);

                // --- 원본 도달 카운터 (크게) ---
                const pulseScale = 1 + 0.25 * lane.counterPulse;
                const numFs =
                    Math.max(15, 19 * sc) * pulseScale * (highlight ? 1.12 : 1);
                const labFs = Math.max(9, fs - 1);
                const numStr = String(lane.originHits);
                ctx.font = `800 ${numFs}px ${FONT}`;
                const numW = ctx.measureText(numStr).width;
                ctx.font = `${labFs}px ${FONT}`;
                const labStr = "원본 도달 ";
                const labW = ctx.measureText(labStr).width;

                if (highlight) {
                    // 리셋 직전 최종 숫자 강조 배경
                    const pillW = labW + numW + 18;
                    const pillH = Math.max(20, numFs + 8);
                    ctx.beginPath();
                    ctx.roundRect(
                        originR - pillW,
                        headerY - pillH / 2,
                        pillW,
                        pillH,
                        pillH / 2,
                    );
                    ctx.fillStyle =
                        lane.counterColor === "#fa5252" ? "#ffe3e3" : "#d3f9d8";
                    ctx.fill();
                }
                ctx.textAlign = "right";
                ctx.font = `800 ${numFs}px ${FONT}`;
                ctx.fillStyle = lane.counterColor;
                ctx.fillText(numStr, originR - (highlight ? 6 : 0), headerY);
                ctx.font = `${labFs}px ${FONT}`;
                ctx.fillStyle = "#868e96";
                ctx.fillText(
                    labStr,
                    originR - numW - 3 - (highlight ? 6 : 0),
                    headerY,
                );
                ctx.textAlign = "left";

                // --- 경로 안내선 ---
                ctx.strokeStyle = "#f1f3f5";
                ctx.lineWidth = Math.max(2, 3.5 * sc);
                ctx.beginPath();
                ctx.moveTo(spawnX, laneY);
                ctx.lineTo(cacheL, laneY);
                ctx.moveTo(cacheR, laneY);
                ctx.lineTo(originL, laneY);
                ctx.stroke();

                // --- 요청 발생 지점 ---
                const pulse = 1 + 0.2 * Math.sin(now * 0.006);
                ctx.beginPath();
                ctx.arc(spawnX, laneY, dotR * 1.4 * pulse, 0, Math.PI * 2);
                ctx.fillStyle = "#e7f5ff";
                ctx.fill();
                ctx.beginPath();
                ctx.arc(spawnX, laneY, dotR * 0.8, 0, Math.PI * 2);
                ctx.fillStyle = "#228be6";
                ctx.fill();
                ctx.font = `${Math.max(9, fs - 2)}px ${FONT}`;
                ctx.fillStyle = "#adb5bd";
                ctx.textAlign = "center";
                ctx.fillText(
                    "요청",
                    spawnX,
                    boxTop + bh + Math.max(9, 11 * sc),
                );

                // --- 캐시 박스 ---
                const staleDuringFetch =
                    lane.mode === "swr" && lane.cacheState !== "fresh";
                let cacheFill = "#fff";
                let cacheStroke = "#adb5bd";
                if (lane.cacheState === "fresh") {
                    cacheStroke = "#40c057";
                } else if (staleDuringFetch) {
                    cacheFill = "#fff9db";
                    cacheStroke = "#fab005";
                } else {
                    cacheFill = "#fff5f5";
                    cacheStroke = "#fa5252";
                }
                ctx.beginPath();
                ctx.roundRect(cacheL, boxTop, bw, bh, 6);
                ctx.fillStyle = cacheFill;
                ctx.fill();
                ctx.strokeStyle = cacheStroke;
                ctx.lineWidth = 1.5;
                ctx.stroke();

                ctx.font = `700 ${fs}px ${FONT}`;
                ctx.fillStyle = "#495057";
                ctx.textAlign = "center";
                ctx.fillText("캐시", cacheCX, boxTop + bh * 0.28);

                // 상태 텍스트 (모바일에서는 생략)
                if (!mobile) {
                    ctx.font = `${Math.max(9, fs - 2)}px ${FONT}`;
                    if (lane.cacheState === "fresh") {
                        ctx.fillStyle = "#2f9e44";
                        ctx.fillText("신선", cacheCX, boxTop + bh * 0.55);
                    } else if (staleDuringFetch) {
                        ctx.fillStyle = "#e8a005";
                        ctx.fillText(
                            "낡음(stale)",
                            cacheCX,
                            boxTop + bh * 0.55,
                        );
                    } else {
                        ctx.fillStyle = "#fa5252";
                        ctx.fillText("비어 있음", cacheCX, boxTop + bh * 0.55);
                    }
                }

                // TTL 게이지: 차오른 뒤 소진
                const gx = cacheL + 8;
                const gw = bw - 16;
                const gh = Math.max(4, 6 * sc);
                const gy = boxTop + bh - gh - Math.max(6, 8 * sc);
                ctx.beginPath();
                ctx.roundRect(gx, gy, gw, gh, gh / 2);
                ctx.fillStyle = "#f1f3f5";
                ctx.fill();
                let frac = 0;
                if (lane.cacheState === "fresh") {
                    frac =
                        lane.cacheT < GAUGE_FILL
                            ? easeInOut(lane.cacheT / GAUGE_FILL)
                            : 1 -
                              (lane.cacheT - GAUGE_FILL) / (TTL - GAUGE_FILL);
                } else if (staleDuringFetch) {
                    frac = 1; // stale 값은 남아 있다
                }
                frac = clamp01(frac);
                if (frac > 0.005) {
                    ctx.beginPath();
                    ctx.roundRect(gx, gy, gw * frac, gh, gh / 2);
                    ctx.fillStyle = staleDuringFetch
                        ? "#fab005"
                        : frac < 0.25
                          ? "#fab005"
                          : "#40c057";
                    ctx.fill();
                }

                // --- 원본 박스 ---
                ctx.beginPath();
                ctx.roundRect(originL, boxTop, bw, bh, 6);
                ctx.fillStyle = "#fff";
                ctx.fill();
                if (lane.originFlash > 0.01) {
                    ctx.fillStyle = `rgba(255, 227, 227, ${lane.originFlash})`;
                    ctx.fill();
                }
                ctx.strokeStyle =
                    lane.originFlash > 0.05 ? "#fa5252" : "#adb5bd";
                ctx.lineWidth = lane.originFlash > 0.05 ? 2 : 1.5;
                ctx.stroke();

                ctx.font = `700 ${fs}px ${FONT}`;
                ctx.fillStyle = "#495057";
                ctx.fillText(
                    "원본",
                    (originL + originR) / 2,
                    boxTop + bh * 0.36,
                );
                // 서버 느낌의 가로줄
                ctx.strokeStyle = "#dee2e6";
                ctx.lineWidth = 1;
                for (let i = 0; i < 2; i++) {
                    const ly = boxTop + bh * 0.58 + i * Math.max(5, 7 * sc);
                    ctx.beginPath();
                    ctx.moveTo(originL + 12, ly);
                    ctx.lineTo(originR - 12, ly);
                    ctx.stroke();
                }

                // --- 점 그리기 ---
                for (const d of lane.dots) {
                    let x = 0;
                    let y = laneY + d.jy * jAmp;
                    let alpha = 1;
                    let r = d.ghost ? dotR * 0.85 : dotR;

                    if (d.phase === "in") {
                        const p = easeInOut(d.t / IN_DUR);
                        x = spawnX + (cacheL - dotR - spawnX) * p;
                    } else if (d.phase === "toOrigin") {
                        const p = easeInOut(d.t / ORIGIN_DUR);
                        x = cacheR + dotR + (originL - dotR * 2 - cacheR) * p;
                        y = laneY + d.jy * jAmp * 0.6;
                    } else if (d.phase === "fromOrigin") {
                        const p = easeInOut(d.t / ORIGIN_DUR);
                        x =
                            originL -
                            dotR * 2 -
                            (originL - dotR * 2 - cacheR - dotR) * p;
                        y = laneY + d.jy * jAmp * 0.6;
                    } else if (d.phase === "wait") {
                        const qi = d.qi ?? 0;
                        const col = qi % 3;
                        const row = Math.floor(qi / 3);
                        x =
                            cacheL -
                            Math.max(12, 16 * sc) -
                            col * (dotR * 2 + 4);
                        y = boxTop + Math.max(6, 8 * sc) + row * (dotR * 2 + 4);
                        r *= 1 + 0.18 * Math.sin(now * 0.01 + qi); // 대기 펄스
                    } else {
                        // out: 캐시 → 요청 지점 (응답)
                        const p = easeInOut(Math.max(0, d.t) / OUT_DUR);
                        x = cacheL - dotR - (cacheL - dotR - spawnX) * p;
                        if (p > 0.75) alpha = 1 - (p - 0.75) / 0.25;
                        if (d.t < 0) alpha = 0;
                    }

                    if (alpha <= 0.01) continue;
                    ctx.globalAlpha = alpha;
                    ctx.beginPath();
                    ctx.arc(x, y, r, 0, Math.PI * 2);
                    ctx.fillStyle = d.color;
                    ctx.fill();
                    ctx.strokeStyle = "#fff";
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    if (d.ghost) {
                        ctx.font = `700 ${Math.max(8, fs - 3)}px ${FONT}`;
                        ctx.fillStyle = "#845ef7";
                        ctx.textAlign = "center";
                        ctx.fillText("갱신", x, y - dotR - 6);
                    }
                    ctx.globalAlpha = 1;
                }
            });

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
            <div
                style={{
                    fontSize: 11,
                    color: "#adb5bd",
                    textAlign: "center",
                    marginTop: 10,
                }}
            >
                같은 트래픽, 같은 만료 — 다른 것은 만료 순간의 구현뿐이다
            </div>
        </div>
    );
};
