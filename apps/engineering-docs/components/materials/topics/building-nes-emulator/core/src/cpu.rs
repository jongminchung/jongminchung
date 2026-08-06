use crate::bus::Bus;

// 상태 레지스터(P)의 플래그 비트
pub const CARRY: u8 = 0x01;
pub const ZERO: u8 = 0x02;
pub const INTERRUPT_DISABLE: u8 = 0x04;
pub const DECIMAL: u8 = 0x08;
pub const BREAK: u8 = 0x10;
pub const UNUSED: u8 = 0x20;
pub const OVERFLOW: u8 = 0x40;
pub const NEGATIVE: u8 = 0x80;

/// 스택은 $0100~$01FF 페이지에 고정되어 있다
const STACK_BASE: u16 = 0x0100;

/// 어드레싱 모드
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Mode {
    Imp, // Implied
    Acc, // Accumulator
    Imm, // Immediate
    Zp,  // Zero Page
    Zpx, // Zero Page,X
    Zpy, // Zero Page,Y
    Abs, // Absolute
    Abx, // Absolute,X
    Aby, // Absolute,Y
    Ind, // Indirect (JMP 전용)
    Izx, // (Indirect,X)
    Izy, // (Indirect),Y
    Rel, // Relative (분기 전용)
}

/// opcode 테이블 한 칸
#[derive(Debug, Clone, Copy)]
pub struct OpInfo {
    pub name: &'static str,
    pub mode: Mode,
    pub cycles: u8,
    /// 페이지 경계를 넘으면 1사이클이 추가되는 명령어인지
    pub cross: bool,
    /// 비공식(undocumented) opcode인지
    pub unofficial: bool,
}

// 테이블을 한 줄씩 읽기 좋게 만드는 축약 생성자들
const fn op(name: &'static str, mode: Mode, cycles: u8) -> OpInfo {
    OpInfo { name, mode, cycles, cross: false, unofficial: false }
}
const fn opc(name: &'static str, mode: Mode, cycles: u8) -> OpInfo {
    OpInfo { name, mode, cycles, cross: true, unofficial: false }
}
const fn un(name: &'static str, mode: Mode, cycles: u8) -> OpInfo {
    OpInfo { name, mode, cycles, cross: false, unofficial: true }
}
const fn unc(name: &'static str, mode: Mode, cycles: u8) -> OpInfo {
    OpInfo { name, mode, cycles, cross: true, unofficial: true }
}
const fn xx() -> OpInfo {
    OpInfo { name: "???", mode: Mode::Imp, cycles: 2, cross: false, unofficial: true }
}

use Mode::{Abs, Abx, Aby, Acc, Imm, Imp, Ind, Izx, Izy, Rel, Zp, Zpx, Zpy};

