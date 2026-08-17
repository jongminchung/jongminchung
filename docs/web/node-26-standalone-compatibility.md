# Node 26 standalone 호환성

- **Node 26의 `require(esm)` 지원이 Next standalone output의 불완전한 `@swc/helpers` 추적과 충돌함**
- **standalone 서버는 `--no-require-module`로 CommonJS export 경로를 사용하도록 고정함**
- **로컬 `start`와 Docker `CMD`는 동일한 Node 옵션을 사용해야 함**
- **직접 의존성 추가나 standalone 의존성 수동 복사는 해결책으로 사용하지 않음**

## 문제와 근거

- **Node 26은 동기 ESM graph를 `require()`로 로드하는 기능을 기본 제공함**
  - 근거: Node는 이 기능이 예상치 못한 문제를 일으키면 `--no-require-module`로 비활성화할 수 있다고 안내함
  - 참고: [Node.js CommonJS modules](https://nodejs.org/api/modules.html), [Node.js CLI](https://nodejs.org/api/cli.html)

- **Next standalone output에는 `@swc/helpers`의 `cjs` 경로만 포함되는 경우가 있음**
  - 근거: Node 26의 `module-sync` 조건은 `esm/_interop_require_default.js`를 선택하지만 해당 파일이 standalone output에 없음
  - 결과: 옵션 없이 standalone `server.js`를 실행하면 `MODULE_NOT_FOUND`로 시작 단계에서 실패함

## 결정과 구현

- **Web의 `start`는 `node --no-require-module .next/standalone/apps/web/server.js`를 실행함**
  - 효과: `@swc/helpers`가 standalone output에 존재하는 CommonJS export를 선택하게 됨
  - 범위: 앱 코드의 ESM 사용 여부를 바꾸지 않고 standalone 서버의 `require()` 해석만 제한함

- **Docker runtime은 `node --no-require-module server.js`를 실행함**
  - 효과: 로컬 `start`, Playwright web server, 배포 컨테이너의 동작을 일치시킴
  - 범위: Dockerfile은 `apps/web/docker`에 두되, monorepo 의존성을 읽도록 저장소 루트 build context를 유지함

- **다음 대안은 적용하지 않음**
  - `@swc/helpers`를 직접 dependency로 선언하지 않음
    - 이유: Next standalone file tracing의 누락을 직접 dependency로 해결한다는 보장이 없음
  - `.next/standalone`에 ESM 파일을 수동 복사하지 않음
    - 이유: 생성물 구조에 결합돼 Next 업데이트마다 유지보수 비용이 발생함

## 검증 기준

- **standalone 시작과 HTTP 계약을 확인해야 함**
  - 명령: `pnpm --filter @jongminchung/web run build` 후 `pnpm --filter @jongminchung/web run start`
  - 사례: `/healthz`는 200, `Host: tech.jamie.kr` 문서는 200, 제거된 `/materials/*`는 404여야 함

- **배포와 브라우저 경계를 확인해야 함**
  - 명령: 사전 기동 서버 없이 `pnpm --filter @jongminchung/web run test:e2e`
  - 사례: Playwright가 clean build의 standalone `start`를 직접 기동하고 E2E 전체를 통과해야 함
  - 명령: `docker build -f apps/web/docker/Dockerfile -t jamie-web .` 후 `docker run --rm -p 3000:3000 jamie-web`
  - 사례: 컨테이너에서도 health와 Host 기반 route가 같은 응답을 제공해야 함

## 재검토 조건

- **Next.js 업데이트 후 standalone output에 `@swc/helpers/esm`이 정상 포함되는지 확인해야 함**
  - 조건이 충족되면 `--no-require-module` 제거 여부를 Docker·로컬 시작·E2E 기준으로 재검토함
