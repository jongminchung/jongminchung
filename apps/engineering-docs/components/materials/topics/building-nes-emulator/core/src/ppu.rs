use crate::cartridge::{Cartridge, Mirroring};

// PPUCTRL($2000) 비트
const CTRL_NMI: u8 = 0x80; // VBlank에서 NMI 발생
const CTRL_SPRITE_16: u8 = 0x20; // 8x16 스프라이트 모드
const CTRL_BG_TABLE: u8 = 0x10; // 배경 패턴 테이블 선택
const CTRL_SPRITE_TABLE: u8 = 0x08; // 스프라이트 패턴 테이블 선택 (8x8 전용)
const CTRL_INCREMENT: u8 = 0x04; // $2007 접근 시 주소 증가폭 (0: +1, 1: +32)

// PPUMASK($2001) 비트
const MASK_SPRITES: u8 = 0x10; // 스프라이트 표시
const MASK_BG: u8 = 0x08; // 배경 표시
const MASK_SPRITES_LEFT: u8 = 0x04; // 왼쪽 8픽셀에 스프라이트 표시
const MASK_BG_LEFT: u8 = 0x02; // 왼쪽 8픽셀에 배경 표시

// PPUSTATUS($2002) 비트
const STATUS_VBLANK: u8 = 0x80;
const STATUS_SPRITE0: u8 = 0x40;
const STATUS_OVERFLOW: u8 = 0x20;

/// 2C02의 64색을 RGB로 옮긴 표준 NTSC 팔레트
pub const NTSC_PALETTE: [[u8; 3]; 64] = [
    [0x66, 0x66, 0x66], [0x00, 0x2A, 0x88], [0x14, 0x12, 0xA7], [0x3B, 0x00, 0xA4],
    [0x5C, 0x00, 0x7E], [0x6E, 0x00, 0x40], [0x6C, 0x06, 0x00], [0x56, 0x1D, 0x00],
    [0x33, 0x35, 0x00], [0x0B, 0x48, 0x00], [0x00, 0x52, 0x00], [0x00, 0x4F, 0x08],
    [0x00, 0x40, 0x4D], [0x00, 0x00, 0x00], [0x00, 0x00, 0x00], [0x00, 0x00, 0x00],
    [0xAD, 0xAD, 0xAD], [0x15, 0x5F, 0xD9], [0x42, 0x40, 0xFF], [0x75, 0x27, 0xFE],
    [0xA0, 0x1A, 0xCC], [0xB7, 0x1E, 0x7B], [0xB5, 0x31, 0x20], [0x99, 0x4E, 0x00],
    [0x6B, 0x6D, 0x00], [0x38, 0x87, 0x00], [0x0C, 0x93, 0x00], [0x00, 0x8F, 0x32],
    [0x00, 0x7C, 0x8D], [0x00, 0x00, 0x00], [0x00, 0x00, 0x00], [0x00, 0x00, 0x00],
    [0xFF, 0xFE, 0xFF], [0x64, 0xB0, 0xFF], [0x92, 0x90, 0xFF], [0xC6, 0x76, 0xFF],
    [0xF3, 0x6A, 0xFF], [0xFE, 0x6E, 0xCC], [0xFE, 0x81, 0x70], [0xEA, 0x9E, 0x22],
    [0xBC, 0xBE, 0x00], [0x88, 0xD8, 0x00], [0x5C, 0xE4, 0x30], [0x45, 0xE0, 0x82],
    [0x48, 0xCD, 0xDE], [0x4F, 0x4F, 0x4F], [0x00, 0x00, 0x00], [0x00, 0x00, 0x00],
    [0xFF, 0xFE, 0xFF], [0xC0, 0xDF, 0xFF], [0xD3, 0xD2, 0xFF], [0xE8, 0xC8, 0xFF],
    [0xFB, 0xC2, 0xFF], [0xFE, 0xC4, 0xEA], [0xFE, 0xCC, 0xC5], [0xF7, 0xD8, 0xA5],
    [0xE4, 0xE5, 0x94], [0xCF, 0xEF, 0x96], [0xBD, 0xF4, 0xAB], [0xB3, 0xF3, 0xCC],
    [0xB5, 0xEB, 0xF2], [0xB8, 0xB8, 0xB8], [0x00, 0x00, 0x00], [0x00, 0x00, 0x00],
];

