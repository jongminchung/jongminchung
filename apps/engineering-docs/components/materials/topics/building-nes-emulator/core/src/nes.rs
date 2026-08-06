use crate::apu::Apu;
use crate::bus::Bus;
use crate::cartridge::Cartridge;
use crate::cpu::Cpu;
use crate::joypad::Joypad;
use crate::ppu::Ppu;

/// NES 본체의 메모리 맵을 구현하는 버스
pub struct NesBus {
    pub ram: [u8; 2048],
    pub ppu: Ppu,
    pub apu: Apu,
    pub cart: Cartridge,
    pub joypad1: Joypad,
    /// OAM DMA로 CPU가 멈춰야 하는 사이클 수
    pub dma_stall: u32,
}

impl Bus for NesBus {
    fn read(&mut self, addr: u16) -> u8 {
        match addr {
            // 2KB 램이 $0000~$1FFF에 네 번 미러된다
            0x0000..=0x1FFF => self.ram[addr as usize & 0x07FF],
            // PPU 레지스터 8개가 $2000~$3FFF에 반복된다
            0x2000..=0x3FFF => self.ppu.read_reg(&mut self.cart, addr & 0x07),
            0x4015 => self.apu.read_status(),
            0x4016 => self.joypad1.read(),
            // 나머지 IO는 스텁
            0x4000..=0x7FFF => 0,
            0x8000..=0xFFFF => self.cart.read_prg(addr),
        }
    }

    fn write(&mut self, addr: u16, val: u8) {
        match addr {
            0x0000..=0x1FFF => self.ram[addr as usize & 0x07FF] = val,
            0x2000..=0x3FFF => self.ppu.write_reg(&mut self.cart, addr & 0x07, val),
            0x4014 => {
                // OAM DMA: CPU 램 한 페이지(256바이트)를 통째로 OAM에 복사
                let base = (val as u16) << 8;
                for i in 0..256u16 {
                    let byte = self.read(base + i);
                    self.ppu.write_reg(&mut self.cart, 4, byte); // OAMDATA 경유
                }
                self.dma_stall += 513; // 그동안 CPU는 멈춘다
            }
            0x4016 => self.joypad1.write(val),
            0x4000..=0x4013 | 0x4015 | 0x4017 => self.apu.write_reg(addr, val),
            0x4018..=0x7FFF => {} // 나머지 IO는 무시
            0x8000..=0xFFFF => {} // 롬에는 쓸 수 없다
        }
    }
}

/// CPU + PPU + 카트리지 + 컨트롤러를 하나로 조립한 콘솔
pub struct Nes {
    pub cpu: Cpu,
    pub bus: NesBus,
}

impl Nes {
    pub fn new(rom: &[u8]) -> Result<Nes, String> {
        let cart = Cartridge::from_ines(rom)?;
        let mut nes = Nes {
            cpu: Cpu::new(),
            bus: NesBus {
                ram: [0; 2048],
                ppu: Ppu::new(),
                apu: Apu::new(),
                cart,
                joypad1: Joypad::new(),
                dma_stall: 0,
            },
        };
        nes.cpu.reset(&mut nes.bus);
        Ok(nes)
    }

    /// CPU 명령어 하나를 실행하고, 그 사이클 수의 3배만큼 PPU를 돌린다.
    pub fn step(&mut self) -> u32 {
        let mut cycles = 0;
        // PPU가 VBlank에서 올린 NMI를 CPU에 전달
        if self.bus.ppu.nmi_take() {
            self.cpu.nmi(&mut self.bus);
            cycles += 7;
        }
        cycles += self.cpu.step(&mut self.bus);
        // OAM DMA가 있었다면 그만큼 CPU가 멈췄던 셈
        cycles += std::mem::take(&mut self.bus.dma_stall);

        // PPU는 CPU보다 3배 빠르다
        for _ in 0..cycles * 3 {
            self.bus.ppu.tick(&mut self.bus.cart);
        }
        // APU는 CPU와 같은 속도로 돈다 (DMC가 PRG 롬을 읽는다)
        for _ in 0..cycles {
            self.bus.apu.tick(&self.bus.cart);
        }
        cycles
    }

    /// 프레임 하나가 완성될 때까지 실행
    pub fn run_frame(&mut self) {
        let frame = self.bus.ppu.frame_count;
        while self.bus.ppu.frame_count == frame {
            self.step();
        }
    }
}
