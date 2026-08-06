use crate::cartridge::Cartridge;

// NTSC CPU 클럭과 출력 샘플레이트. 약 40.58 CPU 사이클마다 샘플 하나를 뽑는다.
const CPU_HZ: f64 = 1_789_773.0;
const SAMPLE_RATE: f64 = 44_100.0;
const CYCLES_PER_SAMPLE: f64 = CPU_HZ / SAMPLE_RATE;

/// 길이 카운터 로드 값 테이블. $4003 등의 상위 5비트가 인덱스가 된다.
const LENGTH_TABLE: [u8; 32] = [
    10, 254, 20, 2, 40, 4, 80, 6, 160, 8, 60, 10, 14, 12, 26, 14, //
    12, 16, 24, 18, 48, 20, 96, 22, 192, 24, 72, 26, 16, 28, 32, 30,
];

/// 펄스 듀티 4종: 12.5%, 25%, 50%, 75%(25%의 반전)
const DUTY_TABLE: [[u8; 8]; 4] = [
    [0, 1, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 0, 0, 0],
    [1, 0, 0, 1, 1, 1, 1, 1],
];

/// 삼각파 32스텝 시퀀스: 15→0으로 내려갔다가 0→15로 올라온다
const TRIANGLE_SEQ: [u8; 32] = [
    15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, //
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
];

/// 노이즈 주기 테이블 (APU 사이클 단위, nesdev의 CPU 사이클 값을 2로 나눈 것)
const NOISE_PERIODS: [u16; 16] = [
    2, 4, 8, 16, 32, 48, 64, 80, 101, 127, 190, 254, 381, 508, 1017, 2034,
];

/// DMC 주기 테이블 (APU 사이클 단위)
const DMC_PERIODS: [u16; 16] = [
    214, 190, 170, 160, 143, 127, 113, 107, 95, 80, 71, 64, 53, 42, 36, 27,
];

/// 볼륨 엔벨로프. 펄스와 노이즈가 공용으로 쓴다.
struct Envelope {
    start: bool,    // 다음 quarter frame에 새로 시작
    divider: u8,    // 분주기 카운터
    decay: u8,      // 15에서 0으로 감쇠하는 볼륨
    period: u8,     // 분주기 주기이자 고정 볼륨 값
    constant: bool, // true면 감쇠 대신 period를 볼륨으로 쓴다
    loop_flag: bool,
}

impl Envelope {
    fn new() -> Envelope {
        Envelope { start: false, divider: 0, decay: 0, period: 0, constant: false, loop_flag: false }
    }

    /// quarter frame마다 호출
    fn clock(&mut self) {
        if self.start {
            self.start = false;
            self.decay = 15;
            self.divider = self.period;
        } else if self.divider == 0 {
            self.divider = self.period;
            if self.decay > 0 {
                self.decay -= 1;
            } else if self.loop_flag {
                self.decay = 15;
            }
        } else {
            self.divider -= 1;
        }
    }

    fn volume(&self) -> u8 {
        if self.constant {
            self.period
        } else {
            self.decay
        }
    }
}

/// 펄스(구형파) 채널. 타이머는 APU 사이클(CPU/2)로 돈다.
struct Pulse {
    enabled: bool,
    duty: u8,
    phase: u8,   // 듀티 시퀀스의 현재 위치
    period: u16, // 11비트 타이머 주기
    timer: u16,
    length: u8,
    halt: bool,
    envelope: Envelope,
    sweep_enabled: bool,
    sweep_period: u8,
    sweep_negate: bool,
    sweep_shift: u8,
    sweep_divider: u8,
    sweep_reload: bool,
    complement: bool, // 펄스 1의 뺄셈은 1의 보수라 결과가 1 더 작다
}

impl Pulse {
    fn new(complement: bool) -> Pulse {
        Pulse {
            enabled: false,
            duty: 0,
            phase: 0,
            period: 0,
            timer: 0,
            length: 0,
            halt: false,
            envelope: Envelope::new(),
            sweep_enabled: false,
            sweep_period: 0,
            sweep_negate: false,
            sweep_shift: 0,
            sweep_divider: 0,
            sweep_reload: false,
            complement,
        }
    }

