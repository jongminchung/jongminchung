# 기여 가이드

## 포맷과 린트

- `make fmt`는 소스를 자동 수정하고 `make lint`는 포맷 검사와 린트를 수정 없이 실행함
- `BUN=/path/to/bun`으로 실행 파일을 재정의할 수 있으며 `fmt:check`는 내부 검사 스크립트임
- `Bun` 1.4 이상과 `shfmt` 3.12.0을 설치한 뒤 저장소 루트에서 실행함

```bash
go install mvdan.cc/sh/v3/cmd/shfmt@v3.12.0
# read:packages 권한의 인증값을 환경에 설정함
export GITHUB_PACKAGES_TOKEN
# jongminchung 저장소 자체는 workspace 패키지를 사용함
bun install --frozen-lockfile

make fmt
make lint
```

- `.editorconfig`를 스타일 기준으로 유지함
    - 기본 공백 2칸·줄 길이 80·LF·마지막 개행을 사용함
    - Python·Markdown·MDX는 공백 4칸, Go·Makefile은 탭을 사용함
    - Markdown의 의미 있는 줄 끝 공백과 목록 계층을 보존함
- `oxfmt`와 `shfmt`에는 들여쓰기·줄 길이를 덮어쓰는 옵션을 추가하지 않음
- Python 저장소의 `pyproject.toml`에 있는 `tool.ruff` 값은 `.editorconfig` 변경 시 함께 갱신함
- 암호화 파일·템플릿·외부 원본·생성물의 제외 범위는 `oxfmt.config.ts`와 셸 검사 스크립트에서 관리함
- 공통 함수는 `@jongminchung/tooling/oxfmt`와 `@jongminchung/tooling/oxlint`에서 가져오며 실제 도구는 각 소비 저장소가 설치함
- 공통 패키지 `1.0.0` 재배포 후 `bun remove --ignore-scripts @jongminchung/tooling` 후 `bun add --dev --exact --ignore-scripts --no-cache @jongminchung/tooling@1.0.0`으로 기존 해석 결과를 버리고 잠금 파일을 함께 반영함

- `bun run check`로 타입 검사·사용하지 않는 코드 검사·테스트를 실행함
- 단일 workspace 작업은 `bun run --filter <package-name> <script>`로 실행함
