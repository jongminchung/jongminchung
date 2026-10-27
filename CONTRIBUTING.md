# 기여 가이드

## 포맷과 린트

- `make fmt`는 소스를 자동 수정하고 `pnpm run check`는 포맷·정적 분석·타입·테스트를 검사함
- Node.js `26.7.0`과 pnpm을 전역 PATH에서 사용하며 `.node-version`은 CI의 Node 버전을 기록함
- pnpm 버전은 `package.json#packageManager`를, shfmt 버전은 CI의 `3.12.0`을 기준으로 함

```bash
node --version
pnpm --version
pnpm install --frozen-lockfile

make fmt
pnpm run check
```

- 위 버전의 도구를 PATH에 설치함. shfmt 경로가 다르면 `SHFMT_BIN=/path/to/shfmt`로 지정함

- `.editorconfig`를 스타일 기준으로 유지함
    - 기본 공백 2칸·줄 길이 80·LF·마지막 개행을 사용함
    - Python·Markdown·MDX는 공백 4칸, Go·Makefile은 탭을 사용함
    - Markdown의 의미 있는 줄 끝 공백과 목록 계층을 보존함
- `oxfmt`와 `shfmt`에는 들여쓰기·줄 길이를 덮어쓰는 옵션을 추가하지 않음
- Python 저장소의 `pyproject.toml`에 있는 `tool.ruff` 값은 `.editorconfig` 변경 시 함께 갱신함
- 암호화 파일·템플릿·외부 원본·생성물의 제외 범위는 `vite.config.ts`의 fmt 설정과 셸 검사 스크립트에서 관리함
- `vite.config.ts`가 Vite+의 `fmt`·`lint` 설정을 소유하며 `vite-plus` 버전은 루트 manifest에서 관리함

- 단일 workspace 작업은 `pnpm --filter <package-name> run <script>`로 실행함

## 타입 검사와 테스트

- `pnpm run check`는 형식·정적 분석·루트·공유 패키지·웹 타입·사용하지 않는 코드·테스트를 검사하며 웹의 Playwright 설정과 E2E 타입도 포함함
- 개별 테스트는 `pnpm --filter @jongminchung/web run test next.config.test.ts`처럼 실행함
- workspace 전체 커버리지는 `pnpm --filter @jongminchung/web run test:coverage`로 검사함. UI에도 같은 script가 있음
- `pnpm run test`와 `pnpm run check`는 전체 workspace의 커버리지 기준과 Node 배포 패키지 검증을 유지함
- 공통 tsconfig는 ECMAScript·Node 환경을 사용하고 DOM 타입은 웹·UI workspace에서만 추가함
- optional 속성은 생략과 `undefined`를 구분함. 외부 API에 선택 값을 전달할 때는 값이 있는 경우에만 속성을 추가함

- React Compiler는 `infer` 모드로 컴포넌트와 Hook을 자동 판별함. `use no memo` 예외는 Fumadocs Hook adapter 및 Compiler 1.0이 처리하지 못하는 구문에 한정하며 이유를 함수에 기록함
- Compiler 업그레이드 시 위 예외를 재검토하고 프로덕션 빌드·E2E를 검증함. 컴파일 적용 범위가 늘어나는 것과 실제 화면 성능 향상은 별도로 측정함

## 브라우저와 공개 패키지 검증

- `pnpm run test:e2e`는 각 workspace의 E2E를 실행함. 웹은 Playwright가 `PLAYWRIGHT_TEST=1`로 한 번 빌드하고 그 결과로 서버를 시작함
- E2E 전에 `pnpm run build`를 따로 실행할 필요가 없음. 일반 배포 빌드는 `pnpm run build`로 별도 실행함
- 웹의 특정 테스트는 `pnpm --filter @jongminchung/web run test:e2e --grep "mobile keyboard"`로 실행함
- 로컬에 기존 3100 서버가 있으면 Playwright가 재사용하므로, 최신 소스를 새로 빌드해 검사하려면 해당 서버를 먼저 종료함
- UI 공개 경로를 추가하거나 변경하면 `exports`, 루트 tsconfig의 `paths`, 필요한 shadcn alias를 함께 갱신함
- `pnpm --filter @jongminchung/ui run test`는 source 경로 계약을, `pnpm --filter @jongminchung/ui run test:node`는 원본에서 출발해 배포 JS·타입 선언과 Node 공개 import 해석을 검증함
- `test:node`는 `source` 조건의 공개 경로 해석도 검사함. 소스 TSX의 실제 변환은 웹 빌드가 담당함
