// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useEffect, useRef, useState } from "react";
import { CpuInspector } from "./pkg/nes_core";
import { ensureWasm } from "./wasmInit";

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const LOAD_ADDR = 0x0600;
// LDA #$50 / ADC #$50 / STA $00 / LDX #$03 / INX / STA $0200 / DEX / BNE / BRK
// 0x50 + 0x50 = 0xA0: 양수+양수=음수라 오버플로(V)와 네거티브(N)가 서고 캐리(C)는 서지 않는다
const PROGRAM = [
  0xa9, 0x50, 0x69, 0x50, 0x85, 0x00, 0xa2, 0x03, 0xe8, 0x8d, 0x00, 0x02, 0xca, 0xd0, 0xfa, 0x00,
];

const FLAG_NAMES = ["N", "V", "-", "B", "D", "I", "Z", "C"] as const;
const FLAG_BITS = [0x80, 0x40, 0x20, 0x10, 0x08, 0x04, 0x02, 0x01];

const hex2 = (v: number) => v.toString(16).toUpperCase().padStart(2, "0");
const hex4 = (v: number) => v.toString(16).toUpperCase().padStart(4, "0");

interface Listing {
  addr: number;
  text: string;
}

interface Snapshot {
  a: number;
  x: number;
  y: number;
  sp: number;
  pc: number;
  p: number;
  cycles: number;
  mem: number[];
}

const takeSnapshot = (cpu: CpuInspector): Snapshot => ({
  a: cpu.a(),
  x: cpu.x(),
  y: cpu.y(),
  sp: cpu.sp(),
  pc: cpu.pc(),
  p: cpu.p(),
  cycles: cpu.cycles(),
  mem: Array.from({ length: 16 }, (_, i) => cpu.read(i)),
});

