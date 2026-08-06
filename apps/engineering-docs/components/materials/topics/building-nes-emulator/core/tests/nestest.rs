use nes_core::bus::Bus;
use nes_core::cpu::Cpu;

/// 매퍼도 PPU도 없는 평평한 64KB 메모리.
/// nestest는 CPU만 검증하므로 이걸로 충분하다.
struct TestBus {
    mem: Vec<u8>,
}

impl Bus for TestBus {
    fn read(&mut self, addr: u16) -> u8 {
        self.mem[addr as usize]
    }
    fn write(&mut self, addr: u16, val: u8) {
        self.mem[addr as usize] = val;
    }
}

/// "A:" 같은 태그 뒤의 16진수 두 자리를 파싱한다
fn hex_field(line: &str, tag: &str) -> u8 {
    let pos = line.rfind(tag).unwrap_or_else(|| panic!("{tag} not found: {line}"));
    let start = pos + tag.len();
    u8::from_str_radix(&line[start..start + 2], 16).unwrap()
}

#[test]
fn nestest_matches_reference_log() {
    let dir = concat!(env!("CARGO_MANIFEST_DIR"), "/testdata");
    let rom = std::fs::read(format!("{dir}/nestest.nes")).expect("nestest.nes");
    let log = std::fs::read_to_string(format!("{dir}/nestest.log")).expect("nestest.log");

    // iNES 헤더 16바이트를 건너뛰고 PRG 16KB를 $8000과 $C000에 미러 매핑
    let prg = &rom[16..16 + 0x4000];
    let mut mem = vec![0u8; 0x10000];
    mem[0x8000..0xC000].copy_from_slice(prg);
    mem[0xC000..0x10000].copy_from_slice(prg);
    let mut bus = TestBus { mem };

    // nestest 자동 실행 모드: 리셋 벡터 대신 $C000에서 강제 시작
    let mut cpu = Cpu::new();
    cpu.pc = 0xC000;
    cpu.p = 0x24;
    cpu.sp = 0xFD;
    cpu.cycles = 7;

    for (i, line) in log.lines().enumerate() {
        let lineno = i + 1;
        let pc = u16::from_str_radix(&line[0..4], 16).unwrap();
        let a = hex_field(line, " A:");
        let x = hex_field(line, " X:");
        let y = hex_field(line, " Y:");
        let p = hex_field(line, " P:");
        let sp = hex_field(line, " SP:");
        let cyc_pos = line.rfind("CYC:").unwrap() + 4;
        let cyc: u64 = line[cyc_pos..].trim().parse().unwrap();

        // 실행 전 상태가 로그의 해당 줄과 정확히 일치해야 한다
        assert_eq!(cpu.pc, pc, "line {lineno}: PC expected {pc:04X}, got {:04X}\n{line}", cpu.pc);
        assert_eq!(cpu.a, a, "line {lineno}: A expected {a:02X}, got {:02X}\n{line}", cpu.a);
        assert_eq!(cpu.x, x, "line {lineno}: X expected {x:02X}, got {:02X}\n{line}", cpu.x);
        assert_eq!(cpu.y, y, "line {lineno}: Y expected {y:02X}, got {:02X}\n{line}", cpu.y);
        assert_eq!(cpu.p, p, "line {lineno}: P expected {p:02X}, got {:02X}\n{line}", cpu.p);
        assert_eq!(cpu.sp, sp, "line {lineno}: SP expected {sp:02X}, got {:02X}\n{line}", cpu.sp);
        assert_eq!(cpu.cycles, cyc, "line {lineno}: CYC expected {cyc}, got {}\n{line}", cpu.cycles);

        cpu.step(&mut bus);
    }

    // nestest는 실패한 테스트 번호를 $02(공식), $03(비공식)에 기록한다
    assert_eq!(bus.mem[0x02], 0, "official opcode test failed: {:02X}", bus.mem[0x02]);
    assert_eq!(bus.mem[0x03], 0, "unofficial opcode test failed: {:02X}", bus.mem[0x03]);
}