    /// reg: $4000~$4003의 하위 2비트
    fn write_reg(&mut self, reg: u16, val: u8) {
        match reg {
            0 => {
                self.duty = val >> 6;
                self.halt = val & 0x20 != 0;
                self.envelope.loop_flag = self.halt;
                self.envelope.constant = val & 0x10 != 0;
                self.envelope.period = val & 0x0F;
            }
            1 => {
                self.sweep_enabled = val & 0x80 != 0;
                self.sweep_period = (val >> 4) & 0x07;
                self.sweep_negate = val & 0x08 != 0;
                self.sweep_shift = val & 0x07;
                self.sweep_reload = true;
            }
            2 => self.period = (self.period & 0x0700) | val as u16,
            _ => {
                self.period = (self.period & 0x00FF) | ((val as u16 & 0x07) << 8);
                if self.enabled {
                    self.length = LENGTH_TABLE[(val >> 3) as usize];
                }
                self.phase = 0; // 듀티 시퀀스가 처음으로 돌아간다
                self.envelope.start = true;
            }
        }
    }

    /// APU 사이클마다: 타이머가 0에 닿으면 듀티 시퀀스를 한 칸 전진
    fn tick_timer(&mut self) {
        if self.timer == 0 {
            self.timer = self.period;
            self.phase = (self.phase + 1) & 7;
        } else {
            self.timer -= 1;
        }
    }

    /// 스윕이 다음에 만들 주기
    fn sweep_target(&self) -> u16 {
        let change = self.period >> self.sweep_shift;
        if self.sweep_negate {
            // 펄스 1은 change+1을 뺀다 (1의 보수 덧셈)
            self.period.saturating_sub(change + if self.complement { 1 } else { 0 })
        } else {
            self.period + change
        }
    }

    /// 주기가 너무 짧거나 스윕 목표가 11비트를 넘으면 강제 무음
    fn muted(&self) -> bool {
        self.period < 8 || self.sweep_target() > 0x07FF
    }

    /// half frame마다: 스윕과 길이 카운터
    fn clock_half(&mut self) {
        if self.sweep_divider == 0 && self.sweep_enabled && self.sweep_shift > 0 && !self.muted() {
            self.period = self.sweep_target();
        }
        if self.sweep_divider == 0 || self.sweep_reload {
            self.sweep_divider = self.sweep_period;
            self.sweep_reload = false;
        } else {
            self.sweep_divider -= 1;
        }
        if !self.halt && self.length > 0 {
            self.length -= 1;
        }
    }

    fn output(&self) -> u8 {
        if self.length == 0 || self.muted() || DUTY_TABLE[self.duty as usize][self.phase as usize] == 0 {
            0
        } else {
            self.envelope.volume()
        }
    }
}

/// 삼각파 채널. 타이머가 CPU 사이클로 돌아 펄스보다 한 옥타브 낮다.
struct Triangle {
    enabled: bool,
    control: bool, // 길이 카운터 정지 + 선형 카운터 컨트롤
    linear: u8,
    linear_reload_val: u8,
    linear_reload: bool,
    period: u16,
    timer: u16,
    step: u8,
    length: u8,
}

impl Triangle {
    fn new() -> Triangle {
        Triangle {
            enabled: false,
            control: false,
            linear: 0,
            linear_reload_val: 0,
            linear_reload: false,
            period: 0,
            timer: 0,
            step: 0,
            length: 0,
        }
    }

    fn write_reg(&mut self, reg: u16, val: u8) {
        match reg {
            0 => {
                self.control = val & 0x80 != 0;
                self.linear_reload_val = val & 0x7F;
            }
            2 => self.period = (self.period & 0x0700) | val as u16,
            3 => {
                self.period = (self.period & 0x00FF) | ((val as u16 & 0x07) << 8);
                if self.enabled {
                    self.length = LENGTH_TABLE[(val >> 3) as usize];
                }
                self.linear_reload = true;
            }
            _ => {}
        }
    }

    /// CPU 사이클마다. 두 카운터가 모두 살아 있어야 시퀀서가 전진한다.
    /// 주기가 너무 짧으면(초음파) 전진을 멈춰 마지막 값을 유지한다.
    fn tick_timer(&mut self) {
        if self.timer == 0 {
            self.timer = self.period;
            if self.length > 0 && self.linear > 0 && self.period >= 2 {
                self.step = (self.step + 1) & 31;
            }
        } else {
            self.timer -= 1;
        }
    }

    /// quarter frame마다: 선형 카운터
    fn clock_quarter(&mut self) {
        if self.linear_reload {
            self.linear = self.linear_reload_val;
        } else if self.linear > 0 {
            self.linear -= 1;
        }
        if !self.control {
            self.linear_reload = false;
        }
    }

