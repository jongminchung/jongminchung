# shadcn 갱신 기록과 보존 계약

2026-09-06에 현재 저장소 소스를 검토해 작성했다. 구성은 `base-nova`, CSS variables, neutral, Lucide이며 Base UI 1.6.0·cmdk 1.1.1·shadcn CLI 4.17.0을 사용한다. 최초 생성에 사용한 registry revision은 기록되어 있지 않다. 이 버전을 최초 생성 버전이라고 간주하지 않는다.

`components.json`, [검토한 로컬 소스의 SHA-256 목록](./shadcn-baseline.json), 현재 Git diff를 비교의 출발점으로 사용한다. SHA-256은 이 검토 시점의 실제 파일을 식별하며 upstream hash가 아니다. 갱신 후 계약 검증을 완료했을 때 해당 파일 hash와 검토일·비교 환경을 함께 갱신한다. registry 응답은 CLI 버전을 고정해도 바뀔 수 있으므로, 갱신할 때 dry-run·diff 원문을 PR에 첨부하고 실제 사용한 registry URL·조회일·응답 SHA-256을 기록한다. 아직 조회하지 않은 upstream hash를 임의로 기록하지 않는다.

```bash
bunx --bun shadcn@4.17.0 add <component> --dry-run -c packages/ui
bunx --bun shadcn@4.17.0 add <component> --diff -c packages/ui
```

먼저 위 결과와 아래 공개 계약을 비교하고, 변경을 병합한 후 다음 검사를 수행한다.

```bash
bun run --filter @jongminchung/ui test
bun run --filter @jongminchung/ui typecheck
bun run --filter @jongminchung/web typecheck
bun run --filter @jongminchung/web test:e2e ui-primitives.e2e.test.ts
```

앱은 source 조건으로 UI를 사용하므로 갱신 검증 시 기존 production 서버를 종료하고 Playwright가 변경된 소스를 빌드하도록 한다. 화면에 영향을 주는 변경은 변경 전후 production 캡처도 비교한다.

## 컴포넌트별 보존 기준

아래 표는 현재 소스에서 확인한 계약이다. 최초 upstream 대비 변경 여부가 확인되지 않은 부분도 이후 갱신에서 보존해야 하는 동작으로 기록한다. 모든 행에 semantic token 사용, 공개 subpath import, `cn(defaults, className)` 재정의 계약이 공통 적용된다.

