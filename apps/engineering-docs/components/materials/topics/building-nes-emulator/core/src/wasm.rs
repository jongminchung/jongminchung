//! 브라우저(JavaScript)에 노출하는 wasm-bindgen 인터페이스.
//! 에뮬레이터 코어는 이 파일의 존재를 모른다.

use crate::bus::Bus;
use crate::cpu::Cpu;
use crate::disasm::{disasm, instruction_len};
use crate::nes::Nes;
use crate::snake::SnakeMachine;
use wasm_bindgen::prelude::*;

/// 완전한 NES 콘솔
#[wasm_bindgen]
pub struct NesConsole {
    nes: Nes,
}

#[wasm_bindgen]
impl NesConsole {
    #[wasm_bindgen(constructor)]
    pub fn new(rom: &[u8]) -> Result<NesConsole, JsValue> {
        let nes = Nes::new(rom).map_err(|e| JsValue::from_str(&e))?;
        Ok(NesConsole { nes })
    }

    /// 프레임 하나(1/60초)만큼 실행
    pub fn run_frame(&mut self) {
        self.nes.run_frame();
    }

    /// 256×240 RGBA 프레임버퍼
    pub fn frame(&self) -> Vec<u8> {
        self.nes.bus.ppu.frame.to_vec()
    }

    /// 컨트롤러 버튼. idx: A=0, B=1, Select=2, Start=3, Up=4, Down=5, Left=6, Right=7
    pub fn set_button(&mut self, idx: u8, pressed: bool) {
        self.nes.bus.joypad1.set_button(idx, pressed);
    }

    /// 지난 호출 이후 쌓인 오디오 샘플 (44.1kHz 모노, 0.0~1.0 범위)
    pub fn audio(&mut self) -> Vec<f32> {
        self.nes.bus.apu.take_samples()
    }

    /// 카트리지의 CHR 데이터 (타일 뷰어용)
    pub fn chr(&self) -> Vec<u8> {
        self.nes.bus.cart.chr.clone()
    }

    /// 현재 팔레트 램 32바이트 (타일 뷰어용)
    pub fn palette_ram(&self) -> Vec<u8> {
        self.nes.bus.ppu.palette_ram.to_vec()
    }
}

/// NTSC 팔레트 색 하나를 [r, g, b]로 돌려준다
#[wasm_bindgen]
pub fn ntsc_color(idx: u8) -> Vec<u8> {
    crate::ppu::NTSC_PALETTE[(idx & 0x3F) as usize].to_vec()
}

/// CHR 타일 하나(16바이트)를 64개의 색 번호(0~3)로 디코드한다.
/// PPU의 render_scanline이 하는 일과 같은 계산이다.
#[wasm_bindgen]
pub fn decode_tile(tile: &[u8]) -> Vec<u8> {
    let mut out = vec![0u8; 64];
    for row in 0..8 {
        let lo = tile[row];
        let hi = tile[row + 8];
        for bit in 0..8 {
            out[row * 8 + bit] = ((hi >> (7 - bit)) & 1) << 1 | ((lo >> (7 - bit)) & 1);
        }
    }
    out
}

/// 스네이크 게임 콘솔 (32×32 화면)
#[wasm_bindgen]
pub struct SnakeConsole {
    machine: SnakeMachine,
}

/// 스네이크 화면의 색 코드(0~15) → RGB
const SNAKE_PALETTE: [[u8; 3]; 16] = [
    [0x0d, 0x0d, 0x0d], // 0 검정 (배경)
    [0xf8, 0xf9, 0xfa], // 1 흰색
    [0x86, 0x8e, 0x96], // 2 회색
    [0xfa, 0x52, 0x52], // 3 빨강 (사과)
    [0x40, 0xc0, 0x57], // 4 초록
    [0x33, 0x9a, 0xf0], // 5 파랑
    [0xcc, 0x5d, 0xe8], // 6 자홍
    [0xfc, 0xc4, 0x19], // 7 노랑
    [0xff, 0x87, 0x87], // 8
    [0x86, 0x8e, 0x96], // 9 회색
    [0xfa, 0x52, 0x52], // 10 빨강
    [0x40, 0xc0, 0x57], // 11 초록
    [0x33, 0x9a, 0xf0], // 12 파랑
    [0xcc, 0x5d, 0xe8], // 13 자홍
    [0xfc, 0xc4, 0x19], // 14 노랑
    [0x22, 0xb8, 0xcf], // 15 청록
];

