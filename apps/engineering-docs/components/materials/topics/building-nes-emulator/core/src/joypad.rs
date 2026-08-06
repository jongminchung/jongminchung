/// 표준 NES 컨트롤러. 버튼 8개를 시프트 레지스터로 한 비트씩 읽는다.
/// 비트 순서: A, B, Select, Start, Up, Down, Left, Right
pub struct Joypad {
    strobe: bool, // strobe가 켜져 있는 동안은 계속 A 버튼 상태만 나온다
    buttons: u8,  // 현재 눌린 버튼들
    index: u8,    // 다음에 읽을 비트 위치
}

impl Default for Joypad {
    fn default() -> Self {
        Self::new()
    }
}

impl Joypad {
    pub fn new() -> Self {
        Joypad { strobe: false, buttons: 0, index: 0 }
    }

    /// idx: A=0, B=1, Select=2, Start=3, Up=4, Down=5, Left=6, Right=7
    pub fn set_button(&mut self, idx: u8, pressed: bool) {
        let bit = 1 << idx;
        if pressed {
            self.buttons |= bit;
        } else {
            self.buttons &= !bit;
        }
    }

    /// $4016 쓰기: 비트 0이 strobe. 켰다 끄면 읽기 위치가 처음으로 돌아간다.
    pub fn write(&mut self, val: u8) {
        self.strobe = val & 0x01 != 0;
        if self.strobe {
            self.index = 0;
        }
    }

    /// $4016 읽기: 버튼 상태를 한 비트씩. 8개를 다 읽은 뒤에는 1이 나온다.
    pub fn read(&mut self) -> u8 {
        if self.strobe {
            return self.buttons & 0x01;
        }
        if self.index >= 8 {
            return 1;
        }
        let bit = (self.buttons >> self.index) & 0x01;
        self.index += 1;
        bit
    }
}
