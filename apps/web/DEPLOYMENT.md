# Web 배포 계약

## Vercel

- Vercel project는 GitHub의 `jongminchung/jongminchung` repository를 연결하고 Root Directory를 `apps/web`으로 설정함
- Framework Preset은 `Next.js`를 사용하고 install command는 `bunx bun@1.4.0 install --frozen-lockfile`, build command는 `bun run build`를 사용함
- Install Command에서 저장소 기준과 같은 Bun `1.4.0`을 직접 실행해 `bun.lock` 형식 호환성을 보장함
- `vercel.json#bunVersion`의 `1.x` 설정으로 build와 Next.js Function runtime에 Vercel 관리형 Bun 1을 사용함
- `*.vercel.app` preview·production hostname은 Tech 사이트로 제공함
- `tech.jamie.kr`은 Vercel project의 domain으로 연결하며 DNS와 domain verification은 Vercel dashboard에서 관리함
- `jamie.kr`, `www.jamie.kr`, `invest.jamie.kr`을 같은 project에 추가하며 Home의 primary domain은 `www.jamie.kr`로 유지함
- Production Branch는 `main`으로 설정하고 pull request deployment는 Preview 환경으로 유지함
- Fumadocs 검색 Route Handler, OG image, RSS와 `llms.txt`는 정적 export로 변환하지 않고 Vercel의 Next.js runtime에서 제공함
- Vercel build는 managed Next.js output을 사용하고 `output: "standalone"`은 Container build에서만 사용함

Repository를 Vercel에 import한 뒤 다음 경로로 배포 결과를 확인함

```sh
curl --fail https://<project>.vercel.app/ko
curl --fail https://<project>.vercel.app/en
curl --fail https://<project>.vercel.app/ko/series/frontend-maintainability
```

## Container

- 하나의 컨테이너가 `jamie.kr`, `www.jamie.kr`, `tech.jamie.kr`, `invest.jamie.kr`의 원래 `Host` 헤더를 받음
- Ingress는 원래 `Host`를 보존하며 애플리케이션은 `Forwarded`와 `X-Forwarded-Host`를 라우팅 입력으로 사용하지 않음
- `/ko`와 `/en` 응답은 URL과 일치하는 `Content-Language`를 제공함
- Kubernetes Ingress·Service·Deployment는 인프라 저장소에서 관리함
- 컨테이너는 공식 Bun 이미지의 비루트 `bun` 사용자로 `0.0.0.0:3000`에서 standalone 서버를 실행함
- readiness와 liveness probe는 Host에 의존하지 않는 `GET /healthz`를 사용함
- 로컬 이미지는 저장소 루트 컨텍스트와 `apps/web/docker/Dockerfile`로 생성함
- Fumadocs Config API가 `source.config.ts`에서 `.source`를 생성하며 `build`가 항상 최신 entry를 다시 생성함
- PlantUML은 빌드 중 Kroki를 호출하지 않고 deflate·base64url로 인코딩된 `https://kroki.io/plantuml/svg/*` 이미지 URL로 출력함
- 문서 독자의 브라우저가 Kroki 이미지를 조회하므로 외부 Kroki 장애는 빌드 실패가 아니라 이미지의 대체 텍스트 표시로 격리됨

```sh
docker build -f apps/web/docker/Dockerfile -t jamie-web .
docker run --rm -p 3000:3000 jamie-web
curl --fail http://127.0.0.1:3000/healthz
curl --fail -H 'Host: jamie.kr' http://127.0.0.1:3000/ko
curl --fail -H 'Host: www.jamie.kr' http://127.0.0.1:3000/ko
curl --fail -H 'Host: tech.jamie.kr' http://127.0.0.1:3000/ko
curl --fail -H 'Host: invest.jamie.kr' http://127.0.0.1:3000/ko
```

## 응답 보안 헤더 소유권

정적 방어 헤더의 canonical owner는 application의 `next.config.ts`다.
Vercel과 Container 모두 같은 설정에서 `X-Content-Type-Options: nosniff`,
`X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy: camera=(), geolocation=(), microphone=()`를 제공한다.
`poweredByHeader: false`로 standalone에서도 framework 헤더를 제거한다.
Ingress와 CDN은 이 헤더를 보존하며 별도 override를 추가할 때는 이 계약과 응답 검증을 함께 변경한다.
TLS 종료와 HSTS는 배포 계층의 책임이며 application에서 preload를 선언하지 않는다.

2026-09-06 공개 Home·Tech·Invest `/ko` 응답 점검에서는 모두 200과 위 네 헤더를
확인했으며 `X-Powered-By`, CSP, CSP Report-Only는 관찰되지 않았다.
이 측정만으로 배포 대시보드의 추가 header override 유무를 확정할 수는 없다.
로컬 HTML·RSS·검색·OG·robots·sitemap 응답은 `app/security-headers.e2e.test.ts`로 검증한다.

CSP는 현재 보류한다. Next hydration과 theme 초기화의 inline script,
Excalidraw 지연 로드, Kroki 이미지 source가 있어 검증 없이 enforce하지 않는다.
Report-Only pilot은 보고 수집 위치·보존 정책과 운영 담당자가 정해지고 실제 browser source
inventory를 확보했을 때 재개한다. nonce를 위해 전체 route를 동적으로 바꾸거나
`unsafe-inline`을 최종 정책으로 고정하지 않는다.
