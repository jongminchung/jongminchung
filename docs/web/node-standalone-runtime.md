# Node.js standalone 런타임

이 저장소는 pnpm `12.15.0`으로 의존성과 workspace script를 관리하고 전역 Node.js `26.7.0`으로 Next.js 앱과 자동화 스크립트를 실행한다. `.node-version`은 CI 버전을 기록한다. 단위·통합 테스트는 Vite+의 `vp test`를 사용한다.

## 앱과 콘텐츠 CLI

- Web의 `dev`, `build`, `typecheck`는 pnpm workspace script에서 Next.js와 TypeScript CLI를 실행한다.
- `build`는 Excalidraw 자산 준비, Fumadocs entry 생성, 콘텐츠 검증, Next.js build를 수행한다.
- 콘텐츠 검증과 evidence CLI는 `node --import tsx --import ./scripts/register-content-plugin.ts`로 Node TypeScript 실행과 `fumadocs-mdx/node` 로더를 등록한다. 해당 preload는 서버 전용 CLI에서만 `server-only`를 빈 모듈로 처리한다.
- Vite+ 테스트는 `apps/web/vite.config.ts`의 `fumadocs-mdx/vite` plugin으로 같은 MDX collection을 로드한다. Next.js build는 `fumadocs-mdx/next`를 사용한다.

## 배포

Vercel은 Node.js의 관리형 Next.js output을 사용한다. 컨테이너 build는 standalone output을 만들고 `node:26.7.0-alpine`의 비루트 `node` 사용자로 `server.js`를 실행한다. Vercel과 컨테이너의 실제 실행 경로는 [Web 배포 계약](../../apps/web/DEPLOYMENT.md)을 따른다.

```sh
pnpm --filter @jongminchung/web run typecheck
pnpm --filter @jongminchung/web run test
pnpm --filter @jongminchung/web run build
pnpm --filter @jongminchung/web run start
```

공개 UI 패키지는 Node.js 24와 26에서 빌드된 export와 `source` 조건을 별도로 검증한다. Node.js·Next.js·Fumadocs를 갱신할 때는 콘텐츠 CLI, standalone 서버, Vercel Preview와 Playwright를 함께 확인한다.
