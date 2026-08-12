"use client";

import React, { useEffect, useState } from "react";

const FONT =
    "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "SF Mono, Menlo, monospace";

const STEP_MS = 1100; // 요청 1건 간격
const FINAL_MS = 2000; // 최종 수치 강조 시간
const RESET_MS = 700; // 리셋 후 빈 화면 유지 시간
const SEED = 48; // 사이클마다 같은 시퀀스가 나오도록 고정
const REQUEST_COUNT = 24;
const MAX_RAW_CHIPS = 18;

const UTM_SOURCES = ["newsletter", "facebook", "google"];

interface Param {
    key: string;
    value: string;
    tracking: boolean;
}

interface CacheEntry {
    label: string;
    tracked: boolean; // 추적 파라미터 탓에 생긴 파편 항목인지
}

interface Frame {
    params: Param[]; // 셔플된 순서 그대로
    normParams: Param[]; // 정규화 표기용: 유지 파라미터 정렬 + 추적 파라미터 뒤에
    rawHit: boolean;
    normHit: boolean;
    rawRate: number;
    normRate: number;
    rawEntries: CacheEntry[];
    normEntries: CacheEntry[];
}

// 고정 시드 의사난수 (mulberry32)
function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function buildFrames(): Frame[] {
    const rand = mulberry32(SEED);
    const rawCache = new Map<string, CacheEntry>();
    const normCache = new Map<string, CacheEntry>();
    let rawHits = 0;
    let normHits = 0;
    const frames: Frame[] = [];

    for (let i = 0; i < REQUEST_COUNT; i++) {
        // 실제 서로 다른 페이지: category(1~3) × sort(2종) = 6개
        const category = 1 + Math.floor(rand() * 3);
        const sort = rand() < 0.5 ? "latest" : "popular";
        const params: Param[] = [
            { key: "category", value: String(category), tracking: false },
            { key: "sort", value: sort, tracking: false },
        ];
        // 45% 확률로 추적 파라미터 부착
        if (rand() < 0.45) {
            if (rand() < 0.5) {
                params.push({
                    key: "utm_source",
                    value: UTM_SOURCES[
                        Math.floor(rand() * UTM_SOURCES.length)
                    ]!,
                    tracking: true,
                });
            } else {
                let token = "";
                while (token.length < 10)
                    token += Math.floor(rand() * 36 ** 6).toString(36);
                params.push({
                    key: "fbclid",
                    value: token.slice(0, 10),
                    tracking: true,
                });
            }
        }
        // 파라미터 순서 셔플
        for (let k = params.length - 1; k > 0; k--) {
            const j = Math.floor(rand() * (k + 1));
            [params[k]!, params[j]!] = [params[j]!, params[k]!];
        }

        const rawKey =
            "/products?" + params.map((p) => `${p.key}=${p.value}`).join("&");
        const kept = params
            .filter((p) => !p.tracking)
            .slice()
            .sort((a, b) => a.key.localeCompare(b.key));
        const normKey =
            "/products?" + kept.map((p) => `${p.key}=${p.value}`).join("&");
        const label = `c${category}·${sort}`;
        const tracked = params.some((p) => p.tracking);

        const rawHit = rawCache.has(rawKey);
        if (rawHit) rawHits += 1;
        else
            rawCache.set(rawKey, {
                label: tracked ? `${label}+추적` : label,
                tracked,
            });

        const normHit = normCache.has(normKey);
        if (normHit) normHits += 1;
        else normCache.set(normKey, { label, tracked: false });

        frames.push({
            params,
            normParams: kept.concat(params.filter((p) => p.tracking)),
            rawHit,
            normHit,
            rawRate: Math.round((rawHits / (i + 1)) * 100),
            normRate: Math.round((normHits / (i + 1)) * 100),
            rawEntries: Array.from(rawCache.values()),
            normEntries: Array.from(normCache.values()),
        });
    }
    return frames;
}

const FRAMES = buildFrames();

const badgeStyle = (hit: boolean): React.CSSProperties => ({
    flexShrink: 0,
    fontSize: 11,
    fontWeight: 700,
    fontFamily: FONT,
    padding: "2px 10px",
    borderRadius: 10,
    color: hit ? "#2f9e44" : "#fa5252",
    background: hit ? "#d3f9d8" : "#ffe3e3",
});

interface PanelProps {
    title: string;
    hit: boolean | null;
    rate: number;
    entries: CacheEntry[];
    maxChips: number;
    final: boolean;
    narrow: boolean;
    goodRate: boolean; // 히트율에 초록 계열을 쓸지
    normKeyView?: React.ReactNode;
}

