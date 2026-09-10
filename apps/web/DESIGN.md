# Web 디자인 명세

- **Web은 정밀한 기술 편집과 검증 가능한 정보 전달을 공통 브랜드 원칙으로 사용함**
- **루트 `DESIGN.md`의 OpenAI 공개 참조 원칙을 Web token과 세 site 표현형으로 번역해 적용함**
- **공용 primitive와 Web 화면은 `packages/ui`의 제품 중립 semantic token을 공통 기반으로 사용함**
- **`home`·`tech`·`invest`는 접근성과 상호작용 계약을 공유하며 정보 밀도만 다르게 구성함**
- **테마 선택은 `html[data-site][data-theme]`에서 결정하고, 기본 semantic role은 모든 조합에서 완결함**
- **새 variant는 여러 사이트에서 같은 의미와 동작을 공유할 때만 공용 UI에 추가함**

## 브랜드와 표현형

- **공통 원칙은 높은 정보 신뢰도, 읽기 가능한 위계, 절제된 motion으로 정의함**
    - 장식은 내용의 구분과 탐색을 돕는 경우에만 사용함
    - `Pretendard`는 본문과 제목에 사용하고 `monospace`는 코드와 메타데이터 보조 역할로 제한함
- **`home`은 저밀도 포트폴리오의 큰 여백과 명확한 작업 위계를 사용함**
    - 프로젝트·글·원칙의 anchor와 locale·navigation 의미론은 유지함
- **`tech`는 탐색형 문서의 rail, 검색, outline, 코드 가독성을 우선함**
    - desktop rail과 mobile sheet는 같은 탐색 구조와 focus return을 유지함
- **`invest`는 일반 블로그형 본문과 문서 내 목차를 우선함**
    - MDX는 별도 요약·작성자 의견 wrapper 없이 제목과 문단이 이어지는 읽기 흐름을 사용함
- **세 사이트의 기본 surface는 OpenAI Docs형 neutral gray 계층으로 통일함**
    - `html[data-site="tech"]`와 `html[data-site="invest"]`는 light에서 white, dark에서 black page background을 공유함
    - `card`, text, border, action, focus를 포함한 semantic role은 제품별 색상 대신 같은 중립 token 값을 사용함

## 토큰 소유권과 cascade

- **primitive token은 `packages/ui/src/styles/theme.css`에서 색상·상태·반경·elevation의 실제 값을 소유함**
    - `--background`, `--foreground`, `--primary`, status, inverse, state 역할은 공용 primitive가 직접 사용 가능함
- **공용 semantic token은 `packages/ui/src/styles/tokens.css`에서 Tailwind utility와 연결함**
    - 공용 UI는 `--web-*`, `--docs-*`, `--research-*`를 직접 참조하지 않음
- **기본 디자인 theme와 global entrypoint는 `@jongminchung/ui/globals.css`가 제공하고 Web은 이를 직접 import함**
    - `packages/ui/src/styles/theme.css`는 light·dark generic semantic role을, `tokens.css`는 Tailwind mapping을, `globals.css`는 이들의 공통 entrypoint를 소유함
    - `apps/web/app/theme.css`는 Web font와 `tech`·`invest`의 동일한 neutral `--background` override만 소유함
    - Web route entry는 공용 `globals.css` 뒤에 앱 `theme.css`를 import하고 나머지 semantic role은 공용 값을 사용함
- **site-scoped alias는 site마다 필요한 도메인 역할만 추가함**
    - `home`은 custom property alias를 추가하지 않고 공용 token과 portfolio composition만 사용함
    - `tech`는 `--docs-code-*`, `--docs-nav-current*`, `--docs-outline-current*`만 사용함
    - `invest`는 별도 site alias 없이 공용 editorial token을 사용함
- **`html[data-site][data-theme]` 조합은 공용 semantic role과 해당 site alias를 완결해야 함**
    - `data-site`는 locale layout의 `<html>`이 source of truth이며 `body`에 중복 설정하지 않음
    - Home CSS는 custom property provider를 선언하지 않고, Tech·Invest CSS는 정해진 domain alias만 provider로 선언함
    - site CSS와 CSS module은 palette literal을 선언하지 않음

## 공통 사용 규칙

- **light·dark 모드는 동일한 semantic 역할을 다른 대비 값으로 제공함**
    - 색상 값을 컴포넌트나 page CSS에 직접 쓰지 않고 역할 token을 사용함
- **focus는 모든 keyboard 조작 요소에서 공용 `--ring`으로 식별 가능해야 함**
    - focus-visible outline은 배경과 충분히 분리되고 마우스 클릭에는 불필요하게 표시되지 않음
- **간격과 반경은 공용 scale과 `--radius` 계열을 사용해 화면 간 리듬을 유지함**
    - elevation은 `--elevation-*`만 사용하고 컨테이너별 그림자 값을 새로 만들지 않음
- **motion은 300ms 이하의 상태 전달에만 사용하고 reduced motion에서 제거됨**
    - hover는 색상·underline·작은 transform처럼 정보 손실 없는 변화로 제한함
- **responsive 기준은 390px, tablet, desktop 및 200% zoom에서 읽기 폭과 overflow를 확인함**
    - 본문은 overflow wrap, 표·코드는 수평 스크롤, navigation은 sheet 또는 축소 rail을 사용함

## Tailwind 클래스 적용

