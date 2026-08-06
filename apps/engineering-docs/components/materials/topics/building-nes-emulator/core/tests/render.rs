use nes_core::nes::Nes;
use std::collections::HashSet;
use std::fs;
use std::process::Command;

/// 프레임버퍼를 PPM으로 저장하고, ffmpeg가 있으면 PNG로도 변환해 둔다
fn save_frame(frame: &[u8], name: &str) {
    fs::create_dir_all("testdata/out").unwrap();
    let ppm_path = format!("testdata/out/{name}.ppm");
    let mut ppm = b"P6\n256 240\n255\n".to_vec();
    for pixel in frame.chunks(4) {
        ppm.extend_from_slice(&pixel[..3]); // RGBA에서 RGB만
    }
    fs::write(&ppm_path, ppm).unwrap();
    // 시각 확인용 PNG (ffmpeg가 없으면 조용히 건너뛴다)
    let png_path = format!("testdata/out/{name}.png");
    let _ = Command::new("ffmpeg").args(["-y", "-i", &ppm_path, &png_path]).output();
}

/// 프레임에 등장하는 서로 다른 색의 수
fn distinct_colors(frame: &[u8]) -> usize {
    frame.chunks(4).map(|p| (p[0], p[1], p[2])).collect::<HashSet<_>>().len()
}

/// 검은 화면이 아닌지: 밝은 픽셀이 어느 정도 있는가
fn bright_pixel_count(frame: &[u8]) -> usize {
    frame.chunks(4).filter(|p| p[0] as u16 + p[1] as u16 + p[2] as u16 > 96).count()
}

fn assert_looks_rendered(frame: &[u8], name: &str, min_colors: usize) {
    let colors = distinct_colors(frame);
    let bright = bright_pixel_count(frame);
    assert!(colors >= min_colors, "{name}: 색이 {colors}가지뿐이다 ({min_colors}가지 이상이어야 함)");
    assert!(bright > 500, "{name}: 밝은 픽셀이 {bright}개뿐 — 사실상 검은 화면이다");
}

#[test]
fn nestest_menu_renders() {
    let rom = fs::read("testdata/nestest.nes").unwrap();
    let mut nes = Nes::new(&rom).unwrap();
    for _ in 0..60 {
        nes.run_frame();
    }
    save_frame(&nes.bus.ppu.frame, "nestest_menu");
    // nestest 메뉴는 원래 검은 배경에 흰 글자뿐이다
    assert_looks_rendered(&nes.bus.ppu.frame, "nestest 메뉴", 2);
}

#[test]
fn chase_title_and_gameplay_render() {
    let rom = fs::read("testdata/Chase.nes").unwrap();
    let mut nes = Nes::new(&rom).unwrap();

    // 타이틀 화면
    for _ in 0..120 {
        nes.run_frame();
    }
    save_frame(&nes.bus.ppu.frame, "chase_title");
    assert_looks_rendered(&nes.bus.ppu.frame, "Chase 타이틀", 4);
    let title = nes.bus.ppu.frame;

    // Start를 몇 프레임 눌렀다 뗀다 → "LEVEL 1" 화면을 지나 게임으로
    nes.bus.joypad1.set_button(3, true);
    for _ in 0..5 {
        nes.run_frame();
    }
    nes.bus.joypad1.set_button(3, false);
    for _ in 0..300 {
        nes.run_frame();
    }
    save_frame(&nes.bus.ppu.frame, "chase_game");
    assert_looks_rendered(&nes.bus.ppu.frame, "Chase 게임 화면", 4);
    assert_ne!(&title[..], &nes.bus.ppu.frame[..], "Start를 눌렀는데 화면이 그대로다");
}
