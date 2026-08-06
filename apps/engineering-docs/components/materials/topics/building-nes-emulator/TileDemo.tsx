// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { chaseRom } from "./chaseRom";
import { NesConsole, decode_tile, ntsc_color } from "./pkg/nes_core";
import { ensureWasm } from "./wasmInit";

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

const TILE_COUNT = 512;
const GRID_COLS = 32;
const GRID_ROWS = 16;
// 그리드 내부 해상도: 타일 24px + 간격 3px (CSS로 축소해 타일당 ~12px 표시)
const CELL = 27;
const CELL_TILE = 24;
// 확대 타일: 픽셀당 28px
const ZOOM = 28;

// 팔레트 프리셋 (NES 팔레트 인덱스 4개)
const PALETTES: { name: string; colors: number[] }[] = [
  { name: "회색조", colors: [0x0f, 0x00, 0x10, 0x30] },
  { name: "초록 계열", colors: [0x0f, 0x09, 0x19, 0x29] },
  { name: "파랑 계열", colors: [0x0f, 0x01, 0x11, 0x21] },
  { name: "빨강 계열", colors: [0x0f, 0x06, 0x16, 0x26] },
];

// 기본 선택: 벽 블록 모서리 타일 (색 0~3이 모두 등장한다)
const DEFAULT_TILE = 65;

const rgb = (c: Uint8Array) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

