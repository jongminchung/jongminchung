# Repository agent instructions

## 핵심 원칙

- **루트 `package.json`은 저장소 전체 orchestration 명령만 제공함**
- **단일 workspace 명령은 루트 별칭을 만들지 않고 `pnpm --filter`로 직접 실행함**
- **모든 명령은 별도 안내가 없으면 저장소 루트에서 실행함**
- **`workspaces` 배열은 Tooling과 의존성 관리 계약이므로 script 최소화 과정에서 제거하지 않음**
- **명령 변경 후 영향받는 workspace 검사와 루트 `pnpm run check`를 실행함**

## 모노레포 명령 정책

- 루트 script는 다음 조건 중 하나를 만족할 때만 추가하거나 유지함
  - 여러 workspace를 하나의 빌드·검사·배포 흐름으로 조정함
  - 저장소 전체 format, lint, typecheck, test, dependency 또는 release 계약을 제공함
  - 아이콘처럼 여러 앱이 공유하는 canonical source 작업을 제공함
- 하나의 workspace script를 이름만 바꿔 전달하는 루트 별칭은 추가하지 않음
  - workspace 이름을 붙인 `dev:*` 전달 별칭을 만들지 않음
  - 범용 루트 `dev` 명령으로 여러 앱 실행을 암묵적으로 결합하지 않음
- 단일 workspace 명령은 `pnpm --filter <package-name> run <script>` 형식으로 실행함
  - 멀티도메인 Web 개발 서버는 `pnpm --filter @jongminchung/web run dev`로 실행함
- package script를 호출할 때는 `run`을 명시함
- 루트 script를 추가하기 전에 기존 workspace script와 `pnpm -r --if-present run <script>` 조합으로 해결 가능한지 먼저 확인함

## 문서와 변경 관리

- **이 파일을 에이전트용 모노레포 명령 정책의 단일 기준으로 사용함**
- `CONTRIBUTING.md`는 사람을 위한 개발 환경·workflow 설명으로 유지함
- 실제 사용자 명령이 달라질 때만 `CONTRIBUTING.md`의 예시를 함께 갱신함
- 기존 작업 트리의 사용자 변경을 보존하고 관련 없는 manifest나 생성물을 수정하지 않음

## 검증

- 명령 제거 전 코드, 다른 script, CI, 문서와 테스트의 참조를 `rg`로 확인함
- 단일 workspace 변경은 가장 가까운 typecheck·test·build를 먼저 실행함
- 루트 script 또는 workspace 연결 변경은 `pnpm run check`로 전체 계약을 검증함
- 최종적으로 `git diff --check`와 `git status --short`로 변경 범위를 확인함
