# 프론트엔드 개선 기록

- 기준일은 2026-09-05이며 현재 작업 트리의 구현과 로컬 검증을 기록함
- 검색창 JavaScript를 최초 열기 시점으로 분리하고 첫 화면 이미지의 로딩 우선순위를 명시함
- 영문에 작은 가변 폰트를 우선 적용하고 나머지 문자는 기존 dynamic subset으로 보완함
- 문서 CSS의 사용 범위를 줄이고 검색창 초점 제어를 공용 UI primitive에 위임함
- 번역 메시지의 namespace·key·locale을 TypeScript에서 검증함

## 반영한 제품 코드 개선

| 영역            | 변경                                                                 | 사용자·유지보수 영향                                                           |
| --------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Next.js         | 검색창을 `next/dynamic`으로 로드하며 기존 `preload={false}`를 유지함 | 검색하지 않는 방문자의 초기 JavaScript에서 검색창 모듈을 분리함                |
| Next.js 링크    | 카드의 미리 읽기를 포인터·키보드 초점 시점에 시작함                  | 이미지 로딩 우선순위와 문서 전체 미리 읽기를 분리하여 초기 CSS·RSC 전송을 줄임 |
| 이미지          | 첫 화면 이미지의 `eager` 옵션을 실제 `loading`과 연결함              | 높은 fetch priority와 지연 로딩이 동시에 적용되던 모순을 제거함                |
| 폰트            | 영문 Latin·기호·한국어 전환 라벨 subset을 먼저 사용함                | 영문 기호 하나 때문에 한글이 포함된 큰 subset을 요청하는 경우를 줄임           |
| React·shadcn/ui | 검색창에 `Base UI`의 `initialFocus`·`finalFocus`를 사용함            | 초점 이동의 effect·ref·animation-frame 중복 제어를 줄임                        |
| TypeScript      | `next-intl`의 `AppConfig`를 메시지 원본으로 보강함                   | 잘못된 namespace·key·locale을 컴파일 단계에서 발견함                           |
| Tailwind        | 공용 코드블록 CSS와 Tech의 Docs layout CSS를 구분함                  | 사용하지 않는 Home·Notebook·Flux layout의 utility 생성을 제외함                |
| MDX             | 데이터 추출용 CLI에서 렌더링 전용 구문 강조를 생략함                 | 콘텐츠 검사와 Next 빌드 사이의 중복 작업을 줄임                                |

