use nes_core::nes::Nes;
use std::fs;

const SAMPLE_RATE: u32 = 44_100;

/// 프레임 단위로 실행하며 APU 샘플을 모은다
fn collect_frames(nes: &mut Nes, frames: usize) -> Vec<f32> {
    let mut out = Vec::new();
    for _ in 0..frames {
        nes.run_frame();
        out.extend(nes.bus.apu.take_samples());
    }
    out
}

/// DC(평균)를 뺀 파형. 믹서 출력이 0.0~1.0이라 중심을 0으로 옮긴다.
fn remove_dc(samples: &[f32]) -> Vec<f32> {
    let mean = samples.iter().sum::<f32>() / samples.len() as f32;
    samples.iter().map(|s| s - mean).collect()
}

fn rms(samples: &[f32]) -> f32 {
    (samples.iter().map(|s| s * s).sum::<f32>() / samples.len() as f32).sqrt()
}

fn zero_crossings(samples: &[f32]) -> usize {
    samples.windows(2).filter(|w| (w[0] >= 0.0) != (w[1] >= 0.0)).count()
}

/// 44.1kHz mono 16bit PCM WAV로 저장
fn write_wav(path: &str, samples: &[f32]) {
    let data_len = (samples.len() * 2) as u32;
    let mut wav = Vec::with_capacity(44 + data_len as usize);
    wav.extend_from_slice(b"RIFF");
    wav.extend_from_slice(&(36 + data_len).to_le_bytes());
    wav.extend_from_slice(b"WAVEfmt ");
    wav.extend_from_slice(&16u32.to_le_bytes()); // fmt 청크 크기
    wav.extend_from_slice(&1u16.to_le_bytes()); // PCM
    wav.extend_from_slice(&1u16.to_le_bytes()); // mono
    wav.extend_from_slice(&SAMPLE_RATE.to_le_bytes());
    wav.extend_from_slice(&(SAMPLE_RATE * 2).to_le_bytes()); // 초당 바이트
    wav.extend_from_slice(&2u16.to_le_bytes()); // 블록 정렬
    wav.extend_from_slice(&16u16.to_le_bytes()); // 비트 수
    wav.extend_from_slice(b"data");
    wav.extend_from_slice(&data_len.to_le_bytes());
    for s in samples {
        let v = (s * 32767.0).clamp(-32768.0, 32767.0) as i16;
        wav.extend_from_slice(&v.to_le_bytes());
    }
    fs::write(path, wav).unwrap();
}

/// 5초 분량 덤프가 "진짜 음악"인지 검사하고 WAV로 남긴다
fn assert_sounds_like_music(samples: &[f32], name: &str) {
    // 샘플 개수 ≈ 5초 × 44100 (±5%)
    let expected = 5 * SAMPLE_RATE as usize;
    assert!(
        samples.len().abs_diff(expected) < expected / 20,
        "{name}: 샘플이 {}개 — 5초 분량({expected}개)과 다르다",
        samples.len()
    );

    let centered = remove_dc(samples);
    let rms = rms(&centered);
    assert!(rms > 0.005, "{name}: RMS {rms:.5} — 사실상 무음이다");
    assert!(rms < 0.5, "{name}: RMS {rms:.5} — 클리핑 수준이다");

    let crossings = zero_crossings(&centered);
    assert!(crossings > 1000, "{name}: 제로 크로싱이 {crossings}개뿐 — 파형이 아니다");

    // 음악이 진행되는지: 첫 2초와 마지막 2초의 파형이 같으면 안 된다
    let two_sec = 2 * SAMPLE_RATE as usize;
    let head = &samples[..two_sec];
    let tail = &samples[samples.len() - two_sec..];
    assert_ne!(head, tail, "{name}: 첫 2초와 마지막 2초가 완전히 같다 — 음악이 멈춰 있다");

    fs::create_dir_all("testdata/out").unwrap();
    write_wav(&format!("testdata/out/{name}.wav"), &centered);
    println!("{name}: {}샘플, RMS {rms:.4}, 제로 크로싱 {crossings}", samples.len());
}

#[test]
fn chase_audio_dump() {
    let rom = fs::read("testdata/Chase.nes").unwrap();
    let mut nes = Nes::new(&rom).unwrap();

    // 타이틀 화면까지 부팅. Chase의 타이틀은 원본 소스에서 music_play를
    // 호출하지 않아 의도적으로 무음이다 — 그것부터 확인한다.
    for _ in 0..120 {
        nes.run_frame();
    }
    nes.bus.apu.take_samples();
    let silent = collect_frames(&mut nes, 60);
    let silent_rms = rms(&remove_dc(&silent));
    assert!(silent_rms < 0.005, "타이틀이 무음이 아니다 (RMS {silent_rms:.5})");

    // Start를 누른 순간부터 5초: 시작 효과음 + LEVEL 1 징글 + 게임 음악 도입부
    nes.bus.joypad1.set_button(3, true);
    for _ in 0..5 {
        nes.run_frame();
    }
    nes.bus.joypad1.set_button(3, false);
    nes.bus.apu.take_samples();

    let title = collect_frames(&mut nes, 295);
    assert_sounds_like_music(&title, "chase_title");

    // 이어지는 5초: 순수한 게임 플레이 음악
    let game = collect_frames(&mut nes, 300);
    assert_sounds_like_music(&game, "chase_game");

    // 두 구간이 같으면 음악이 진행되지 않는 것이다
    assert_ne!(&title[..SAMPLE_RATE as usize], &game[..SAMPLE_RATE as usize]);
}