#[wasm_bindgen]
impl SnakeConsole {
    #[wasm_bindgen(constructor)]
    pub fn new(seed: u32) -> SnakeConsole {
        SnakeConsole { machine: SnakeMachine::new(seed) }
    }

    pub fn set_key(&mut self, key: u8) {
        self.machine.set_key(key);
    }

    /// 명령어 n개 실행. 게임 오버면 false를 반환한다.
    pub fn run(&mut self, instructions: u32) -> bool {
        self.machine.run(instructions);
        !self.machine.game_over
    }

    pub fn game_over(&self) -> bool {
        self.machine.game_over
    }

    pub fn snake_len(&self) -> u8 {
        self.machine.snake_len()
    }

    /// 32×32 화면을 RGBA로 변환해 돌려준다
    pub fn frame(&self) -> Vec<u8> {
        let screen = self.machine.screen();
        let mut out = vec![0u8; 32 * 32 * 4];
        for (i, &code) in screen.iter().enumerate() {
            let rgb = SNAKE_PALETTE[(code & 0x0F) as usize];
            out[i * 4] = rgb[0];
            out[i * 4 + 1] = rgb[1];
            out[i * 4 + 2] = rgb[2];
            out[i * 4 + 3] = 0xFF;
        }
        out
    }
}

/// CPU 스텝 실행기: 작은 프로그램을 한 명령어씩 실행하며 관찰한다
#[wasm_bindgen]
pub struct CpuInspector {
    cpu: Cpu,
    mem: FlatBus,
}

struct FlatBus {
    mem: Box<[u8; 0x10000]>,
}

impl Bus for FlatBus {
    fn read(&mut self, addr: u16) -> u8 {
        self.mem[addr as usize]
    }
    fn write(&mut self, addr: u16, val: u8) {
        self.mem[addr as usize] = val;
    }
}

#[wasm_bindgen]
impl CpuInspector {
    #[wasm_bindgen(constructor)]
    pub fn new() -> CpuInspector {
        CpuInspector {
            cpu: Cpu::new(),
            mem: FlatBus { mem: vec![0u8; 0x10000].into_boxed_slice().try_into().unwrap() },
        }
    }

    /// 프로그램을 addr에 로드하고 PC를 그 주소로 맞춘다
    pub fn load(&mut self, program: &[u8], addr: u16) {
        let start = addr as usize;
        self.mem.mem[start..start + program.len()].copy_from_slice(program);
        self.cpu = Cpu::new();
        self.cpu.pc = addr;
    }

    /// 명령어 하나 실행, 소요 사이클 반환
    pub fn step(&mut self) -> u32 {
        self.cpu.step(&mut self.mem)
    }

    pub fn read(&mut self, addr: u16) -> u8 {
        self.mem.read(addr)
    }

    pub fn write(&mut self, addr: u16, val: u8) {
        self.mem.write(addr, val);
    }

    /// addr에서 시작하는 명령어 한 줄 디스어셈블: "주소|바이트수|텍스트"
    pub fn disasm_at(&mut self, addr: u16) -> String {
        let opcode = self.mem.read(addr);
        let text = disasm(&mut self.mem, addr);
        format!("{:04X}|{}|{}", addr, instruction_len(opcode), text)
    }

    pub fn a(&self) -> u8 { self.cpu.a }
    pub fn x(&self) -> u8 { self.cpu.x }
    pub fn y(&self) -> u8 { self.cpu.y }
    pub fn sp(&self) -> u8 { self.cpu.sp }
    pub fn pc(&self) -> u16 { self.cpu.pc }
    pub fn p(&self) -> u8 { self.cpu.p }
    pub fn cycles(&self) -> u32 { self.cpu.cycles as u32 }
}

impl Default for CpuInspector {
    fn default() -> Self {
        Self::new()
    }
}
