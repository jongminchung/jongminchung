# 08. IntelliJ 없이 버그 하나를 수정하고 제출하기

[이전: 원격·팀 운영](07-remote-and-team-workflow.md) · [목차](README.md) · [자료실](resources.md)

최종 실습은 IDE를 실행했다는 확인을 넘어선다. **실패를 재현하고 원인을 관찰한 뒤,
리팩터링과 포맷까지 완료한 변경을 제출할 수 있는지** 확인한다. 아래 과제는 이 시리즈의
편집 판단으로 설계한 작업 기준이다.

## 공통 문제: 음수 수량을 허용하는 가격 계산

입력은 `price=1200`, `quantity=3`이고 정상 결과는 `3600`이다. `quantity=-1`은 음수 금액을
만드는 대신 명시적 오류로 거부해야 한다. 04·05·06편의 `total` 구현은 의도적으로 이 검증이
없다. **첫 테스트가 실패하는 것이 출발점**이다.

| 언어   | 추가할 테스트                           | 수정할 동작                           |
| ------ | --------------------------------------- | ------------------------------------- |
| Java   | JUnit `assertThrows`                    | `IllegalArgumentException`            |
| TS     | 프로젝트 test runner의 throws assertion | `RangeError`                          |
| Go     | error 반환을 확인하는 테스트            | `(int, error)`로 변경하고 호출자 처리 |
| Python | pytest `raises`                         | `ValueError`                          |

TS·Python·Java에서 함수 이름을 `subtotal`로 바꿀 때는 Rename Symbol을 사용한다.
Go는 반환 타입 변경도 포함되므로 compile error를 따라 호출자와 테스트를 단계적으로 고친다.
문자열 메시지를 테스트 계약에 포함할지는 팀 정책으로 정하되 오류 타입·오류 반환은 반드시 검증한다.

Python에 바로 추가할 수 있는 실패 테스트는 다음과 같다.

```python
import pytest

from main import total


def test_negative_quantity_is_rejected() -> None:
    with pytest.raises(ValueError):
        total(1200, -1)
```

이 테스트를 먼저 실행해 실패를 관찰한다. `total` 첫 줄에 breakpoint를 놓고 테스트를
디버깅한다. `quantity=-1`이 전달되는 것을 확인한 뒤 검증을 추가한다. 양수 경로의 기존
테스트도 통과해야 한다. 다른 언어에서도 같은 순서를 따른다.

## 수행 순서

1. **기준 상태 기록**: git 상태, runtime·도구 버전, 기존 테스트 결과를 기록한다.
2. **실패 재현**: 음수 테스트 하나를 추가한다. 실패가 의도한 이유인지 읽는다.
3. **탐색**: 정의·사용처·호출 계층을 확인해 변경 영향을 설명한다.
4. **디버깅**: 테스트 한 개를 debug하여 인자·stack·분기를 관찰한다.
5. **수정**: 입력 검증을 추가하고 테스트 한 개부터 전체까지 실행한다.
6. **리팩터링**: 이름 변경 또는 함수 추출을 수행하고 diff를 읽는다.
7. **포맷 수렴**: 저장과 CLI 자동 수정 결과를 비교한다.
8. **검사**: 수정 없는 format check·lint·typecheck·test를 실행한다.
9. **제출 준비**: source·테스트·필요한 설정만 stage하고 변경 이유·검증을 기록한다.
10. **환경 재현**: 다른 Profile 또는 원격 창에서 같은 프로젝트·명령으로 재검증한다.

