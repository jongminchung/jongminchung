# VS Code를 주 IDE로 쓰는 실전 시리즈

IntelliJ에서 하던 일을 VS Code에서도 끝낼 수 있으려면 자동 완성보다 먼저 프로젝트 모델,
실행 환경, 검사 명령이 연결되어야 한다. 이 시리즈는 저장소를 열어 오류를 찾고, 안전하게
리팩터링하고, 테스트를 디버깅한 뒤 CI와 같은 검사로 변경을 제출하는 흐름을 만든다.
Java·TypeScript·Go·Python을 각각 실제 업무에 사용할 수 있도록 구성한다.

자료 확인일: **2026-09-06**. 설정 키와 확장 기능은 이날 확인한 공식 문서를 기준으로 한다.
영상의 화면·설치 방식은 촬영 당시 기준이므로 최신 설정은 본문과 공식 문서에서 확인한다.
각 설정은 선택한 학습 프로젝트에 적용하는 예제이며 이 저장소의 실행 설정을 변경하지 않는다.

## 읽는 순서

| 편                                   | 주제                                  | 읽고 나서 할 수 있는 일                                                 |
| ------------------------------------ | ------------------------------------- | ----------------------------------------------------------------------- |
| [01](01-workspace-and-navigation.md) | 작업 환경과 IntelliJ 작업 습관 옮기기 | Profile·workspace 구성, 심볼 탐색, 리팩터링, Git diff 검토              |
| [02](02-format-lint-contract.md)     | 저장해도 코드가 싸우지 않는 설정      | formatter·import·lint 소유권 분리, Prettier 충돌 재현·해결              |
| [03](03-java.md)                     | Java와 Spring Boot                    | JDK·Maven·Gradle 연결, JUnit 디버깅, Spring 탐색, 포맷 통일             |
| [04](04-typescript.md)               | TypeScript와 웹                       | 언어 서비스·컴파일러 확인, ESLint/Prettier 또는 Oxc, source map 디버깅  |
| [05](05-go.md)                       | Go                                    | gopls·go.work·Delve, 테스트·race·프로파일링, gofmt 기준 확정            |
| [06](06-python.md)                   | Python                                | 가상환경·Pylance·Ruff·pytest·debugpy를 같은 환경으로 연결               |
| [07](07-remote-and-team-workflow.md) | 원격 개발과 팀 운영                   | Run Configuration, Tasks, 모노레포, SSH·WSL·Dev Containers, 느려짐 진단 |
| [08](08-graduation-lab.md)           | IntelliJ 없이 변경 하나 완성하기      | 버그 재현 → 테스트 디버깅 → 수정 → 리팩터링 → CI 검사                   |
| [자료실](resources.md)               | 공식 문서와 YouTube                   | 주제별 원문·영상·시청 과제 찾기                                         |

처음부터 모든 확장을 설치하지 않는다. 01·02편을 읽고 주력 언어 한 편과 07·08편을
완료한 다음 두 번째 언어를 추가한다. 단축키를 이미 익혔다면 02편부터 시작해도 된다.

함께 읽을 글: [VS Code의 성장에서 배우고 싶은 것, 앞으로 묻고 싶은 것](the-story-of-vscode-reflection.md).
《The Story of VS Code》의 공개 소개와 챕터 구성을 바탕으로 개방성, 개발 환경,
AI의 검토 가능성에 대한 감상과 피드백을 담았다. 원문에 자료 확인 범위를 명시했다.

## 여기서 말하는 IntelliJ 수준

다음은 제품 기능 전체의 동등성을 주장하는 표가 아니라, 이 시리즈가 완성할 작업 기준이다.
Java 지원은 [JDT 기반 확장](https://github.com/redhat-developer/vscode-java),
TS는 [VS Code 언어 기능](https://code.visualstudio.com/docs/languages/typescript),
Go·Python은 각 언어 확장의 기능을 조합한다.

| 평소 하던 작업             | VS Code에서 구성할 경로            | 완료 판단                                  |
| -------------------------- | ---------------------------------- | ------------------------------------------ |
| 프로젝트 인식·오류 표시    | 빌드 파일·언어 서버·SDK            | CLI가 아는 의존성을 편집기도 해석함        |
| Find Usages·Rename·Extract | References·Rename Symbol·Refactor  | 문자열 치환 없이 참조를 바꾸고 테스트 통과 |
| Run Configuration          | `launch.json`·Tasks·Testing        | 동일 인자·환경·작업 폴더로 반복 실행       |
| 테스트 한 개 디버깅        | 언어별 Test Explorer·debug adapter | 실패하는 입력과 호출 스택을 관찰           |
| Reformat·Optimize Imports  | 파일 종류별 지정 도구              | 저장·CLI·두 번째 저장의 결과가 같음        |
| Commit·충돌 해결           | Source Control·diff·Merge Editor   | 실제 수정한 줄만 검토하고 stage            |
| 원격 개발                  | Remote SSH·WSL·Dev Containers      | 서버 쪽 SDK와 소스를 같은 환경에서 사용    |

Java의 복잡한 프레임워크 참조, JPA 쿼리, 대규모 구조 변경, 앱 서버와 데이터베이스 도구는
별도 평가 항목이다. 필요한 기능을 확장 이름만으로 충족했다고 판단하지 않는다. 팀의 실제
대표 작업으로 08편을 통과하면 주 IDE 전환을 결정한다. 지원되지 않는 리팩터링은 단계적
코드 변경과 컴파일·테스트로 수행하고, 비용이 너무 크면 기존 도구를 그 작업에 유지한다.

## 예제를 적용하는 규칙

예제의 `${workspaceFolder}`는 **해당 학습 프로젝트를 연 폴더**다. 별도 안내가 없으면
명령도 그 폴더에서 실행한다. `settings.json`, `tasks.json`, `launch.json`은 모두
그 폴더의 `.vscode/` 아래에 둔다. 기존 파일이 있으면 필요한 키만 병합하며 통째로 덮어쓰지 않는다.
POSIX 셸 예제는 macOS·Linux·WSL 기준이며 Windows 차이는 해당 편에서 설명한다.

이 저장소를 작업하는 경우에는 [기여 가이드](../CONTRIBUTING.md)와
[기존 `.vscode/settings.json`](../../.vscode/settings.json)이 우선이다.
현재 JS·TS·문서 포맷은 Oxfmt, lint는 Oxlint이며 Prettier·ESLint 학습용 구성을 추가하지 않는다.

문서 검증 범위와 직접 실행한 실습 결과는 [08편의 검증 기록](08-graduation-lab.md#문서-검증-기록)에 남긴다.
