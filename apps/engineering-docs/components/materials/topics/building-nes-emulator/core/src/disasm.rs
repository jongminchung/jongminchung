use crate::bus::Bus;
use crate::cpu::{Mode, OPCODES};

/// opcode의 총 길이(opcode 1바이트 + 피연산자)를 돌려준다
pub fn instruction_len(opcode: u8) -> u8 {
    match OPCODES[opcode as usize].mode {
        Mode::Imp | Mode::Acc => 1,
        Mode::Abs | Mode::Abx | Mode::Aby | Mode::Ind => 3,
        _ => 2,
    }
}

/// addr에 있는 명령어 한 개를 nestest 로그 스타일로 디스어셈블한다.
/// 예: "JMP $C5F5", "LDA ($80),Y", "*NOP $A9,X"
pub fn disasm(bus: &mut impl Bus, addr: u16) -> String {
    let opcode = bus.read(addr);
    let info = OPCODES[opcode as usize];
    // 비공식 opcode는 nestest 로그처럼 * 를 붙여 구분한다
    let prefix = if info.unofficial { "*" } else { "" };
    let name = info.name;

    let b1 = bus.read(addr.wrapping_add(1));
    let b2 = bus.read(addr.wrapping_add(2));
    let abs = (b2 as u16) << 8 | b1 as u16;

    match info.mode {
        Mode::Imp => format!("{prefix}{name}"),
        Mode::Acc => format!("{prefix}{name} A"),
        Mode::Imm => format!("{prefix}{name} #${b1:02X}"),
        Mode::Zp => format!("{prefix}{name} ${b1:02X}"),
        Mode::Zpx => format!("{prefix}{name} ${b1:02X},X"),
        Mode::Zpy => format!("{prefix}{name} ${b1:02X},Y"),
        Mode::Abs => format!("{prefix}{name} ${abs:04X}"),
        Mode::Abx => format!("{prefix}{name} ${abs:04X},X"),
        Mode::Aby => format!("{prefix}{name} ${abs:04X},Y"),
        Mode::Ind => format!("{prefix}{name} (${abs:04X})"),
        Mode::Izx => format!("{prefix}{name} (${b1:02X},X)"),
        Mode::Izy => format!("{prefix}{name} (${b1:02X}),Y"),
        Mode::Rel => {
            // 분기 목적지 = 다음 명령어 주소 + 부호 있는 오프셋
            let target = addr.wrapping_add(2).wrapping_add(b1 as i8 as u16);
            format!("{prefix}{name} ${target:04X}")
        }
    }
}