기본 debugger 조작은 [공식 debugging 안내](https://code.visualstudio.com/docs/debugtest/debugging),
언어별 launch 세부 값은 각 편의 공식 문서를 따른다.

## 저장과 CLI가 같은 결과인지 증명한다

학습용 파일을 수정하고 저장한 후 다음 비교를 수행한다. 기존 변경이 많은 실제 저장소에서
`git diff --exit-code` 전체를 사용하면 이번 포맷 변화와 기존 diff를 구분하지 못하므로
파일 복사와 `cmp`로 이번 실습의 결과만 비교한다.

아래는 06편 Python 프로젝트의 POSIX 셸 예제다. CLI 수정 전에 편집기에서 파일을 저장한다.

```sh
cp main.py /tmp/vscode-lab-editor.py
uv run ruff check main.py --fix
uv run ruff format main.py
cmp main.py /tmp/vscode-lab-editor.py
cp main.py /tmp/vscode-lab-first.py
uv run ruff check main.py --fix
uv run ruff format main.py
cmp main.py /tmp/vscode-lab-first.py
```

첫 비교는 editor와 CLI의 일치, 두 번째는 CLI 변환의 수렴을 검사한다.
이어 편집기에서 의미 없는 공백을 하나 넣고 다시 저장해 CLI 결과와 같은지 확인한다.
Windows PowerShell에서는 별도 임시 폴더에 `Copy-Item`으로 보관하고 `Get-FileHash`로 비교할 수 있다.

다른 언어도 같은 구조로 검사한다. Java는 선택한 formatter task, TS는 팀의 fmt script,
Go는 선택한 gofmt/goimports 조합을 사용한다. 두 번째 실행에서도 diff가 생기면
[02편](02-format-lint-contract.md)의 제공자·설정 경로·버전 진단으로 돌아간다.

## 실제 프로젝트 전환 판단

| 항목          | 통과 기준                               | 미통과 시 다음 조치                   |
| ------------- | --------------------------------------- | ------------------------------------- |
| 프로젝트 인식 | 의존성·생성 코드·테스트를 해석          | SDK·빌드 모델·source root 복구        |
| 리팩터링      | 참조 갱신과 전체 검사 성공              | 작은 변경으로 나누고 지원 범위 확인   |
| 디버깅        | 대표 오류의 입력과 호출 stack 관찰      | 프로세스·map·classpath·cwd 확인       |
| format·lint   | editor/CLI/재실행 결과 일치             | 변환별 소유자와 버전 통일             |
| framework     | Spring/React/CLI 등 실제 사용 경로 재현 | 실제 확장 기능·build·통합 테스트 확인 |
| DB·HTTP       | 대표 요청·쿼리·migration 재현           | 팀 도구와 실행 절차 연결              |
| 원격          | 같은 검사와 테스트 debug 가능           | 원격 확장·SDK·경로 확인               |
| 팀 전달       | 다른 사람이 문서만으로 재현             | 개인 경로·숨은 설정 제거              |

모두 통과한 프로젝트는 VS Code를 주 IDE로 운영할 근거가 있다. 특정 프레임워크의 구조 변경이나
분석이 계속 막힌다면 그 작업의 도구 비용을 기록한다. 전체 기능의 추상적인 우열보다 실제
작업 시간을 기준으로 전환 범위를 정한다.

## 검증 기록 양식

다음 항목을 PR 또는 팀 문서에 작성한다. 아래는 작성 항목이며 실행 성공 기록이 아니다.

```text
프로젝트 / commit:
OS / 로컬·SSH·WSL·Container:
VS Code / 주요 확장 버전:
runtime / compiler / formatter / linter 버전:
재현 테스트와 최초 실패:
debug로 확인한 값:
수정과 리팩터링 범위:
editor → CLI → 재실행 파일 비교:
최종 검사 명령과 결과:
남은 framework·도구 차이:
```

## 문서 검증 기록

2026-09-06, Linux amd64의 임시 프로젝트에 본문 code block을 추출해 검증했다.
학습용 의존성은 임시 폴더에만 설치했고 이 저장소의 manifest·lockfile·VS Code 설정은 바꾸지 않았다.

| 대상             | 실제 확인한 결과                                                           |
| ---------------- | -------------------------------------------------------------------------- |
| JSON·TOML 예제   | 모든 해당 code block 구문 파싱 성공                                        |
| TypeScript       | Prettier·ESLint·typecheck·build 통과, Node 실행 결과 `3600`                |
| TS 포맷          | ESLint fix → Prettier를 다시 실행해 파일 내용 불변 확인                    |
| Go               | 본문 단위 테스트·`go vet`·`go test -race` 통과, gofmt 수정 대상 없음       |
| Python           | 본문 pytest·Ruff check/format check·Pyright 통과, 실행 결과 `3600`         |
| Python 회귀 실습 | 음수 입력 테스트의 `DID NOT RAISE` 실패 확인 후 검증 추가, 테스트 2개 통과 |
| Python 포맷      | Ruff fix → format 두 번 실행해 내용 불변 확인                              |
| 외부 링크        | 80개 URL 응답 확인. YouTube 7개는 oEmbed 메타데이터로 확인                 |

CLI 실습 환경은 Node 26.8.1, TypeScript 6.0.3, ESLint 10.10.0, Prettier 3.9.6,
typescript-eslint 8.69.0, Go 1.27.1, Python 3.12.3, pytest 9.1.1, Ruff 0.16.6,
Pyright 1.1.411이다. 이 버전은 당시 검증 환경이며 모든 프로젝트에 적용할 최신 버전 선언이 아니다.
특히 TS 학습 예제의 검증 버전과 이 저장소가 채택한 TS 7 계약은 구분한다.

Java용 JDK가 이 검사 환경에 없어 Java 실행은 검증하지 않았다. 네 언어의 VS Code GUI에서
실제 저장 action·breakpoint·refactoring을 수행하거나 Spring·원격 환경을 end-to-end 검증한
기록도 아니다. 해당 항목은 위 최종 실습으로 각 개발 환경에서 확인한다. formatter의 CLI
수렴 성공과 편집기 저장 결과의 일치 검증은 별개다.