    fn clock_half(&mut self) {
        if !self.control && self.length > 0 {
            self.length -= 1;
        }
    }

    fn output(&self) -> u8 {
        TRIANGLE_SEQ[self.step as usize]
    }
}

/// 노이즈 채널. 15비트 LFSR이 의사 난수 비트를 만든다.
struct Noise {
    enabled: bool,
    halt: bool,
    envelope: Envelope,
    mode: bool, // true면 비트6 피드백(주기적 잡음), false면 비트1(백색 잡음)
    period: u16,
    timer: u16,
    lfsr: u16,
    length: u8,
}

impl Noise {
    fn new() -> Noise {
        Noise {
            enabled: false,
            halt: false,
            envelope: Envelope::new(),
            mode: false,
            period: NOISE_PERIODS[0],
            timer: 0,
            lfsr: 1, // 0이면 영원히 0이라 1로 시작
            length: 0,
        }
    }

    fn write_reg(&mut self, reg: u16, val: u8) {
        match reg {
            0 => {
                self.halt = val & 0x20 != 0;
                self.envelope.loop_flag = self.halt;
                self.envelope.constant = val & 0x10 != 0;
                self.envelope.period = val & 0x0F;
            }
            2 => {
                self.mode = val & 0x80 != 0;
                self.period = NOISE_PERIODS[(val & 0x0F) as usize];
            }
            3 => {
                if self.enabled {
                    self.length = LENGTH_TABLE[(val >> 3) as usize];
                }
                self.envelope.start = true;
            }
            _ => {}
        }
    }

    /// APU 사이클마다. 테이블 값이 전체 주기라서 리로드에서 1을 뺀다.
    fn tick_timer(&mut self) {
        if self.timer == 0 {
            self.timer = self.period - 1;
            let tap = if self.mode { self.lfsr >> 6 } else { self.lfsr >> 1 };
            let feedback = (self.lfsr ^ tap) & 1;
            self.lfsr = (self.lfsr >> 1) | (feedback << 14);
        } else {
            self.timer -= 1;
        }
    }

    fn clock_half(&mut self) {
        if !self.halt && self.length > 0 {
            self.length -= 1;
        }
    }

    fn output(&self) -> u8 {
        if self.length == 0 || self.lfsr & 1 != 0 {
            0
        } else {
            self.envelope.volume()
        }
    }
}

/// DMC 채널. PRG 롬에서 1비트 델타 샘플을 읽어 7비트 카운터를 오르내린다.
struct Dmc {
    irq_enable: bool,
    irq_flag: bool, // CPU 인터럽트는 걸지 않고 $4015 상태 비트로만 보인다
    loop_flag: bool,
    period: u16,
    timer: u16,
    output: u8, // 7비트 출력 카운터
    sample_addr: u16,
    sample_len: u16,
    cur_addr: u16,
    bytes_left: u16,
    buffer: Option<u8>, // 롬에서 읽어 둔 다음 바이트
    shift: u8,
    bits_left: u8,
    silence: bool,
}

impl Dmc {
    fn new() -> Dmc {
        Dmc {
            irq_enable: false,
            irq_flag: false,
            loop_flag: false,
            period: DMC_PERIODS[0],
            timer: 0,
            output: 0,
            sample_addr: 0xC000,
            sample_len: 1,
            cur_addr: 0xC000,
            bytes_left: 0,
            buffer: None,
            shift: 0,
            bits_left: 8,
            silence: true,
        }
    }

    fn write_reg(&mut self, reg: u16, val: u8) {
        match reg {
            0 => {
                self.irq_enable = val & 0x80 != 0;
                if !self.irq_enable {
                    self.irq_flag = false;
                }
                self.loop_flag = val & 0x40 != 0;
                self.period = DMC_PERIODS[(val & 0x0F) as usize];
            }
            1 => self.output = val & 0x7F,
            2 => self.sample_addr = 0xC000 + (val as u16) * 64,
            _ => self.sample_len = (val as u16) * 16 + 1,
        }
    }

    /// 샘플을 처음부터 다시 재생하도록 준비
    fn restart(&mut self) {
        self.cur_addr = self.sample_addr;
        self.bytes_left = self.sample_len;
    }

