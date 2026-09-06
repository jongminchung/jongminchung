# 01. 작업 환경을 만들고 IntelliJ의 작업 습관을 옮기기

[시리즈 목차](README.md) · 다음: [포맷·lint 충돌 방지](02-format-lint-contract.md)

목표는 메뉴를 비슷하게 만드는 것이 아니라 코드를 읽고 바꾸는 시간을 줄이는 것이다.
처음 30분은 테마 선택보다 프로젝트 열기, SDK 확인, 심볼 탐색에 사용한다.

## 파일 대신 프로젝트를 연다

VS Code를 설치한 뒤 `File: Open Folder`로 빌드 설정이 있는 폴더를 연다.
Java는 `pom.xml` 또는 `settings.gradle(.kts)`, TS는 `package.json`·`tsconfig.json`,
Go는 `go.mod`·`go.work`, Python은 `pyproject.toml`이 기준이다. 파일 하나만 열면
프로젝트의 의존성과 실행 위치를 잃기 쉽다.

독립 서비스 여러 개라면 [Multi-root workspace](https://code.visualstudio.com/docs/editing/workspaces/multi-root-workspaces)를
사용할 수 있다. 반대로 하나의 빌드 그래프를 이루는 모노레포는 먼저 저장소 루트 하나를
열고 언어별 프로젝트 인식이 정상인지 확인한다. 같은 소스가 부모·자식 workspace에
중복 포함되면 오류와 테스트가 두 번 보일 수 있다.

## Profile과 팀 설정을 분리한다

`Profiles: Create Profile`에서 Java, Web, Go, Python Profile을 만든다.
공통 단축키·테마는 개인 취향이고, formatter와 테스트 명령은 팀 계약이다.
Profile 내보내기는 초기 설정 공유에 유용하지만 빌드 도구 버전 잠금 파일을 대체하지 않는다.
[Profiles 공식 안내](https://code.visualstudio.com/docs/configure/profiles)

| 보관 위치                 | 넣을 내용                           | 피할 내용                    |
| ------------------------- | ----------------------------------- | ---------------------------- |
| 개인 User/Profile         | 폰트, 키맵, 로컬 SDK 경로           | 팀 전체에 강제할 스타일      |
| `.vscode/settings.json`   | 언어별 formatter·검사 연결          | 개인 홈 경로·인증값          |
| `.vscode/extensions.json` | 필요한 확장 ID 권장 목록            | 확장 버전이 고정된다는 가정  |
| 빌드·도구 설정            | lint 규칙, formatter 규칙, SDK 버전 | IDE에서만 성립하는 별도 규칙 |

확장 화면에서 표시 이름과 **게시자·확장 ID**를 확인한다. 필요한 언어의 확장만 설치한다.
권장 목록은 자동 설치나 버전 잠금이 아니다. 실제 설치 상태는
`code --list-extensions --show-versions`로 기록할 수 있다.
[확장 관리](https://code.visualstudio.com/docs/configure/extensions/extension-marketplace)

학습용 프로젝트의 공통 시작 설정은 다음과 같다. 저장 자동 수정은 02편에서 언어별로 켠다.

```json
{
    "files.autoSave": "off",
    "editor.formatOnSave": false,
    "editor.formatOnPaste": false,
    "editor.formatOnType": false,
    "editor.formatOnSaveMode": "file",
    "editor.codeActionsOnSave": {
        "source.fixAll": "never",
        "source.organizeImports": "never"
    },
    "editor.bracketPairColorization.enabled": true,
    "editor.guides.bracketPairs": true,
    "editor.stickyScroll.enabled": true
}
```

언어별 기본값은 이 일반 설정보다 우선할 수 있다. 특히 Go처럼 확장이 언어별 저장 동작을
제공하는 경우 `[go]` 설정까지 확인한다. `@modified`, `@lang:go`, `@ext:golang.go`를
Settings 검색에 사용하면 원인을 좁히기 쉽다.
[설정 범위와 우선순위](https://code.visualstudio.com/docs/configure/settings)

## 이름보다 작업을 기억한다

기본 키맵 기준이다. 키맵 확장·OS 예약 키 때문에 다르면 Command Palette에서 표의 명령을
검색하고 Keyboard Shortcuts에서 현재 할당을 확인한다. macOS에서 F키는 키보드 설정에 따라
Fn이 필요하다. IntelliJ 키맵을 쓰더라도 실제 명령 이름은 익혀 둔다.

| 의도               | VS Code 명령·기능         | Windows/Linux | macOS       |
| ------------------ | ------------------------- | ------------- | ----------- |
| 명령 찾기          | Command Palette           | Ctrl+Shift+P  | Cmd+Shift+P |
| 파일 찾기          | Quick Open                | Ctrl+P        | Cmd+P       |
| 현재 파일 심볼     | Go to Symbol in Editor    | Ctrl+Shift+O  | Cmd+Shift+O |
| 프로젝트 심볼      | Go to Symbol in Workspace | Ctrl+T        | Cmd+T       |
| 정의로 이동        | Go to Definition          | F12           | F12         |
| 정의를 옆에서 보기 | Peek Definition           | Alt+F12       | Option+F12  |
| 사용처 확인        | Go to References          | Shift+F12     | Shift+F12   |
| 심볼 이름 변경     | Rename Symbol             | F2            | F2          |
| 빠른 수정          | Quick Fix                 | Ctrl+.        | Cmd+.       |
| 오류 목록          | Problems                  | Ctrl+Shift+M  | Cmd+Shift+M |
| 전체 텍스트 검색   | Search                    | Ctrl+Shift+F  | Cmd+Shift+F |
| 이전 위치          | Go Back                   | Alt+Left      | Ctrl+-      |

키맵 원문은 [Keyboard shortcuts](https://code.visualstudio.com/docs/configure/keybindings),
탐색 기능은 [Code Navigation](https://code.visualstudio.com/docs/editing/editingevolved)을 따른다.

`Ctrl+P`에서 파일 이름 뒤에 `:42`를 붙여 특정 줄로 간다. 열린 파일의 Breadcrumbs와
Outline으로 구조를 보고, 인터페이스에서는 Go to Implementations와 Call Hierarchy를 사용한다.
대량 텍스트 검색은 설정 키·로그 문구처럼 심볼이 아닌 대상에 쓰고, 함수 이름 변경은 F2로 한다.

## 리팩터링은 작은 변경으로 검증한다

예를 들어 `calculateTotal`을 `calculateSubtotal`로 바꾸려면 먼저 References에서 호출자를
확인한다. F2로 이름을 바꾼 뒤 diff를 검토하고 타입 검사와 해당 테스트를 실행한다.
문자열 기반 DI 이름, 직렬화 키, SQL, reflection 호출은 언어 서버의 참조 범위 밖일 수 있으므로
텍스트 검색을 함께 수행한다. 이것은 아래 실습의 검토 절차이지 특정 확장이 모든 참조를
갱신한다는 보장이 아니다.

여러 줄을 선택한 뒤 `Refactor...`에서 Extract Method/Function/Variable을 확인한다.
메뉴는 언어와 선택 범위에 따라 달라진다. 명령이 없다면 파일 모드·프로젝트 오류를 먼저
확인하고 언어별 지원 목록을 본다. [리팩터링 개요](https://code.visualstudio.com/docs/editing/refactoring)

멀티 커서는 반복 문구 편집에 쓰되 심볼 리팩터링과 구분한다. 정규식 바꾸기는 Preview로
일치 범위를 확인하고 실행한다. 여러 파일을 고친 직후에는 Source Control에서 파일별 diff를
읽고 필요한 줄만 stage한다. [기본 편집](https://code.visualstudio.com/docs/editing/codebasics),
[Source Control](https://code.visualstudio.com/docs/sourcecontrol/overview)

## 20분 실습

1. 기존 작은 프로젝트를 열고 터미널에서 빌드·테스트를 한 번 실행한다.
2. 심볼 검색으로 진입점에 가서 정의 → 사용처 → 이전 위치를 왕복한다.
3. 내부 함수 하나를 Rename하고 다른 파일의 호출자가 바뀌는지 확인한다.
4. 함수 일부를 Extract하고 같은 테스트를 다시 실행한다.
5. Source Control에서 의도하지 않은 포맷 변경이 없는지 확인한다.

통과 기준은 파일 탐색기를 반복해서 펼치지 않고 호출 경로를 찾고, 테스트를 유지하며 변경을
검토하는 것이다. 언어 오류가 있으면 다음 확장을 추가하기보다 해당 언어 편의 복구 절차를 따른다.

영상 실습: [Code Customization 101: Supercharge VS Code with Profiles](https://www.youtube.com/watch?v=QjvvqR9KyVo)
— Visual Studio Code, 2023-06-29. Profile 생성·전환·내보내기를 따라 하되 프로젝트 설정은
저장소 파일로 관리한다. 자세한 시청 안내는 [자료실](resources.md)에 있다.
