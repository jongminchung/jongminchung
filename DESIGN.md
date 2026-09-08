# OpenAI 공개 참조 디자인 시스템

- **이 문서는 OpenAI의 공개 Research·ChatGPT Learn·Developer Blog 화면에서 관찰한 정보 설계 원칙을 제품 설계에 적용하기 위한 참조 계약임**
- **문서형·연구형·개발자형 화면은 같은 foundation을 공유하고, 탐색 밀도와 콘텐츠 조합만 다르게 적용함**
- **브랜드 모사보다 명확한 위계, 빠른 검색, 맥락 보존, 검증 가능한 메타데이터를 우선함**
- **색상값·서체·로고 같은 공식 brand asset은 별도 사용 권한과 최신 가이드가 확인될 때만 확정함**
- **이 문서는 OpenAI의 내부 디자인 시스템이나 공식 brand guideline을 주장하지 않으며, 공개 화면 기반의 구현 지침임**

## 참조 범위와 관찰 근거

- **Research는 분류·필터·정렬·media 표시를 통해 많은 항목을 탐색 가능하게 구성함**
  - 상단에는 `Company`, `Research`, `Product`, `Safety`, `Engineering`, `Security` 등 주제 분류를 제공함
  - 목록 항목에는 제목, 콘텐츠 유형, 발행일을 함께 제공해 최신성과 성격을 빠르게 판단하게 함
  - 근거는 [OpenAI Research](https://openai.com/news/research/) 공개 화면에 있음
- **ChatGPT Learn은 전역 제품 전환, 문서 검색, 계층형 sidebar를 함께 제공함**
  - 검색 진입점과 suggested query를 먼저 배치해 긴 문서 트리보다 목표 탐색을 우선하게 함
  - `Get started`, `Core concepts`, `Production`처럼 독립적인 정보 묶음을 명시적으로 구분함
  - 근거는 [ChatGPT Learn](https://learn.chatgpt.com/docs) 공개 문서에 있음
- **Developer Blog는 최신 글과 topic taxonomy를 함께 제공해 학습 경로와 최신성을 연결함**
  - `API`, `Apps SDK`, `Audio`, `Codex`, `Agents`, `Evals` 같은 topic을 재사용 가능한 탐색 축으로 사용함
  - 글 목록은 날짜·제목·요약·topic을 조합해 맥락을 잃지 않도록 구성함
  - 근거는 [OpenAI Developer Blog](https://developers.openai.com/blog) 공개 화면에 있음

## 핵심 원칙

- **기본 화면은 중립적 surface와 강한 텍스트 대비로 정보 자체를 전면에 둠**
  - 색상은 상태·선택·행동을 구별하는 역할에 한정하고, 카드마다 다른 장식색을 사용하지 않음
- **탐색은 전역 제품 영역, 현재 섹션, 현재 문서의 세 수준으로 분리함**
  - 전역 전환은 제품군을 바꾸고, sidebar는 문서·주제를 바꾸며, outline은 현재 페이지 안에서 이동하게 함
- **검색은 보조 기능이 아니라 정보 구조의 첫 진입점으로 취급함**
  - keyboard shortcut, 검색어 제안, 결과 유형·섹션 표시는 검색 속도와 신뢰도를 함께 높임
- **콘텐츠 카드는 메타데이터를 생략하지 않고, 제목보다 약한 위계로 제공함**
  - type, topic, date, reading context는 카드·목록·문서 header에서 일관된 순서로 배치함
- **UI는 정적인 shell을 유지하고, 상태 변화는 필요한 부분에만 적용함**
  - filter, dialog, navigation sheet, copied state처럼 사용자가 행동한 결과만 즉시 피드백함

## 토큰 계층과 소유권

- **primitive token은 실제 색상·font·spacing·radius·motion 값을 소유함**
  - `--color-neutral-*`, `--color-signal-*`, `--space-*`, `--radius-*`, `--font-*`, `--duration-*`처럼 값 중심 이름을 사용함
- **semantic token은 UI 역할을 소유하고 primitive를 직접 노출하지 않음**
  - `--surface-page`, `--surface-raised`, `--text-primary`, `--text-secondary`, `--border-subtle`, `--focus-ring`을 기본 역할로 사용함
- **domain token은 Research·Learn·Developer Blog의 의미 차이만 표현함**
  - `--research-type`, `--docs-current-nav`, `--docs-code-surface`, `--blog-topic`처럼 페이지 조합이 필요로 하는 역할만 정의함
- **component token은 반복되는 component 내부 간격과 상태만 소유함**
  - `--nav-height`, `--sidebar-width`, `--content-measure`, `--card-padding`처럼 component contract가 필요한 경우에만 사용함
- **페이지와 CSS module은 색상 literal 또는 provider 재정의를 선언하지 않음**
  - 표현 변경은 semantic 또는 domain alias를 통해서만 수행함

## Foundation

- **색상은 neutral foundation, signal action, semantic status의 세 계층으로 구성함**
  - `--surface-page`는 읽기 흐름을 방해하지 않는 기본 바탕을 제공함
  - `--surface-raised`와 `--surface-selected`는 카드·현재 항목·sheet처럼 계층을 구별할 때만 사용함
  - `--text-primary`, `--text-secondary`, `--text-tertiary`는 제목·본문·메타데이터의 대비 차이를 유지함
  - `--action-primary`, `--action-primary-hover`, `--focus-ring`은 행동과 keyboard focus를 명확하게 구별함
  - `--status-success`, `--status-warning`, `--status-danger`, `--status-info`는 상태 전달에만 사용함
- **타이포그래피는 하나의 sans-serif 본문 체계와 제한된 monospace 보조 체계로 구성함**
  - `--font-sans`는 UI·제목·본문에 사용하고, 별도 라이선스가 없는 경우 system sans fallback을 사용함
  - `--font-mono`는 code, command, API field, timestamp처럼 고정폭이 의미를 높이는 영역에만 사용함
  - `--type-display`는 page title에만 사용하고, 과도한 굵기·자간 효과로 정보 위계를 대체하지 않음
  - `--type-body`는 긴 문서에서 읽기 폭과 line-height를 우선해 설정함
- **간격은 compact control과 spacious reading의 두 리듬을 함께 제공함**
  - control 내부는 `4px` 기반 scale을 사용해 filter·button·input의 밀도를 유지함
  - 문서 본문과 section 사이에는 더 큰 scale을 사용해 제목·코드·표의 경계를 분명하게 함
- **radius와 elevation은 구조를 보조하고 장식으로 사용하지 않음**
  - button·input은 작은 radius, card·dialog·sheet는 중간 radius를 사용함
  - elevation은 overlay·dialog·mobile navigation처럼 실제 layer가 겹칠 때만 사용함
- **motion은 120–200ms 범위의 상태 전달을 기본으로 함**
  - `prefers-reduced-motion`에서는 transition과 scroll animation을 제거하거나 즉시 완료함

## 표현형

- **Research 표현형은 밀도 높은 index와 evidence-first 목록을 사용함**
  - page header 아래에 topic filter, sort, media toggle을 제공함
  - result card는 `type → date → title → summary` 순서로 읽히게 구성함
  - featured 항목은 크기·배치로만 구분하고, 다른 카드와 다른 의미론을 만들지 않음
- **Learn 표현형은 task-first documentation과 깊은 탐색을 사용함**
  - global product switcher, search, section tabs, sidebar, article outline의 역할을 분리함
  - article header는 title, 설명, 업데이트 정보, 관련 action을 포함함
  - code, table, callout은 본문 흐름을 끊지 않도록 semantic surface와 horizontal overflow 규칙을 공유함
- **Developer Blog 표현형은 최신성·주제·실용성을 연결하는 editorial feed를 사용함**
  - recent post와 topic filter를 함께 제공하고, topic은 재사용 가능한 taxonomy로 관리함
  - post card는 날짜·topic·제목·한 문장 요약을 제공함
  - topic page와 detail page는 같은 metadata 순서와 card anatomy를 유지함

## 컴포넌트 계약

- **`global-header`는 제품군 전환과 계정·주요 action을 제공함**
  - 현재 제품은 text와 accessible current state로 구분하고, 색상만으로 선택 상태를 전달하지 않음
- **`docs-search`는 검색 shortcut, input, suggestion, 결과 그룹을 제공함**
  - dialog를 닫을 때 trigger로 focus를 반환하고, keyboard로 suggestion과 result를 탐색 가능하게 함
- **`section-tabs`와 `topic-filter`는 URL state와 동기화되는 단일 선택 control로 구성함**
  - 선택된 항목에는 `aria-current` 또는 적절한 `aria-selected`를 제공함
- **`content-card`는 type·topic·date·title·summary의 안정된 순서를 제공함**
  - card 전체가 link일 때 중첩 interactive element를 만들지 않음
- **`article-header`는 제목, 설명, metadata, action을 단일 읽기 흐름으로 제공함**
  - timestamp는 사람이 읽을 수 있는 문자열과 machine-readable `datetime`을 함께 제공함
- **`code-block`은 language label, copy action, horizontal scroll, focusable scroll region을 제공함**
  - code line wrap으로 의미가 변할 수 있는 경우 wrap 대신 수평 스크롤을 사용함
- **`callout`은 info·warning·success·danger의 제품 중립 variant만 제공함**
  - research, docs, blog의 표현형 차이는 class가 아니라 domain alias로 조정함
- **`mobile-navigation-sheet`는 desktop sidebar와 같은 navigation tree를 사용함**
  - ESC close, focus trap, close 이후 trigger focus return을 필수 계약으로 함

## 접근성과 반응형 기준

- **모든 색상 조합은 WCAG AA 대비를 충족해야 함**
  - 현재 navigation, selected filter, code copy state, disabled control은 색상 외 텍스트·icon·border·position 변화를 함께 제공함
- **keyboard focus는 page 전체에서 동일한 `--focus-ring` 역할로 보임**
  - focus는 clipped container 밖에서도 식별 가능해야 함
- **문서는 390px mobile, tablet, desktop, 200% zoom에서 읽기 폭을 유지해야 함**
  - sidebar는 mobile sheet로 전환하고, table·code·wide visualization은 내부 scroll container를 사용함
- **검색·dialog·sheet는 semantic role과 announcement를 제공해야 함**
  - 비동기 결과·오류·재시도 상태는 `aria-live` 또는 적절한 status role로 전달함

## 구현과 검증 순서

- **첫 단계는 token map과 공용 primitive contract를 정의하는 작업임**
  - 현재 제품의 palette를 바꾸기 전에 semantic token과 Tailwind mapping의 소유권을 확정함
- **두 번째 단계는 navigation·search·content card의 공통 anatomy를 구현하는 작업임**
  - Research·Learn·Blog 표현형은 이 contract 위에서 composition만 다르게 적용함
- **세 번째 단계는 각 표현형의 정보 밀도와 metadata 규칙을 이행하는 작업임**
  - route group별 CSS와 E2E만 수정하고 shared foundation의 소유자를 분리함
- **최종 단계는 keyboard, forced colors, reduced motion, visual baseline, bundle 영향 검토임**
  - 의도된 visual diff만 승인하고, 실제 구현 후 source page와의 불필요한 brand 혼동이 없는지 다시 검토함

## `apps/web` 적용과 유지보수 원칙

- **`DESIGN.md`는 AI agent와 개발자가 같은 UI 판단을 재사용하게 하는 설계 입력으로 사용함**
  - `getdesign.md`가 제안하는 색상·타입·간격·컴포넌트와 그 이유를 함께 기록하는 방식을 따름
  - 새로운 page는 이 문서의 token·component·표현형 규칙을 먼저 참조하고, 개별 화면에서 시각 규칙을 발명하지 않음
- **`packages/ui`는 기본 디자인 theme와 generic primitive의 canonical source로 유지함**
  - `@jongminchung/ui/globals.css`는 `theme.css`, `tokens.css`, reset·base rule을 묶어 모든 소비자가 import하는 기본 entrypoint로 제공함
  - `Button`, `Badge`, `Card`, `Alert`, `Input`, `Dialog`, `Sheet`, `Table`은 제품 중립 semantic role과 접근성 동작만 소유함
  - `home`, `tech`, `invest`의 표현 차이는 `apps/web` route composition과 domain alias에서 소유함
  - 기본 theme 변경은 Web 외 소비자에도 영향을 주므로 generic 역할의 의미와 contrast를 먼저 검토하고, OpenAI brand palette를 제품 전체에 강제하지 않음
- **shadcn의 Open Code 원칙은 복사 설치가 아니라 source-first 유지보수 방식으로 적용함**
  - component를 외부 package wrapper로 감싸지 않고 현재 `packages/ui/src/components`에서 직접 읽고 수정 가능하게 유지함
  - 공용 component API는 `className`, `render`, `data-slot`, typed variant처럼 일관된 composition surface를 유지함
- **shadcn의 distribution 원칙은 registry 도입 전에 source ownership과 API 안정성으로 적용함**
  - 외부 consumer가 생기기 전에는 `components.json` registry나 별도 install workflow를 추가하지 않음
  - 공유 수요가 확인되면 component dependency·alias·설치 규칙을 schema로 공개하는 별도 이슈로 분리함
- **token과 component 변경은 문서·test·visual evidence를 함께 갱신하는 방식으로 유지보수함**
  - semantic token 추가는 light·dark contract와 Tailwind mapping test를 동반함
  - primitive variant 추가는 두 개 이상 site에서 같은 의미·상호작용·접근성 계약을 공유할 때만 허용함
  - visual baseline은 domain 이행이 완료된 뒤 한 번에 검토하며, 단일 component 변경마다 자동 갱신하지 않음

## `apps/web` 표현형 매핑

- **Home은 OpenAI 공개 화면의 절제된 shell을 저밀도 portfolio 위계에 적용함**
  - `--background`, `--card`, `--foreground`, `--muted-foreground`, `--primary`를 직접 사용해 hero·project·writing·footer의 역할을 정의함
  - Home 전용 component는 project index·writing metadata처럼 portfolio 의미가 있는 composition만 소유함
- **Tech는 Learn의 search-first documentation과 계층형 navigation을 적용함**
  - `--docs-current-nav`, `--docs-code-*`, `--docs-outline-*` alias는 공용 semantic role을 참조해 rail·search·outline·code의 역할만 구분함
  - `DocsShell`, `SearchDialog`, `DocumentOutline`, `DocsCodeBlock`은 기존 locale·keyboard·focus return 계약을 유지함
- **Invest는 Research의 evidence-first card와 metadata 순서를 적용함**
  - `--research-source-*`, `--research-judgment-*`, `--research-evidence-*` alias는 공용 semantic role을 참조해 source·판단·근거를 분리함
  - `SourceSummary`, `JamieNotes`, evidence rail은 MDX 의미 구조를 보존하며 시각 차이만 적용함
- **Tech와 Invest의 editorial 목록·상세는 `apps/web/components/Editorial.tsx`의 공통 composition을 사용함**
  - `EditorialHeader`, `EditorialIndex`, `EditorialCard`, `EditorialArticle`, `EditorialFooter`는 Web 레이어가 소유하며 `packages/ui` primitive로 승격하지 않음
  - 두 도메인은 content adapter와 문구·실제 탐색 링크만 제공하고 카드의 type·date·title·summary 읽기 순서를 공유함
  - card media는 항목 ID·제목·태그로 결정되는 추상 SVG이며 외부 브랜드 자산이나 로고를 복제하지 않음

## 외부 참조의 적용 한계

- **`getdesign.md`는 `DESIGN.md` 작성 방식의 참조이고, 이 저장소의 디자인 token 원본이 아님**
  - 근거는 [getdesign.md](https://getdesign.md/) 공개 안내에 있음
- **shadcn은 유지보수 방식의 참조이고, 현재 UI primitive를 교체하라는 지시가 아님**
  - shadcn은 component library가 아니라 수정 가능한 component code를 만드는 방식이라고 설명함
  - 근거는 [shadcn/ui 소개](https://ui.shadcn.com/docs)와 [components.json](https://ui.shadcn.com/docs/components-json) 공식 문서에 있음

## 금지 사항

- **OpenAI의 로고, wordmark, 독점 서체, 승인되지 않은 brand asset을 제품 자산처럼 복제하지 않음**
  - 외부 공개 페이지는 정보 설계 참조이며 brand license의 근거가 아님
- **공개 화면만으로 정확한 hex, font metric, animation timing을 확정하지 않음**
  - 값이 필요한 경우 프로젝트의 contrast·accessibility 기준으로 정하고, 별도 디자인 review에서 승인함
- **Research·Docs·Blog의 정보 구조를 장식 중심 landing page로 단순화하지 않음**
  - filter, search, taxonomy, metadata, reading context를 유지해야 함
- **제품별 표현을 공용 primitive variant에 추가하지 않음**
  - `research`, `documentation`, `developer-blog`은 route composition의 책임으로 유지함

## 참조

- OpenAI Research (https://openai.com/news/research/)
- ChatGPT Learn (https://learn.chatgpt.com/docs)
- OpenAI Developer Blog (https://developers.openai.com/blog)
