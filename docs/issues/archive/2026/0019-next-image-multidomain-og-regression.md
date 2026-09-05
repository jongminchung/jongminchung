# Issue 0019: 다중 도메인 OG 이미지와 Next Image 회귀 해소

- 상태: 완료
- 완료일: 2026-08-20
- 최종 갱신 커밋: `7f4a72b`
- 우선순위: P0
- 기준일: 2026-08-19
- 기준 commit: `f8ece16`
- 영향 범위:
  [DocumentCard](<../../../../apps/web/app/(tech)/_components/DocumentCard.tsx>),
  [site proxy](../../../../apps/web/proxy.ts),
  [OG route](<../../../../apps/web/app/(tech)/tech/og/[locale]/[...slug]/route.tsx>),
  [Web E2E](<../../../../apps/web/app/(tech)/document-discovery.e2e.test.ts>)
- 참고 OSS:
  [Next.js Image](https://nextjs.org/docs/app/api-reference/components/image),
  [Next.js source](https://github.com/vercel/next.js)

## 핵심 요약

- **`DocumentCard`의 `<img>`를 최적화된 `<Image>`로 바꾼 뒤 모든 문서 카드 OG 이미지가 깨짐**
- **Web E2E 전체 결과는 `36 passed / 11 failed`이며 이 중 문서 카드·Tech visual 9개 실패에서 깨진 `/og/...` source가 직접 확인됨**
- **원인은 공개 경로 `/og/...`가 요청의 `Host`를 기준으로 `/tech/og/...`에 rewrite되는 반면 Image optimizer의 내부 source 요청은 같은 site 문맥을 보존하지 못하는 구조임**
- **responsive CSS를 사용하는 이미지에 `sizes`가 없어 optimizer가 최대 `3840px` 후보까지 생성하는 별도 전송량 회귀도 있음**
- **동적 OG route가 이미 정확한 `1200×630` 이미지를 생성하므로 우선 `unoptimized`로 원본 경로를 보존하는 방식이 가장 작은 수정임**

## OSS 기준에서 달라진 동작

- **Next.js `<Image>`는 기본 loader를 사용할 때 `src`를 `/_next/image?...`로 바꾸고 최적화 서버가 원본을 다시 읽음**
    - 현재 proxy는 `/_next/`를 공용 asset으로 처리해 site rewrite를 적용하지 않음
    - 원본 `/og/...`는 `tech.jamie.*` Host 문맥이 있을 때만 내부 `/tech/og/...` route로 연결됨
    - 실행 결과 optimizer는 원본 응답을 이미지로 판별하지 못하고 `received null` 오류를 기록함
- **Next.js는 CSS로 responsive 크기를 만드는 이미지에 `sizes` 사용을 요구함**
    - `DocumentCard`는 featured·related·mobile에서 `width: 100%`를 사용함
    - `sizes`가 없으면 browser는 `100vw`를 가정하며 현재 E2E DOM에는 `w=3840` 후보가 생성됨
- **Next.js 16의 `preload` prop 사용 자체는 올바름**
    - 실제 LCP 이미지가 정상적으로 제공된다는 전제가 먼저 충족되어야 함
    - 여러 카드 전체가 아니라 featured 한 장만 preload하는 현재 범위는 유지 가능함

## 현재 저장소에서 확인한 증거

- **기능 E2E가 변경된 DOM 계약을 감지함**
    - 기대 `src`: `/og/ko/deep-dive/typescript-7-compatibility`
    - 실제 `src`: `/_next/image?url=%2Fog%2F...&w=3840&q=75`
- **production standalone server가 반복 오류를 출력함**
    - `The requested resource isn't a valid image for /og/... received null`
    - 한국어·영어 handbook과 deep-dive 카드 전체에서 동일하게 발생함
- **visual E2E에서 카드 이미지가 깨진 placeholder로 렌더링됨**
    - 문서 랜딩과 관련 문서 화면의 screenshot이 크게 달라짐
    - 기존 snapshot 갱신으로 승인할 수 있는 의도된 시각 변경이 아님
- **typecheck·unit test·production build만으로는 이 회귀가 드러나지 않음**
    - 세 검사는 모두 통과함
    - 실제 Host 기반 standalone browser 실행에서만 source fetch 계약이 깨짐

## 채택할 내용

- **우선 `<Image unoptimized>` 또는 동등한 raw loader로 기존 공개 OG 경로를 그대로 요청함**
    - width·height는 layout shift 방지를 위해 유지함
    - featured 카드의 preload 필요성은 실제 LCP 측정으로 유지 여부를 확인함
    - raw source를 사용할 때 불필요한 optimizer `srcset`을 생성하지 않음
- **optimizer를 유지하려면 site identity를 잃지 않는 명시적 source URL 계약을 먼저 설계함**
    - production·localhost의 세 Host를 모두 다뤄야 함
    - 내부 `/tech/...` 경로를 공개 우회 경로로 노출하지 않아야 함
    - cache key와 canonical public URL이 site별로 일관되어야 함
- **E2E assertion을 구현 문자열과 실제 사용자 결과로 나눔**
    - 공개 `src` 또는 loader 계약을 의도적으로 검증함
    - `naturalWidth > 0`과 broken image 부재를 함께 검증함
    - visual snapshot은 이미지가 정상 복구된 뒤에만 비교함

## 채택하지 않을 내용

- **깨진 이미지를 의도된 Next.js DOM 변경으로 보고 snapshot만 갱신하지 않음**
- **`/_next/image` 요청에 임의의 Host를 주입해 세 site 중 하나로 고정하지 않음**
- **문서별 OG source를 static file로 중복 생성하지 않음**
- **모든 Web 이미지를 전역 `images.unoptimized`로 바꾸지 않음**

## 완료 조건

- **세 Host에서 문서 카드 이미지의 `naturalWidth`와 `naturalHeight`가 0보다 큼**
- **standalone server log에 `/og/...` image optimizer 오류가 없음**
- **featured·list·related·mobile 카드가 기존 비율과 crop을 유지함**
- **Web E2E 47개가 의도되지 않은 snapshot 갱신 없이 통과함**
- **optimizer를 유지할 경우 responsive `sizes`와 실제 전송 폭의 근거가 있음**

## 검증

- **가까운 정적·browser 검증을 순서대로 실행함**
    - `pnpm --filter @jongminchung/web run typecheck`
    - `pnpm --filter @jongminchung/web run test`
    - `pnpm --filter @jongminchung/web run build`
    - `pnpm --filter @jongminchung/web run test:e2e`
- **세 개발 Host에서 직접 image response를 확인함**
    - `jamie.localhost`
    - `tech.jamie.localhost`
    - `invest.jamie.localhost`
- **최종 `pnpm run check`, `git diff --check`, `git status --short`를 실행함**

## 구현 결과

- **Host 문맥이 필요한 OG 카드 이미지만 `unoptimized`로 전환함**
- **공개 `/og/...` URL과 `1200×630` natural size를 E2E에서 함께 검증함**
- **문서 카드 이미지 변경 자체는 snapshot 갱신 없이 통과했으며 현재 Web E2E 50개가 통과함**
