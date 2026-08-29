# 저장소 문서

이 디렉터리는 pnpm 모노레포의 기술 선택, 유지보수 절차와 의사결정 기록을 관리한다.
별도 안내가 없으면 명령은 저장소 루트에서 실행한다. `plugins/go-lsp` 문서는 이 인덱스의
범위에 포함하지 않는다.

## 유지보수

- [기술 스택과 공식 문서](technology-stack.md): 기반 도구와 외부 직접 의존성의 현재 버전·용도·공식 문서
- [유지보수 가이드](maintenance.md): 의존성, 보안, 생성물, workflow와 릴리스 운영 절차
- [프론트엔드 OSS 유지보수 권장안](frontend-oss-maintainability.md): Tailwind CSS·shadcn/ui·Base UI의 역할 경계, 공용 UI 소유권과 단계별 검증·업데이트 방안
- [루트 기여 가이드](../CONTRIBUTING.md): 개발 환경, workspace별 명령과 제출 기준
- [디자인 시스템](../DESIGN_SYSTEM.md): UI primitive·Tailwind 진입점·semantic token의 통합 소유권

## 기술 기록

- [ADR 0002: 공개 TypeScript 패키지 빌드를 `tsc`로 단순화](adr/0002-node-library-tsc-build.md)
- [TypeScript 7 호환성 보고서](typescript-7-compatibility-report.md): 현재 TypeScript 6 정책과 재검증 기준

## 실행 이슈

- [OSS 기반 제품·유지보수 개선 이슈](issues/README.md): 현재 진행·조건부 보류 작업과 연도별 완료 이슈 아카이브

## 프로젝트 문서

- [Web 앱 구조](web/README.md): 다중 도메인 routing, 콘텐츠 생성, 화면 계층, 테스트와 배포 경계
- [Web 테스트 전략](web-testing-strategy.md): Next.js 공식 Vitest·Playwright 가이드에 따른 Web 테스트 분류와 실행 기준
- [Web 컨테이너 배포 계약](../apps/web/DEPLOYMENT.md)
- [`@jongminchung/tooling`](../packages/tooling/README.md): Oxc 설정과 package map
