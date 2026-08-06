/// 네임테이블 미러링 방식. 카트리지 기판의 배선이 결정한다.
pub enum Mirroring {
    Horizontal,
    Vertical,
}

pub struct Cartridge {
    pub prg: Vec<u8>, // 프로그램 롬
    pub chr: Vec<u8>, // 그래픽 롬 (없으면 8KB CHR-RAM)
    pub mirroring: Mirroring,
    pub mapper: u8,
    pub chr_is_ram: bool,
}

impl Cartridge {
    /// iNES 파일을 파싱한다. 매퍼 0(NROM)만 지원.
    pub fn from_ines(bytes: &[u8]) -> Result<Cartridge, String> {
        if bytes.len() < 16 || &bytes[0..4] != b"NES\x1a" {
            return Err("iNES 헤더가 아니다".to_string());
        }
        let prg_size = bytes[4] as usize * 16 * 1024;
        let chr_size = bytes[5] as usize * 8 * 1024;
        let flags6 = bytes[6];
        let flags7 = bytes[7];

        let mapper = (flags7 & 0xF0) | (flags6 >> 4);
        if mapper != 0 {
            return Err(format!("지원하지 않는 매퍼: {mapper}"));
        }
        let mirroring = if flags6 & 0x01 != 0 { Mirroring::Vertical } else { Mirroring::Horizontal };

        // 트레이너(512바이트)가 있으면 건너뛴다
        let mut offset = 16 + if flags6 & 0x04 != 0 { 512 } else { 0 };
        if bytes.len() < offset + prg_size + chr_size {
            return Err("롬 파일이 헤더가 말한 크기보다 작다".to_string());
        }

        let prg = bytes[offset..offset + prg_size].to_vec();
        offset += prg_size;

        // CHR 뱅크가 0개면 카트리지에 램이 달려 있다는 뜻
        let chr_is_ram = chr_size == 0;
        let chr = if chr_is_ram {
            vec![0; 8 * 1024]
        } else {
            bytes[offset..offset + chr_size].to_vec()
        };

        Ok(Cartridge { prg, chr, mirroring, mapper, chr_is_ram })
    }

    /// CPU 쪽 $8000~$FFFF 읽기. PRG가 16KB뿐이면 두 번 미러된다.
    pub fn read_prg(&self, addr: u16) -> u8 {
        let mut idx = addr as usize - 0x8000;
        if self.prg.len() == 16 * 1024 {
            idx &= 0x3FFF;
        }
        self.prg[idx]
    }

    /// PPU 쪽 $0000~$1FFF(패턴 테이블) 읽기
    pub fn read_chr(&self, addr: u16) -> u8 {
        self.chr[addr as usize & 0x1FFF]
    }

    /// CHR-RAM일 때만 쓰기가 먹힌다
    pub fn write_chr(&mut self, addr: u16, val: u8) {
        if self.chr_is_ram {
            self.chr[addr as usize & 0x1FFF] = val;
        }
    }
}
