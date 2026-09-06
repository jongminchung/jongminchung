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

## 현재 상태 — 2026-09-06 작업 트리

- **`site-routing.ts`의 `siteOrigins`가 production origin의 단일 기준이며 production host mapping도 여기서 파생됨**
    - Home·Tech·Invest의 layout·sitemap·robots·RSS와 Home 외부 링크가 이를 참조함
    - `createRobotsResponse`와 `getLocaleProtocol`도 공통 helper로 사용함
- **Tech·Invest RSS의 `escapeXml`, item·channel serialization과 cache header는 각 route에 남아 있음**
- **origin 통합은 반영됐지만 RSS protocol 통합과 공통 fixture 검증이 남아 있어 진행 중 상태를 유지함**
- 이 절은 소스 대조 결과이며 운영 응답을 검증한 기록은 아님

## 최초 문제와 근거 — 2026-08-20

- production host mapping만 `site-routing.ts`에 있고 origin 문자열은 metadata·sitemap·robots·RSS·Home 링크에 반복됐음
- Tech·Invest RSS는 XML escape·locale language·item markup·response header를 각각 구현했음
- metadata route 검증은 Tech 중심이어서 세 사이트와 두 RSS의 공통 protocol 계약을 충분히 검증하지 못했음

## 남은 작업의 근거

- 두 RSS route에 별도의 `escapeXml`과 동일한 item template·cache header가 남아 있음
- 현재 metadata route test는 Tech sitemap·robots와 Invest sitemap을 검사하지만 Home·Invest robots와 두 RSS의 escaping·language·header 공통 fixture는 없음
- 도메인별 콘텐츠 선택과 channel 문구는 각 route에 두고 공통 XML·response 규칙만 추출해야 함

## 채택한 방향

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

## 실행 작업과 남은 범위

- [x] `SiteId`별 production origin을 `siteOrigins`로 제공함
- [x] 기존 `resolveSite`가 같은 origin에서 파생된 host mapping을 사용함
- [ ] RSS XML과 response helper를 `apps/web/lib` 내부에 추가함
- [ ] Tech와 Invest RSS route에서 중복 protocol 코드를 제거함
- [x] metadata·sitemap·robots·RSS와 Home 링크가 `siteOrigins`를 참조함
- [ ] 세 site origin과 두 RSS output을 fixture로 검증함

## 완료 조건

- **production host와 canonical origin의 site별 mapping이 한 source에 존재함**
- **Tech와 Invest RSS route에 별도의 `escapeXml` 구현이 남지 않음**
- **RSS 특수문자·locale language·publication date·header가 공통 fixture를 통과함**
- **robots와 sitemap URL이 site identity origin과 일치함**
- **기존 multi-domain route와 canonical URL이 변경되지 않음**

## 현재 재검증

- `bun run --filter @jongminchung/web typecheck`
- `bun run --filter @jongminchung/web test`
- `bun run --filter @jongminchung/web build`
- metadata route focused test
- RSS route focused test
- `bun run check`
- `git diff --check`