- 디자인 토큰을 유지하고 화면 스타일은 JSX의 `className`에 Tailwind utility로 직접 작성함.
- 제품별 표현을 위해 `data-[variant=...]`, `group-data-[variant=...]` 또는 새 CVA variant를 추가하지 않음.
- 단순한 상태 분기는 JSX 조건식과 `cn`으로 완전한 클래스 문자열을 선택함. 동적으로 클래스 이름을 조립하지 않음.
- 제품별 카드 구조는 제품 컴포넌트에서 직접 조합함. `EngineeringCard`는 Tech가 소유하고 공용 미디어·메타데이터만 재사용함. 초기 목록과 추가 로딩은 같은 카드 조합을 사용함.
- 이미 매핑된 토큰은 `rounded-md`, `rounded-lg`, `shadow-md`처럼 semantic utility로 사용함. 기존 값과 다른 크기·간격으로 바꾸는 작업은 별도의 디자인 변경으로 다룸.
- 직접 작성한 자식 요소에는 클래스를 직접 지정함. 공용 컴포넌트 내부 wrapper는 명시적인 `className` prop으로 조정하고 소비자가 DOM 구조 selector로 접근하지 않음.
- 공용 기본값의 재정의는 같은 breakpoint에서 적용함. 검색창의 기존 `max-w-xl sm:max-w-sm`을 유지하며 너비 확대는 별도 UI 변경임.
- 스타일 정리에서 `!important`를 제거할 때 기존의 실제 computed style을 소비 클래스에 보존함. 전후 production 화면과 keyboard 동작으로 확인함.
- `hover:`, `focus-visible:`, responsive 및 `aria-*`·primitive의 실제 상태 selector는 계속 사용함.

## 컴포넌트 경계

- **`packages/ui`는 제품 중립 primitive와 여러 제품에 공통인 상태 variant만 소유함**
    - `Button`, `Card`, `Badge`, `Alert`, `Table`, `Input`, `Dialog`는 semantic token으로만 확장함
- **도메인 composition은 각 route group이 소유함**
    - 문서 코드·현재 navigation·outline은 Tech composition에, source·judgment·evidence는 Invest composition에 둠
- **공통 editorial composition은 `apps/web/components/EditorialIndex.tsx`가 소유함**
    - 목록 query는 `tag`, `sort=newest|oldest`, `view=grid|list`, `page`로 URL과 동기화함
    - Tech와 Invest adapter는 같은 item contract를 제공하고 domain 전용 primitive를 추가하지 않음
- **새 공용 variant는 의미·접근성·상호작용이 세 사이트에서 같을 때만 추가함**
    - `technical`, `research`처럼 제품 표현을 담는 variant는 공용 UI에 추가하지 않음

## 품질 gate

- **변경은 token cascade와 primitive API 계약을 먼저 통과해야 함**
    - locale, navigation, theme persistence의 기존 동작을 유지해야 함
- **브라우저 검증은 axe, keyboard focus, ESC focus return, overflow, forced colors, reduced motion을 포함함**
    - 대표 route는 desktop·tablet·390px mobile과 200% zoom에서 확인함
- **visual baseline은 의도된 변경만 darwin·Linux Chromium에서 검토 후 갱신함**
    - font loading, client boundary, route별 초기 전송량, asset loading 변화를 release 전에 확인함

## 유지보수 계약과 검증

제품별 variant를 추가하지 않고 기존 computed style을 보존하도록 다음 항목을 적용함.

| 적용 항목                          | 구현·검증 위치                                                                                           | 보존하는 계약                                                                                                                                                                                            |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 직접 소유한 자식의 Tailwind 클래스 | `DocumentOutline.tsx`, `DocumentPager.tsx`, `PlatformArchitectureVisuals.tsx`                            | 목차의 선택·hover 우선순위, 빈 pager 칸의 최소 높이, 기존 selector가 덮어쓰던 다이어그램 번호의 block·색상·크기까지 보존함.                                                                              |
| 제품 selector 재도입 방지          | `packages/ui/src/architecture-contract.test.ts`                                                          | 앱의 data-variant 스타일은 차단하고 primitive의 실제 상태·size·side 및 기존 공용 API는 허용함.                                                                                                           |
| 반복 타이포그래피 토큰             | `packages/ui/src/styles/theme.css`, `tokens.css`                                                         | `text-metadata` 10px, `text-caption` 11px, `tracking-metadata` 0.08em. 기존 상속 line-height를 유지하고 일회성 카드 제목 크기는 그대로 둠.                                                               |
| 소비자의 클래스 재정의             | `packages/ui/src/lib/utils.ts`, `utils.test.ts`, `ConsumerStyleFixture.tsx`, `ui-primitives.e2e.test.ts` | 글자 크기·색상·자간 병합을 구분하고 390px·1440px에서 Dialog·Sheet·Select의 크기·반경·간격과 ESC focus 복귀를 검사함.                                                                                     |
| 실제 검색 composition 환경 검사    | `ui-primitives.e2e.test.ts`                                                                              | 390px dark, 1440px light, 1024px tablet, CSS zoom 200%, forced-colors 환경에서 긴 한글 결과·overflow·키보드 선택·ESC 복귀를 확인함. CSS zoom 검사는 OS나 브라우저 메뉴 확대를 직접 조작하는 검사가 아님. |
| shadcn 소스 갱신 기록              | [공용 UI 갱신 기록](../../packages/ui/SHADCN.md)                                                         | 29개 primitive의 보존 계약, 현재 비교 환경, 원래 registry revision 미기록 사실과 다음 갱신 시 남길 증거를 명시함.                                                                                        |

Fumadocs가 생성하는 MDX 내부 요소의 selector는 앱이 직접 소유한 JSX 자식과 구분함. `DocsMdxPrimitives`의 문단·제목 구조와 `DocsCodeBlock`의 생성된 code 요소에 대한 selector는 통합 경계로 유지함.