| 소스 (`src/components/`) | 보존할 API·동작과 이유                                                                                                                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `command.tsx`            | cmdk 기반 키보드 선택·active descendant. `CommandInput.wrapperClassName`은 wrapper, `className`은 input. Dialog의 title·description·closeLabel 계약과 일반 utility 재정의로 한국어 검색·소비자 스타일을 보존한다. |
| `dialog.tsx`             | 닫기 버튼 표시 시 `closeLabel` 필수. `initialFocus`·`finalFocus` 전달, ESC 복귀, 기본 `sm:max-w-sm` 및 같은 breakpoint 재정의를 보존한다.                                                                         |
| `sheet.tsx`              | `side`별 위치·너비·transition, 닫기 버튼 label, focus 복귀를 보존한다. 너비 재정의는 현재 `data-[side=…]`와 같은 modifier에서 비교한다.                                                                           |
| `select.tsx`             | `size`, `alignItemWithTrigger`, `positionerClassName`과 popup `className`을 구분한다. 화살표·Enter·ESC 선택과 trigger focus, size modifier의 재정의를 보존한다.                                                   |
| `dropdown-menu.tsx`      | Base UI menu·submenu의 키보드·checkbox·radio 상태와 destructive 표현을 보존한다.                                                                                                                                  |
| `button.tsx`             | native button props·disabled·aria-busy, `buttonVariants`의 링크용 스타일과 기존 size를 보존한다. 제품 variant는 추가하지 않는다.                                                                                  |
| `button-group.tsx`       | group 의미론과 orientation·인접 버튼/입력의 경계·focus 쌓임 순서를 보존한다.                                                                                                                                      |
| `badge.tsx`              | render 합성, 기존 size·variant 및 아이콘 크기 우선순위를 검토한다. 강제 중요도를 제거할 때 현재 computed size를 먼저 확인한다.                                                                                    |
| `alert.tsx`              | title·description·action 슬롯과 default/destructive 표현의 의미를 보존한다.                                                                                                                                       |
| `card.tsx`               | header·title·description·action·content·footer 슬롯과 size에 따른 간격을 보존한다.                                                                                                                                |
| `checkbox.tsx`           | mixed 상태는 Minus, checked는 Check로 표시한다. `aria-checked="mixed"`와 확장된 클릭 영역을 보존한다.                                                                                                             |
| `radio-group.tsx`        | Base UI 단일 선택·키보드 탐색과 확장 클릭 영역·invalid·disabled 상태를 보존한다.                                                                                                                                  |
| `field.tsx`              | label·description·error 연결, 빈 오류 제외·중복 오류 제거·여러 오류 목록과 role=alert를 보존한다.                                                                                                                 |
| `input-group.tsx`        | addon 정렬·control focus·invalid·disabled 상태, 클릭 시 input focus와 이벤트 취소 계약을 보존한다.                                                                                                                |
| `input.tsx`              | native input props, responsive 글자 크기, focus·invalid·disabled를 보존한다.                                                                                                                                      |
| `textarea.tsx`           | native textarea props와 field-sizing-content·최소 높이·responsive 글자 크기를 보존한다.                                                                                                                           |
| `label.tsx`              | native label의 htmlFor 전달과 disabled 표현을 보존한다.                                                                                                                                                           |
| `item.tsx`               | 정적 item의 listitem 의미론과 실행 가능한 render 합성을 구분한다. button에 listitem role을 강제하지 않는다.                                                                                                       |
| `empty.tsx`              | media·title·description·content 조합과 icon 표현의 간격을 보존한다.                                                                                                                                               |
| `popover.tsx`            | Portal·Positioner·Popup 경계와 side·align·offset을 보존한다.                                                                                                                                                      |
| `preview-card.tsx`       | 실제 anchor trigger의 href·id, inverse token, viewport 제한·긴 텍스트 줄바꿈·collisionPadding을 보존한다. 각주 미리보기의 링크 의미론을 유지한다.                                                                 |
| `scroll-area.tsx`        | Root·Viewport·Scrollbar·Thumb와 orientation에 따른 스크롤 계약을 보존한다.                                                                                                                                        |
| `separator.tsx`          | orientation과 장식 여부를 Base UI에 전달한다.                                                                                                                                                                     |
| `spinner.tsx`            | 의미 있는 spinner는 label 필수·role=status, 장식 spinner는 aria-hidden만 적용한다.                                                                                                                                |
| `table.tsx`              | native table 의미론과 바깥 수평 스크롤 컨테이너·caption을 보존한다.                                                                                                                                               |
| `tabs.tsx`               | orientation·선택 상태와 line 표현에서만 적용되는 표시기 계약을 보존한다.                                                                                                                                          |
| `toggle.tsx`             | Base UI pressed 상태와 공개 toggleVariants·size를 보존한다.                                                                                                                                                       |
| `toggle-group.tsx`       | 그룹의 선택·orientation·spacing과 자식의 size·variant 전달을 보존한다.                                                                                                                                            |
| `tooltip.tsx`            | Provider의 delay 기본값 0과 Portal 위치·trigger 합성을 보존한다.                                                                                                                                                  |

## 로컬 변경 기록

- 2026-09-06: Command의 강제 중요도를 일반 utility로 바꾸고 `wrapperClassName`을 추가했다. 앱의 실제 검색창 너비·반경은 보존한다.
- 2026-09-06: metadata 10px·caption 11px·metadata 자간 0.08em을 기존 값 그대로 semantic token으로 등록했다. `utils.ts`는 크기와 색상을 구분하고 사용자 정의 자간 충돌도 병합한다. `utils.test.ts`와 브라우저 소비자 fixture가 이를 검증한다.
- 2026-09-06: 앱의 제품별 data-variant 스타일 재도입을 architecture 검사로 차단했다. 공용 primitive 상태·size·side modifier와 기존 공용 API는 유지한다.

다음 갱신 기록에는 대상 컴포넌트, 이전 Git commit, registry URL·조회일·SHA-256, 받아들인 변경, 보존한 로컬 수정, 실행한 검사 결과를 남긴다.
