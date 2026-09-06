# 장애 진단과 복구

명령은 저장소 루트에서 실행한다. 첫 오류의 전체 메시지, 실행 명령, commit SHA,
Bun·Node 버전, 발생 URL·Host·언어, 마지막 정상 시점을 기록한다.
운영 장애라면 [배포 기록](release.md)을 열어 현재 artifact와 마지막 정상 artifact를
대조한다. 원인 분석에 오래 걸리고 정상 artifact가 확인되어 있으면 먼저 복구한다.

## 설치·검사 실패

| 증상                          | 확인과 조치                                                                                                                                              | 다시 확인                          |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| frozen lockfile 설치 실패     | 버전 파일과 실행 Bun 버전, manifest·lockfile diff 확인. 일반 작업에서 lockfile을 지워 해결하지 않는다. 의도한 의존성 변경이면 `bun install` 후 diff 검토 | `bun install --frozen-lockfile`    |
| `shfmt` 또는 `make` 없음      | `mise install`과 PATH 확인. 별도 shfmt는 `SHFMT_BIN`으로 지정                                                                                            | `make lint`                        |
| `.source` 또는 새 MDX 누락    | MDX 경로·schema 확인 후 Web `postinstall` 실행                                                                                                           | Web `typecheck`, `build`           |
| route 타입 불일치             | 실제 내부 App Router 경로와 `PageProps` 인자 확인                                                                                                        | Web `typecheck`로 Next 타입 재생성 |
| 번역·metadata·내부 링크 오류  | 오류에 나온 파일과 한영 쌍, [콘텐츠 절차](content.md) 확인                                                                                               | Web `test`, `build`                |
| Client에서 `server-only` 오류 | `use client`부터 import를 추적해 서버 콘텐츠 로더를 가져오는 지점 수정                                                                                   | Web `typecheck`, `build`           |
| Knip 오류                     | import·script·catalog 사용처 확인. 생성 entry나 CLI인지 조사 후 선언 또는 사용처 수정                                                                    | `bun run deadcode`                 |
| 커버리지 실패                 | 해당 workspace `bunfig.toml`과 누락된 동작 확인. 한 파일 실행으로 전체 coverage를 판단하지 않는다                                                        | 해당 workspace `test:coverage`     |
| `links:check`의 Docker 오류   | Docker 설치·daemon 접근 확인. 첫 실행은 이미지 다운로드 필요                                                                                             | `bun run links:check`              |
| 전체 format 검사 실패         | 보고된 파일이 자신의 변경인지 확인하고 필요한 파일만 formatter 적용                                                                                      | `bun run fmt:check`                |

검사 명령의 workspace 필터는 [시작 안내](start.md)를 따른다. 자동 수정 전
`git diff`를 확인하고 다른 작업의 변경을 덮어쓰지 않는다.

## 브라우저 테스트 실패

1. Chromium이 없으면 `bunx playwright install --with-deps chromium`을 실행한다.
2. 로컬 3100 서버를 자신이 실행했는지 확인한다. Playwright는 기존 서버를 재사용하므로
   자신의 오래된 서버를 종료한 뒤 다시 실행한다.
3. 실패한 테스트만 이름으로 재현한다. 아래 `검색할 테스트 이름`은 실제 실패 이름으로 바꾼다.

```sh
bun run --filter @jongminchung/web test:e2e --grep '검색할 테스트 이름' --workers=1 --retries=1
```

4. `apps/web/test-results`의 screenshot·video·trace를 본다. trace는 첫 재시도에서
   수집되므로 기본 재시도 0인 로컬 실행에는 없을 수 있다. CI의 artifact 이름은
   `web-playwright-failure`다.
5. visual 실패는 같은 OS·브라우저의 expected·actual·diff를 비교한다. 의도한 화면 변경만
   같은 테스트 선택 조건에 `--update-snapshots`를 추가해 갱신하고 이미지 diff를 검토한다.

공유 설정의 자세한 기준은 [Web 테스트 전략](../web-testing-strategy.md)과
[Playwright 설정](../../apps/web/playwright.config.ts)을 따른다.

## 사이트 응답 이상

실행 중인 로컬 standalone 서버 또는 컨테이너를 아래처럼 확인한다. 기본 포트가
3000이 아니면 URL의 포트를 바꾼다.

```sh
curl --fail --show-error -i http://127.0.0.1:3000/healthz
curl --fail --show-error -i -H 'Host: www.jamie.kr' http://127.0.0.1:3000/ko
curl --fail --show-error -i -H 'Host: tech.jamie.kr' http://127.0.0.1:3000/ko
curl --fail --show-error -i -H 'Host: invest.jamie.kr' http://127.0.0.1:3000/ko
```

`/healthz`는 `200`과 `{"status":"ok"}`가 정상이다. 이 검사는 프로세스 응답만
확인하므로 세 사이트·두 언어·콘텐츠가 모두 정상이라는 뜻은 아니다.

| 증상                             | 분리할 원인                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------- |
| healthz도 실패                   | 프로세스 종료, 포트·Service 연결, 컨테이너 시작 로그                              |
| healthz 성공, 특정 Host만 실패   | `proxy.ts`, `lib/site-routing.ts`, DNS·Ingress의 원래 Host 보존                   |
| 원점 응답 정상, 공개 도메인 실패 | DNS·TLS·Vercel domain 설정 또는 Ingress 경로                                      |
| `/`가 `307`                      | 정상 locale 선택일 수 있음. `Location`과 cookie·Accept-Language 확인              |
| 직접 `/tech/ko` 요청이 거부됨    | 내부 경로 보호 동작. 공개 URL `/ko`와 Tech Host로 검사                            |
| 새 글만 없음                     | 현재 배포 SHA, 공개 상태, `.source` 재생성·build 여부                             |
| HTML은 정상, CSS·이미지 404      | standalone의 `public`, `.next/static` 포함 여부, 실제 이미지 경로                 |
| PlantUML 이미지만 없음           | 브라우저의 Kroki 요청 확인. build는 Kroki 네트워크를 호출하지 않음                |
| 개발에서만 사이트가 달라짐       | `JAMIE_LOCAL_SITE`는 개발 loopback host 선택값. production에서는 도메인 매핑 확인 |

## 복구와 종료 판단

Web은 배포 시스템에 기록된 마지막 정상 deployment 또는 image digest로 복구한다.
기존 배포가 없으면 문제 commit을 되돌리는 별도 변경을 만들고 build·검증 후 재배포한다.
공유 브랜치를 강제로 과거 상태로 바꾸거나 미커밋 작업을 삭제하지 않는다.

복구 후 healthz, Home·Tech·Invest의 `/ko`·`/en`, 장애가 났던 URL과 상호작용을
다시 확인한다. 코드 수정만으로 종료하지 말고 공개 도메인에서도 확인한다.
패키지 게시 실패는 고정 `1.0.0` 삭제로 소비자 설치까지 영향을 받을 수 있으므로
[패키지 복구 절차](release.md)를 따른다.

[이슈 목록](../issues/README.md)에 발생 시각, 영향, 원인, 복구 artifact·SHA,
실행한 확인, 재발 방지 작업을 남긴다. 로그에서 token·인증정보는 제거한다.
