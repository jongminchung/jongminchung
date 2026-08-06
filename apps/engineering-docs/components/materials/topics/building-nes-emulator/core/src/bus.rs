/// CPU가 바깥 세상(메모리, PPU, APU, 카트리지)과 대화하는 유일한 통로.
/// CPU는 주소를 내밀고 바이트를 주고받을 뿐, 그 너머에 뭐가 있는지 모른다.
pub trait Bus {
    fn read(&mut self, addr: u16) -> u8;
    fn write(&mut self, addr: u16, val: u8);

    /// 리틀 엔디언 16비트 읽기
    fn read16(&mut self, addr: u16) -> u16 {
        let lo = self.read(addr) as u16;
        let hi = self.read(addr.wrapping_add(1)) as u16;
        (hi << 8) | lo
    }
}
