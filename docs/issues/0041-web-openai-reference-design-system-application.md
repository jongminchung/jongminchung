# Issue 0041: OpenAI 공개 참조 디자인 시스템을 Web 세 사이트에 적용

- 상태: 진행 중
- 우선순위: P2
- 기준일: 2026-08-23
- 선행 이슈:
  [초기 font 전송량과 예산](0037-web-initial-font-transfer-budget.md),
  [Tech 유지보수 경계](0040-web-tech-starlight-inspired-maintainability.md)
- 영향 범위:
  [공개 참조 디자인 시스템](../../DESIGN.md),
  [Web 디자인 명세](../../apps/web/DESIGN.md),
  [공용 UI token](../../packages/ui/src/styles/theme.css),
  [공용 UI primitive](../../packages/ui/src/components),
  [Home route](<../../apps/web/app/(home)>),
  [Tech route](<../../apps/web/app/(tech)>),
  [Invest route](<../../apps/web/app/(invest)>),
  [Web E2E](../../apps/web)
- 외부 근거:
  [OpenAI Research](https://openai.com/news/research/),
  [ChatGPT Learn](https://learn.chatgpt.com/docs),
  [OpenAI Developer Blog](https://developers.openai.com/blog),
  [getdesign.md](https://getdesign.md/),
  [shadcn/ui Open Code와 Composition](https://ui.shadcn.com/docs),
  [shadcn `components.json`](https://ui.shadcn.com/docs/components-json)

## 핵심 요약

- **OpenAI 공개 화면의 정보 설계는 `DESIGN.md`에서 참조하고, 기본 theme·공용 primitive는 `packages/ui`가 소유함**
- **Web은 `@jongminchung/ui/globals.css`를 직접 import하고, Home·Tech·Invest의 표현 차이는 domain composition과 제한된 alias로 분리함**
- **`home`은 저밀도 portfolio, `tech`는 search-first documentation, `invest`는 evidence-first research로 같은 foundation을 다르게 사용함**

## 목표와 변경하지 않을 계약

- **목표는 세 사이트의 시각 언어를 통일하면서 각 제품의 정보 밀도와 독립성을 유지하는 것임**
  - neutral surface, 명확한 type hierarchy, 검색과 metadata, 제한된 interaction을 공통 기반으로 적용함
  - `home`, `tech`, `invest`의 URL, locale, canonical, navigation, MDX 콘텐츠 구조는 유지함
- **`DESIGN.md`는 공개 OpenAI 화면을 참조하는 reasoning document로 유지함**
  - 공개 화면에서 확인할 수 없는 exact palette, font metric, logo asset, animation timing은 구현 기준으로 추정하지 않음
  - OpenAI brand asset을 복제하지 않고, 프로젝트 소유 semantic token으로 같은 정보 설계 원칙만 적용함
- **`apps/web/DESIGN.md`는 Web 구현자가 참조하는 site-specific contract로 유지함**
  - root `DESIGN.md`의 foundation을 Web token, 표현형, responsive, quality gate로 번역함
- **새 component는 shadcn의 source-first·composition 원칙으로 판단하되, 실제 공유 수요가 있는 경우에만 `packages/ui`에 추가함**

## 아키텍처와 소유권

- **기본 디자인 theme와 공용 foundation은 `packages/ui`가 소유함**
  - `theme.css`는 light·dark semantic role을, `tokens.css`는 Tailwind mapping을, `globals.css`는 reset·base rule을 포함한 consumer entrypoint를 유지함
  - 현재 세 route group CSS의 `@jongminchung/ui/globals.css` 직접 import를 유지하고, `apps/web/app/global.css`와 `apps/web/app/design-theme.css`는 새로 만들지 않음
  - light·dark semantic role, keyboard·dialog·form 접근성, product-neutral primitive를 유지함
  - `Button`, `Badge`, `Alert`, `Card`, `Input`, `Dialog`, `Sheet`, `Table`은 여러 site가 같은 의미로 쓰는 variant만 제공함
- **site-scoped alias와 composition은 각 route group이 소유함**
  - Tech는 `--docs-current-nav`, `--docs-code-*`, `--docs-outline-*`와 Docs shell composition을 소유함
  - Invest는 `--research-source-*`, `--research-judgment-*`, `--research-evidence-*`와 MDX evidence composition을 소유함
  - Home은 portfolio entity와 writing metadata composition을 소유하며 custom property alias를 새로 만들지 않음
  - Tech·Invest alias는 generic semantic role을 참조할 수 있으나 primitive 값이나 theme provider를 재정의하지 않음
  - `packages/ui` 기본 theme는 다른 consumer에도 적용되므로 OpenAI 브랜드 색을 고정값으로 도입하지 않고 generic 의미·contrast 영향 검토를 선행함
- **문서와 test는 source code와 같은 변경 단위에서 유지함**
  - token 또는 primitive API를 바꾸면 `DESIGN.md`, `apps/web/DESIGN.md`, contract test를 함께 갱신함
  - visual baseline은 feature branch마다 갱신하지 않고 통합 검증 단계에서만 승인함

## 코드 예시: token cascade와 layout contract

- **generic token은 공용 UI와 Home이 직접 소비하고, Tech·Invest alias는 해당 site composition만 소비해야 함**

  ```css
  /* packages/ui/src/styles/theme.css */
  :where(:root) {
    --background: var(--neutral-0);
    --foreground: var(--neutral-950);
    --primary: var(--signal-600);
    --ring: var(--signal-600);
  }

  :where(:root[data-theme="dark"]) {
    --background: var(--neutral-950);
    --foreground: var(--neutral-50);
    --primary: var(--signal-400);
    --ring: var(--signal-400);
  }
  ```

  - primitive는 `--background`, `--foreground`, `--primary`, `--ring`처럼 제품 중립 역할만 참조함
  - 실제 primitive 값은 contrast 검토 후 결정하며 위 이름은 구조 예시임

- **세 route group은 공용 global entrypoint를 import하고 필요한 domain alias만 선언해야 함**

  ```css
  /* apps/web/app/(tech)/tech.css */
  @import "@jongminchung/ui/globals.css";

  :root[data-site="tech"] {
    --docs-current-nav: var(--primary);
    --docs-code-surface: var(--card);
    --docs-outline-current: var(--foreground);
  }

  /* apps/web/app/(invest)/invest.css */
  @import "@jongminchung/ui/globals.css";

  :root[data-site="invest"] {
    --research-source: var(--primary);
    --research-judgment: var(--foreground);
    --research-evidence: var(--border);
  }
  ```

  - Home CSS도 `@jongminchung/ui/globals.css`를 import하고 generic semantic role만 사용해 불필요한 domain token 증가를 막음
  - `data-theme`가 generic token 값을 light·dark에 맞게 전환하므로 Tech·Invest alias는 해당 역할을 참조한 채 값을 유지함
  - domain alias는 제품별 표현 차이를 제공하지만 primitive 값이나 generic theme provider를 재정의하지 않음

- **site identity는 locale layout의 `<html>`에서 한 번만 선언해야 함**

  ```tsx
  <html
    lang={locale}
    className={pretendard.variable}
    data-site="tech"
    data-theme="light"
    suppressHydrationWarning
  >
    <body>{children}</body>
  </html>
  ```

  - theme 초기화 script는 같은 `<html>`의 `data-theme`만 변경함
  - E2E는 `body[data-site]`가 아니라 `html[data-site]`를 검증함

## 코드 예시: shadcn식 source-first component 경계

- **공용 primitive는 composition 가능한 작은 API를 유지해야 함**

  ```tsx
  // packages/ui/src/components/badge.tsx
  const badgeVariants = cva("inline-flex items-center rounded-full", {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground",
        destructive: "bg-destructive/10 text-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  });
  ```

  - `research`, `technical`, `portfolio` 같은 product name을 `variant`로 추가하지 않음
  - 새 variant는 두 개 이상 site가 동일한 의미·상호작용·접근성으로 사용할 때만 추가함

- **site는 primitive를 감싸는 domain composition에서 의미를 제공해야 함**

  ```tsx
  // apps/web/app/(invest)/_components/ResearchEvidence.tsx
  export function ResearchEvidence({ source, children }: Props) {
    return (
      <section className={styles.evidence} aria-labelledby={source.id}>
        <p className={styles.source} id={source.id}>
          {source.label}
        </p>
        {children}
      </section>
    );
  }
  ```

  - Invest의 source·judgment·evidence 구분은 `Badge` variant가 아니라 semantic HTML과 `--research-*` alias가 소유함
  - Tech의 current navigation·code·outline도 같은 방식으로 docs composition이 소유함

- **contract test는 값이 아니라 cascade의 완결성과 금지 규칙을 검증해야 함**

  ```ts
  for (const theme of ["light", "dark"]) {
    expect(genericThemeBlock(theme)).toContain("--background:");
    expect(genericThemeBlock(theme)).toContain("--foreground:");
    expect(genericThemeBlock(theme)).toContain("--ring:");
  }

  expect(homeCss).not.toMatch(/^\s*--[\w-]+\s*:/mu);
  expect(techCss).not.toMatch(/^\s*--(?!docs-)[\w-]+\s*:/mu);
  expect(investCss).not.toMatch(/^\s*--(?!research-)[\w-]+\s*:/mu);
  expect(siteCss).not.toMatch(/#[\da-f]{3,8}\b|(?:rgb|hsl|oklch)\(/iu);
  ```

  - theme contract는 light·dark generic role 누락과 site CSS의 허용 범위 밖 provider·literal 회귀를 조기에 차단함
  - contrast 값 자체는 browser·axe 검증과 visual review에서 확인함

## Home·Tech·Invest 적용 계획

- **Home은 OpenAI 공개 shell의 절제와 metadata 위계를 portfolio 표현형에 적용함**
  - header·hero·project·writing·footer는 `--background`, `--card`, `--foreground`, `--muted-foreground`, `--primary`로 역할을 교체함
  - project card는 제목·category·기술·외부 action의 읽기 순서를 유지하고, 장식적 gradient·새 product variant를 추가하지 않음
  - existing anchor, locale, primary navigation, theme persistence, local font E2E를 유지함
- **Tech는 ChatGPT Learn의 search-first 문서 흐름을 현재 Docs shell에 적용함**
  - rail·context navigation·search·outline·code block에 `--docs-*` alias를 적용함
  - 검색 dialog, mobile sheet, outline active state, code copy는 focus·keyboard·scroll contract를 유지함
  - `0040`의 page model·client island 경계 작업과 충돌하지 않도록 data source와 provider ownership은 변경하지 않음
- **Invest는 Research 목록의 evidence-first metadata 흐름을 note와 MDX composition에 적용함**
  - source, summary, judgment, evidence rail의 role을 `--research-*` alias로 분리함
  - `SourceSummary`, `JamieNotes`, note header, source card는 content 구조와 disclosure 순서를 유지함
  - investment advice처럼 보일 수 있는 강조 표현이나 의미론 변경을 추가하지 않음

## TODO 체크리스트

- [ ] **Foundation owner와 token inventory를 확정함**
  - [ ] `packages/ui/src/styles/theme.css`에서 generic semantic role의 현재 owner와 누락 역할을 목록화함
  - [ ] `packages/ui/src/styles/tokens.css`의 Tailwind mapping과 generic token 목록을 동기화함
  - [ ] 세 route group CSS의 `@jongminchung/ui/globals.css` 직접 import를 유지하고 `apps/web/app/global.css`와 `apps/web/app/design-theme.css`를 추가하지 않음
  - [ ] 기본 theme 변경이 Web 외 consumer에 미치는 semantic·contrast 영향을 검토함
- [ ] **layout identity와 contract test를 이행함**
  - [ ] Home·Tech·Invest locale layout과 Tech diagram layout의 `data-site`를 `<html>`로 이동함
  - [ ] `theme-contract.test.ts`를 token cascade·literal·provider 금지 계약으로 교체함
  - [ ] site identity를 검증하는 E2E selector를 `<html>` 기준으로 교체함
- [ ] **공용 primitive의 유지보수 경계를 정리함**
  - [ ] 실제 공유 수요가 있는 status·inverse·state role만 generic token으로 추가함
  - [ ] `Button`, `Badge`, `Alert`, `Card`, `Input`, `Dialog`, `Sheet`, `Table` API의 variant 의미를 test로 고정함
  - [ ] 제품 표현 variant와 wrapper component가 `packages/ui`에 추가되지 않도록 review 기준을 적용함
- [ ] **Home 표현형을 이행함**
  - [ ] Home shell·section CSS에서 `@jongminchung/ui/globals.css`의 generic semantic role을 사용하고 custom property provider를 추가하지 않음
  - [ ] desktop·390px·dark mode에서 portfolio 읽기 흐름과 action을 검토함
- [ ] **Tech 표현형을 이행함**
  - [ ] navigation·outline·article·code·diagram CSS에서 generic role과 `--docs-*` alias만 사용함
  - [ ] search dialog·mobile sheet·outline·code copy의 keyboard와 focus return을 검토함
- [ ] **Invest 표현형을 이행함**
  - [ ] shell·note·source card·MDX evidence CSS에서 generic role과 `--research-*` alias만 사용함
  - [ ] source·summary·judgment의 semantic heading과 accessible relationship을 검토함
- [ ] **통합 품질 gate와 release evidence를 완료함**
  - [ ] darwin·Linux Chromium visual baseline을 한 번에 검토하고 승인된 diff만 갱신함
  - [ ] `bundle:report`, font transfer, client boundary, asset loading 변화를 이전 기준과 비교함
  - [ ] rollback 대상 artifact와 대표 route smoke result를 release 기록에 남김

## 검증 기준

- **token과 primitive 계약은 unit·typecheck에서 검증되어야 함**
  - 모든 generic semantic role이 light·dark에서 정의되고 Tailwind mapping을 가져야 함
  - `home | tech | invest`의 모든 `html[data-site][data-theme]` 조합이 같은 generic role을 소비할 수 있어야 함
  - Home은 provider를 선언하지 않고 Tech·Invest domain alias는 정해진 scope 밖으로 확장되지 않아야 함
- **접근성과 interaction은 브라우저 E2E에서 검증되어야 함**
  - 대표 Home·Tech·Invest route가 axe, keyboard focus, ESC close와 trigger focus return을 통과해야 함
  - forced colors와 reduced motion에서 navigation, search, code copy, overflow가 유지되어야 함
- **layout과 visual은 viewport·platform matrix에서 검증되어야 함**
  - 390px mobile, tablet, desktop, 200% zoom에서 reflow·reading measure·horizontal overflow를 확인해야 함
  - screenshot diff는 Home·Tech·Invest의 intended visual change를 설명하는 review와 함께 승인되어야 함
- **성능과 release는 production artifact를 기준으로 검증되어야 함**
  - Pretendard 요청이 same-origin을 유지하고, font 전송량은 `0037`의 예산과 함께 검토되어야 함
  - client boundary와 asset size 변화는 `bundle:report`로 비교되어야 함
  - release 전후의 theme persistence, locale, navigation, content metadata smoke를 기록해야 함

## 실행 명령과 완료 조건

- **각 단계는 가장 가까운 Web 검증을 먼저 실행해야 함**
  - `pnpm --filter @jongminchung/web run typecheck`
  - `pnpm --filter @jongminchung/web run test`
  - `pnpm --filter @jongminchung/web run build`
- **통합 전에는 production browser와 asset 검증을 실행해야 함**
  - `pnpm --filter @jongminchung/web run bundle:report`
  - `pnpm --filter @jongminchung/web run test:e2e`
- **마지막으로 저장소 전체 계약과 변경 범위를 검증해야 함**
  - `pnpm run check`
  - `git diff --check`
  - `git status --short`
- **완료는 모든 TODO와 검증 기준의 증거가 이슈에 기록된 경우에만 선언함**
  - 이슈 완료 후 반복 규칙은 `DESIGN.md`, `apps/web/DESIGN.md`, source code, test 중 적절한 canonical owner로 승격함
