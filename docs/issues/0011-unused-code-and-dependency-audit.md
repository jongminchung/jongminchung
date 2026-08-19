# Issue 0011: 미사용 코드·export·dependency audit 도입 검토

- 상태: 제안
- 우선순위: P2
- 기준일: 2026-08-19
- 영향 범위:
  [루트 workspace](../../package.json),
  [Web package](../../apps/web/package.json),
  [Git Client package](../../apps/git-client/package.json),
  [UI package](../../packages/ui/package.json)

## 핵심 요약

- **현재 TypeScript와 Oxc는 파일 내부 오류를 잘 찾지만 도달하지 않는 entry·export·dependency까지 완전히 판별하지 않음**
- **Next route, Electron main·preload·renderer와 package subpath 때문에 일반적인 dead-code 도구는 false positive를 만들 수 있음**
- **`Knip` 같은 도구는 즉시 merge gate로 추가하지 않고 report-only pilot으로 적합성을 확인해야 함**
- **pilot의 핵심은 삭제량보다 entry point를 정확히 모델링하고 작은 allowlist를 유지하는 것임**
- **삭제는 검색·build·test로 실제 비사용을 증명한 항목만 별도 변경에서 수행함**

## 현재 문제와 근거

- **저장소에 여러 종류의 암묵적 entry point가 있음**
  - Next App Router의 route·layout·metadata file
  - Web content와 asset 생성 script
  - Electron main·preload·renderer·Forge config
  - Playwright config·reporter·fixture
  - package export map과 `source` condition
- **정적 import 횟수만으로 사용 여부를 판단하기 어려움**
  - dynamic import와 lazy dialog
  - JSON manifest가 참조하는 command
  - framework convention으로 호출되는 module
  - build·release script에서만 사용하는 dependency
- **장기적으로 feature 제거 뒤 잔여 코드가 남을 가능성이 있음**
  - component와 stylesheet가 많음
  - app·package·Electron 경계를 함께 검색해야 함
  - dependency와 devDependency 오분류도 수동 검토 대상임

## 채택할 내용

- **report-only dead-code audit를 pilot으로 실행함**
  - unused file
  - unused export
  - unused dependency와 devDependency
  - unresolved workspace entry
- **framework별 entry point를 명시함**
  - Next App Router convention
  - Electron Forge·Vite config와 main·preload entry
  - Vitest·Playwright config와 test helper
  - package export map·scripts·CSS side effect
- **결과를 세 범주로 분류함**
  - 안전하게 제거 가능
  - dynamic 또는 convention entry로 사용 중
  - 구조 개선 뒤 재검토
- **pilot 정확도가 확인된 검사만 repo-wide check 후보로 승격함**

## 채택하지 않을 내용

- **첫 실행 결과를 근거로 source를 일괄 삭제하지 않음**
- **`apps/**`, test, config 같은 넓은 glob을 allowlist로 제외하지 않음**
- **framework entry를 false positive로 남긴 채 CI failure gate를 추가하지 않음**
- **package root barrel을 추가해 도구가 export를 더 쉽게 찾도록 만들지 않음**
- **사용 여부와 별개인 공개 API 제거를 이 이슈에서 수행하지 않음**

## 실행 작업

- **도구 없이 현재 entry와 export graph를 먼저 inventory함**
- **`Knip` 또는 동등한 도구를 dependency 추가 없이 일회성 pilot으로 실행함**
- **false positive를 framework·runtime별로 분류함**
- **최소 config로 두 번째 report를 생성하고 정확도를 비교함**
- **유효한 결과를 package별 정리 이슈로 분리함**
- **지속 실행 가치가 확인되면 repo-wide audit script와 CI 주기를 별도 결정함**

## 완료 조건

- **Next·Electron·test·package entry point가 audit에서 사용 중으로 인식됨**
- **false positive allowlist가 파일 단위 또는 좁은 pattern으로 제한됨**
- **unused dependency report가 runtime과 dev dependency를 구분함**
- **삭제 후보마다 검색·typecheck·build·test 근거를 연결할 수 있음**
- **pilot 정확도가 부족하면 gate를 추가하지 않고 보류 결론을 기록함**

## 검증

- **삭제 후보가 생기면 영향받는 workspace부터 확인함**
  - `pnpm --filter <package-name> run typecheck`
  - `pnpm --filter <package-name> run test`
  - `pnpm --filter <package-name> run build`
- **entry point 변경 시 해당 runtime test를 추가함**
  - Web route는 Playwright E2E
  - Electron entry는 package·smoke test
  - package export는 dry-run tarball과 consumer import
  - 최종 `pnpm run check`