pub struct Ppu {
    pub vram: [u8; 2048],       // 네임테이블 2장
    pub palette_ram: [u8; 32],  // 팔레트
    pub oam: [u8; 256],         // 스프라이트 64개 x 4바이트
    // loopy 레지스터: v는 현재 VRAM 주소, t는 스크롤 값을 조립해 두는 임시 주소
    v: u16,
    t: u16,
    x: u8,   // fine x (타일 내 가로 오프셋 0~7)
    w: bool, // $2005/$2006 쓰기 토글 (두 번에 나눠 쓰므로)
    ctrl: u8,
    mask: u8,
    status: u8,
    oam_addr: u8,
    read_buffer: u8, // $2007 읽기는 한 박자 늦게 나온다
    pub scanline: u16, // 0~261
    pub dot: u16,      // 0~340
    pub frame: [u8; 256 * 240 * 4], // RGBA 프레임버퍼
    pub frame_count: u64,
    nmi_pending: bool,
}

impl Default for Ppu {
    fn default() -> Self {
        Self::new()
    }
}

impl Ppu {
    pub fn new() -> Self {
        Ppu {
            vram: [0; 2048],
            palette_ram: [0; 32],
            oam: [0; 256],
            v: 0,
            t: 0,
            x: 0,
            w: false,
            ctrl: 0,
            mask: 0,
            status: 0,
            oam_addr: 0,
            read_buffer: 0,
            scanline: 0,
            dot: 0,
            frame: [0; 256 * 240 * 4],
            frame_count: 0,
            nmi_pending: false,
        }
    }

    // --- CPU 쪽 인터페이스 ($2000~$2007) ---

    pub fn read_reg(&mut self, cart: &mut Cartridge, reg: u16) -> u8 {
        match reg & 7 {
            2 => {
                // PPUSTATUS: 읽는 순간 VBlank 플래그와 쓰기 토글이 리셋된다
                let result = self.status;
                self.status &= !STATUS_VBLANK;
                self.w = false;
                result
            }
            4 => self.oam[self.oam_addr as usize],
            7 => {
                // PPUDATA: 일반 VRAM은 버퍼를 거쳐 한 박자 늦게, 팔레트는 즉시
                let addr = self.v & 0x3FFF;
                let result = if addr >= 0x3F00 {
                    // 팔레트를 읽어도 버퍼에는 그 "밑에 깔린" 네임테이블 값이 남는다
                    self.read_buffer = self.mem_read(cart, addr - 0x1000);
                    self.palette_ram[Self::palette_index(addr)]
                } else {
                    let buffered = self.read_buffer;
                    self.read_buffer = self.mem_read(cart, addr);
                    buffered
                };
                self.increment_v();
                result
            }
            _ => 0,
        }
    }

