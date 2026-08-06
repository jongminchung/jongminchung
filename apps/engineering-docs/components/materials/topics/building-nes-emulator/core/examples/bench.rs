use nes_core::nes::Nes;
use std::time::Instant;

fn main() {
    let rom = std::fs::read("testdata/Chase.nes").unwrap();
    let mut nes = Nes::new(&rom).unwrap();
    // 워밍업 60프레임
    for _ in 0..60 {
        nes.run_frame();
    }
    let start = Instant::now();
    let frames = 3600; // 60초 분량
    for _ in 0..frames {
        nes.run_frame();
    }
    let elapsed = start.elapsed();
    let per_frame = elapsed.as_secs_f64() * 1000.0 / frames as f64;
    println!("{}프레임(게임 시간 60초) 실행: {:.3}초", frames, elapsed.as_secs_f64());
    println!("프레임당 {:.3}ms (예산 16.667ms의 {:.1}%)", per_frame, per_frame / 16.667 * 100.0);
    println!("실시간 대비 {:.0}배속", 60.0 / elapsed.as_secs_f64());
}
