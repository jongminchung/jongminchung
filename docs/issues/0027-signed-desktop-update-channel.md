# Issue 0027: 서명된 데스크톱 업데이트 채널 도입 준비

- 상태: 조건부 제안
- 우선순위: P2
- 기준일: 2026-08-19
- 선행 이슈:
  [0006 릴리스 workflow 계약](0006-release-workflow-contract-drift.md),
  [0014 package smoke와 release trust](0014-packaged-app-smoke-and-release-trust.md),
  [0017 local data와 privacy](0017-local-data-migration-and-privacy-inventory.md)
- 영향 범위:
  [Git Client release 문서](../../apps/git-client/docs/releases.md),
  [Git Client package](../../apps/git-client/package.json),
  [release publisher](../../apps/git-client/scripts/publish-release.ts),
  [release build](../../apps/git-client/scripts/release.ts),
  [Git Client workflow](../../.github/workflows/git-client.yml),
  [Electron main](../../apps/git-client/electron/main)
- 참고 OSS:
  [Electron autoUpdater](https://www.electronjs.org/docs/latest/api/auto-updater),
  [Electron Updating Applications](https://www.electronjs.org/docs/latest/tutorial/updates),
  [GitHub Desktop](https://github.com/desktop/desktop)

## 핵심 요약

- **현재 Git Client는 서명·notarization된 DMG를 제공하지만 앱 내부 업데이트 기능이 없음**
- **릴리스가 고정 `1.0.0` tag와 asset을 교체하므로 새 버전 판정·rollback·업데이트 이력을 신뢰할 수 없음**
- **자동 업데이트보다 먼저 단조 증가하는 version과 변경 불가능한 release artifact 계약을 만들어야 함**
- **macOS updater는 서명된 앱과 신뢰 가능한 update metadata가 필요하며 package smoke에서 실제 업그레이드 경로를 검증해야 함**
- **초기 범위는 stable channel 하나와 사용자 승인형 설치로 제한하고 staged rollout은 운영 근거가 생긴 뒤 검토함**

## OSS 기준에서 확인한 업데이트 패턴

- **Electron은 macOS와 Windows용 `autoUpdater`와 update lifecycle event를 제공함**
  - macOS 자동 업데이트에는 code signing이 필수임
  - update metadata와 artifact를 일관되게 게시해야 함
  - download 완료 뒤 재시작 설치 또는 다음 실행 설치가 가능함
- **장기간 운영되는 desktop OSS는 version 비교·channel·다운로드·재시작·실패 복구를 release pipeline과 하나의 계약으로 관리함**
- **채택할 핵심은 updater API 호출이 아니라 release identity에서 설치 완료까지 이어지는 trust chain임**

## 현재 저장소의 선행 문제

- **`package.json` version이 `1.0.0`으로 고정됨**
- **publisher는 기존 `git-client-1.0.0` release와 tag를 삭제하고 같은 identity로 다시 게시함**
  - 사용자는 이미 설치한 build와 새 build의 선후 관계를 판단할 수 없음
  - cache와 update metadata가 같은 version의 다른 binary를 가리킬 수 있음
  - rollback 대상과 보안 공지에 사용할 불변 identity가 없음
- **현재 release test는 updater와 maker가 없는 고정 build 계약을 의도적으로 검증함**
- **앱 종료 전 진행 중 Git operation·terminal·window 상태를 updater 재시작과 연결하는 정책이 없음**

## 도입 전제

- **stable semantic version이 release마다 단조 증가함**
- **게시된 tag·release·DMG·checksum을 같은 version으로 교체하지 않음**
- **release note와 최소 지원 version을 기계가 읽을 수 있는 metadata로 제공함**
- **서명·notarization·checksum·package smoke가 성공한 artifact만 update channel에 게시함**
- **업데이트 확인 endpoint와 수집 metadata를 privacy inventory에 기록함**

## 채택할 내용

- **stable channel 하나의 update state를 정의함**
  - idle
  - checking
  - available
  - downloading과 progress
  - downloaded
  - install-deferred
  - failed-retryable
  - failed-manual-download-required
- **사용자와 실행 중 작업을 보존하는 설치 UX를 제공함**
  - download 전 version과 release note 표시
  - Git operation 또는 terminal 활성 상태에서 강제 재시작 금지
  - 지금 재시작과 종료 시 설치 선택
  - 실패 시 검증된 GitHub Release 수동 다운로드 연결
- **update metadata와 artifact trust를 검증함**
  - expected version
  - signed application identity
  - notarization과 checksum
  - channel과 architecture
  - downgrade와 동일 version 재설치 차단
- **이전 version에서 새 version으로 실제 설치하는 package smoke를 추가함**

## 채택하지 않을 내용

- **고정 `1.0.0` 정책을 유지한 채 updater를 연결하지 않음**
- **개발 환경과 ad-hoc package에서 production update endpoint를 조회하지 않음**
- **서명 검증을 checksum 하나로 대체하지 않음**
- **진행 중인 write operation을 중단하고 자동 재시작하지 않음**
- **첫 단계에 nightly·beta·staged rollout을 동시에 도입하지 않음**
- **실패한 update를 무한 반복 다운로드하지 않음**

## 실행 작업

- **fixed release 정책을 immutable semantic version release로 migration함**
- **release metadata schema와 publishing 순서를 정의함**
- **packaged production build에만 update check를 활성화함**
- **main process가 updater를 소유하고 preload에는 최소 상태·명령만 노출함**
- **진행 중 작업·창 종료·재실행과 update lifecycle을 통합함**
- **N-1에서 N으로 설치하는 isolated profile package smoke를 추가함**
- **metadata 변조·서명 불일치·offline·disk 부족·취소 회귀 test를 추가함**

## 완료 조건

- **게시된 모든 release가 고유한 version·tag·artifact identity를 가짐**
- **서명·notarization·package smoke를 통과한 artifact만 update metadata에 노출됨**
- **사용자가 update version·release note·설치 시점을 선택할 수 있음**
- **진행 중 Git 작업이 있을 때 앱이 강제로 종료되지 않음**
- **N-1 설치본이 N을 감지·다운로드·검증·설치하고 기존 local data를 유지함**
- **update 실패 시 앱이 계속 실행되며 수동 복구 경로를 제공함**

## 검증

- **release와 실제 package 경계를 함께 검증함**
  - `pnpm --filter @jongminchung/git-client run test`
  - `pnpm --filter @jongminchung/git-client run release:validate-local -- <version>`
  - 이전 version에서 현재 version으로 upgrade smoke
  - offline·metadata 오류·서명 오류 fixture
- **최종 `pnpm run check`, `git diff --check`, `git status --short`를 실행함**