    pub fn write_reg(&mut self, cart: &mut Cartridge, reg: u16, val: u8) {
        match reg & 7 {
            0 => {
                let nmi_was_on = self.ctrl & CTRL_NMI != 0;
                self.ctrl = val;
                // 네임테이블 선택 2비트는 t에도 들어간다
                self.t = (self.t & !0x0C00) | (((val & 0x03) as u16) << 10);
                // VBlank 도중에 NMI를 켜면 그 즉시 NMI가 발생한다
                if !nmi_was_on && val & CTRL_NMI != 0 && self.status & STATUS_VBLANK != 0 {
                    self.nmi_pending = true;
                }
            }
            1 => self.mask = val,
            3 => self.oam_addr = val,
            4 => {
                self.oam[self.oam_addr as usize] = val;
                self.oam_addr = self.oam_addr.wrapping_add(1);
            }
            5 => {
                // PPUSCROLL: 첫 쓰기는 X, 둘째 쓰기는 Y
                if !self.w {
                    self.t = (self.t & !0x001F) | (val >> 3) as u16; // coarse X
                    self.x = val & 0x07; // fine X
                } else {
                    self.t = (self.t & !0x73E0)
                        | (((val & 0x07) as u16) << 12)  // fine Y
                        | (((val >> 3) as u16) << 5); // coarse Y
                }
                self.w = !self.w;
            }
            6 => {
                // PPUADDR: 상위 바이트 → 하위 바이트, 완성되면 v로 복사
                if !self.w {
                    self.t = (self.t & 0x00FF) | (((val & 0x3F) as u16) << 8);
                } else {
                    self.t = (self.t & 0xFF00) | val as u16;
                    self.v = self.t;
                }
                self.w = !self.w;
            }
            7 => {
                self.mem_write(cart, self.v & 0x3FFF, val);
                self.increment_v();
            }
            _ => {}
        }
    }

    /// NMI 요청을 소비한다. 콘솔이 CPU에 전달한 뒤 지운다.
    pub fn nmi_take(&mut self) -> bool {
        let pending = self.nmi_pending;
        self.nmi_pending = false;
        pending
    }

    // --- 타이밍 ---

    /// PPU 도트 1개 진행. CPU 1사이클마다 3번 불린다.
    pub fn tick(&mut self, cart: &mut Cartridge) {
        // 가시 스캔라인은 시작 도트에서 한 줄을 통째로 그린다.
        // 이 시점의 v에는 이전 라인 끝(도트 256/257)에서 갱신된 스크롤이 들어 있다.
        if self.scanline < 240 && self.dot == 1 {
            self.render_scanline(cart);
        }

        if self.rendering_enabled() && (self.scanline < 240 || self.scanline == 261) {
            if self.dot == 256 {
                self.increment_y(); // 다음 라인으로 수직 이동
            }
            if self.dot == 257 {
                // v의 수평 성분을 t에서 복원
                self.v = (self.v & !0x041F) | (self.t & 0x041F);
            }
            if self.scanline == 261 && (280..=304).contains(&self.dot) {
                // 프리렌더 라인에서 수직 성분 복원
                self.v = (self.v & !0x7BE0) | (self.t & 0x7BE0);
            }
        }

        if self.scanline == 241 && self.dot == 1 {
            self.status |= STATUS_VBLANK;
            if self.ctrl & CTRL_NMI != 0 {
                self.nmi_pending = true;
            }
        }
        if self.scanline == 261 && self.dot == 1 {
            self.status &= !(STATUS_VBLANK | STATUS_SPRITE0 | STATUS_OVERFLOW);
        }

        self.dot += 1;
        if self.dot == 341 {
            self.dot = 0;
            self.scanline += 1;
            if self.scanline == 262 {
                self.scanline = 0;
                self.frame_count += 1;
            }
        }
    }

    fn rendering_enabled(&self) -> bool {
        self.mask & (MASK_BG | MASK_SPRITES) != 0
    }

    fn increment_v(&mut self) {
        let step = if self.ctrl & CTRL_INCREMENT != 0 { 32 } else { 1 };
        self.v = self.v.wrapping_add(step) & 0x7FFF;
    }

    /// loopy 수직 증가: fine Y가 넘치면 coarse Y로, 29를 넘으면 아래 네임테이블로
    fn increment_y(&mut self) {
        let mut v = self.v;
        if v & 0x7000 != 0x7000 {
            v += 0x1000; // fine Y += 1
        } else {
            v &= !0x7000;
            let mut coarse_y = (v >> 5) & 0x1F;
            if coarse_y == 29 {
                coarse_y = 0;
                v ^= 0x0800; // 수직 네임테이블 전환
            } else if coarse_y == 31 {
                coarse_y = 0; // 어트리뷰트 영역이면 전환 없이 랩
            } else {
                coarse_y += 1;
            }
            v = (v & !0x03E0) | (coarse_y << 5);
        }
        self.v = v;
    }

