/* @ts-self-types="./nes_core.d.ts" */

/**
 * CPU 스텝 실행기: 작은 프로그램을 한 명령어씩 실행하며 관찰한다
 */
export class CpuInspector {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    CpuInspectorFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_cpuinspector_free(ptr, 0);
  }
  /**
   * @returns {number}
   */
  a() {
    const ret = wasm.cpuinspector_a(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  cycles() {
    const ret = wasm.cpuinspector_cycles(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * addr에서 시작하는 명령어 한 줄 디스어셈블: "주소|바이트수|텍스트"
   * @param {number} addr
   * @returns {string}
   */
  disasm_at(addr) {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm.cpuinspector_disasm_at(this.__wbg_ptr, addr);
      deferred1_0 = ret[0];
      deferred1_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
  }
  /**
   * 프로그램을 addr에 로드하고 PC를 그 주소로 맞춘다
   * @param {Uint8Array} program
   * @param {number} addr
   */
  load(program, addr) {
    const ptr0 = passArray8ToWasm0(program, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    wasm.cpuinspector_load(this.__wbg_ptr, ptr0, len0, addr);
  }
  constructor() {
    const ret = wasm.cpuinspector_new();
    this.__wbg_ptr = ret;
    CpuInspectorFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
  /**
   * @returns {number}
   */
  p() {
    const ret = wasm.cpuinspector_p(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  pc() {
    const ret = wasm.cpuinspector_pc(this.__wbg_ptr);
    return ret;
  }
  /**
   * @param {number} addr
   * @returns {number}
   */
  read(addr) {
    const ret = wasm.cpuinspector_read(this.__wbg_ptr, addr);
    return ret;
  }
  /**
   * @returns {number}
   */
  sp() {
    const ret = wasm.cpuinspector_sp(this.__wbg_ptr);
    return ret;
  }
  /**
   * 명령어 하나 실행, 소요 사이클 반환
   * @returns {number}
   */
  step() {
    const ret = wasm.cpuinspector_step(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
   * @param {number} addr
   * @param {number} val
   */
  write(addr, val) {
    wasm.cpuinspector_write(this.__wbg_ptr, addr, val);
  }
  /**
   * @returns {number}
   */
  x() {
    const ret = wasm.cpuinspector_x(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  y() {
    const ret = wasm.cpuinspector_y(this.__wbg_ptr);
    return ret;
  }
}
if (Symbol.dispose) CpuInspector.prototype[Symbol.dispose] = CpuInspector.prototype.free;

/**
 * 완전한 NES 콘솔
 */
export class NesConsole {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    NesConsoleFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_nesconsole_free(ptr, 0);
  }
  /**
   * 지난 호출 이후 쌓인 오디오 샘플 (44.1kHz 모노, 0.0~1.0 범위)
   * @returns {Float32Array}
   */
  audio() {
    const ret = wasm.nesconsole_audio(this.__wbg_ptr);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
  }
  /**
   * 카트리지의 CHR 데이터 (타일 뷰어용)
   * @returns {Uint8Array}
   */
  chr() {
    const ret = wasm.nesconsole_chr(this.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
  }
  /**
   * 256×240 RGBA 프레임버퍼
   * @returns {Uint8Array}
   */
  frame() {
    const ret = wasm.nesconsole_frame(this.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
  }
  /**
   * @param {Uint8Array} rom
   */
  constructor(rom) {
    const ptr0 = passArray8ToWasm0(rom, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.nesconsole_new(ptr0, len0);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    this.__wbg_ptr = ret[0];
    NesConsoleFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
  /**
   * 현재 팔레트 램 32바이트 (타일 뷰어용)
   * @returns {Uint8Array}
   */
  palette_ram() {
    const ret = wasm.nesconsole_palette_ram(this.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
  }
  /**
   * 프레임 하나(1/60초)만큼 실행
   */
  run_frame() {
    wasm.nesconsole_run_frame(this.__wbg_ptr);
  }
  /**
   * 컨트롤러 버튼. idx: A=0, B=1, Select=2, Start=3, Up=4, Down=5, Left=6, Right=7
   * @param {number} idx
   * @param {boolean} pressed
   */
  set_button(idx, pressed) {
    wasm.nesconsole_set_button(this.__wbg_ptr, idx, pressed);
  }
}
if (Symbol.dispose) NesConsole.prototype[Symbol.dispose] = NesConsole.prototype.free;

/**
 * 스네이크 게임 콘솔 (32×32 화면)
 */
export class SnakeConsole {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    SnakeConsoleFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_snakeconsole_free(ptr, 0);
  }
  /**
   * 32×32 화면을 RGBA로 변환해 돌려준다
   * @returns {Uint8Array}
   */
  frame() {
    const ret = wasm.snakeconsole_frame(this.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
  }
  /**
   * @returns {boolean}
   */
  game_over() {
    const ret = wasm.snakeconsole_game_over(this.__wbg_ptr);
    return ret !== 0;
  }
  /**
   * @param {number} seed
   */
  constructor(seed) {
    const ret = wasm.snakeconsole_new(seed);
    this.__wbg_ptr = ret;
    SnakeConsoleFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
  /**
   * 명령어 n개 실행. 게임 오버면 false를 반환한다.
   * @param {number} instructions
   * @returns {boolean}
   */
  run(instructions) {
    const ret = wasm.snakeconsole_run(this.__wbg_ptr, instructions);
    return ret !== 0;
  }
  /**
   * @param {number} key
   */
  set_key(key) {
    wasm.snakeconsole_set_key(this.__wbg_ptr, key);
  }
  /**
   * @returns {number}
   */
  snake_len() {
    const ret = wasm.snakeconsole_snake_len(this.__wbg_ptr);
    return ret;
  }
}
if (Symbol.dispose) SnakeConsole.prototype[Symbol.dispose] = SnakeConsole.prototype.free;

/**
 * CHR 타일 하나(16바이트)를 64개의 색 번호(0~3)로 디코드한다.
 * PPU의 render_scanline이 하는 일과 같은 계산이다.
 * @param {Uint8Array} tile
 * @returns {Uint8Array}
 */
export function decode_tile(tile) {
  const ptr0 = passArray8ToWasm0(tile, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.decode_tile(ptr0, len0);
  var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
  wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
  return v2;
}

/**
 * NTSC 팔레트 색 하나를 [r, g, b]로 돌려준다
 * @param {number} idx
 * @returns {Uint8Array}
 */
export function ntsc_color(idx) {
  const ret = wasm.ntsc_color(idx);
  var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
  wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
  return v1;
}
function __wbg_get_imports() {
  const import0 = {
    __proto__: null,
    __wbg___wbindgen_throw_344f42d3211c4765: function (arg0, arg1) {
      throw new Error(getStringFromWasm0(arg0, arg1));
    },
    __wbindgen_cast_0000000000000001: function (arg0, arg1) {
      // Cast intrinsic for `Ref(String) -> Externref`.
      const ret = getStringFromWasm0(arg0, arg1);
      return ret;
    },
    __wbindgen_init_externref_table: function () {
      const table = wasm.__wbindgen_externrefs;
      const offset = table.grow(4);
      table.set(0, undefined);
      table.set(offset + 0, undefined);
      table.set(offset + 1, null);
      table.set(offset + 2, true);
      table.set(offset + 3, false);
    },
  };
  return {
    __proto__: null,
    "./nes_core_bg.js": import0,
  };
}

const CpuInspectorFinalization =
  typeof FinalizationRegistry === "undefined"
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry((ptr) => wasm.__wbg_cpuinspector_free(ptr, 1));
const NesConsoleFinalization =
  typeof FinalizationRegistry === "undefined"
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry((ptr) => wasm.__wbg_nesconsole_free(ptr, 1));
const SnakeConsoleFinalization =
  typeof FinalizationRegistry === "undefined"
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry((ptr) => wasm.__wbg_snakeconsole_free(ptr, 1));

function getArrayF32FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getFloat32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayU8FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedFloat32ArrayMemory0 = null;
function getFloat32ArrayMemory0() {
  if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
    cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
  }
  return cachedFloat32ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
  return decodeText(ptr >>> 0, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
  if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
    cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8ArrayMemory0;
}

function passArray8ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 1, 1) >>> 0;
  getUint8ArrayMemory0().set(arg, ptr / 1);
  WASM_VECTOR_LEN = arg.length;
  return ptr;
}

function takeFromExternrefTable0(idx) {
  const value = wasm.__wbindgen_externrefs.get(idx);
  wasm.__externref_table_dealloc(idx);
  return value;
}

let cachedTextDecoder = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
  numBytesDecoded += len;
  if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
    cachedTextDecoder = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
    cachedTextDecoder.decode();
    numBytesDecoded = len;
  }
  return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
  wasmInstance = instance;
  wasm = instance.exports;
  wasmModule = module;
  cachedFloat32ArrayMemory0 = null;
  cachedUint8ArrayMemory0 = null;
  wasm.__wbindgen_start();
  return wasm;
}

async function __wbg_load(module, imports) {
  if (typeof Response === "function" && module instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming === "function") {
      try {
        return await WebAssembly.instantiateStreaming(module, imports);
      } catch (e) {
        const validResponse = module.ok && expectedResponseType(module.type);

        if (validResponse && module.headers.get("Content-Type") !== "application/wasm") {
          console.warn(
            "`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n",
            e,
          );
        } else {
          throw e;
        }
      }
    }

    const bytes = await module.arrayBuffer();
    return await WebAssembly.instantiate(bytes, imports);
  } else {
    const instance = await WebAssembly.instantiate(module, imports);

    if (instance instanceof WebAssembly.Instance) {
      return { instance, module };
    } else {
      return instance;
    }
  }

  function expectedResponseType(type) {
    switch (type) {
      case "basic":
      case "cors":
      case "default":
        return true;
    }
    return false;
  }
}

function initSync(module) {
  if (wasm !== undefined) return wasm;

  if (module !== undefined) {
    if (Object.getPrototypeOf(module) === Object.prototype) {
      ({ module } = module);
    } else {
      console.warn("using deprecated parameters for `initSync()`; pass a single object instead");
    }
  }

  const imports = __wbg_get_imports();
  if (!(module instanceof WebAssembly.Module)) {
    module = new WebAssembly.Module(module);
  }
  const instance = new WebAssembly.Instance(module, imports);
  return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
  if (wasm !== undefined) return wasm;

  if (module_or_path !== undefined) {
    if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
      ({ module_or_path } = module_or_path);
    } else {
      console.warn(
        "using deprecated parameters for the initialization function; pass a single object instead",
      );
    }
  }

  if (module_or_path === undefined) {
    module_or_path = new URL("nes_core_bg.wasm", import.meta.url);
  }
  const imports = __wbg_get_imports();

  if (
    typeof module_or_path === "string" ||
    (typeof Request === "function" && module_or_path instanceof Request) ||
    (typeof URL === "function" && module_or_path instanceof URL)
  ) {
    module_or_path = fetch(module_or_path);
  }

  const { instance, module } = await __wbg_load(await module_or_path, imports);

  return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