/// 256개 opcode 전체. 인덱스가 곧 opcode 값이다.
#[rustfmt::skip]
pub const OPCODES: [OpInfo; 256] = [
    // 0x00
    op("BRK", Imp, 7), op("ORA", Izx, 6), xx(),              un("SLO", Izx, 8),
    un("NOP", Zp, 3),  op("ORA", Zp, 3),  op("ASL", Zp, 5),  un("SLO", Zp, 5),
    op("PHP", Imp, 3), op("ORA", Imm, 2), op("ASL", Acc, 2), xx(),
    un("NOP", Abs, 4), op("ORA", Abs, 4), op("ASL", Abs, 6), un("SLO", Abs, 6),
    // 0x10
    op("BPL", Rel, 2), opc("ORA", Izy, 5), xx(),              un("SLO", Izy, 8),
    un("NOP", Zpx, 4), op("ORA", Zpx, 4),  op("ASL", Zpx, 6), un("SLO", Zpx, 6),
    op("CLC", Imp, 2), opc("ORA", Aby, 4), un("NOP", Imp, 2), un("SLO", Aby, 7),
    unc("NOP", Abx, 4), opc("ORA", Abx, 4), op("ASL", Abx, 7), un("SLO", Abx, 7),
    // 0x20
    op("JSR", Abs, 6), op("AND", Izx, 6), xx(),              un("RLA", Izx, 8),
    op("BIT", Zp, 3),  op("AND", Zp, 3),  op("ROL", Zp, 5),  un("RLA", Zp, 5),
    op("PLP", Imp, 4), op("AND", Imm, 2), op("ROL", Acc, 2), xx(),
    op("BIT", Abs, 4), op("AND", Abs, 4), op("ROL", Abs, 6), un("RLA", Abs, 6),
    // 0x30
    op("BMI", Rel, 2), opc("AND", Izy, 5), xx(),              un("RLA", Izy, 8),
    un("NOP", Zpx, 4), op("AND", Zpx, 4),  op("ROL", Zpx, 6), un("RLA", Zpx, 6),
    op("SEC", Imp, 2), opc("AND", Aby, 4), un("NOP", Imp, 2), un("RLA", Aby, 7),
    unc("NOP", Abx, 4), opc("AND", Abx, 4), op("ROL", Abx, 7), un("RLA", Abx, 7),
    // 0x40
    op("RTI", Imp, 6), op("EOR", Izx, 6), xx(),              un("SRE", Izx, 8),
    un("NOP", Zp, 3),  op("EOR", Zp, 3),  op("LSR", Zp, 5),  un("SRE", Zp, 5),
    op("PHA", Imp, 3), op("EOR", Imm, 2), op("LSR", Acc, 2), xx(),
    op("JMP", Abs, 3), op("EOR", Abs, 4), op("LSR", Abs, 6), un("SRE", Abs, 6),
    // 0x50
    op("BVC", Rel, 2), opc("EOR", Izy, 5), xx(),              un("SRE", Izy, 8),
    un("NOP", Zpx, 4), op("EOR", Zpx, 4),  op("LSR", Zpx, 6), un("SRE", Zpx, 6),
    op("CLI", Imp, 2), opc("EOR", Aby, 4), un("NOP", Imp, 2), un("SRE", Aby, 7),
    unc("NOP", Abx, 4), opc("EOR", Abx, 4), op("LSR", Abx, 7), un("SRE", Abx, 7),
    // 0x60
    op("RTS", Imp, 6), op("ADC", Izx, 6), xx(),              un("RRA", Izx, 8),
    un("NOP", Zp, 3),  op("ADC", Zp, 3),  op("ROR", Zp, 5),  un("RRA", Zp, 5),
    op("PLA", Imp, 4), op("ADC", Imm, 2), op("ROR", Acc, 2), xx(),
    op("JMP", Ind, 5), op("ADC", Abs, 4), op("ROR", Abs, 6), un("RRA", Abs, 6),
    // 0x70
    op("BVS", Rel, 2), opc("ADC", Izy, 5), xx(),              un("RRA", Izy, 8),
    un("NOP", Zpx, 4), op("ADC", Zpx, 4),  op("ROR", Zpx, 6), un("RRA", Zpx, 6),
    op("SEI", Imp, 2), opc("ADC", Aby, 4), un("NOP", Imp, 2), un("RRA", Aby, 7),
    unc("NOP", Abx, 4), opc("ADC", Abx, 4), op("ROR", Abx, 7), un("RRA", Abx, 7),
    // 0x80
    un("NOP", Imm, 2), op("STA", Izx, 6), un("NOP", Imm, 2), un("SAX", Izx, 6),
    op("STY", Zp, 3),  op("STA", Zp, 3),  op("STX", Zp, 3),  un("SAX", Zp, 3),
    op("DEY", Imp, 2), un("NOP", Imm, 2), op("TXA", Imp, 2), xx(),
    op("STY", Abs, 4), op("STA", Abs, 4), op("STX", Abs, 4), un("SAX", Abs, 4),
    // 0x90
    op("BCC", Rel, 2), op("STA", Izy, 6), xx(),              xx(),
    op("STY", Zpx, 4), op("STA", Zpx, 4), op("STX", Zpy, 4), un("SAX", Zpy, 4),
    op("TYA", Imp, 2), op("STA", Aby, 5), op("TXS", Imp, 2), xx(),
    xx(),              op("STA", Abx, 5), xx(),              xx(),
    // 0xA0
    op("LDY", Imm, 2), op("LDA", Izx, 6), op("LDX", Imm, 2), un("LAX", Izx, 6),
    op("LDY", Zp, 3),  op("LDA", Zp, 3),  op("LDX", Zp, 3),  un("LAX", Zp, 3),
    op("TAY", Imp, 2), op("LDA", Imm, 2), op("TAX", Imp, 2), xx(),
    op("LDY", Abs, 4), op("LDA", Abs, 4), op("LDX", Abs, 4), un("LAX", Abs, 4),
    // 0xB0
    op("BCS", Rel, 2),  opc("LDA", Izy, 5), xx(),              unc("LAX", Izy, 5),
    op("LDY", Zpx, 4),  op("LDA", Zpx, 4),  op("LDX", Zpy, 4), un("LAX", Zpy, 4),
    op("CLV", Imp, 2),  opc("LDA", Aby, 4), op("TSX", Imp, 2), xx(),
    opc("LDY", Abx, 4), opc("LDA", Abx, 4), opc("LDX", Aby, 4), unc("LAX", Aby, 4),
    // 0xC0
    op("CPY", Imm, 2), op("CMP", Izx, 6), un("NOP", Imm, 2), un("DCP", Izx, 8),
    op("CPY", Zp, 3),  op("CMP", Zp, 3),  op("DEC", Zp, 5),  un("DCP", Zp, 5),
    op("INY", Imp, 2), op("CMP", Imm, 2), op("DEX", Imp, 2), xx(),
    op("CPY", Abs, 4), op("CMP", Abs, 4), op("DEC", Abs, 6), un("DCP", Abs, 6),
    // 0xD0
    op("BNE", Rel, 2), opc("CMP", Izy, 5), xx(),              un("DCP", Izy, 8),
    un("NOP", Zpx, 4), op("CMP", Zpx, 4),  op("DEC", Zpx, 6), un("DCP", Zpx, 6),
    op("CLD", Imp, 2), opc("CMP", Aby, 4), un("NOP", Imp, 2), un("DCP", Aby, 7),
    unc("NOP", Abx, 4), opc("CMP", Abx, 4), op("DEC", Abx, 7), un("DCP", Abx, 7),
    // 0xE0
    op("CPX", Imm, 2), op("SBC", Izx, 6), un("NOP", Imm, 2), un("ISB", Izx, 8),
    op("CPX", Zp, 3),  op("SBC", Zp, 3),  op("INC", Zp, 5),  un("ISB", Zp, 5),
    op("INX", Imp, 2), op("SBC", Imm, 2), op("NOP", Imp, 2), un("SBC", Imm, 2),
    op("CPX", Abs, 4), op("SBC", Abs, 4), op("INC", Abs, 6), un("ISB", Abs, 6),
    // 0xF0
    op("BEQ", Rel, 2), opc("SBC", Izy, 5), xx(),              un("ISB", Izy, 8),
    un("NOP", Zpx, 4), op("SBC", Zpx, 4),  op("INC", Zpx, 6), un("ISB", Zpx, 6),
    op("SED", Imp, 2), opc("SBC", Aby, 4), un("NOP", Imp, 2), un("ISB", Aby, 7),
    unc("NOP", Abx, 4), opc("SBC", Abx, 4), op("INC", Abx, 7), un("ISB", Abx, 7),
];