const Panel = ({
    title,
    hit,
    rate,
    entries,
    maxChips,
    final,
    narrow,
    goodRate,
    normKeyView,
}: PanelProps) => {
    const shown = entries.slice(0, maxChips);
    const overflow = entries.length - shown.length;
    const rateColor = goodRate
        ? "#2f9e44"
        : entries.length > 6
          ? "#fa5252"
          : "#495057";
    return (
        <div
            style={{
                border: final ? "1px solid #adb5bd" : "1px solid #dee2e6",
                borderRadius: 8,
                padding: narrow ? "10px 10px" : "12px 14px",
                background: "#fff",
                transition: "border-color 0.3s",
                minWidth: 0,
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    marginBottom: 8,
                }}
            >
                <span
                    style={{
                        fontSize: narrow ? 12 : 13,
                        fontWeight: 700,
                        color: "#495057",
                    }}
                >
                    {title}
                </span>
                {hit !== null && (
                    <span style={badgeStyle(hit)}>{hit ? "HIT" : "MISS"}</span>
                )}
            </div>

            <div
                style={{
                    background: final
                        ? goodRate
                            ? "#e7f5ff"
                            : "#fff5f5"
                        : "#f8f9fa",
                    border: "1px solid #dee2e6",
                    borderRadius: 6,
                    padding: final ? "10px 10px" : "6px 10px",
                    marginBottom: 8,
                    textAlign: "center",
                    transition: "background 0.3s, padding 0.3s",
                }}
            >
                <span
                    style={{
                        fontSize: final ? (narrow ? 20 : 24) : narrow ? 14 : 15,
                        fontWeight: 700,
                        color: rateColor,
                        fontVariantNumeric: "tabular-nums",
                        transition: "font-size 0.3s",
                    }}
                >
                    히트율 {rate}%
                </span>
                <span
                    style={{
                        fontSize: final ? 15 : 12,
                        color: "#adb5bd",
                        margin: "0 6px",
                    }}
                >
                    ·
                </span>
                <span
                    style={{
                        fontSize: final ? (narrow ? 20 : 24) : narrow ? 14 : 15,
                        fontWeight: 700,
                        color: entries.length > 6 ? "#fa5252" : "#495057",
                        fontVariantNumeric: "tabular-nums",
                        transition: "font-size 0.3s",
                    }}
                >
                    항목 {entries.length}개
                </span>
            </div>

            {normKeyView}

            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 4,
                    minHeight: 44,
                    alignContent: "flex-start",
                }}
            >
                {entries.length === 0 ? (
                    <span style={{ fontSize: 11, color: "#adb5bd" }}>
                        아직 캐시된 항목이 없다
                    </span>
                ) : (
                    <>
                        {shown.map((e, i) => (
                            <span
                                key={`${e.label}-${i}`}
                                style={{
                                    fontSize: 10,
                                    fontFamily: MONO,
                                    padding: "3px 6px",
                                    borderRadius: 4,
                                    whiteSpace: "nowrap",
                                    color: e.tracked ? "#adb5bd" : "#1971c2",
                                    background: e.tracked
                                        ? "#f8f9fa"
                                        : "#e7f5ff",
                                    border: e.tracked
                                        ? "1px solid #dee2e6"
                                        : "1px solid #a5d8ff",
                                }}
                            >
                                {e.label}
                            </span>
                        ))}
                        {overflow > 0 && (
                            <span
                                style={{
                                    fontSize: 10,
                                    fontFamily: FONT,
                                    fontWeight: 700,
                                    padding: "3px 6px",
                                    borderRadius: 4,
                                    color: "#fa5252",
                                    background: "#fff5f5",
                                    border: "1px solid #ffc9c9",
                                }}
                            >
                                +{overflow}개
                            </span>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export const CacheKeyDemo = () => {
    // -1: 리셋 직후 빈 상태, 0..REQUEST_COUNT-1: 요청 진행, REQUEST_COUNT: 최종 수치 강조
    const [step, setStep] = useState(-1);
    const [narrow, setNarrow] = useState(false);

    useEffect(() => {
        const onResize = () => setNarrow(window.innerWidth < 480);
        onResize();
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    useEffect(() => {
        let timer = 0;
        let current = -1;
        const advance = () => {
            if (current < REQUEST_COUNT - 1) {
                current += 1;
                setStep(current);
                timer = window.setTimeout(advance, STEP_MS);
            } else if (current === REQUEST_COUNT - 1) {
                current = REQUEST_COUNT;
                setStep(current);
                timer = window.setTimeout(advance, FINAL_MS);
            } else {
                current = -1;
                setStep(current);
                timer = window.setTimeout(advance, RESET_MS);
            }
        };
        timer = window.setTimeout(advance, RESET_MS);
        return () => window.clearTimeout(timer);
    }, []);

    const final = step >= REQUEST_COUNT;
    const frameIndex = Math.min(step, REQUEST_COUNT - 1);
    const frame = frameIndex >= 0 ? FRAMES[frameIndex] : null;

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
            {/* 들어오는 요청 */}
            <div
                style={{
                    border: "1px solid #dee2e6",
                    borderRadius: 8,
                    background: "#f8f9fa",
                    padding: narrow ? "10px 10px" : "12px 14px",
                    marginBottom: 12,
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        marginBottom: 6,
                    }}
                >
                    <span style={{ fontSize: 11, color: "#868e96" }}>
                        들어오는 요청
                    </span>
                    <span
                        style={{
                            fontSize: 11,
                            color: "#adb5bd",
                            fontVariantNumeric: "tabular-nums",
                        }}
                    >
                        {frame ? `${frameIndex + 1} / ${REQUEST_COUNT}` : ""}
                    </span>
                </div>
                <div style={{ overflowX: "auto" }}>
                    {frame === null ? (
                        <div
                            style={{
                                fontSize: narrow ? 13 : 15,
                                color: "#adb5bd",
                                whiteSpace: "nowrap",
                                lineHeight: 1.6,
                            }}
                        >
                            요청을 기다리는 중…
                        </div>
                    ) : (
                        <div
                            key={frameIndex}
                            style={{
                                fontFamily: MONO,
                                fontSize: narrow ? 13 : 15,
                                color: "#495057",
                                whiteSpace: "nowrap",
                                lineHeight: 1.6,
                            }}
                        >
                            <span>/products?</span>
                            {frame!.params!.map((p, i) => (
                                <React.Fragment key={p.key}>
                                    {i > 0 && (
                                        <span style={{ color: "#adb5bd" }}>
                                            &amp;
                                        </span>
                                    )}
                                    <span
                                        style={{
                                            color: "#495057",
                                            background: p.tracking
                                                ? "#fff9db"
                                                : "transparent",
                                            borderRadius: 3,
                                            padding: p.tracking ? "0 2px" : 0,
                                        }}
                                    >
                                        {p.key}={p.value}
                                    </span>
                                </React.Fragment>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* 좌우 비교 패널 */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: narrow ? "1fr" : "1fr 1fr",
                    gap: 10,
                    marginBottom: 12,
                }}
            >
                <Panel
                    title="캐시 키: URL 그대로"
                    hit={frame ? frame.rawHit : null}
                    rate={frame ? frame.rawRate : 0}
                    entries={frame ? frame.rawEntries : []}
                    maxChips={MAX_RAW_CHIPS}
                    final={final}
                    narrow={narrow}
                    goodRate={false}
                />
                <Panel
                    title="캐시 키: 정규화"
                    hit={frame ? frame.normHit : null}
                    rate={frame ? frame.normRate : 0}
                    entries={frame ? frame.normEntries : []}
                    maxChips={6}
                    final={final}
                    narrow={narrow}
                    goodRate
                    normKeyView={
                        frame && (
                            <div
                                style={{
                                    fontFamily: MONO,
                                    fontSize: 11,
                                    color: "#1971c2",
                                    background: "#e7f5ff",
                                    borderRadius: 5,
                                    padding: "3px 8px",
                                    marginBottom: 8,
                                    overflowX: "auto",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                <span>/products?</span>
                                {frame.normParams.map((p, i) => (
                                    <React.Fragment key={p.key}>
                                        {i > 0 && (
                                            <span
                                                style={{
                                                    color: "#adb5bd",
                                                    textDecoration: p.tracking
                                                        ? "line-through"
                                                        : "none",
                                                    opacity: p.tracking
                                                        ? 0.35
                                                        : 1,
                                                }}
                                            >
                                                &amp;
                                            </span>
                                        )}
                                        <span
                                            style={{
                                                textDecoration: p.tracking
                                                    ? "line-through"
                                                    : "none",
                                                opacity: p.tracking ? 0.35 : 1,
                                                color: p.tracking
                                                    ? "#868e96"
                                                    : "#1971c2",
                                            }}
                                        >
                                            {p.key}={p.value}
                                        </span>
                                    </React.Fragment>
                                ))}
                            </div>
                        )
                    }
                />
            </div>

            <div
                style={{ fontSize: 11, color: "#adb5bd", textAlign: "center" }}
            >
                실제로 서로 다른 페이지는 6개뿐이다 — 왼쪽의 나머지 항목은 전부
                파편이다
            </div>
        </div>
    );
};
