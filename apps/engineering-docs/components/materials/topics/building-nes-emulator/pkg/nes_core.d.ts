// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.

/* tslint:disable */
/* eslint-disable */

/**
 * CPU 스텝 실행기: 작은 프로그램을 한 명령어씩 실행하며 관찰한다
 */
export class CpuInspector {
  free(): void;
  [Symbol.dispose](): void;
  a(): number;
  cycles(): number;
  /**
   * addr에서 시작하는 명령어 한 줄 디스어셈블: "주소|바이트수|텍스트"
   */
  disasm_at(addr: number): string;
  /**
   * 프로그램을 addr에 로드하고 PC를 그 주소로 맞춘다
   */
  load(program: Uint8Array, addr: number): void;
  constructor();
  p(): number;
  pc(): number;
  read(addr: number): number;
  sp(): number;
  /**
   * 명령어 하나 실행, 소요 사이클 반환
   */
  step(): number;
  write(addr: number, val: number): void;
  x(): number;
  y(): number;
}

/**
 * 완전한 NES 콘솔
 */
export class NesConsole {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * 지난 호출 이후 쌓인 오디오 샘플 (44.1kHz 모노, 0.0~1.0 범위)
   */
  audio(): Float32Array;
  /**
   * 카트리지의 CHR 데이터 (타일 뷰어용)
   */
  chr(): Uint8Array;
  /**
   * 256×240 RGBA 프레임버퍼
   */
  frame(): Uint8Array;
  constructor(rom: Uint8Array);
  /**
   * 현재 팔레트 램 32바이트 (타일 뷰어용)
   */
  palette_ram(): Uint8Array;
  /**
   * 프레임 하나(1/60초)만큼 실행
   */
  run_frame(): void;
  /**
   * 컨트롤러 버튼. idx: A=0, B=1, Select=2, Start=3, Up=4, Down=5, Left=6, Right=7
   */
  set_button(idx: number, pressed: boolean): void;
}

/**
 * 스네이크 게임 콘솔 (32×32 화면)
 */
export class SnakeConsole {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * 32×32 화면을 RGBA로 변환해 돌려준다
   */
  frame(): Uint8Array;
  game_over(): boolean;
  constructor(seed: number);
  /**
   * 명령어 n개 실행. 게임 오버면 false를 반환한다.
   */
  run(instructions: number): boolean;
  set_key(key: number): void;
  snake_len(): number;
}

/**
 * CHR 타일 하나(16바이트)를 64개의 색 번호(0~3)로 디코드한다.
 * PPU의 render_scanline이 하는 일과 같은 계산이다.
 */
export function decode_tile(tile: Uint8Array): Uint8Array;

/**
 * NTSC 팔레트 색 하나를 [r, g, b]로 돌려준다
 */
export function ntsc_color(idx: number): Uint8Array;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_nesconsole_free: (a: number, b: number) => void;
  readonly nesconsole_new: (a: number, b: number) => [number, number, number];
  readonly nesconsole_run_frame: (a: number) => void;
  readonly nesconsole_frame: (a: number) => [number, number];
  readonly nesconsole_set_button: (a: number, b: number, c: number) => void;
  readonly nesconsole_audio: (a: number) => [number, number];
  readonly nesconsole_chr: (a: number) => [number, number];
  readonly nesconsole_palette_ram: (a: number) => [number, number];
  readonly ntsc_color: (a: number) => [number, number];
  readonly decode_tile: (a: number, b: number) => [number, number];
  readonly __wbg_snakeconsole_free: (a: number, b: number) => void;
  readonly snakeconsole_new: (a: number) => number;
  readonly snakeconsole_set_key: (a: number, b: number) => void;
  readonly snakeconsole_run: (a: number, b: number) => number;
  readonly snakeconsole_game_over: (a: number) => number;
  readonly snakeconsole_snake_len: (a: number) => number;
  readonly snakeconsole_frame: (a: number) => [number, number];
  readonly __wbg_cpuinspector_free: (a: number, b: number) => void;
  readonly cpuinspector_new: () => number;
  readonly cpuinspector_load: (a: number, b: number, c: number, d: number) => void;
  readonly cpuinspector_step: (a: number) => number;
  readonly cpuinspector_read: (a: number, b: number) => number;
  readonly cpuinspector_write: (a: number, b: number, c: number) => void;
  readonly cpuinspector_disasm_at: (a: number, b: number) => [number, number];
  readonly cpuinspector_a: (a: number) => number;
  readonly cpuinspector_x: (a: number) => number;
  readonly cpuinspector_y: (a: number) => number;
  readonly cpuinspector_sp: (a: number) => number;
  readonly cpuinspector_pc: (a: number) => number;
  readonly cpuinspector_p: (a: number) => number;
  readonly cpuinspector_cycles: (a: number) => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init(
  module_or_path?:
    | { module_or_path: InitInput | Promise<InitInput> }
    | InitInput
    | Promise<InitInput>,
): Promise<InitOutput>;
