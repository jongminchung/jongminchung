"use client";

import { useEffect, useRef, useState } from "react";
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
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

// 시뮬레이션 파라미터 (초)
const MAX_AGE = 60; // 신선 구간 끝
const SWR_END = 360; // max-age + stale-while-revalidate
const TIMELINE_END = 420; // 타임라인 표시 범위

// 배속: 평상시 10배, 빨리감기 구간 150배
const SPEED_NORMAL = 10;
const SPEED_FF = 150;

// 시나리오 타임라인 (실시간 ms)
const T_REQ1 = 1800; // ① 첫 요청 → MISS, 캐시 생성 (나이 0)
const T_REQ2 = T_REQ1 + (30 / SPEED_NORMAL) * 1000; // ② 나이 30초 → HIT
const T_REQ3 = T_REQ1 + (100 / SPEED_NORMAL) * 1000; // ③ 나이 100초 → STALE
const T_REVAL = T_REQ3 + 1000; // 백그라운드 재검증 완료 → 나이 0으로 리셋
const T_FF = T_REVAL + 800; // 빨리감기 시작
const AGE_AT_FF = ((T_FF - T_REVAL) / 1000) * SPEED_NORMAL;
const T_REQ4 = T_FF + ((380 - AGE_AT_FF) / SPEED_FF) * 1000; // ④ 나이 380초 → MISS
const CYCLE = T_REQ4 + 2600; // 2초쯤 멈췄다가 로그를 비우고 재시작

const PULSE_DUR = 1000; // 요청 화살표+펄스 표시 시간

interface ScenarioEvent {
    t: number; // 발생 시각 (실시간 ms)
    age: number; // 요청 시점의 캐시 나이 (펄스 위치)
    arrow: boolean; // 요청 화살표를 그릴지 (재검증 완료는 펄스만)
    color: string; // 화살표·펄스 색
    badge: string;
    badgeColor: string;
    badgeBg: string;
    text: string;
    ageText: string;
    sub?: boolean; // 보조 로그 (들여쓰기)
}

const EVENTS: ScenarioEvent[] = [
    {
        t: T_REQ1,
        age: 0,
        arrow: true,
        color: "#fa5252",
        badge: "MISS",
        badgeColor: "#fa5252",
        badgeBg: "#ffe3e3",
        text: "원본에서 받아옴, 본문 127.8KB",
        ageText: "캐시 없음",
    },
    {
        t: T_REQ2,
        age: 30,
        arrow: true,
        color: "#2f9e44",
        badge: "HIT",
        badgeColor: "#2f9e44",
        badgeBg: "#d3f9d8",
        text: "캐시에서 즉시 응답, 네트워크 없음",
        ageText: "나이 30초",
    },
    {
        t: T_REQ3,
        age: 100,
        arrow: true,
        color: "#e8590c",
        badge: "STALE",
        badgeColor: "#e8590c",
        badgeBg: "#fff9db",
        text: "낡은 응답을 즉시 내주고 백그라운드 재검증",
        ageText: "나이 100초",
    },
    {
        t: T_REVAL,
        age: 0,
        arrow: false,
        color: "#228be6",
        badge: "재검증",
        badgeColor: "#228be6",
        badgeBg: "#e7f5ff",
        text: "백그라운드 재검증 완료 → 캐시 갱신",
        ageText: "나이 0초로 리셋",
        sub: true,
    },
    {
        t: T_REQ4,
        age: 380,
        arrow: true,
        color: "#fa5252",
        badge: "MISS",
        badgeColor: "#fa5252",
        badgeBg: "#ffe3e3",
        text: "만료 — 재검증 후 응답, 대기 발생",
        ageText: "나이 380초",
    },
];