fn page_crossed(a: u16, b: u16) -> bool {
    a & 0xFF00 != b & 0xFF00
}

pub struct Cpu {
    pub a: u8,
    pub x: u8,
    pub y: u8,
    pub sp: u8,
    pub pc: u16,
    pub p: u8,
    pub cycles: u64,
}

impl Default for Cpu {
    fn default() -> Self {
        Self::new()
    }
}

impl Cpu {
    pub fn new() -> Self {
        Cpu { a: 0, x: 0, y: 0, sp: 0xFD, pc: 0, p: INTERRUPT_DISABLE | UNUSED, cycles: 0 }
    }

    /// 전원 인가/리셋. $FFFC의 리셋 벡터에서 시작 주소를 읽는다.
    pub fn reset(&mut self, bus: &mut impl Bus) {
        self.a = 0;
        self.x = 0;
        self.y = 0;
        self.sp = 0xFD;
        self.p = INTERRUPT_DISABLE | UNUSED;
        self.pc = bus.read16(0xFFFC);
        self.cycles += 7;
    }

    /// NMI(Non-Maskable Interrupt). PPU가 VBlank에 진입할 때 발생한다.
    pub fn nmi(&mut self, bus: &mut impl Bus) {
        self.push16(bus, self.pc);
        self.push(bus, (self.p | UNUSED) & !BREAK);
        self.p |= INTERRUPT_DISABLE;
        self.pc = bus.read16(0xFFFA);
        self.cycles += 7;
    }

