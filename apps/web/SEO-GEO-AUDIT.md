# Web SEO·GEO 감사 보고서

## 핵심 요약

- **`tech.jamie.kr/ko/docs/fe`의 실측 Lighthouse SEO는 100점**이며 모바일 성능 60점, 데스크톱 성능 89점, 접근성 96점, 모범 사례 100점으로 측정됨
- **`claude-seo 2.2.5` 가중 평가 기준의 전체 코드 SEO Health는 약 92점으로 산정됨**
- **Tech SEO Health는 76점에서 92점, Invest SEO Health는 77점에서 93점으로 개선될 것으로 산정됨**
- **`/ko/docs/fe`의 GEO Readiness는 73점에서 84점으로 개선될 것으로 산정됨**
- **`jamie.kr/ko`는 운영 환경에서 `www.jamie.kr/ko`로 이동한 뒤 404를 반환하는 치명적 색인 차단 상태**였으며 코드에서 `www.jamie.kr` Home 라우팅과 canonical을 복구함
- **문서 중복 canonical, 구조화 데이터 부재, 발행자 엔터티 단절을 해결함**으로써 검색 엔진과 생성형 검색 시스템이 동일 문서·저자·출처를 연결할 수 있게 됨
- **모바일 성능의 최대 잔여 문제는 약 2MB인 Pretendard 가변 폰트**이며 배포 후 필드 데이터와 함께 별도 최적화가 필요함

## 같은 기준으로 현재 점수를 측정함

- **실측 점수는 Lighthouse `13.4.1`의 모바일 기본 조건과 데스크톱 preset으로 측정함**
  - 측정 시각은 2026-08-28 KST 기준임
  - PageSpeed Insights 공개 API는 할당량이 없어 동일 Lighthouse CLI와 Chrome `151`로 대체함

- **SEO Health는 `claude-seo 2.2.5`의 공개 가중치를 적용한 수동 감사 점수임**
  - Technical SEO 22%, Content Quality 23%, On-Page SEO 20%, Schema 10%, Performance 10%, AI Search Readiness 10%, Images 5% 구성임
  - `claude-seo` 런타임은 격리 환경이 설치되지 않아 자동 크롤러 대신 동일 버전의 평가 항목을 HTML·Lighthouse·저장소 증거에 적용함
  - 이 점수는 Google 또는 OpenAI가 제공하는 공식 점수가 아닌 변경 전후 비교용 지표임

- **GEO Readiness는 `claude-seo`의 다섯 항목을 그대로 적용함**
  - Citability 25%, Structural Readability 20%, Multi-Modal Content 15%, Authority & Brand Signals 20%, Technical Accessibility 20% 구성임
  - `llms.txt`는 존재 여부만 기록하고 Google 검색·인용 점수에는 가중하지 않음

| 대상                                          |    기준선 |      개선 후 | 상태                            |
| --------------------------------------------- | --------: | -----------: | ------------------------------- |
| 전체 코드 SEO Health                          |         - |           92 | 세 검색 표면의 코드 기준 예상치 |
| Home SEO Health                               | 측정 불가 |           90 | 운영 404로 기준선 비교 불가     |
| Tech SEO Health                               |        76 |           92 | 코드 기준 예상치                |
| Invest SEO Health                             |        77 |           93 | 코드 기준 예상치                |
| `/ko/docs/fe` GEO Readiness                   |        73 |           84 | 코드 기준 예상치                |
| `/ko/docs/fe` Lighthouse SEO                  |       100 |     100 예상 | 기준선 실측·배포 후 재측정 필요 |
| `/ko/docs/fe` Lighthouse Performance 모바일   |        60 | 60 기준 유지 | 잔여 개선 대상                  |
| `/ko/docs/fe` Lighthouse Performance 데스크톱 |        89 | 89 기준 유지 | 잔여 개선 대상                  |
| Home 운영 접근성                              |       404 |     200 예상 | 배포 후 확인 필요               |

## 무엇이 바뀌었는지 설명함

