use nes_core::snake::SnakeMachine;

#[test]
fn snake_runs_and_draws() {
    let mut m = SnakeMachine::new(12345);
    m.run(2000);
    let nonzero = m.screen().iter().filter(|&&b| b != 0).count();
    assert!(nonzero >= 3, "화면에 뱀과 사과가 그려져야 한다, nonzero={nonzero}");
    assert!(!m.game_over, "2천 명령어 만에 죽으면 안 된다");
    // 아무 키도 안 누르면 언젠가 벽에 부딪혀 죽는다
    m.run(200_000);
    assert!(m.game_over, "방치하면 게임 오버가 되어야 한다");
}