    /// IRQ. I 플래그가 서 있으면 무시된다.
    pub fn irq(&mut self, bus: &mut impl Bus) {
        if self.p & INTERRUPT_DISABLE != 0 {
            return;
        }
        self.push16(bus, self.pc);
        self.push(bus, (self.p | UNUSED) & !BREAK);
        self.p |= INTERRUPT_DISABLE;
        self.pc = bus.read16(0xFFFE);
        self.cycles += 7;
    }

    /// 명령어 하나를 실행하고 소요된 사이클 수를 돌려준다.
    pub fn step(&mut self, bus: &mut impl Bus) -> u32 {
        let opcode = bus.read(self.pc);
        self.pc = self.pc.wrapping_add(1);
        let info = OPCODES[opcode as usize];

        // 피연산자 주소를 먼저 해석한다 (PC도 여기서 전진)
        let (addr, crossed) = self.operand_addr(bus, info.mode);
        let mut cycles = info.cycles as u32;
        if info.cross && crossed {
            cycles += 1; // 페이지 경계 추가 사이클
        }

        match info.name {
            // --- 적재 / 저장 ---
            "LDA" => {
                self.a = bus.read(addr);
                self.set_zn(self.a);
            }
            "LDX" => {
                self.x = bus.read(addr);
                self.set_zn(self.x);
            }
            "LDY" => {
                self.y = bus.read(addr);
                self.set_zn(self.y);
            }
            "STA" => bus.write(addr, self.a),
            "STX" => bus.write(addr, self.x),
            "STY" => bus.write(addr, self.y),

            // --- 레지스터 간 이동 ---
            "TAX" => {
                self.x = self.a;
                self.set_zn(self.x);
            }
            "TAY" => {
                self.y = self.a;
                self.set_zn(self.y);
            }
            "TXA" => {
                self.a = self.x;
                self.set_zn(self.a);
            }
            "TYA" => {
                self.a = self.y;
                self.set_zn(self.a);
            }
            "TSX" => {
                self.x = self.sp;
                self.set_zn(self.x);
            }
            "TXS" => self.sp = self.x, // 유일하게 플래그를 건드리지 않는 transfer

            // --- 스택 ---
            "PHA" => self.push(bus, self.a),
            "PHP" => self.push(bus, self.p | BREAK | UNUSED), // PHP는 B 플래그를 켜서 쌓는다
            "PLA" => {
                self.a = self.pull(bus);
                self.set_zn(self.a);
            }
            "PLP" => self.p = (self.pull(bus) | UNUSED) & !BREAK,

            // --- 논리 연산 ---
            "AND" => {
                self.a &= bus.read(addr);
                self.set_zn(self.a);
            }
            "ORA" => {
                self.a |= bus.read(addr);
                self.set_zn(self.a);
            }
            "EOR" => {
                self.a ^= bus.read(addr);
                self.set_zn(self.a);
            }
            "BIT" => {
                let v = bus.read(addr);
                self.set_flag(ZERO, self.a & v == 0);
                self.set_flag(OVERFLOW, v & 0x40 != 0);
                self.set_flag(NEGATIVE, v & 0x80 != 0);
            }

            // --- 산술 연산 ---
            "ADC" => {
                let v = bus.read(addr);
                self.adc(v);
            }
            "SBC" => {
                // 뺄셈은 보수를 더하는 것과 같다: A - M - (1-C) = A + !M + C
                let v = bus.read(addr);
                self.adc(!v);
            }
            "CMP" => {
                let v = bus.read(addr);
                self.compare(self.a, v);
            }
            "CPX" => {
                let v = bus.read(addr);
                self.compare(self.x, v);
            }
            "CPY" => {
                let v = bus.read(addr);
                self.compare(self.y, v);
            }

            // --- 증감 ---
            "INC" => {
                let v = bus.read(addr).wrapping_add(1);
                bus.write(addr, v);
                self.set_zn(v);
            }
            "DEC" => {
                let v = bus.read(addr).wrapping_sub(1);
                bus.write(addr, v);
                self.set_zn(v);
            }
            "INX" => {
                self.x = self.x.wrapping_add(1);
                self.set_zn(self.x);
            }
            "INY" => {
                self.y = self.y.wrapping_add(1);
                self.set_zn(self.y);
            }
            "DEX" => {
                self.x = self.x.wrapping_sub(1);
                self.set_zn(self.x);
            }
            "DEY" => {
                self.y = self.y.wrapping_sub(1);
                self.set_zn(self.y);
            }

            // --- 시프트 / 로테이트 (누산기 또는 메모리) ---
            "ASL" => {
                let v = self.read_rmw(bus, info.mode, addr);
                let r = self.asl(v);
                self.write_rmw(bus, info.mode, addr, r);
            }
            "LSR" => {
                let v = self.read_rmw(bus, info.mode, addr);
                let r = self.lsr(v);
                self.write_rmw(bus, info.mode, addr, r);
            }
            "ROL" => {
                let v = self.read_rmw(bus, info.mode, addr);
                let r = self.rol(v);
                self.write_rmw(bus, info.mode, addr, r);
            }
            "ROR" => {
                let v = self.read_rmw(bus, info.mode, addr);
                let r = self.ror(v);
                self.write_rmw(bus, info.mode, addr, r);
            }

            // --- 점프 / 서브루틴 ---
            "JMP" => self.pc = addr,
            "JSR" => {
                // 복귀 주소는 다음 명령어 주소 - 1 (RTS가 +1 해서 돌아온다)
                self.push16(bus, self.pc.wrapping_sub(1));
                self.pc = addr;
            }
            "RTS" => self.pc = self.pull16(bus).wrapping_add(1),
            "RTI" => {
                self.p = (self.pull(bus) | UNUSED) & !BREAK;
                self.pc = self.pull16(bus);
            }
            "BRK" => {
                self.push16(bus, self.pc.wrapping_add(1)); // BRK는 2바이트 취급
                self.push(bus, self.p | BREAK | UNUSED);
                self.p |= INTERRUPT_DISABLE;
                self.pc = bus.read16(0xFFFE);
            }

            // --- 분기 ---
            "BCC" => cycles += self.branch(self.p & CARRY == 0, addr, crossed),
            "BCS" => cycles += self.branch(self.p & CARRY != 0, addr, crossed),
            "BNE" => cycles += self.branch(self.p & ZERO == 0, addr, crossed),
            "BEQ" => cycles += self.branch(self.p & ZERO != 0, addr, crossed),
            "BPL" => cycles += self.branch(self.p & NEGATIVE == 0, addr, crossed),
            "BMI" => cycles += self.branch(self.p & NEGATIVE != 0, addr, crossed),
            "BVC" => cycles += self.branch(self.p & OVERFLOW == 0, addr, crossed),
            "BVS" => cycles += self.branch(self.p & OVERFLOW != 0, addr, crossed),

            // --- 플래그 조작 ---
            "CLC" => self.set_flag(CARRY, false),
            "SEC" => self.set_flag(CARRY, true),
            "CLI" => self.set_flag(INTERRUPT_DISABLE, false),
            "SEI" => self.set_flag(INTERRUPT_DISABLE, true),
            "CLV" => self.set_flag(OVERFLOW, false),
            "CLD" => self.set_flag(DECIMAL, false),
            "SED" => self.set_flag(DECIMAL, true),

            // --- 비공식 opcode ---
            "LAX" => {
                // LDA + LDX
                let v = bus.read(addr);
                self.a = v;
                self.x = v;
                self.set_zn(v);
            }
            "SAX" => bus.write(addr, self.a & self.x),
            "DCP" => {
                // DEC + CMP
                let v = bus.read(addr).wrapping_sub(1);
                bus.write(addr, v);
                self.compare(self.a, v);
            }
            "ISB" => {
                // INC + SBC
                let v = bus.read(addr).wrapping_add(1);
                bus.write(addr, v);
                self.adc(!v);
            }
            "SLO" => {
                // ASL + ORA
                let v = bus.read(addr);
                let r = self.asl(v);
                bus.write(addr, r);
                self.a |= r;
                self.set_zn(self.a);
            }
            "RLA" => {
                // ROL + AND
                let v = bus.read(addr);
                let r = self.rol(v);
                bus.write(addr, r);
                self.a &= r;
                self.set_zn(self.a);
            }
            "SRE" => {
                // LSR + EOR
                let v = bus.read(addr);
                let r = self.lsr(v);
                bus.write(addr, r);
                self.a ^= r;
                self.set_zn(self.a);
            }
            "RRA" => {
                // ROR + ADC
                let v = bus.read(addr);
                let r = self.ror(v);
                bus.write(addr, r);
                self.adc(r);
            }

            // NOP과 미구현 opcode는 아무 일도 하지 않는다
            _ => {}
        }

        self.cycles += cycles as u64;
        cycles
    }