// 사이클 내 시각 e(ms)에서의 캐시 나이(초). 캐시가 없으면 null
function ageAt(e: number): number | null {
    if (e < T_REQ1) return null;
    if (e < T_REVAL) return ((e - T_REQ1) / 1000) * SPEED_NORMAL;
    if (e < T_FF) return ((e - T_REVAL) / 1000) * SPEED_NORMAL;
    if (e < T_REQ4) return AGE_AT_FF + ((e - T_FF) / 1000) * SPEED_FF;
    return 380; // 마지막 MISS 후 잠시 정지
}

export const FreshnessLifetimeDemo = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<SvgCanvasHandle>(null);
    const logCountRef = useRef(-1);
    const [logs, setLogs] = useState<ScenarioEvent[]>([]);

    useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;

        let raf = 0;
        const start = performance.now();

        const render = (now: number) => {
            const w = container.clientWidth;
            const dpr = window.devicePixelRatio || 1;
            const isMobile = w < 480;
            const e = Math.max(0, now - start) % CYCLE;

            // 로그는 이벤트 경계에서만 setState (프레임마다 리렌더하지 않는다)
            const visibleCount = EVENTS.filter((ev) => ev.t <= e).length;
            if (visibleCount !== logCountRef.current) {
                logCountRef.current = visibleCount;
                setLogs(EVENTS.slice(0, visibleCount).slice(-4).reverse());
            }

            const topH = 44; // 나이 라벨 + 요청 화살표 영역
            const barH = 26;
            const tickH = 16;
            const h = topH + barH + 5 + tickH;

            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;

            const ctx = canvas.getContext("2d")!;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.scale(dpr, dpr);

            const pad = 6;
            const barX = pad;
            const barW = w - pad * 2;
            const barY = topH;
            const toX = (t: number) => barX + (t / TIMELINE_END) * barW;

            // --- 구간 배경 (둥근 모서리로 클리핑) ---
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(barX, barY, barW, barH, 5);
            ctx.clip();
            ctx.fillStyle = "#40c057";
            ctx.fillRect(toX(0), barY, toX(MAX_AGE) - toX(0), barH);
            ctx.fillStyle = "#fab005";
            ctx.fillRect(toX(MAX_AGE), barY, toX(SWR_END) - toX(MAX_AGE), barH);
            ctx.fillStyle = "#adb5bd";
            ctx.fillRect(
                toX(SWR_END),
                barY,
                toX(TIMELINE_END) - toX(SWR_END),
                barH,
            );
            ctx.restore();

            // 구간 경계선
            ctx.strokeStyle = "rgba(255,255,255,0.7)";
            ctx.lineWidth = 1;
            [MAX_AGE, SWR_END].forEach((t) => {
                ctx.beginPath();
                ctx.moveTo(toX(t), barY);
                ctx.lineTo(toX(t), barY + barH);
                ctx.stroke();
            });

            // 구간 라벨 (바 안쪽, 흰색)
            const zoneFs = Math.max(10, Math.min(12, w / 46));
            ctx.font = `700 ${zoneFs}px ${FONT}`;
            ctx.fillStyle = "#fff";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const midY = barY + barH / 2 + 0.5;
            ctx.fillText("신선", (toX(0) + toX(MAX_AGE)) / 2, midY);
            ctx.fillText(
                isMobile ? "SWR 창" : "낡음 — SWR 창",
                (toX(MAX_AGE) + toX(SWR_END)) / 2,
                midY,
            );
            ctx.fillText("만료", (toX(SWR_END) + toX(TIMELINE_END)) / 2, midY);

            // 눈금
            const tickFs = Math.max(9, Math.min(11, w / 50));
            ctx.font = `${tickFs}px ${FONT}`;
            ctx.fillStyle = "#868e96";
            ctx.textBaseline = "top";
            const tickY = barY + barH + 5;
            ctx.textAlign = "left";
            ctx.fillText("0초", toX(0), tickY);
            ctx.textAlign = "center";
            ctx.fillText("60초", toX(MAX_AGE), tickY);
            ctx.fillText("360초", toX(SWR_END), tickY);
            ctx.textAlign = "right";
            ctx.fillText("420초", toX(TIMELINE_END), tickY);

            const age = ageAt(e);
            const isFF = e >= T_FF && e < T_REQ4;

            // 배속 표기 (캔버스 우상단)
            ctx.font = `700 ${Math.max(9, Math.min(11, w / 50))}px ${MONO}`;
            ctx.fillStyle = isFF ? "#e8590c" : "#adb5bd";
            ctx.textAlign = "right";
            ctx.textBaseline = "top";
            const speedLabel = isFF
                ? `${SPEED_FF}배속 ≫`
                : `${SPEED_NORMAL}배속`;
            const speedW = ctx.measureText(speedLabel).width;
            ctx.fillText(speedLabel, w - pad, 2);

            if (age === null) {
                // ① 시작: 캐시 없음 상태
                ctx.font = `600 ${Math.max(11, Math.min(12, w / 42))}px ${FONT}`;
                ctx.fillStyle = "#868e96";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(
                    "캐시 없음 — 첫 요청이 들어온다",
                    w / 2,
                    topH / 2 + 4,
                );
            } else {
                const clamped = Math.min(age, TIMELINE_END);
                const px = toX(clamped);

                // 빨리감기 잔상 (뒤따라오는 점선 고스트)
                if (isFF) {
                    [18, 40, 66].forEach((back, i) => {
                        const gx = toX(Math.max(AGE_AT_FF, clamped - back));
                        if (gx >= px - 1) return;
                        ctx.strokeStyle = `rgba(73,80,87,${0.28 - i * 0.09})`;
                        ctx.lineWidth = 2;
                        ctx.setLineDash([3, 3]);
                        ctx.beginPath();
                        ctx.moveTo(gx, barY - 2);
                        ctx.lineTo(gx, barY + barH + 2);
                        ctx.stroke();
                    });
                    ctx.setLineDash([]);
                }

                // 플레이헤드
                ctx.strokeStyle = "#495057";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(px, barY - 4);
                ctx.lineTo(px, barY + barH + 2);
                ctx.stroke();
                ctx.fillStyle = "#495057";
                ctx.beginPath();
                ctx.moveTo(px - 5, barY - 10);
                ctx.lineTo(px + 5, barY - 10);
                ctx.lineTo(px, barY - 3);
                ctx.closePath();
                ctx.fill();

                // 나이 라벨 (가장자리·배속 표기와 겹치지 않게 클램프)
                ctx.font = `700 ${Math.max(10, Math.min(12, w / 44))}px ${FONT}`;
                const label = isFF
                    ? `나이 ${Math.floor(age)}초 ≫≫`
                    : `나이 ${Math.floor(age)}초`;
                const lw = ctx.measureText(label).width;
                const lx = Math.min(
                    Math.max(px, pad + lw / 2),
                    w - pad - speedW - 10 - lw / 2,
                );
                ctx.fillStyle = isFF ? "#e8590c" : "#495057";
                ctx.textAlign = "center";
                ctx.textBaseline = "bottom";
                ctx.fillText(label, lx, barY - 28);
            }

            // --- 요청 발생 강조: 화살표 + 펄스 ---
            EVENTS.forEach((ev) => {
                const dt = e - ev.t;
                if (dt < 0 || dt >= PULSE_DUR) return;
                const p = dt / PULSE_DUR;
                const px = toX(ev.age);

                // 퍼지는 펄스 링 (바 중앙)
                const ringR = 5 + p * 15;
                ctx.strokeStyle = ev.color;
                ctx.globalAlpha = (1 - p) * 0.9;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(px, barY + barH / 2, ringR, 0, Math.PI * 2);
                ctx.stroke();
                ctx.globalAlpha = 1;

                if (!ev.arrow) return;

                // 아래로 꽂히는 요청 화살표 (살짝 내려오는 이징)
                const drop = Math.min(1, p * 3);
                const ay = barY - 24 + drop * 4;
                ctx.strokeStyle = ev.color;
                ctx.fillStyle = ev.color;
                ctx.globalAlpha = Math.min(1, (1 - p) * 3);
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(px, ay);
                ctx.lineTo(px, barY - 8);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(px - 4.5, barY - 9);
                ctx.lineTo(px + 4.5, barY - 9);
                ctx.lineTo(px, barY - 2);
                ctx.closePath();
                ctx.fill();
                // "요청" 텍스트 (오른쪽 끝이면 왼쪽에)
                ctx.font = `700 ${Math.max(10, Math.min(11, w / 46))}px ${FONT}`;
                ctx.textBaseline = "middle";
                if (px > w - 44) {
                    ctx.textAlign = "right";
                    ctx.fillText("요청", px - 7, ay + 5);
                } else {
                    ctx.textAlign = "left";
                    ctx.fillText("요청", px + 7, ay + 5);
                }
                ctx.globalAlpha = 1;
            });

            raf = scheduleMaterialFrame(render);
        };

        // rAF 루프가 매 프레임 컨테이너 폭을 다시 재므로 리사이즈에 자연히 대응한다
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
            {/* 고정 헤더 표기 */}
            <div
                style={{
                    background: "#f8f9fa",
                    border: "1px solid #dee2e6",
                    borderRadius: 6,
                    padding: "8px 12px",
                    fontFamily: MONO,
                    fontSize: 12,
                    color: "#495057",
                    marginBottom: 16,
                    overflowX: "auto",
                    whiteSpace: "nowrap",
                }}
            >
                <span style={{ color: "#868e96" }}>Cache-Control:</span>{" "}
                <span style={{ color: "#228be6", fontWeight: 600 }}>
                    max-age=60
                </span>
                ,{" "}
                <span style={{ color: "#e8590c", fontWeight: 600 }}>
                    stale-while-revalidate=300
                </span>
            </div>

            {/* 타임라인 */}
            <div ref={containerRef}>
                <SvgCanvas
                    ref={canvasRef}
                    style={{ display: "block", width: "100%" }}
                />
            </div>

            {/* 로그 (최근 4건, 위가 최신) — 높이를 고정해 레이아웃 흔들림 방지 */}
            <div style={{ marginTop: 12, minHeight: 4 * 29 }}>
                {logs.length === 0 ? (
                    <div
                        style={{
                            fontSize: 12,
                            color: "#adb5bd",
                            padding: "6px 8px",
                        }}
                    >
                        아직 요청이 없다…
                    </div>
                ) : (
                    logs.map((log) => (
                        <div
                            key={log.t}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                flexWrap: "wrap",
                                padding: "5px 8px",
                                paddingLeft: log.sub ? 22 : 8,
                                borderBottom: "1px solid #f1f3f5",
                                fontSize: 12,
                            }}
                        >
                            <span
                                style={{
                                    flexShrink: 0,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    fontFamily: MONO,
                                    color: log.badgeColor,
                                    background: log.badgeBg,
                                    borderRadius: 4,
                                    padding: "2px 7px",
                                }}
                            >
                                {log.badge}
                            </span>
                            <span
                                style={{
                                    color: log.sub ? "#868e96" : "#495057",
                                    flex: "1 1 auto",
                                }}
                            >
                                {log.text}
                            </span>
                            <span
                                style={{
                                    flexShrink: 0,
                                    color: "#adb5bd",
                                    fontSize: 11,
                                }}
                            >
                                {log.ageText}
                            </span>
                        </div>
                    ))
                )}
            </div>

            <div
                style={{
                    fontSize: 11,
                    color: "#adb5bd",
                    textAlign: "center",
                    marginTop: 12,
                }}
            >
                같은 캐시라도 요청이 떨어지는 구간에 따라 응답 경로가 달라진다
            </div>
        </div>
    );
};
