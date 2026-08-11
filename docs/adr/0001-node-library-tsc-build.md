# ADR 0001: 공개 TypeScript 패키지 빌드를 `tsc`로 단순화

- 상태: 승인
- 결정일: 2026-08-11

## 배경

- 공개 Node 패키지: `@jongminchung/remark-plantuml`, `@jongminchung/tooling`
- 지원 runtime: Node.js 24 이상
- JavaScript 계약: ESM 전용, named export 전용
- 기존 빌드: `tsdown`의 `unbundle` 모드
- 실제 사용 기능: ESM JavaScript 생성, declaration 생성, `dist` 정리, CSS·JSON 복사
- 사용하지 않은 기능: 번들링, 코드 축소, CommonJS 출력, 빌드 플러그인
- 유지보수 문제:
  - TypeScript 외 별도 빌드 도구와 전이 의존성 관리 필요
  - declaration 생성 경로에서 `rolldown-plugin-dts`와 TypeScript compiler 결합 추가
  - 단순 자산 복사를 위한 build hook 유지 필요

## 결정

- 공통 `tsconfig.library.json` 사용
  - `module`: `NodeNext`
  - `moduleResolution`: `NodeNext`
  - `target`: `ES2024`
  - `declaration`: `true`
  - `noEmitOnError`: `true`
- 패키지별 `tsconfig.build.json` 사용
  - 공개 entry point만 `files`에 명시
  - `rootDir`: `src`
  - `outDir`: `dist`
- package build 순서
  - 현재 package의 `dist`만 정리
  - `tsc -p tsconfig.build.json` 실행
- JavaScript 배포 계약 유지
  - `type: "module"`
  - `engines.node: ">=24.0.0"`
  - `exports`의 `import` 조건만 사용
  - CommonJS·`require` 조건·JavaScript `default` fallback 미제공
- CSS·JSON 자산
  - tarball에 포함된 `src` 원본을 공개 subpath가 직접 참조
  - 공개 package specifier 유지
  - 별도 복사 단계 미사용

## 결과

- 장점:
  - `tsdown`과 `rolldown-plugin-dts` 의존성 제거
  - TypeScript compiler를 JavaScript와 declaration의 단일 생성 경계로 사용
  - 공개 entry와 배포 대상의 대응 관계 명시
  - 자산 복사 hook과 중복 산출물 제거
- 비용:
  - 브라우저용 단일 파일 미제공
  - 코드 축소 미수행
  - CommonJS 소비자 미지원
  - 비표준 소스 변환 미지원
- 호환성:
  - 공개 함수·타입·subpath specifier 변경 없음
  - CSS·JSON의 tarball 내부 위치만 `dist`에서 `src`로 변경

## 검토한 대안

- `tsdown` 유지
  - 현재 사용하지 않는 번들러 기능에 비해 의존성과 compiler 결합 비용이 큼
  - 채택하지 않음
- 다른 번들러로 교체
  - 동일한 불필요한 도구 계층을 다시 추가함
  - 채택하지 않음
- TypeScript 소스만 배포
  - Node.js 외 소비 도구와 declaration 소비 계약을 불필요하게 제한함
  - 채택하지 않음

## 번들러 재도입 조건

- 브라우저·CDN용 단일 파일을 직접 배포해야 함
- ESM 외 CommonJS·IIFE·UMD 또는 runtime별 출력을 공식 지원해야 함
- Vue·Svelte 같은 framework compile이나 macro·code generation이 필요함
- WASM·CSS Module·비표준 자산 변환이 필요함
- 측정된 package 크기·network·시작 성능 문제가 번들링이나 축소로 개선됨
- 조건 충족 시 새 ADR과 소비자 회귀 검증을 함께 추가함

## 검증 기준

- 두 package의 build·typecheck·test 통과
- tarball에 ESM JavaScript·declaration·원본 자산 포함
- Node.js 24 소비자에서 named import 성공
- CommonJS `require()` 거부
- CSS·JSON subpath 해석과 원본 내용 일치
- 공개 package export와 API 유지

## 참고 문서

- [TypeScript declaration](https://www.typescriptlang.org/tsconfig/declaration.html)
- [TypeScript NodeNext module reference](https://www.typescriptlang.org/docs/handbook/modules/reference.html#node16-node18-node20-nodenext)
- [Node.js package entry points](https://nodejs.org/docs/latest-v24.x/api/packages.html#package-entry-points)
- [Node.js ECMAScript modules](https://nodejs.org/docs/latest-v24.x/api/esm.html)
- [tsdown unbundle mode](https://tsdown.dev/options/unbundle)