    /// 어드레싱 모드에 따라 피연산자의 실효 주소를 계산한다.
    /// 두 번째 반환값은 인덱싱 중 페이지 경계를 넘었는지 여부.
    fn operand_addr(&mut self, bus: &mut impl Bus, mode: Mode) -> (u16, bool) {
        match mode {
            Mode::Imp | Mode::Acc => (0, false),
            Mode::Imm => {
                let addr = self.pc;
                self.pc = self.pc.wrapping_add(1);
                (addr, false)
            }
            Mode::Zp => (self.fetch8(bus) as u16, false),
            Mode::Zpx => (self.fetch8(bus).wrapping_add(self.x) as u16, false),
            Mode::Zpy => (self.fetch8(bus).wrapping_add(self.y) as u16, false),
            Mode::Abs => (self.fetch16(bus), false),
            Mode::Abx => {
                let base = self.fetch16(bus);
                let addr = base.wrapping_add(self.x as u16);
                (addr, page_crossed(base, addr))
            }
            Mode::Aby => {
                let base = self.fetch16(bus);
                let addr = base.wrapping_add(self.y as u16);
                (addr, page_crossed(base, addr))
            }
            Mode::Ind => {
                // 6502 하드웨어 버그: 포인터가 $xxFF에 걸치면
                // 상위 바이트를 다음 페이지가 아니라 같은 페이지 첫 바이트에서 읽는다
                let ptr = self.fetch16(bus);
                let lo = bus.read(ptr) as u16;
                let hi = bus.read((ptr & 0xFF00) | (ptr.wrapping_add(1) & 0x00FF)) as u16;
                ((hi << 8) | lo, false)
            }
            Mode::Izx => {
                let ptr = self.fetch8(bus).wrapping_add(self.x);
                (self.read16_zp(bus, ptr), false)
            }
            Mode::Izy => {
                let ptr = self.fetch8(bus);
                let base = self.read16_zp(bus, ptr);
                let addr = base.wrapping_add(self.y as u16);
                (addr, page_crossed(base, addr))
            }
            Mode::Rel => {
                let offset = self.fetch8(bus) as i8; // 부호 있는 오프셋
                let addr = self.pc.wrapping_add(offset as u16);
                (addr, page_crossed(self.pc, addr))
            }
        }
    }