    /// 버퍼가 비었고 남은 바이트가 있으면 롬에서 한 바이트 채운다
    fn fill_buffer(&mut self, cart: &Cartridge) {
        if self.buffer.is_some() || self.bytes_left == 0 {
            return;
        }
        self.buffer = Some(cart.read_prg(self.cur_addr));
        // $FFFF 다음은 $8000으로 감아 돈다
        self.cur_addr = if self.cur_addr == 0xFFFF { 0x8000 } else { self.cur_addr + 1 };
        self.bytes_left -= 1;
        if self.bytes_left == 0 {
            if self.loop_flag {
                self.restart();
            } else if self.irq_enable {
                self.irq_flag = true;
            }
        }
    }

    /// APU 사이클마다
    fn tick_timer(&mut self, cart: &Cartridge) {
        self.fill_buffer(cart);
        if self.timer > 0 {
            self.timer -= 1;
            return;
        }
        self.timer = self.period - 1;

        // 출력 유닛: 비트 하나로 카운터를 ±2
        if !self.silence {
            if self.shift & 1 != 0 {
                if self.output <= 125 {
                    self.output += 2;
                }
            } else if self.output >= 2 {
                self.output -= 2;
            }
        }
        self.shift >>= 1;
        self.bits_left -= 1;
        if self.bits_left == 0 {
            self.bits_left = 8;
            match self.buffer.take() {
                Some(byte) => {
                    self.shift = byte;
                    self.silence = false;
                }
                None => self.silence = true,
            }
        }
    }
}

/// NTSC 2A03 APU.
///
/// 믹서 출력은 nesdev 비선형 근사식을 그대로 쓴 0.0~1.0 범위의 f32다
/// (무음이 0.0). 프런트엔드에서 DC를 제거하거나 중심을 옮겨 쓰면 된다.
pub struct Apu {
    pulse1: Pulse,
    pulse2: Pulse,
    triangle: Triangle,
    noise: Noise,
    dmc: Dmc,
    /// 프레임 카운터: $4017 이후 지난 CPU 사이클 수
    frame_cycle: u32,
    /// true면 5스텝 모드
    frame_mode5: bool,
    /// 홀수 CPU 사이클마다 APU 사이클이 한 번 돈다
    odd_cycle: bool,
    /// 다운샘플용 분수 누적기
    sample_acc: f64,
    /// 사이클 평균용: 이번 샘플 구간의 믹서 출력 합과 사이클 수
    mix_sum: f64,
    mix_count: u32,
    /// 44.1kHz로 뽑은 출력. 프런트엔드가 take_samples로 비워 간다.
    pub samples: Vec<f32>,
}

impl Default for Apu {
    fn default() -> Apu {
        Apu::new()
    }
}

impl Apu {
    pub fn new() -> Apu {
        Apu {
            pulse1: Pulse::new(true),
            pulse2: Pulse::new(false),
            triangle: Triangle::new(),
            noise: Noise::new(),
            dmc: Dmc::new(),
            frame_cycle: 0,
            frame_mode5: false,
            odd_cycle: false,
            sample_acc: 0.0,
            mix_sum: 0.0,
            mix_count: 0,
            samples: Vec::new(),
        }
    }

    /// $4000~$4013, $4015, $4017 쓰기
    pub fn write_reg(&mut self, addr: u16, val: u8) {
        match addr {
            0x4000..=0x4003 => self.pulse1.write_reg(addr & 3, val),
            0x4004..=0x4007 => self.pulse2.write_reg(addr & 3, val),
            0x4008..=0x400B => self.triangle.write_reg(addr & 3, val),
            0x400C..=0x400F => self.noise.write_reg(addr & 3, val),
            0x4010..=0x4013 => self.dmc.write_reg(addr & 3, val),
            0x4015 => {
                // 채널 enable. 끄면 길이 카운터가 즉시 0이 된다.
                self.pulse1.enabled = val & 0x01 != 0;
                self.pulse2.enabled = val & 0x02 != 0;
                self.triangle.enabled = val & 0x04 != 0;
                self.noise.enabled = val & 0x08 != 0;
                if !self.pulse1.enabled {
                    self.pulse1.length = 0;
                }
                if !self.pulse2.enabled {
                    self.pulse2.length = 0;
                }
                if !self.triangle.enabled {
                    self.triangle.length = 0;
                }
                if !self.noise.enabled {
                    self.noise.length = 0;
                }
                if val & 0x10 != 0 {
                    // DMC는 켰을 때 남은 게 없으면 처음부터 다시 시작
                    if self.dmc.bytes_left == 0 {
                        self.dmc.restart();
                    }
                } else {
                    self.dmc.bytes_left = 0;
                }
                self.dmc.irq_flag = false; // $4015 쓰기는 DMC IRQ 플래그를 지운다
            }
            0x4017 => {
                self.frame_mode5 = val & 0x80 != 0;
                self.frame_cycle = 0;
                // 5스텝 모드로 바꾸면 즉시 한 번 클럭된다
                if self.frame_mode5 {
                    self.clock_quarter();
                    self.clock_half();
                }
            }
            _ => {}
        }
    }