const TileDemo = () => {
  const zoomRef = useRef<HTMLCanvasElement>(null);
  const gridRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [tile, setTile] = useState(DEFAULT_TILE);
  const [paletteIdx, setPaletteIdx] = useState(0);
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null);
  const chrRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureWasm();
      if (cancelled) return;
      const nes = new NesConsole(chaseRom());
      chrRef.current = nes.chr();
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 현재 팔레트를 RGB 문자열 4개로 (wasm 초기화 이후에만 ntsc_color 호출 가능)
  const paletteRgb = useMemo(() => {
    if (!ready) return null;
    return PALETTES[paletteIdx].colors.map((idx) => rgb(ntsc_color(idx)));
  }, [ready, paletteIdx]);

  // 선택된 타일의 원본 16바이트와 디코드 결과
  const tileBytes = useMemo(() => {
    if (!ready || !chrRef.current) return null;
    return chrRef.current.slice(tile * 16, tile * 16 + 16);
  }, [ready, tile]);
  const pixels = useMemo(() => (tileBytes ? decode_tile(tileBytes) : null), [tileBytes]);

  // 확대 타일 그리기
  useEffect(() => {
    const canvas = zoomRef.current;
    if (!canvas || !pixels || !paletteRgb) return;
    const ctx = canvas.getContext("2d")!;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const c = pixels[row * 8 + col];
        const x = col * ZOOM;
        const y = row * ZOOM;
        if (c === 0) {
          // 색 0 = 투명(배경색): 체커보드로 표시
          ctx.fillStyle = "#f1f3f5";
          ctx.fillRect(x, y, ZOOM, ZOOM);
          ctx.fillStyle = "#dee2e6";
          const h = ZOOM / 2;
          ctx.fillRect(x, y, h, h);
          ctx.fillRect(x + h, y + h, h, h);
        } else {
          ctx.fillStyle = paletteRgb[c];
          ctx.fillRect(x, y, ZOOM, ZOOM);
        }
      }
    }
    // 픽셀 경계선
    ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(i * ZOOM + 0.5, 0);
      ctx.lineTo(i * ZOOM + 0.5, 8 * ZOOM);
      ctx.moveTo(0, i * ZOOM + 0.5);
      ctx.lineTo(8 * ZOOM, i * ZOOM + 0.5);
      ctx.stroke();
    }
    if (hover) {
      ctx.strokeStyle = "#228be6";
      ctx.lineWidth = 3;
      ctx.strokeRect(hover.col * ZOOM + 1.5, hover.row * ZOOM + 1.5, ZOOM - 3, ZOOM - 3);
    }
  }, [pixels, paletteRgb, hover]);

  // 512타일 전체 그리드 그리기
  useEffect(() => {
    const canvas = gridRef.current;
    const chr = chrRef.current;
    if (!canvas || !chr || !paletteRgb) return;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#f8f9fa";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const px = CELL_TILE / 8;
    for (let t = 0; t < TILE_COUNT; t++) {
      const pix = decode_tile(chr.slice(t * 16, t * 16 + 16));
      const ox = (t % GRID_COLS) * CELL + 1.5;
      const oy = Math.floor(t / GRID_COLS) * CELL + 1.5;
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const c = pix[row * 8 + col];
          ctx.fillStyle = c === 0 ? "#fff" : paletteRgb[c];
          ctx.fillRect(ox + col * px, oy + row * px, px, px);
        }
      }
    }
    // 선택 타일 테두리
    ctx.strokeStyle = "#228be6";
    ctx.lineWidth = 3;
    ctx.strokeRect(
      (tile % GRID_COLS) * CELL,
      Math.floor(tile / GRID_COLS) * CELL,
      CELL + 3,
      CELL + 3,
    );
  }, [ready, paletteRgb, tile]);

  const onGridPick = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const col = Math.floor(((e.clientX - rect.left) / rect.width) * GRID_COLS);
    const row = Math.floor(((e.clientY - rect.top) / rect.height) * GRID_ROWS);
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return;
    setTile(row * GRID_COLS + col);
    setHover(null);
  };

  const onZoomPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const col = Math.floor(((e.clientX - rect.left) / rect.width) * 8);
    const row = Math.floor(((e.clientY - rect.top) / rect.height) * 8);
    if (col < 0 || col > 7 || row < 0 || row > 7) return;
    setHover({ row, col });
  };

  // 호버 중인 픽셀의 비트 정보
  const hoverInfo = useMemo(() => {
    if (!hover || !tileBytes) return null;
    const bit = 7 - hover.col;
    const b0 = (tileBytes[hover.row] >> bit) & 1;
    const b1 = (tileBytes[hover.row + 8] >> bit) & 1;
    return { bit, b0, b1, color: b0 | (b1 << 1) };
  }, [hover, tileBytes]);

  const bitRows = (plane: 0 | 1) =>
    Array.from({ length: 8 }, (_, row) => {
      const byte = tileBytes ? tileBytes[row + plane * 8] : 0;
      return (
        <div key={row} style={{ display: "flex", gap: 1, lineHeight: "16px" }}>
          {Array.from({ length: 8 }, (_, col) => {
            const bit = (byte >> (7 - col)) & 1;
            const hit = hover && hover.row === row && hover.col === col;
            return (
              <span
                key={col}
                style={{
                  fontFamily: MONO,
                  fontSize: 11,
                  width: 12,
                  textAlign: "center",
                  borderRadius: 2,
                  background: hit ? "#228be6" : bit ? "#e7f5ff" : "transparent",
                  color: hit ? "#fff" : bit ? "#1971c2" : "#adb5bd",
                  fontWeight: bit ? 700 : 400,
                }}
              >
                {bit}
              </span>
            );
          })}
        </div>
      );
    });

  const btn: React.CSSProperties = {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: 600,
    padding: "5px 10px",
    borderRadius: 6,
    border: "1px solid #dee2e6",
    background: "#fff",
    color: "#495057",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  };

  return (
    <div
      data-testid="tile-demo"
      style={{
        border: "1px solid #dee2e6",
        borderRadius: 8,
        padding: 20,
        margin: "24px 0",
        background: "#fff",
        fontFamily: FONT,
      }}
    >
      {/* 팔레트 스위처 */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 16,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 12, color: "#868e96" }}>팔레트</span>
        {PALETTES.map((p, i) => (
          <button
            key={p.name}
            data-testid={`palette-${i}`}
            style={{
              ...btn,
              borderColor: paletteIdx === i ? "#228be6" : "#dee2e6",
              background: paletteIdx === i ? "#e7f5ff" : "#fff",
              color: paletteIdx === i ? "#1971c2" : "#495057",
            }}
            onClick={() => setPaletteIdx(i)}
          >
            <span style={{ display: "inline-flex" }}>
              {p.colors.map((c, j) => (
                <span
                  key={j}
                  style={{
                    width: 10,
                    height: 10,
                    background: ready ? rgb(ntsc_color(c)) : "#ccc",
                    border: "1px solid rgba(0,0,0,0.15)",
                    marginLeft: j ? -1 : 0,
                  }}
                />
              ))}
            </span>
            {p.name}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        {/* 왼쪽: 확대 타일 + 원본 바이트 */}
        <div style={{ flex: "0 1 240px", minWidth: 224 }}>
          <div style={{ fontSize: 12, color: "#868e96", marginBottom: 6 }}>
            타일 #{tile} — 픽셀에 마우스를 올려 보자 (모바일: 탭)
          </div>
          <canvas
            ref={zoomRef}
            data-testid="tile-zoom"
            width={8 * ZOOM}
            height={8 * ZOOM}
            onPointerMove={(e) => {
              if (e.pointerType === "mouse") onZoomPoint(e);
            }}
            onPointerDown={onZoomPoint}
            onPointerLeave={(e) => {
              if (e.pointerType === "mouse") setHover(null);
            }}
            style={{
              width: "100%",
              maxWidth: 8 * ZOOM,
              display: "block",
              border: "1px solid #dee2e6",
              borderRadius: 4,
              touchAction: "manipulation",
              cursor: "crosshair",
            }}
          />

          <div
            data-testid="tile-bit-info"
            style={{
              marginTop: 8,
              minHeight: 20,
              fontSize: 12,
              color: hoverInfo ? "#1971c2" : "#adb5bd",
              fontWeight: hoverInfo ? 600 : 400,
            }}
          >
            {hoverInfo
              ? `평면1=${hoverInfo.b1}, 평면0=${hoverInfo.b0} → 색 ${hoverInfo.color}번${hoverInfo.color === 0 ? " (투명)" : ""}`
              : "픽셀을 가리키면 비트가 하이라이트된다"}
          </div>

          <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: "#868e96", marginBottom: 4 }}>
                평면 0 (하위 비트)
              </div>
              {bitRows(0)}
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#868e96", marginBottom: 4 }}>
                평면 1 (상위 비트)
              </div>
              {bitRows(1)}
            </div>
          </div>
        </div>

        {/* 오른쪽: CHR 512타일 그리드 */}
        <div style={{ flex: "1 1 300px", minWidth: 280 }}>
          <div style={{ fontSize: 12, color: "#868e96", marginBottom: 6 }}>
            Chase의 CHR ROM — 512개 타일 전체 (클릭해서 선택)
          </div>
          <canvas
            ref={gridRef}
            data-testid="tile-grid"
            width={GRID_COLS * CELL + 3}
            height={GRID_ROWS * CELL + 3}
            onPointerDown={onGridPick}
            style={{
              width: "100%",
              maxWidth: 440,
              display: "block",
              border: "1px solid #dee2e6",
              borderRadius: 4,
              touchAction: "manipulation",
              cursor: "pointer",
              imageRendering: "pixelated",
            }}
          />
          <div style={{ fontSize: 11, color: "#adb5bd", marginTop: 6 }}>
            타일 데이터에는 색이 없다 — 0~3 번호뿐이고, 위 팔레트를 바꾸면 같은 타일이 다른 색으로
            칠해진다. 색 0번은 투명(배경색)이라 체커보드로 표시했다.
          </div>
        </div>
      </div>
    </div>
  );
};

export default TileDemo;