- **Home의 공개 기준 URL을 `https://www.jamie.kr`로 통일함**
  - `www.jamie.kr` Host를 Home으로 라우팅하고 metadata base, canonical, hreflang, sitemap, robots, Person URL을 같은 origin으로 맞춤
  - 현재 Vercel의 apex redirect가 `www`를 primary domain으로 사용한다는 운영 응답을 코드 계약에 반영함
  - 한국어·영어·`x-default` 대체 URL과 지역화된 Open Graph·Twitter 메타데이터를 추가함

- **동일 기술 문서의 canonical을 짧은 문서 URL로 통합함**
  - `/ko/docs/fe/{id}`와 `/ko/{id}`가 같은 본문을 제공하던 상태에서 canonical을 `/ko/{id}`로 통일함
  - `/docs/fe/{id}`와 `/docs/k8s/{id}` 중복 항목을 sitemap에서 제거해 검색 엔진에 상충하는 정규 URL 신호를 보내지 않게 함

- **검색 엔진이 읽을 JSON-LD 엔터티 그래프를 추가함**
  - Home에 `Person`과 `ProfilePage`를 연결함
  - Tech와 Invest에 `WebSite`와 발행자 `Person`을 연결함
  - 기술 문서에 `TechArticle`, 투자 노트에 `Article`을 추가하고 canonical URL, 발행일, 수정일, 저자, 키워드, 원자료 citation을 포함함
  - `/ko/docs/fe`에 `CollectionPage`와 포함된 canonical `TechArticle` 목록을 추가함
  - 기술 글과 투자 노트에 `BreadcrumbList`를 연결해 사이트·컬렉션·문서의 계층을 표현함

- **Invest의 모든 공개 collection을 독립적인 검색 문서로 정리함**
  - 노트 목록, 시리즈, 태그, 원자료 유형 페이지에 고유 제목·설명·canonical·언어 대체·RSS·Open Graph·Twitter 메타데이터를 추가함
  - 각 collection에 `CollectionPage` JSON-LD를 추가하고 노트 본문에서 시리즈·태그 collection으로 직접 연결함
  - `Operating notes` 표시 문자열 기반 URL을 `/series/operating-notes`로 정규화하고 기존 인코딩 URL은 영구 리다이렉트함
  - 문서가 2개 미만인 얇은 collection은 `noindex, follow`로 유지하고 sitemap 및 `hreflang` 대상에서 제외함

- **세 sitemap의 정규 URL·언어·수정일 계약을 강화함**
  - Home·Tech·Invest의 지역화 URL에 `x-default`를 추가함
  - Tech 문서와 Invest 노트·collection의 실제 수정일을 `lastModified`에 반영함
  - 중복 기술 문서와 색인 가치가 낮은 Invest collection을 sitemap에서 제거함

- **검색용이 아닌 기술 보조 화면을 색인에서 제외함**
  - 독립 diagram viewer, UI fixture, 전역 404에 `noindex`를 적용함
  - 제품 문서와 시각·테스트 보조 경로가 검색 결과에서 경쟁하지 않게 함

- **`/ko/docs/fe`의 검색 의도를 제목과 설명에 명확히 반영함**
  - 제목을 `FE Docs`에서 `프론트엔드 엔지니어링 문서`로 변경함
  - 첫 설명을 프론트엔드 문서의 정의와 실제 구현·검증 범위가 드러나는 직접 답변형 문장으로 변경함

- **모든 페이지에 기본 보안 응답 헤더를 추가함**
  - `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`를 추가함
  - Next.js 인라인 스크립트와 충돌할 수 있는 CSP는 nonce 설계 없이 임의 추가하지 않음

## `/ko/docs/fe`가 어떤 수준으로 작성됐는지 평가함

- **기본 SEO 구현은 이미 높은 수준임**
  - self canonical, 한국어·영어 hreflang, 단일 H1, 논리적인 H2 그룹, Open Graph, Twitter Card, 서버 렌더링, sitemap, robots, `llms.txt`가 존재함
  - Lighthouse SEO 100점은 이 기본 계약이 브라우저 감사 항목을 모두 통과했음을 의미함

- **문서 탐색 구조는 GEO에 유리함**
  - 프론트엔드 문서를 컴포넌트, 테스트, 성능, 유지보수로 분류해 주제 관계를 명시함
  - 각 카드가 제목과 독립 설명을 제공해 생성형 검색 시스템이 문서 범위를 추출하기 쉬움

