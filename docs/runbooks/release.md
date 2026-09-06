# 배포와 유지보수 인수인계

명령은 저장소 루트에서 실행한다. 이 문서는 저장소의 설정과 workflow를 기준으로 한다.
현재 운영 계정의 설정·권한·배포 이력은 저장소만으로 확인할 수 없다.
배포 전에 아래 기록을 실제 운영 시스템과 대조한다.

## 운영자가 보관할 기록

접근 가능한 운영 문서에 다음 표를 채워 인수인계한다. token 자체는 문서에 쓰지 않고
secret 관리자 또는 GitHub Actions secret의 위치를 기록한다.

| 항목               | 기록할 값                                                             |
| ------------------ | --------------------------------------------------------------------- |
| 책임자             | Web·DNS·패키지 담당자와 장애 연락 수단                                |
| 실제 Web 배포 대상 | Vercel project·team 또는 cluster·namespace·Deployment·Service·Ingress |
| 배포 권한          | 계정·역할, 접근 신청 및 복구 방법                                     |
| DNS                | zone 관리 위치, 네 도메인의 연결 대상과 인증서 관리 위치              |
| 정상 artifact      | 마지막 정상 Git SHA, Vercel deployment ID 또는 registry image digest  |
| 복구 방법          | 해당 대상의 rollback 실행 위치, 권한, 정상 여부 확인 URL              |
| 패키지 게시        | `GH_PAT` 관리·만료 확인 담당자, 정상 tarball 보관 위치·checksum       |
| 관찰 위치          | build·runtime 로그, 알림·health 확인 위치                             |

이 항목이 비어 있으면 다른 유지보수자는 로컬 재현은 할 수 있어도 운영 복구를
완결할 수 없다. 확인되지 않은 project 이름·namespace·배포 명령을 추정하지 않는다.

## Web 배포 전 확인

```sh
bun install --frozen-lockfile
bun run check:full
bun run audit
bun run --filter @jongminchung/web build
```

마지막 명령은 테스트 fixture용 build와 별도로 일반 배포 build를 확인한다.
`PLAYWRIGHT_TEST`를 배포 환경에 설정하지 않는다. Vercel과 컨테이너의 build 출력
차이는 [next.config.ts](../../apps/web/next.config.ts)가 결정한다.

[Web workflow](../../.github/workflows/web.yml)는 검증과 주간 콘텐츠 보고서를 실행한다.
이 workflow가 성공했다는 사실만으로 운영 배포가 완료되었다고 판단하지 않는다.
실제 운영 반영 여부는 배포 시스템의 SHA·deployment ID로 확인한다.

## Vercel 또는 컨테이너 배포

Vercel의 Root Directory, install/build command, 도메인, branch 설정은
[Web 배포 계약](../../apps/web/DEPLOYMENT.md)의 값과 대조한다. Preview에서
검증한 SHA와 production에 반영할 SHA를 기록한다. `*.vercel.app`은 Tech로 연결되므로
Preview 첫 화면 확인만으로 Home·Invest 검증을 끝내지 않는다.

컨테이너는 저장소 루트 컨텍스트로 먼저 로컬 검증한다.

```sh
docker build -f apps/web/docker/Dockerfile -t jamie-web:local .
docker run --rm --name jamie-web-local -p 3000:3000 jamie-web:local
```

다른 터미널에서 [응답 진단](recovery.md)의 healthz·Host별 요청을 실행한다.
이 실행은 터미널의 `Ctrl+C`로 종료한다. 운영 image는 팀의 registry·배포 절차에 따라
게시하고 digest를 기록한다. Kubernetes manifest는 인프라 저장소가 소유하므로
실제 cluster·namespace·Deployment를 확인한 뒤 해당 운영 절차를 따른다.

배포 후 공개 도메인의 healthz, Home·Tech·Invest의 `/ko`·`/en`, 대표 본문·검색·
이미지와 `Content-Language`를 확인한다. 실패 시 마지막 정상 Vercel deployment 또는
image digest로 복구하고 같은 확인을 반복한다. 복구 위치와 조작 절차는 위 운영 기록의
실제 배포 대상을 기준으로 한다.

## 공용 패키지 게시

[Publish Packages workflow](../../.github/workflows/publish-packages.yml)는 수동 실행한다.
UI 패키지만 검증하고 게시한다.

