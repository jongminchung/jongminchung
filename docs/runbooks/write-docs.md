# 공식 문서 작성하기

이 안내에서 공식 문서는 Tech 사이트의 Docs에 제공하는 프로젝트 사용·설정·운영
문서를 뜻한다. 원본 프로젝트의 코드, 릴리스와 지원 정책을 확인하고 사용자가
실행하거나 조회할 수 있는 형태로 작성한다. 저장소 개발·기여 절차는 `docs/`에
Markdown으로 작성하고 [저장소 문서 인덱스](../README.md)에 연결한다.

## 문서 목적과 기준 정하기

| `documentKind` | 독자의 목적               | 포함할 내용                                              |
| -------------- | ------------------------- | -------------------------------------------------------- |
| `tutorial`     | 처음부터 따라 하며 배우기 | 사전 조건, 순서가 있는 실습, 단계별 예상 결과, 정리 방법 |
| `how-to`       | 특정 작업 끝내기          | 시작 조건, 실행 절차, 성공 확인, 실패 시 복구            |
| `reference`    | 정확한 값을 찾아보기      | 입력명, 타입, 기본값, 필수 여부, 제약, 버전별 차이       |
| `explanation`  | 구조와 선택 이유 이해하기 | 개념, 책임, 동작 흐름, 대안과 설계 이유                  |

한 페이지의 주된 목적에 맞춰 유형을 하나 선택한다. 작성 전에 대상 버전, 지원 환경,
원본 코드·문서의 위치를 정하고 가능하면 해당 release나 commit의 근거를 기록한다.
`sourceUrl`은 대표 원본의 인증정보 없는 HTTPS URL로 적는다. 다른 근거는 본문의
관련 설명 가까이에 추가한다. 웹 안내와 원본의 내용이 다를 때 어떤 자료를 기준으로
판단할지도 명시한다.

## 파일 위치 정하기

현재 공개 영역은 `rke2spray`, `fe`, `be`, `k8s`다. `ansible`은 schema에 있어도
현재 inventory 검증에서 콘텐츠를 허용하지 않는다. 새 영역을 만들려면 폴더 외에
영역 schema·공개 목록·탐색·routing·검증 계약을 함께 변경해야 한다.

예를 들어 rke2spray의 새 운영 안내는 아래 파일로 만든다.

```text
apps/web/content/tech/docs/ko/rke2spray/backup-verification.mdx
apps/web/content/tech/docs/en/rke2spray/backup-verification.mdx
```

공개 URL은 `/ko/docs/rke2spray/backup-verification`과 영어 대응 경로다. 영역 아래에
추가 하위 폴더를 만들지 않는다. ID는 영역을 제외한 파일명에서 계산되므로 다른
Docs 영역이나 Blog와도 중복되지 않아야 한다.

| 파일                                            | 역할과 주의점                                                                     |
| ----------------------------------------------- | --------------------------------------------------------------------------------- |
| `{locale}/index.mdx`                            | Docs 전체 개요. `documentKind`, `overview`, `area`, `id`, `locale`을 넣지 않는다. |
| `{locale}/{area}/index.mdx`                     | 영역 개요. `documentKind`가 필요하며 `overview`는 넣지 않는다.                    |
| `{locale}/{area}/<slug>.mdx`                    | 일반 문서. `documentKind`가 필요하다.                                             |
| `{locale}/{area}/<slug>.mdx` + `overview: true` | 별도 주제 개요. 내부 ID가 `<slug>-overview`가 되며 일반 문서 개수에서 제외된다.   |

`id`, `locale`, `area`는 모든 Docs에서 경로로 계산한다. 일반 페이지는 `overview`를
생략하고 `-overview`로 끝나는 파일명을 피한다. 새 글을 개수 제한에서 제외하려고
개요로 표시하지 않는다.

## 일반 문서 MDX 예제

아래 예제의 출처·날짜·내용은 실제 검증 결과로 교체한다. 이 예제는 구조를 보여주는
초안이며, 실행 가능한 운영 절차를 채운 뒤 발행해야 한다.

```mdx
---
documentKind: how-to
title: "백업 복원 가능 여부 확인하기"
description: "분리된 검증 환경에서 백업을 복원하고 정상 동작을 확인하는 절차"
publishedAt: "2026-09-06"
updatedAt: "2026-09-06"
verifiedAt: "2026-09-06"
tags: [rke2spray, backup, operations]
status: experimental
publicationStatus: draft
sourceUrl: https://example.com/project-backup-reference
---

## 목적과 적용 범위

지원 버전, 검증할 결과와 이 절차가 다루는 범위를 쓴다.

## 사전 조건

필요한 권한, 도구, 입력 파일과 검증 환경을 적는다.

## 실행 절차

실행 위치와 명령, 입력값을 바꾸는 방법, 각 단계의 예상 출력을 적는다.

## 성공 확인

복원 결과를 어떤 명령과 관찰값으로 판단하는지 적는다.

## 실패 대응과 정리

중단 조건, 재시도 전 확인 사항, 복구와 임시 자원 정리 방법을 적는다.
```

영어 파일은 같은 경로 구조로 만들고 제목·설명·본문을 번역한다. `status`, `tags`,
`documentKind`, 패키지·API 관련 필드는 한영에서 같아야 한다. Blog 전용 `thesis`,
`counterargument`, `series`, `seriesOrder`는 Docs에 추가하지 않는다.

Docs의 `verifiedAt`은 필수이며 `publishedAt <= updatedAt <= verifiedAt`이어야 한다.
본문을 바꿨다면 해당 버전의 근거와 절차를 다시 확인하고 날짜를 갱신한다. 확인하지
않은 내용을 날짜만 바꾸어 최신 문서로 표시하지 않는다.

## Sidebar와 내부 링크 연결하기

두 언어의 `{area}/meta.json`에서 `pages` 배열의 원하는 위치에 확장자를 뺀
`"backup-verification"`을 넣는다. 기존 항목을 유지하면서 관련 문서 가까이에 추가한다.
예를 들어 아래는 배열 안에 추가할 위치를 설명하는 일부 항목이다.

```json
["operations", "backup-verification", "---참조---", "compatibility"]
```

한국어·영어에서 문서 순서를 맞추고 구분선 제목은 번역한다. 영역 개요의 Cards나
다음 단계 링크에서도 새 문서를 찾을 수 있게 연결한다. 본문 링크는 파일 경로 대신
`/ko/docs/rke2spray/backup-verification`처럼 공개 URL로 쓴다.
영어 문서의 링크에는 `/en`을 사용한다.

## 검증하고 유지하기

[공통 발행 절차](content.md)에 따라 번역·링크·파일 개수·build를 검증한다. 위 예제처럼
일반 문서 한영 쌍을 추가하면 언어별 `docsPagesPerLocale`와 `docsInventoryPerLocale`를
각각 1씩 늘린다. 개요 한영 쌍이면 전체 개수만 늘린다.

로컬에서 공개 상태로 미리 볼 때 Sidebar 순서, 제목과 목차, 코드·표·Callout,
관련 문서 이동과 언어 전환을 확인한다. 실제 명령은 문서에서 명시한 검증 환경에서
실행하고 기대 결과와 비교한다. 콘텐츠 build 통과만으로 운영 절차가 검증되지는 않는다.

발행 후 버전·기본값·지원 범위가 바뀌면 해당 참조 문서와 이를 사용하는 안내를 함께
갱신한다. 폐기된 절차는 `status: deprecated`로 표시하고 대체 문서와 전환 방법을
설명한다. 이 상태도 `publicationStatus: published`면 공개되며, 비공개 전환은 별도다.