    /// loopy 수평 증가: coarse X가 31을 넘으면 옆 네임테이블로
    fn coarse_x_increment(v: u16) -> u16 {
        if v & 0x001F == 31 {
            (v & !0x001F) ^ 0x0400
        } else {
            v + 1
        }
    }

    // --- PPU 메모리 공간 ($0000~$3FFF) ---

    fn mem_read(&self, cart: &Cartridge, addr: u16) -> u8 {
        let addr = addr & 0x3FFF;
        match addr {
            0x0000..=0x1FFF => cart.read_chr(addr),
            0x2000..=0x3EFF => self.vram[Self::nt_index(&cart.mirroring, addr)],
            _ => self.palette_ram[Self::palette_index(addr)],
        }
    }

    fn mem_write(&mut self, cart: &mut Cartridge, addr: u16, val: u8) {
        let addr = addr & 0x3FFF;
        match addr {
            0x0000..=0x1FFF => cart.write_chr(addr, val),
            0x2000..=0x3EFF => self.vram[Self::nt_index(&cart.mirroring, addr)] = val,
            _ => self.palette_ram[Self::palette_index(addr)] = val,
        }
    }

    /// 네임테이블 주소를 2KB 실제 VRAM 인덱스로 접는다
    fn nt_index(mirroring: &Mirroring, addr: u16) -> usize {
        let idx = (addr as usize - 0x2000) & 0x0FFF; // 논리 공간 4KB
        match mirroring {
            Mirroring::Vertical => idx & 0x07FF,                      // 좌우 두 장
            Mirroring::Horizontal => (idx & 0x03FF) | ((idx & 0x0800) >> 1), // 상하 두 장
        }
    }

    /// 팔레트 인덱스. $3F10/$14/$18/$1C는 $3F00/$04/$08/$0C의 미러다.
    fn palette_index(addr: u16) -> usize {
        let mut idx = (addr & 0x1F) as usize;
        if idx >= 16 && idx % 4 == 0 {
            idx -= 16;
        }
        idx
    }

    fn palette_color(&self, palette_idx: u8) -> [u8; 3] {
        NTSC_PALETTE[(self.palette_ram[Self::palette_index(palette_idx as u16)] & 0x3F) as usize]
    }

    // --- 렌더링 (스캔라인 단위) ---