    // --- 연산 헬퍼 ---

    /// ADC의 본체. SBC와 RRA, ISB도 이걸 재사용한다.
    fn adc(&mut self, v: u8) {
        let carry = (self.p & CARRY) as u16;
        let sum = self.a as u16 + v as u16 + carry;
        let result = sum as u8;
        self.set_flag(CARRY, sum > 0xFF);
        // 부호가 같은 두 수를 더했는데 결과 부호가 다르면 오버플로
        self.set_flag(OVERFLOW, (self.a ^ result) & (v ^ result) & 0x80 != 0);
        self.a = result;
        self.set_zn(result);
    }

    fn compare(&mut self, reg: u8, v: u8) {
        self.set_flag(CARRY, reg >= v);
        self.set_zn(reg.wrapping_sub(v));
    }

    fn asl(&mut self, v: u8) -> u8 {
        self.set_flag(CARRY, v & 0x80 != 0);
        let r = v << 1;
        self.set_zn(r);
        r
    }

    fn lsr(&mut self, v: u8) -> u8 {
        self.set_flag(CARRY, v & 0x01 != 0);
        let r = v >> 1;
        self.set_zn(r);
        r
    }

    fn rol(&mut self, v: u8) -> u8 {
        let carry_in = self.p & CARRY;
        self.set_flag(CARRY, v & 0x80 != 0);
        let r = (v << 1) | carry_in;
        self.set_zn(r);
        r
    }