const CpuStepDemo = () => {
  const cpuRef = useRef<CpuInspector | null>(null);
  const [listing, setListing] = useState<Listing[]>([]);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [prev, setPrev] = useState<Snapshot | null>(null);
  const [lastExec, setLastExec] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await ensureWasm();
      if (cancelled) return;

      const cpu = new CpuInspector();
      cpu.load(new Uint8Array(PROGRAM), LOAD_ADDR);
      cpuRef.current = cpu;

      // 디스어셈블리 리스팅 미리 구성 (BRK를 만나면 종료)
      const lines: Listing[] = [];
      let addr = LOAD_ADDR;
      while (addr < LOAD_ADDR + PROGRAM.length) {
        const [, sizeStr, text] = cpu.disasm_at(addr).split("|");
        lines.push({ addr, text });
        if (cpu.read(addr) === 0x00) break; // BRK
        addr += parseInt(sizeStr, 10);
      }

      setListing(lines);
      setSnap(takeSnapshot(cpu));
      setPrev(null);
      setLastExec(null);
      setDone(false);
      setPlaying(false);
    })();

    return () => {
      cancelled = true;
      cpuRef.current = null;
    };
  }, [resetKey]);

  const stepOnce = () => {
    const cpu = cpuRef.current;
    if (!cpu || done) return;

    const before = takeSnapshot(cpu);
    const [, , text] = cpu.disasm_at(before.pc).split("|");
    const cyc = cpu.step();
    const after = takeSnapshot(cpu);

    setPrev(before);
    setSnap(after);
    setLastExec(`방금 실행: ${text} (${cyc}사이클)`);
    if (cpu.read(after.pc) === 0x00) {
      setDone(true);
      setPlaying(false);
    }
  };

  const stepRef = useRef(stepOnce);
  stepRef.current = stepOnce;

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => stepRef.current(), 500);
    return () => clearInterval(id);
  }, [playing]);

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

  const disabledBtn: React.CSSProperties = {
    ...btn,
    color: "#adb5bd",
    cursor: "default",
  };

  const regChanged = (key: "a" | "x" | "y" | "sp" | "pc") =>
    prev !== null && snap !== null && prev[key] !== snap[key];

  const regRow = (label: string, value: string, changed: boolean, testid: string) => (
    <div
      key={label}
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "3px 8px",
        borderRadius: 4,
        background: changed ? "#fff3bf" : "transparent",
        transition: "background 0.3s",
      }}
    >
      <span style={{ color: "#868e96", fontSize: 12, fontWeight: 600 }}>{label}</span>
      <span data-testid={testid} style={{ fontFamily: MONO, fontSize: 13, color: "#212529" }}>
        {value}
      </span>
    </div>
  );

  if (!snap) {
    return (
      <div
        style={{
          border: "1px solid #dee2e6",
          borderRadius: 8,
          padding: 20,
          margin: "24px 0",
          background: "#fff",
          fontFamily: FONT,
          fontSize: 13,
          color: "#868e96",
        }}
      >
        에뮬레이터 로딩 중…
      </div>
    );
  }

  return (
    <div
      data-testid="cpu-demo"
      style={{
        border: "1px solid #dee2e6",
        borderRadius: 8,
        padding: 20,
        margin: "24px 0",
        background: "#fff",
        fontFamily: FONT,
      }}
    >
      {/* 컨트롤 */}
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
          data-testid="cpu-step"
          style={done ? disabledBtn : btn}
          disabled={done}
          onClick={stepOnce}
        >
          한 스텝
        </button>
        <button
          data-testid="cpu-play"
          style={{
            ...(done ? disabledBtn : btn),
            ...(playing ? { background: "#228be6", color: "#fff", borderColor: "#228be6" } : null),
          }}
          disabled={done}
          onClick={() => setPlaying((p) => !p)}
        >
          {playing ? "정지" : "자동 재생"}
        </button>
        <button data-testid="cpu-reset" style={btn} onClick={() => setResetKey((k) => k + 1)}>
          처음부터
        </button>
        {done && (
          <span data-testid="cpu-done" style={{ fontSize: 12, fontWeight: 700, color: "#228be6" }}>
            프로그램 종료
          </span>
        )}
      </div>

      {/* 리스팅 + 레지스터 */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* 디스어셈블리 */}
        <div style={{ flex: "1 1 240px", minWidth: 220 }}>
          <div style={{ fontSize: 12, color: "#868e96", fontWeight: 600, marginBottom: 6 }}>
            디스어셈블리
          </div>
          <div
            style={{
              border: "1px solid #f1f3f5",
              borderRadius: 6,
              padding: "6px 0",
              background: "#f8f9fa",
            }}
          >
            {listing.map((line) => {
              const current = line.addr === snap.pc;
              return (
                <div
                  key={line.addr}
                  style={{
                    fontFamily: MONO,
                    fontSize: 13,
                    lineHeight: 1.7,
                    padding: "0 12px",
                    whiteSpace: "pre",
                    background: current ? "#228be6" : "transparent",
                    color: current ? "#fff" : "#495057",
                  }}
                >
                  {`$${hex4(line.addr)}  ${line.text}`}
                </div>
              );
            })}
          </div>
        </div>

        {/* 레지스터 패널 */}
        <div style={{ flex: "1 1 200px", minWidth: 200 }}>
          <div style={{ fontSize: 12, color: "#868e96", fontWeight: 600, marginBottom: 6 }}>
            레지스터
          </div>
          <div style={{ border: "1px solid #f1f3f5", borderRadius: 6, padding: 8 }}>
            {regRow("A", `$${hex2(snap.a)}`, regChanged("a"), "reg-a")}
            {regRow("X", `$${hex2(snap.x)}`, regChanged("x"), "reg-x")}
            {regRow("Y", `$${hex2(snap.y)}`, regChanged("y"), "reg-y")}
            {regRow("SP", `$${hex2(snap.sp)}`, regChanged("sp"), "reg-sp")}
            {regRow("PC", `$${hex4(snap.pc)}`, regChanged("pc"), "reg-pc")}
            {regRow("사이클", String(snap.cycles), false, "reg-cycles")}
          </div>

          <div style={{ fontSize: 12, color: "#868e96", fontWeight: 600, margin: "10px 0 6px" }}>
            플래그
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {FLAG_NAMES.map((name, i) => {
              const on = (snap.p & FLAG_BITS[i]) !== 0;
              return (
                <span
                  key={`${name}-${i}`}
                  data-testid={`flag-${name === "-" ? "U" : name}`}
                  data-on={on ? "true" : "false"}
                  style={{
                    fontFamily: MONO,
                    fontSize: 12,
                    fontWeight: 700,
                    width: 26,
                    height: 26,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 5,
                    background: on ? "#228be6" : "#f1f3f5",
                    color: on ? "#fff" : "#adb5bd",
                  }}
                >
                  {name}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* 메모리 뷰 */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 12, color: "#868e96", fontWeight: 600, marginBottom: 6 }}>
          메모리 $0000–$000F
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 13,
            border: "1px solid #f1f3f5",
            borderRadius: 6,
            padding: "6px 10px",
            background: "#f8f9fa",
            overflowX: "auto",
            whiteSpace: "nowrap",
          }}
        >
          {snap.mem.map((v, i) => {
            const changed = prev !== null && prev.mem[i] !== v;
            return (
              <span
                key={i}
                data-testid={`mem-${i}`}
                style={{
                  display: "inline-block",
                  padding: "1px 3px",
                  marginRight: 4,
                  borderRadius: 3,
                  background: changed ? "#fff3bf" : "transparent",
                  color: "#495057",
                }}
              >
                {hex2(v)}
              </span>
            );
          })}
        </div>
      </div>

      {/* 마지막 실행 내역 */}
      <div
        data-testid="cpu-last"
        style={{
          marginTop: 10,
          fontSize: 12,
          color: lastExec ? "#495057" : "#adb5bd",
          fontFamily: MONO,
        }}
      >
        {lastExec ?? "[한 스텝]을 눌러 명령어를 실행해 보자"}
      </div>
    </div>
  );
};

export default CpuStepDemo;
