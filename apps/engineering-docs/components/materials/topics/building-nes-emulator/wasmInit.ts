// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.

import init from "./pkg/nes_core";
const wasmUrl = "/materials/building-nes-emulator/nes_core_bg.wasm";

// 모듈 스코프 싱글턴: 여러 데모 컴포넌트가 한 번의 초기화를 공유한다
let wasmReady: Promise<unknown> | null = null;

export const ensureWasm = () => (wasmReady ??= init({ module_or_path: wasmUrl }));