    /// $4015 읽기: 각 채널 길이 카운터가 살아 있는지
    pub fn read_status(&mut self) -> u8 {
        let mut st = 0;
        if self.pulse1.length > 0 {
            st |= 0x01;
        }
        if self.pulse2.length > 0 {
            st |= 0x02;
        }
        if self.triangle.length > 0 {
            st |= 0x04;
        }
        if self.noise.length > 0 {
            st |= 0x08;
        }
        if self.dmc.bytes_left > 0 {
            st |= 0x10;
        }
        if self.dmc.irq_flag {
            st |= 0x80;
        }
        st
    }

    /// 엔벨로프·선형 카운터 클럭 (quarter frame)
    fn clock_quarter(&mut self) {
        self.pulse1.envelope.clock();
        self.pulse2.envelope.clock();
        self.triangle.clock_quarter();
        self.noise.envelope.clock();
    }

    /// 길이 카운터·스윕 클럭 (half frame)
    fn clock_half(&mut self) {
        self.pulse1.clock_half();
        self.pulse2.clock_half();
        self.triangle.clock_half();
        self.noise.clock_half();
    }

    /// 프레임 카운터. nesdev의 3728.5 APU 사이클 등을 CPU 사이클 정수로 근사.
    fn tick_frame_counter(&mut self) {
        self.frame_cycle += 1;
        match self.frame_cycle {
            7457 => self.clock_quarter(),
            14913 => {
                self.clock_quarter();
                self.clock_half();
            }
            22371 => self.clock_quarter(),
            29829 => {
                if !self.frame_mode5 {
                    self.clock_quarter();
                    self.clock_half();
                    self.frame_cycle = 0;
                }
            }
            37281 => {
                self.clock_quarter();
                self.clock_half();
                self.frame_cycle = 0;
            }
            _ => {}
        }
    }

    /// nesdev 표준 비선형 믹서. 반환값은 0.0~1.0 (무음 0.0).
    fn mix(&self) -> f32 {
        let p = (self.pulse1.output() + self.pulse2.output()) as f64;
        let pulse_out = if p == 0.0 { 0.0 } else { 95.88 / (8128.0 / p + 100.0) };

        let tnd = self.triangle.output() as f64 / 8227.0
            + self.noise.output() as f64 / 12241.0
            + self.dmc.output as f64 / 22638.0;
        let tnd_out = if tnd == 0.0 { 0.0 } else { 159.79 / (1.0 / tnd + 100.0) };

        (pulse_out + tnd_out) as f32
    }

    /// CPU 1사이클마다 1번. DMC가 PRG 롬을 읽어야 해서 카트리지를 받는다.
    pub fn tick(&mut self, cart: &Cartridge) {
        self.tick_frame_counter();

        // 삼각파는 CPU 사이클, 나머지 타이머는 APU 사이클(CPU/2)로 돈다
        self.triangle.tick_timer();
        self.odd_cycle = !self.odd_cycle;
        if self.odd_cycle {
            self.pulse1.tick_timer();
            self.pulse2.tick_timer();
            self.noise.tick_timer();
            self.dmc.tick_timer(cart);
        }

        // 약 40.58사이클마다 한 샘플. 그 순간의 값 하나만 찍으면(포인트 샘플링)
        // 구형파의 높은 배음이 접혀 들어와 잡음이 되므로, 구간 평균을 쓴다.
        self.mix_sum += self.mix() as f64;
        self.mix_count += 1;
        self.sample_acc += 1.0;
        if self.sample_acc >= CYCLES_PER_SAMPLE {
            self.sample_acc -= CYCLES_PER_SAMPLE;
            self.samples.push((self.mix_sum / self.mix_count as f64) as f32);
            self.mix_sum = 0.0;
            self.mix_count = 0;
        }
    }

    /// 쌓인 샘플을 비우면서 가져간다
    pub fn take_samples(&mut self) -> Vec<f32> {
        std::mem::take(&mut self.samples)
    }
}