    fn render_scanline(&mut self, cart: &Cartridge) {
        let sl = self.scanline as usize;
        let mut line = [self.palette_color(0); 256]; // 배경색으로 초기화
        let mut bg_opaque = [false; 256]; // 스프라이트 우선순위 판정용

        // 1. 배경
        if self.mask & MASK_BG != 0 {
            let fine_x = self.x as usize;
            let fine_y = (self.v >> 12) & 0x07;
            let bg_table: u16 = if self.ctrl & CTRL_BG_TABLE != 0 { 0x1000 } else { 0x0000 };

            // fine x 스크롤 때문에 화면 폭보다 타일 하나를 더 가져온다 (33개)
            let mut pixels = [0u8; 33 * 8]; // 팔레트 램 인덱스 (0이면 투명)
            let mut v = self.v;
            for tile in 0..33 {
                let tile_id = self.mem_read(cart, 0x2000 | (v & 0x0FFF)) as u16;
                // 어트리뷰트 바이트: 4x4 타일 블록마다 1바이트
                let attr_addr = 0x23C0 | (v & 0x0C00) | ((v >> 4) & 0x38) | ((v >> 2) & 0x07);
                let attr = self.mem_read(cart, attr_addr);
                // 블록 내 위치(2x2 타일 단위)에 따라 2비트를 골라낸다
                let shift = ((v >> 4) & 0x04) | (v & 0x02);
                let palette_hi = ((attr >> shift) & 0x03) << 2;

                let pattern_addr = bg_table + tile_id * 16 + fine_y;
                let lo = self.mem_read(cart, pattern_addr);
                let hi = self.mem_read(cart, pattern_addr + 8);
                for (bit, px) in pixels[tile * 8..tile * 8 + 8].iter_mut().enumerate() {
                    let color = ((hi >> (7 - bit)) & 1) << 1 | ((lo >> (7 - bit)) & 1);
                    *px = if color == 0 { 0 } else { palette_hi | color };
                }
                v = Self::coarse_x_increment(v);
            }

            for (sx, out) in line.iter_mut().enumerate() {
                if sx < 8 && self.mask & MASK_BG_LEFT == 0 {
                    continue; // 왼쪽 8픽셀 클리핑
                }
                let px = pixels[sx + fine_x];
                if px != 0 {
                    bg_opaque[sx] = true;
                    *out = self.palette_color(px);
                }
            }
        }

        // 2. 스프라이트
        if self.mask & MASK_SPRITES != 0 {
            let height: isize = if self.ctrl & CTRL_SPRITE_16 != 0 { 16 } else { 8 };
            let mut count = 0;
            let mut sprite_drawn = [false; 256]; // 낮은 OAM 번호가 이긴다

            for i in 0..64 {
                // OAM의 Y는 실제 표시 위치보다 1 작다
                let row = sl as isize - (self.oam[i * 4] as isize + 1);
                if row < 0 || row >= height {
                    continue;
                }
                count += 1;
                if count > 8 {
                    self.status |= STATUS_OVERFLOW; // 하드웨어 제한: 라인당 8개
                    break;
                }

                let tile = self.oam[i * 4 + 1] as u16;
                let attr = self.oam[i * 4 + 2];
                let sprite_x = self.oam[i * 4 + 3] as usize;
                let mut row = row as u16;
                if attr & 0x80 != 0 {
                    row = height as u16 - 1 - row; // 수직 플립
                }

                let pattern_addr = if height == 16 {
                    // 8x16: 타일 번호의 최하위 비트가 패턴 테이블을 고른다
                    let bank = (tile & 0x01) * 0x1000;
                    let tile_id = (tile & 0xFE) + if row >= 8 { 1 } else { 0 };
                    bank + tile_id * 16 + (row & 0x07)
                } else {
                    let bank: u16 = if self.ctrl & CTRL_SPRITE_TABLE != 0 { 0x1000 } else { 0x0000 };
                    bank + tile * 16 + row
                };
                let lo = self.mem_read(cart, pattern_addr);
                let hi = self.mem_read(cart, pattern_addr + 8);
                let palette_hi = 0x10 | ((attr & 0x03) << 2);
                let behind_bg = attr & 0x20 != 0;

                for bit in 0..8usize {
                    let shift = if attr & 0x40 != 0 { bit } else { 7 - bit }; // 수평 플립
                    let color = ((hi >> shift) & 1) << 1 | ((lo >> shift) & 1);
                    if color == 0 {
                        continue; // 투명 픽셀
                    }
                    let sx = sprite_x + bit;
                    if sx >= 256 || (sx < 8 && self.mask & MASK_SPRITES_LEFT == 0) {
                        continue;
                    }
                    // 스프라이트 0의 불투명 픽셀이 불투명 배경과 겹치면 히트
                    if i == 0 && bg_opaque[sx] && sx != 255 {
                        self.status |= STATUS_SPRITE0;
                    }
                    if sprite_drawn[sx] {
                        continue;
                    }
                    sprite_drawn[sx] = true;
                    if behind_bg && bg_opaque[sx] {
                        continue; // 배경 뒤 우선순위
                    }
                    line[sx] = self.palette_color(palette_hi | color);
                }
            }
        }

        // 3. 프레임버퍼에 RGBA로 기록
        let base = sl * 256 * 4;
        for (sx, rgb) in line.iter().enumerate() {
            let offset = base + sx * 4;
            self.frame[offset..offset + 3].copy_from_slice(rgb);
            self.frame[offset + 3] = 0xFF;
        }
    }
}
