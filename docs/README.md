# 저장소 문서

이 디렉터리는 Bun 모노레포의 기술 선택, 유지보수 절차와 의사결정 기록을 관리한다.
별도 안내가 없으면 명령은 저장소 루트에서 실행한다. `plugins/go-lsp` 문서는 이 인덱스의
범위에 포함하지 않는다.

## 작업을 바로 시작하려면

AI 대화 기록 없이도 작업할 수 있도록 수정 위치, 실행 명령, 성공 판단과 복구 순서를
아래 절차에 정리한다. 처음 맡았다면 첫 실행부터 읽는다.

- [AI 없이 첫 변경 완료하기](runbooks/start.md): 도구 설치, 작업 선택, 변경별 검증과 완료 기준
- [콘텐츠 편집과 발행](runbooks/content.md): 한영 MDX, 공개 상태, 이미지 수동 준비와 발행 취소
- [블로그 글 작성하기](runbooks/write-blog.md): 필수 메타데이터와 복사 가능한 MDX 예제
- [시리즈 글 작성하기](runbooks/write-series.md): 시리즈 등록, 회차 순서와 순차 발행
- [공식 문서 작성하기](runbooks/write-docs.md): 문서 유형, 원본 근거, Sidebar와 검증 절차
- [장애 진단과 복구](runbooks/recovery.md): 설치·검사·브라우저·도메인 오류와 복구 확인
- [배포와 유지보수 인수인계](runbooks/release.md): 배포 사전 검증, 패키지 교체·복구, 운영 기록

## 유지보수

- [기술·아키텍처·유지보수 온보딩](onboarding.md): arc42·C4·PlantUML로 설명하는 전체 구조, 기술 스택, 첫 실행과 변경 검증 절차
- [유지보수 가이드](maintenance.md): 의존성, 보안, 생성물, workflow와 릴리스 운영 절차
- [프론트엔드 OSS 유지보수 권장안](frontend-oss-maintainability.md): Tailwind CSS·shadcn/ui·Base UI의 역할 경계, 공용 UI 소유권과 단계별 검증·업데이트 방안
- [기여 가이드](CONTRIBUTING.md): 개발 환경, workspace별 명령과 제출 기준
- [디자인 시스템](../DESIGN_SYSTEM.md): UI primitive·Tailwind 진입점·semantic token의 통합 소유권

## 기술 기록

- [VS Code를 주 IDE로 쓰는 실전 시리즈](vscode/README.md): IntelliJ 작업 흐름 전환, Java·TS·Go·Python, formatter·lint 충돌 방지와 공식 문서·YouTube 자료

- [프론트엔드 개선 기록](web/frontend-improvements.md): 당시 구현·측정·검증 결과와 후속 검토 후보
- [완료 기록 보관함](archive/README.md): 완료 TODO와 기존 완료 이슈 아카이브

- [ADR 0001: 공개 TypeScript 패키지 빌드를 `tsc`로 단순화](adr/0001-node-library-tsc-build.md)
- [TypeScript 7 호환성 보고서](../apps/web/content/tech/docs/ko/fe/typescript-7-compatibility.mdx): 현재 TypeScript 7 채택 근거와 재검증 기준

## 실행 이슈

- [OSS 기반 제품·유지보수 개선 이슈](issues/README.md): 현재 진행·조건부 보류 작업과 연도별 완료 이슈 아카이브

## 프로젝트 문서

- [Web 앱 구조와 직접 유지보수](web/README.md): 작업별 수정 파일, 다중 도메인 routing, 라이브러리 역할, 생성물과 오류 확인 순서
- [공용 헤더 안내](web/header-unification.md): Home·Tech·Invest 헤더 구성과 유지보수 경계
- [Web 테스트 전략](web-testing-strategy.md): Bun 내장 test runner와 Playwright의 테스트 분류 및 실행 기준
- [Web 컨테이너 배포 계약](../apps/web/DEPLOYMENT.md)
- [`@jongminchung/tooling`](../packages/tooling/README.md): Oxc 설정과 package map
