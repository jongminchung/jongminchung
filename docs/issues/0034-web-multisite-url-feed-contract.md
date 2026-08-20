# Issue 0034: Web multi-site URL과 feed 계약 통합

- 상태: 진행 중
- 우선순위: P2
- 기준일: 2026-08-20
- 영향 범위:
  [site routing](../../apps/web/lib/site-routing.ts),
  [Home metadata](<../../apps/web/app/(home)/home/[locale]/layout.tsx>),
  [Tech RSS](<../../apps/web/app/(tech)/tech/[locale]/rss.xml/route.ts>),
  [Invest RSS](<../../apps/web/app/(invest)/invest/[locale]/rss.xml/route.ts>),
  [metadata route tests](../../apps/web/app/metadata-routes.test.ts)

## 핵심 요약

- **production host mapping은 `site-routing.ts`에 있지만 canonical origin은 metadata·sitemap·robots·RSS와 Home link에 반복됨**
- **Tech와 Invest RSS route가 XML escape·locale parameter·item markup·response header를 각각 구현함**
- **같은 도메인과 feed 규칙을 여러 위치에서 수정해야 하므로 site 추가·origin 변경·feed 수정 시 drift 가능성이 있음**
- **site identity와 공통 protocol helper만 통합하고 도메인별 콘텐츠 선택은 각 route에 유지해야 함**
- **CI 변경 없이 multi-domain 제품 코드의 단일 기준을 만드는 작업임**

## 현재 문제와 근거

- **site identity의 한 부분만 canonical source를 가짐**
  - `siteIds`와 production host mapping은 `site-routing.ts`가 소유함
  - `https://jamie.kr`, `https://tech.jamie.kr`, `https://invest.jamie.kr` origin은 여러 layout·sitemap·robots·RSS·component에 직접 작성됨
  - host와 origin이 다른 변경에서 독립적으로 drift할 수 있음
- **RSS protocol 구현이 두 route에 중복됨**
  - `escapeXml` 구현이 동일함
  - `ko-KR`·`en-US` language mapping과 cache header가 동일함
  - title·link·guid·description·publication date item template가 동일함
  - route별 차이는 origin·channel copy·item source뿐임
- **metadata route test가 Tech 중심으로 제한됨**
  - Tech sitemap과 robots 연결은 검증함
  - Home·Invest robots와 두 RSS feed의 escaping·language·header 계약은 직접 검증하지 않음

## 채택할 내용

- **site ID별 production identity를 한 module에서 관리함**
  - production host
  - canonical origin
  - locale cookie key와 내부 path는 기존 routing 계약을 유지함
- **RSS protocol helper를 작게 추출함**
  - XML text escaping
  - locale language tag
  - item serialization
  - channel response와 공통 cache header
- **각 route는 제품별 data selection과 channel copy만 소유함**
  - Tech는 published article selection과 최신순 정렬을 소유함
  - Invest는 published note selection을 소유함
- **robots·sitemap·RSS가 같은 site origin을 사용하는 contract test를 추가함**

## 채택하지 않을 내용

- **세 사이트의 metadata copy와 UI를 하나의 거대한 configuration object로 이동하지 않음**
- **Home·Tech·Invest route를 하나의 동적 route handler로 합치지 않음**
- **RSS library나 XML runtime dependency를 추가하지 않음**
- **현재 public URL과 cache policy를 변경하지 않음**
- **deployment·proxy·GitHub Actions 설정을 변경하지 않음**

## 실행 작업

- **`SiteId`별 production host와 origin을 제공하는 site identity 계약을 추가함**
- **기존 `resolveSite`가 같은 identity source에서 host mapping을 구성하도록 함**
- **RSS XML과 response helper를 `apps/web/lib` 내부에 추가함**
- **Tech와 Invest RSS route에서 중복 protocol 코드를 제거함**
- **metadata·sitemap·robots의 직접 origin 문자열을 site identity 참조로 단계적으로 교체함**
- **세 site origin과 두 RSS output을 fixture로 검증함**

## 완료 조건

- **production host와 canonical origin의 site별 mapping이 한 source에 존재함**
- **Tech와 Invest RSS route에 별도의 `escapeXml` 구현이 남지 않음**
- **RSS 특수문자·locale language·publication date·header가 공통 fixture를 통과함**
- **robots와 sitemap URL이 site identity origin과 일치함**
- **기존 multi-domain route와 canonical URL이 변경되지 않음**

## 검증

- `pnpm --filter @jongminchung/web run typecheck`
- `pnpm --filter @jongminchung/web run test`
- `pnpm --filter @jongminchung/web run build`
- metadata route focused test
- RSS route focused test
- `pnpm run check`
- `git diff --check`