- [검색창 로딩](<../../apps/web/app/(tech)/_components/SearchPalette.tsx>), [검색창 UI](<../../apps/web/app/(tech)/_components/SearchDialog.tsx>), [이미지](../../apps/web/components/EditorialImage.tsx), [폰트 재생성](../../apps/web/app/fonts/README.md)에 구현 경계를 기록함
- Invest 코드블록 CSS는 노트 본문의 layout으로 옮겨 노트 목록 링크의 미리 읽기에 포함되지 않도록 함
- [코드블록 CSS](../../apps/web/app/mdx-theme.css)는 Web 앱이 소유하며 공용 `packages/ui`에 제품별 스타일을 추가하지 않음
- `@fumadocs/tailwind`는 기존 전이 의존성 0.1.1을 직접 선언하여 사용한 typography plugin의 의존성을 명시함
- 데이터 추출 모드는 `JAMIE_MDX_METADATA_ONLY=1`인 CLI에만 적용하며 실제 Next 페이지에는 원래 구문 강조를 유지함
- 폰트 파생본은 `Jamie Latin`으로 명명하며 원본 저작권·라이선스와 가변 weight·hinting을 보존함
- 공식 API 근거는 [Next lazy loading](https://nextjs.org/docs/app/guides/lazy-loading), [Base UI Dialog](https://base-ui.com/react/components/dialog), [next-intl TypeScript](https://next-intl.dev/docs/workflows/typescript), [Tailwind source detection](https://tailwindcss.com/docs/detecting-classes-in-source-files)임

## 함께 마무리한 운영 정리

- 삭제된 파일로 향하는 문서 링크를 제거하고 완료된 0040 이슈를 아카이브로 이동함
- 주간 콘텐츠 보고서의 업로드 경로를 workspace의 실제 출력 경로로 수정함
- 보고서 파일이 누락되면 artifact 단계가 실패하도록 명시함
- 글 목록의 이미지 검사는 새 글 추가로 대상이 다음 페이지로 이동해도 탐색하도록 수정함
- 전체 MDX corpus를 처리하는 검색 통합 검사에 제한된 별도 시간 예산을 부여함

## 실제 브라우저 전송량

- Chromium의 새 context에서 `networkidle`·`document.fonts.ready` 이후 측정한 값이며 단위는 bytes임
- 영문 Tech 폰트 전송량은 이전 [실패 CI](https://github.com/jongminchung/jongminchung/actions/runs/33891316800)의 136,060에서 45,176으로 약 66.8% 감소함
- 영문 세 사이트는 폰트 요청 1개를 사용하며 한국어의 기존 92개 subset은 유지함

| 경로      | 폰트 전송 | CSS 전송 | JavaScript 전송 |
| --------- | --------: | -------: | --------------: |
| home/en   |    45,176 |   35,189 |         199,574 |
| home/ko   |   380,088 |   35,189 |         199,574 |
| tech/en   |    45,176 |   46,720 |         272,483 |
| tech/ko   |   339,656 |   46,720 |         272,483 |
| invest/en |    45,176 |   33,662 |         233,121 |
| invest/ko |   399,204 |   33,662 |         233,121 |

- 한국어 Tech·Invest의 예산은 현재 콘텐츠에 필요한 glyph 조합을 재측정해 약 4–5% 여유를 반영함
- 이 값은 초기 자산 전송량이며 실제 사용자 환경의 LCP·INP 개선율을 뜻하지 않음
- 코드블록 기본 utility는 `components` layer에서 생성하여 앱의 반응형 utility를 덮어쓰지 않도록 함

## 최종 검증

- `bun run check`를 통과했으며 Web 167개·UI 13개·Tooling 14개 테스트와 Node ESM consumer 검사를 포함함
- `PLAYWRIGHT_TEST=1 bun run --filter @jongminchung/web build`로 프로덕션 빌드를 확인함
- `bun run --filter @jongminchung/web test:e2e --workers=2`에서 82개 테스트가 모두 통과함
- 기준 화면 12개를 전후 비교하고 콘텐츠·탐색 UI 변경이 반영된 10개 snapshot을 갱신함
- 영어 검색창 chunk가 Tech의 초기 JavaScript 요청에 포함되지 않음을 확인함
- `shadcn info`의 Web·UI 설정 확인과 문서 링크 검사를 통과함
- 주간 보고서를 실제 workspace 경로에 생성하여 144개 콘텐츠 항목이 기록됨을 확인함
- 측정 환경은 Bun 1.4.1·Node 26.8.1·Playwright 1.62.1의 Chromium이며 원격 CI 재실행이나 배포 결과를 뜻하지 않음

## 다음 제품 코드 개선 우선순위

1. **Next.js의 페이지별 CSS 경계를 더 좁히는 작업이 우선임**
    - Tech 목록도 현재 같은 layout에서 Docs 관련 CSS를 받으므로 Blog·Docs 공통 shell과 문서 전용 스타일을 분리할 여지가 있음
    - App Router의 CSS 병합·페이지 전환 동작을 함께 확인해야 하므로 파일을 옮기는 것만으로 전송량 감소를 단정할 수 없음
2. **React Compiler는 상호작용이 있는 컴포넌트부터 점진적으로 확대하는 편이 적절함**
    - 현재 `annotation` 모드이며 `BrandWordmark`에만 `use memo`가 있으므로 검색·탐색 컴포넌트의 실제 재렌더링 비용을 먼저 측정할 필요가 있음
    - 기존 `useMemo`를 일괄 제거하지 않고 효과가 확인되는 범위를 선택하는 접근이 [React의 점진적 도입 안내](https://react.dev/learn/react-compiler/introduction)에 부합함
3. **TypeScript는 외부 검색 응답의 타입 단언 경계를 줄이는 작업이 남아 있음**
    - `SearchDialog`의 breadcrumb 문자열을 문서 유형으로 단언하는 부분은 알려진 유형을 판별하고 알 수 없는 값에 fallback을 제공하도록 바꿀 수 있음
    - 클라이언트에서 사용하는 판별 함수 때문에 서버 콘텐츠 schema나 Zod 전체가 포함되지 않도록 가벼운 타입 계약을 분리할 필요가 있음
4. **Tailwind·shadcn/ui는 제품 variant의 명시적인 API를 유지하는 작업이 유효함**
    - 반복되는 카드·목록의 레이아웃 선택을 이름 있는 variant로 모으면 수정 지점을 줄일 수 있음
    - `packages/ui`의 primitive와 앱의 제품 컴포넌트 경계를 유지하고 전체 CLI 재생성으로 기존 접근성·디자인 수정을 덮어쓰지 않아야 함

- 새로운 검사 수를 늘리기보다 초기 전송량·상호작용 비용·제품 컴포넌트 API를 개선하는 순서를 권장함
