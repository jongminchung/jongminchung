# VS Code 시리즈 공식 문서·YouTube 자료실

[시리즈 목차](README.md)

확인일: **2026-09-06**. 주제별로 실제 작업에 필요한 자료를 모았다. 웹의 모든 관련 영상을
망라한 목록은 아니며, 본문에서 사용한 공식 근거와 실습에 연결할 직접 영상 링크를 제공한다.
기능·설정의 근거는 공식 문서, 영상은 화면 흐름 학습용으로 구분한다.

## 먼저 볼 YouTube 영상

영상의 제목·채널·공개일·설명/챕터를 확인해 선정했다. 전체 영상을 재생해 모든 설정을
재검증한 기록은 아니다. 챕터가 있는 경우 아래 시간은 게시자가 제공한 설명을 따른다.
영상 속 최신 버전 표현은 **공개 당시** 기준이다.

| 연결 편 | 영상·원 채널                                                                                                                              | 공개일     | 시청할 부분과 실습                                                           |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------- |
| 01      | [Code Customization 101: Supercharge VS Code with Profiles](https://www.youtube.com/watch?v=QjvvqR9KyVo) — Visual Studio Code             | 2023-06-29 | 00:29 Profile 생성, 03:11 내보내기. 개인 설정과 workspace 계약 분리          |
| 03      | [Working with Java in Visual Studio Code](https://www.youtube.com/watch?v=ZHHUZyy_fOo) — Microsoft Developer                              | 2022-04-07 | Java 확장과 작업 환경 이해. JDK 조건은 현재 Red Hat 문서 재확인              |
| 03      | [From Zero to Hero: Coding Spring Boot Applications in Visual Studio Code](https://www.youtube.com/watch?v=ztc2C99hhvw) — SpringDeveloper | 2023-09-06 | Initializr·Spring 편집·테스트·실행·debug 흐름을 자신의 서비스로 재현         |
| 04      | [How to Run Typescript in VS Code](https://www.youtube.com/watch?v=_hKYFKZPZmc) — Train To Code                                           | 2022-11-10 | 04:33 로컬 TypeScript, 07:57 debugging. SDK 키·TS 7은 현재 문서 적용         |
| 05      | [Go — Writing and debugging fast, reliable and efficient software](https://www.youtube.com/watch?v=6r08zGi38Tk) — Visual Studio Code      | 2021-06-17 | 03:52 개발, 11:38 테스트·debug. gopls·Delve 옵션은 현재 문서 적용            |
| 06      | [Getting Started with Python in VS Code (Official Video)](https://www.youtube.com/watch?v=D2cwvpJSBX4) — Visual Studio Code               | 2024-08-12 | 02:29 가상환경, 06:20 탐색, 08:27 debug. Ruff 구성은 본문 사용               |
| 06      | [Setting up VS Code for Python Beginners](https://www.youtube.com/watch?v=7FltByLPnrg) — Visual Studio Code                               | 2021-11-12 | 08:08 interpreter, 10:29 venv. 과거 formatter/lint 통합 설정은 복사하지 않기 |

## 공통 환경·편집·디버깅

| 공식 문서                                                                                              | 찾을 내용                             |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| [Settings](https://code.visualstudio.com/docs/configure/settings)                                      | User·Remote·Workspace·언어별 우선순위 |
| [Profiles](https://code.visualstudio.com/docs/configure/profiles)                                      | 역할별 환경·내보내기·가져오기         |
| [Keyboard shortcuts](https://code.visualstudio.com/docs/configure/keybindings)                         | 명령 ID·현재 키맵·충돌 확인           |
| [Basic editing](https://code.visualstudio.com/docs/editing/codebasics)                                 | 검색·치환·멀티 커서                   |
| [Code navigation](https://code.visualstudio.com/docs/editing/editingevolved)                           | 심볼·정의·참조·계층                   |
| [Refactoring](https://code.visualstudio.com/docs/editing/refactoring)                                  | 언어별 Code Action·Rename             |
| [Tasks](https://code.visualstudio.com/docs/debugtest/tasks)                                            | 명령·cwd·problem matcher·background   |
| [Debug configuration](https://code.visualstudio.com/docs/debugtest/debugging-configuration)            | launch·attach·compound·preLaunchTask  |
| [Multi-root](https://code.visualstudio.com/docs/editing/workspaces/multi-root-workspaces)              | folder 설정·이름 있는 workspace 변수  |
| [Source Control](https://code.visualstudio.com/docs/sourcecontrol/overview)                            | diff·stage·commit                     |
| [Merge conflicts](https://code.visualstudio.com/docs/sourcecontrol/merge-conflicts)                    | Merge Editor·결과 검토                |
| [Extension Marketplace](https://code.visualstudio.com/docs/configure/extensions/extension-marketplace) | 확장 ID·권장 목록·관리                |
| [Performance issues](https://github.com/microsoft/vscode/wiki/Performance-Issues)                      | extension host·프로세스·bisect 진단   |

## formatter·lint

| 공식 문서                                                                     | 찾을 내용                         |
| ----------------------------------------------------------------------------- | --------------------------------- |
| [Prettier와 linters](https://prettier.io/docs/integrating-with-linters)       | 스타일 규칙 충돌을 끄는 이유      |
| [Prettier VS Code](https://github.com/prettier/prettier-vscode)               | 로컬 package·requireConfig·Output |
| [eslint-config-prettier](https://github.com/prettier/eslint-config-prettier)  | flat config 순서·충돌 검사        |
| [VS Code ESLint](https://github.com/microsoft/vscode-eslint)                  | fixAll·workingDirectories·진단    |
| [typescript-eslint 시작](https://typescript-eslint.io/getting-started/)       | 기본 flat config                  |
| [Typed linting](https://typescript-eslint.io/getting-started/typed-linting/)  | 타입 정보를 쓰는 검사 설정        |
| [Oxfmt editor integration](https://oxc.rs/docs/guide/usage/formatter/editors) | 프로젝트 로컬 LSP·공식 확장       |
| [Oxfmt configuration](https://oxc.rs/docs/guide/usage/formatter/config)       | EditorConfig 지원·설정 탐색       |
| [Oxc VS Code](https://github.com/oxc-project/oxc-vscode)                      | Oxlint·Oxfmt 통합                 |
| [Code Actions on Save 변경](https://code.visualstudio.com/updates/v1_83)      | explicit·always·never의 도입 근거 |

## Java·Spring

| 공식 문서                                                                       | 찾을 내용                              |
| ------------------------------------------------------------------------------- | -------------------------------------- |
| [Java overview](https://code.visualstudio.com/docs/languages/java)              | 확장 구성·기능 범위                    |
| [Red Hat Java](https://github.com/redhat-developer/vscode-java)                 | tooling JDK·project JDK·언어 서버 로그 |
| [Java projects](https://code.visualstudio.com/docs/java/java-project)           | 모듈 import·runtime·classpath          |
| [Maven·Gradle](https://code.visualstudio.com/docs/java/java-build)              | 빌드 task·dependency                   |
| [Java refactoring](https://code.visualstudio.com/docs/java/java-refactoring)    | 생성·추출·변환 지원 목록               |
| [Java debugging](https://code.visualstudio.com/docs/java/java-debugging)        | args·vmArgs·attach·Hot Code Replace    |
| [Java testing](https://code.visualstudio.com/docs/java/java-testing)            | JUnit·TestNG·Testing UI                |
| [Java formatting](https://code.visualstudio.com/docs/java/java-linting)         | Eclipse profile·Checkstyle             |
| [Spring Boot](https://code.visualstudio.com/docs/java/java-spring-boot)         | Spring 확장·Dashboard·프로젝트 생성    |
| [Spotless Gradle](https://github.com/diffplug/spotless/tree/main/plugin-gradle) | formatter engine·import·apply/check    |

## TypeScript·웹

| 공식 문서                                                                                           | 찾을 내용                                 |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| [TypeScript overview](https://code.visualstudio.com/docs/languages/typescript)                      | built-in 기능                             |
| [Compiler와 language service](https://code.visualstudio.com/docs/typescript/typescript-transpiling) | 버전 선택·tsconfig·빌드                   |
| [Editing TypeScript](https://code.visualstudio.com/docs/typescript/typescript-editing)              | 현재 js/ts 설정·inlay hint·CodeLens       |
| [Refactoring TypeScript](https://code.visualstudio.com/docs/typescript/typescript-refactoring)      | Rename·Extract·import 갱신                |
| [TypeScript debugging](https://code.visualstudio.com/docs/typescript/typescript-debugging)          | sourceMap·outFiles                        |
| [Node debugging](https://code.visualstudio.com/docs/nodejs/nodejs-debugging)                        | Debug Terminal·launch·attach              |
| [TS 7 전환 기록](https://code.visualstudio.com/blogs/2026/06/26/iterating-faster-with-ts-7)         | native compiler·language server 전환 배경 |
| [Bun debugger](https://bun.sh/docs/runtime/debugger)                                                | Bun 프로세스의 별도 debugging 경로        |

## Go

| 공식 문서                                                                         | 찾을 내용                     |
| --------------------------------------------------------------------------------- | ----------------------------- |
| [Go VS Code](https://github.com/golang/vscode-go)                                 | 설치·도구 연결                |
| [Go 기능](https://github.com/golang/vscode-go/wiki/features)                      | navigation·Code Action·테스트 |
| [Go 확장 설정](https://github.com/golang/vscode-go/blob/master/docs/settings.md)  | formatTool·gopls 설정         |
| [Go debugging](https://github.com/golang/vscode-go/blob/master/docs/debugging.md) | Delve·test mode·원격 경로     |
| [gopls settings](https://go.dev/gopls/settings)                                   | gofumpt·local·workspace       |
| [gofmt](https://pkg.go.dev/cmd/gofmt)                                             | 포맷·목록 출력                |
| [goimports](https://pkg.go.dev/golang.org/x/tools/cmd/goimports)                  | import 추가·제거·정렬         |
| [Go workspaces](https://go.dev/doc/tutorial/workspaces)                           | 여러 모듈의 개발 관계         |
| [Go test](https://pkg.go.dev/cmd/go#hdr-Test_packages)                            | test flag·cache               |
| [Race detector](https://go.dev/doc/articles/race_detector)                        | 지원 조건·동시성 검사         |
| [Diagnostics](https://go.dev/doc/diagnostics)                                     | profiling·pprof               |
| [golangci-lint](https://golangci-lint.run/docs/welcome/quick-start/)              | 구성 검증·lint 실행           |

## Python

| 공식 문서                                                                                     | 찾을 내용                         |
| --------------------------------------------------------------------------------------------- | --------------------------------- |
| [Python environments](https://code.visualstudio.com/docs/python/environments)                 | interpreter·프로젝트 환경 선택    |
| [Python editing](https://code.visualstudio.com/docs/python/editing)                           | Pylance·탐색·타입 분석            |
| [Python formatting](https://code.visualstudio.com/docs/python/formatting)                     | 독립 formatter 확장               |
| [Python testing](https://code.visualstudio.com/docs/python/testing)                           | pytest discovery·debug            |
| [Python debugging](https://code.visualstudio.com/docs/python/debugging)                       | debugpy·program/module·환경       |
| [Jupyter kernels](https://code.visualstudio.com/docs/datascience/jupyter-kernel-management)   | notebook kernel 선택              |
| [Ruff formatter](https://docs.astral.sh/ruff/formatter/)                                      | lint 호환성·format/check          |
| [Ruff editor setup](https://docs.astral.sh/ruff/editors/setup/)                               | formatter·fixAll·organizeImports  |
| [Ruff editor settings](https://docs.astral.sh/ruff/editors/settings/)                         | tool 경로·설정 해석               |
| [Ruff VS Code](https://github.com/astral-sh/ruff-vscode)                                      | 확장 ID·설치·버전 선택            |
| [Pyright configuration](https://github.com/microsoft/pyright/blob/main/docs/configuration.md) | typeCheckingMode·include·가상환경 |
| [uv projects](https://docs.astral.sh/uv/guides/projects/)                                     | lock·sync·run                     |

## 원격 개발

- [Remote SSH](https://code.visualstudio.com/docs/remote/ssh): 원격 host·확장 설치·포트
- [WSL](https://code.visualstudio.com/docs/remote/wsl): Windows UI와 Linux 개발 환경
- [Dev Containers](https://code.visualstudio.com/docs/devcontainers/containers): toolchain·이미지·mount·확장

새 버전으로 갱신할 때는 문서 링크의 존재만 확인하지 않는다. 설정 키·확장 ID·runtime 조건·
실제 저장 결과·테스트 debug를 다시 검토하고 확인일을 갱신한다. 삭제된 영상을 검색 결과
페이지로 대체하기보다 현재 공식 자료를 연결하고 기존 영상의 상태를 기록한다.