    fn ror(&mut self, v: u8) -> u8 {
        let carry_in = self.p & CARRY;
        self.set_flag(CARRY, v & 0x01 != 0);
        let r = (v >> 1) | (carry_in << 7);
        self.set_zn(r);
        r
    }

    /// 분기 처리. 성공 시 +1, 페이지를 넘으면 +2 사이클.
    fn branch(&mut self, cond: bool, addr: u16, crossed: bool) -> u32 {
        if !cond {
            return 0;
        }
        self.pc = addr;
        if crossed {
            2
        } else {
            1
        }
    }

    // --- 읽기/쓰기 헬퍼 ---

    /// RMW(read-modify-write) 명령어용: Acc 모드면 누산기를 읽는다
    fn read_rmw(&mut self, bus: &mut impl Bus, mode: Mode, addr: u16) -> u8 {
        if mode == Mode::Acc {
            self.a
        } else {
            bus.read(addr)
        }
    }

    fn write_rmw(&mut self, bus: &mut impl Bus, mode: Mode, addr: u16, v: u8) {
        if mode == Mode::Acc {
            self.a = v;
        } else {
            bus.write(addr, v);
        }
    }

    /// PC 위치에서 1바이트를 읽고 PC를 전진시킨다
    fn fetch8(&mut self, bus: &mut impl Bus) -> u8 {
        let v = bus.read(self.pc);
        self.pc = self.pc.wrapping_add(1);
        v
    }

    fn fetch16(&mut self, bus: &mut impl Bus) -> u16 {
        let v = bus.read16(self.pc);
        self.pc = self.pc.wrapping_add(2);
        v
    }

    /// 제로 페이지 안에서 랩어라운드하는 16비트 읽기 ((Indirect,X) / (Indirect),Y 용)
    fn read16_zp(&mut self, bus: &mut impl Bus, ptr: u8) -> u16 {
        let lo = bus.read(ptr as u16) as u16;
        let hi = bus.read(ptr.wrapping_add(1) as u16) as u16;
        (hi << 8) | lo
    }

    fn push(&mut self, bus: &mut impl Bus, v: u8) {
        bus.write(STACK_BASE + self.sp as u16, v);
        self.sp = self.sp.wrapping_sub(1);
    }

    fn pull(&mut self, bus: &mut impl Bus) -> u8 {
        self.sp = self.sp.wrapping_add(1);
        bus.read(STACK_BASE + self.sp as u16)
    }

    fn push16(&mut self, bus: &mut impl Bus, v: u16) {
        self.push(bus, (v >> 8) as u8);
        self.push(bus, v as u8);
    }

    fn pull16(&mut self, bus: &mut impl Bus) -> u16 {
        let lo = self.pull(bus) as u16;
        let hi = self.pull(bus) as u16;
        (hi << 8) | lo
    }

    // --- 플래그 헬퍼 ---

    fn set_flag(&mut self, flag: u8, on: bool) {
        if on {
            self.p |= flag;
        } else {
            self.p &= !flag;
        }
    }

    /// Zero, Negative 플래그는 거의 모든 명령어가 갱신하므로 헬퍼로 뺀다
    fn set_zn(&mut self, v: u8) {
        self.set_flag(ZERO, v == 0);
        self.set_flag(NEGATIVE, v & 0x80 != 0);
    }
}
