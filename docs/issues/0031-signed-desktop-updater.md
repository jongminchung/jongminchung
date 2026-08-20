# Issue 0031: 서명된 데스크톱 updater 운영 도입

- 상태: 조건부 보류
- 우선순위: P2
- 기준일: 2026-08-20
- 선행 결과:
  [`0027` 서명된 데스크톱 업데이트 채널 도입 준비](archive/2026/0027-signed-desktop-update-channel.md)
- 영향 범위:
  [Git Client release 문서](../../apps/git-client/docs/releases.md),
  [Git Client workflow](../../.github/workflows/git-client.yml),
  [Electron main](../../apps/git-client/electron/main)

## 핵심 요약

- **불변 SemVer release·서명·notarization·package trust의 선행 계약은 `0027`에서 완료함**
- **앱 내부 updater는 실제 N-1 production artifact와 서명된 update feed가 없어 도입하지 않음**
- **privacy inventory·최소 지원 version metadata·실제 upgrade smoke 환경이 함께 준비되어야 재개할 수 있음**
- **재개 전에는 production endpoint나 Electron `autoUpdater`를 연결하지 않음**
- **초기 구현 범위는 stable channel 하나와 사용자 승인형 설치로 제한함**

## 재개 조건

- **서명·notarization을 통과한 N-1 production artifact를 테스트 환경에서 설치할 수 있어야 함**
- **version·architecture·checksum·release note를 제공하는 서명된 update feed가 있어야 함**
- **업데이트 endpoint와 수집 metadata가 privacy inventory에 반영되어야 함**
- **N-1에서 N으로 갱신하고 기존 local data를 확인할 isolated upgrade smoke 환경이 있어야 함**
- **최소 지원 version과 수동 복구 release URL의 운영 주체가 확정되어야 함**

## 재개 후 실행 범위

- **main process가 updater lifecycle을 소유하고 preload에는 최소 상태와 명령만 노출함**
- **사용자에게 update version·release note·설치 시점을 표시함**
- **진행 중 Git operation이나 terminal이 있을 때 강제 재시작하지 않음**
- **metadata 변조·서명 불일치·offline·disk 부족·취소 상태를 복구 가능한 실패로 처리함**
- **실패 시 검증된 수동 다운로드 경로를 제공함**

## 완료 조건

- **서명·notarization·package smoke를 통과한 artifact만 update feed에 노출됨**
- **N-1 설치본이 N을 감지·다운로드·검증·설치하고 기존 local data를 유지함**
- **동일 version 재설치와 downgrade가 차단됨**
- **진행 중 작업이 있을 때 앱이 강제로 종료되지 않음**
- **update 실패 후 앱을 계속 사용할 수 있고 수동 복구 경로가 제공됨**

## 검증

- **실제 package와 update feed 경계를 함께 검증함**
  - `pnpm --filter @jongminchung/git-client run test`
  - `pnpm --filter @jongminchung/git-client run release:validate-local -- <version>`
  - 이전 version에서 현재 version으로 upgrade smoke
  - offline·metadata 오류·서명 오류 fixture
  - 최종 `pnpm run check`