UI는 GitHub Packages의 동일한 `1.0.0`을 삭제한 뒤 다시 게시하는 정책이다.
이전 lockfile의 integrity와 새 내용이 다를 수 있고 삭제·게시 사이에 설치가 실패할 수 있다.
게시 전에 이전 정상 tarball·checksum과 소비자 lockfile을 보관한다. Git SHA만으로는
동일한 과거 tarball을 복원했다고 증명할 수 없다.

로컬 사전 검증은 UI를 검사하는 아래 명령을 사용할 수 있다.

```sh
bun install --frozen-lockfile --ignore-scripts
bun run --filter @jongminchung/ui typecheck
bun run --filter @jongminchung/ui test:coverage
bun run --filter @jongminchung/ui test:node
bun run --filter @jongminchung/ui publish:dry-run
```

`--ignore-scripts` 설치 후 Web 작업으로 돌아갈 때는 Web `postinstall`로 MDX entry를
생성한다. dry-run의 포함 파일·ESM JavaScript·타입 선언·공개 export를 확인한다.

workflow는 UI를 Node 24·26에서 검사하고, 게시할 정확한 tarball을 먼저
만든다. 그 뒤 `GH_PAT`로 인증해
기존 버전을 삭제하고 `npm publish`로 해당 tarball을 게시한다. 게시 후 registry
integrity·깨끗한 소비자 import를 검사한다.

GitHub Actions에서 검증한 ref를 확인해 실행하고, 최종 소비자 검증
단계까지 성공했는지 확인한다. 외부 소비자는 `@jongminchung` scope의 registry 설정과
`read:packages` 권한의 classic PAT가 필요하다. 인증값은 환경에서 공급한다.
소비자가 교체본을 채택할 때는 재해석 후 lockfile을 함께 반영한다.

```sh
# 해당 패키지를 사용하는 외부 소비 저장소에서 실행
bun update --force @jongminchung/ui@1.0.0
```

소비 저장소 자체의 검사·build를 통과시켜야 교체가 완료된다.

## 게시 실패와 복구

| 실패 시점                       | 조치                                                                                                                             |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| validate 또는 tarball 생성 실패 | 삭제 단계 이전인지 로그 확인. 오류를 수정하고 같은 대상의 사전 검증 반복                                                         |
| 인증·삭제 실패                  | `GH_PAT` 존재·권한·만료와 기존 버전 상태 확인. token을 로그로 출력하지 않음                                                      |
| 삭제 후 publish 실패            | registry에서 버전 존재 여부 확인. 원인을 해결한 뒤 검증된 ref와 대상만 재실행하거나 보관한 정상 archive 복구                     |
| publish 후 소비자 검증 실패     | 게시 성공으로 종료하지 않음. tarball·registry integrity·공개 import·peer dependency를 조사하고 정상 archive 또는 수정본으로 교체 |

동일 `1.0.0` 정책에는 버전 번호를 낮추는 일반적인 rollback이 없다. 보관한 정상
archive를 같은 registry에 재게시하려면 현재 버전 처리와 게시 권한이 필요하며,
게시 후 소비자 재해석·검사를 다시 수행해야 한다. 과거 SHA로 재빌드하는 경우에도
새 tarball로 취급하고 내용과 integrity를 검증한다.

## 정기 점검

| 시점                  | 확인                                                                                |
| --------------------- | ----------------------------------------------------------------------------------- |
| 매주                  | `bun run audit`, Renovate PR, Web 예약 실행의 `content-evidence` artifact 검토      |
| 배포 전후             | SHA·artifact·실행자·확인 결과·복구 대상을 운영 기록에 추가                          |
| 의존성 갱신 시        | catalog·lockfile·peer 범위·공식 변경 내역과 [유지보수 절차](../maintenance.md) 확인 |
| 담당자 교체 시        | 새 환경에서 [첫 실행](start.md), Preview 또는 로컬 복구 연습, 계정·로그 접근 확인   |
| 명령·workflow 변경 시 | 이 문서의 입력·검사·artifact·secret 이름도 같은 PR에서 갱신                         |

주간 예약 Web 작업은 콘텐츠 근거 보고서를 생성하며 일반 Web 전체 검증과 실행
조건이 다르다. 보고서 성공을 전체 build·E2E 성공으로 해석하지 않는다.