- **기준선의 GEO 약점은 페이지 자체보다 엔터티 연결 부족에 가까움**
  - 카테고리 페이지에 저자·발행자·포함 문서 관계를 표현하는 구조화 데이터가 없었음
  - 동일 본문이 두 URL에서 각각 self canonical로 노출돼 인용 URL 선택이 분산될 가능성이 있었음
  - 카테고리 페이지의 멀티모달 콘텐츠가 제한적이어서 `claude-seo`의 Multi-Modal 항목은 낮게 유지됨

- **현재 개선 후에도 84점으로 산정한 이유는 과대평가를 피하기 위함**
  - 구조화 데이터, 계층형 breadcrumb, 직접 답변형 설명은 Citability·Authority·Technical Accessibility를 개선함
  - 독창적 도표, 원자료를 종합한 통계, 외부 브랜드 언급과 같은 인용 수요 신호는 이번 코드 변경만으로 생기지 않음

## 남은 한계와 실패 조건을 명시함

- **Home 복구는 Vercel에서 `www.jamie.kr`가 이 프로젝트에 연결돼 있다는 전제가 필요함**
  - 배포 후 `curl -IL https://jamie.kr/ko`의 최종 응답이 200이 아니면 Vercel Domain의 project 연결과 primary domain 설정을 수정해야 함

- **모바일 성능은 이번 변경의 완료 조건에 포함되지 않음**
  - 기준선에서 약 2MB Pretendard 가변 폰트가 총 전송량 대부분을 차지함
  - 단순 preload 해제 실험은 초기 렌더링을 늦출 가능성이 확인돼 반영하지 않음
  - 공식 unicode-range subset 또는 콘텐츠 빌드 시 폰트 subsetting을 도입한 뒤 한국어 glyph 누락과 시각 회귀를 함께 검증해야 함

- **구조화 데이터는 노출을 보장하지 않음**
  - JSON-LD가 유효해도 검색 순위와 AI 인용은 콘텐츠 품질, 외부 언급, 색인 상태, 쿼리 적합성에 의해 달라짐
  - 배포 후 Rich Results Test와 Search Console Enhancement·Page Indexing 보고서에서 파싱 결과를 확인해야 함

- **전체 SEO Health 92점은 배포 전 코드 예상치임**
  - Home 90점, Tech 92점, Invest 93점을 세 공개 검색 표면의 대표값으로 종합함
  - 운영 도메인의 응답, 실제 색인 선택, Core Web Vitals, 외부 인용 신호는 배포 후에만 확인 가능함

- **예상 점수의 실패 조건은 배포 후 실측 악화임**
  - Lighthouse SEO가 100 미만이거나 canonical·hreflang·JSON-LD가 운영 HTML에서 누락되면 빌드와 배포 결과가 로컬 검증과 달라진 것으로 판단함
  - Search Console의 Duplicate without user-selected canonical 수가 4주 후 감소하지 않으면 내부 링크를 canonical URL로 직접 전환하는 후속 조치가 필요함

## 결론과 실행 제안

- **우선 배포 후 Home 최종 200 응답과 `/ko/docs/fe` 운영 JSON-LD를 확인할 필요가 있음**
- **그다음 Google Search Console에서 세 도메인의 sitemap을 다시 제출하고 대표 URL 검사를 요청할 필요가 있음**
- **2주에서 4주 동안 canonical 선택, 색인 수, 검색 노출, AI referral을 기준선과 비교할 필요가 있음**
- **다음 성능 작업은 Pretendard unicode-range subset을 독립 변경으로 진행하고 모바일 Lighthouse와 시각 회귀를 함께 통과시킬 필요가 있음**
- **이번 코드 상태는 format, lint, typecheck, 단위 테스트 112개, 프로덕션 빌드, 핵심 E2E 22개를 통과함**
  - 세 sitemap의 공개 URL 126개에서 200 응답, title, description, canonical, 단일 H1, index 허용을 전수 확인함
  - 같은 URL 126개에서 Open Graph, Twitter Card, `x-default`, RSS, 파싱 가능한 JSON-LD를 전수 확인함

- 평가 기준은 [AgriciDaniel/claude-seo `2.2.5`](https://github.com/AgriciDaniel/claude-seo)와 [Google Search Central](https://developers.google.com/search/docs)을 참고함
