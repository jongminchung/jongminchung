# 1부. 스토리지 엔진

데이터베이스 관리 시스템(DBMS, Database Management System)의 주목적은 데이터를 안정적으로
저장하고 사용자에게 제공하는 것이다.

- 데이터베이스는 모듈식 시스템
  - 요청을 전달하는 전송 계층
  - 가장 효율적인 쿼리 실행을 계획을 결정하는 쿼리 프로세서
  - 실제 작업을 수행하는 실행 엔진 그리고 스토리지 엔진으로 구성됨

- 스토리지 엔진은 DBMS에서 데이터를 메모리와 디스크에 저장
  - 검색 및 관리하는 소프트웨어 컴포넌트
  - 각 노드에 데이터를 영구 저장함
  - 복잡한 쿼리를 수행할 수 있도록 데이터를 세밀하게 조작할 수 있는 간단한 API를 제공함
- 사용자는 스토리지 엔진을 사용해 레코드를 CRUD를 할 수 있음

# 1장. 소개 및 개요

**1. System Context**

```plantuml
@startuml DBMSSystemContext
!include <C4/C4_Context.puml>

LAYOUT_LEFT_RIGHT()
title DBMS 구조 - System Context

System_Ext(client, "클라이언트 애플리케이션", "SQL 명령과 트랜잭션 요청을 보낸다")
System(dbms, "DBMS", "쿼리를 최적화·실행하고 트랜잭션과 데이터를 관리한다")
System_Ext(peer, "다른 DBMS 노드", "분산 쿼리의 실행 조각을 처리한다")

Rel(client, dbms, "SQL 요청 / 실행 결과", "DB 프로토콜")
Rel(dbms, peer, "원격 실행 요청 / 결과", "클러스터 프로토콜")

SHOW_LEGEND()
@enduml
```

**2. Component**

```plantuml
@startuml DBMSComponents
!include <C4/C4_Component.puml>

LAYOUT_TOP_DOWN()
title DBMS 구조 - Component Diagram

System_Ext(client, "클라이언트 애플리케이션", "SQL 요청자")
System_Ext(peer, "다른 DBMS 노드", "분산 실행 참여자")

Container_Boundary(dbms, "DBMS 서버") {
  Boundary(transport, "트랜스포트") {
    Component(client_transport, "클라이언트 통신", "Transport Adapter", "클라이언트 연결, 인증, 요청/응답 프레이밍을 처리한다")
    Component(cluster_transport, "클러스터 통신", "Transport Adapter", "DBMS 노드 사이의 실행 요청과 결과를 전달한다")
  }

  Boundary(query_processor, "쿼리 프로세서") {
    Component(parser, "쿼리 파서", "Parser", "SQL을 검증하고 구문 트리로 변환한다")
    Component(optimizer, "쿼리 옵티마이저", "Optimizer", "실행 비용을 비교해 로컬 또는 분산 실행 계획을 만든다")
  }

  Boundary(execution_engine, "실행 엔진") {
    Component(local_execution, "로컬 실행", "Execution Engine", "현재 노드에서 실행 계획과 연산자를 수행한다")
    Component(remote_execution, "원격 실행", "Distributed Execution Coordinator", "다른 노드로 실행 조각을 보내고 결과를 병합한다")
  }

  Boundary(storage_engine, "스토리지 엔진") {
    Component(transaction_manager, "트랜잭션 매니저", "Transaction Manager", "트랜잭션을 스케줄링하고 데이터베이스 상태의 논리적 일관성을 보장")
    Component(lock_manager, "잠금 매니저", "Lock Manager", "동시 접근 잠금과 충돌을 관리")
    Component(access_method, "액세스 메소드", "Table / Index Access", "디스크에 저장된 데이터에 대한 접근 및 저장 방식으로 정의, 힙 파일과 B-트리 또는 LSM 트리 등의 자료 구조를 사용")
    Component(buffer_manager, "버퍼 매니저", "Buffer Manager", 데이터 페이지를 메모리에 캐시")
    Component(recovery_manager, "복구 매니저", "Recovery / WAL", "로그 기록과 장애 복구를 담당")
  }
}

Rel(client, client_transport, "SQL 요청 / 결과", "DB 프로토콜")
Rel(client_transport, parser, "정규화된 SQL 요청")
Rel(parser, optimizer, "구문 트리")
Rel(optimizer, local_execution, "로컬 실행 계획")
Rel(optimizer, remote_execution, "분산 실행 계획")

Rel(remote_execution, cluster_transport, "실행 조각 전송 / 결과 수집")
Rel(cluster_transport, remote_execution, "수신한 실행 요청 / 결과 전달")
Rel(cluster_transport, peer, "원격 실행 요청 / 결과", "클러스터 프로토콜")
Rel(remote_execution, local_execution, "현재 노드의 실행 조각 위임")

Rel(local_execution, transaction_manager, "트랜잭션 시작 / 커밋 / 롤백")
Rel(local_execution, lock_manager, "레코드·페이지 잠금 요청")
Rel(local_execution, access_method, "스캔 / 조회 / 삽입 / 갱신 / 삭제")

Rel(transaction_manager, lock_manager, "잠금 해제 / 트랜잭션 종료 통지")
Rel(transaction_manager, recovery_manager, "커밋·롤백 로그와 복구 요청")
Rel(access_method, buffer_manager, "페이지 읽기 / 쓰기")
Rel(access_method, recovery_manager, "데이터 변경 로그 기록")
Rel(buffer_manager, recovery_manager, "WAL 규칙에 따른 페이지 플러시 확인")

SHOW_LEGEND()
@enduml
```

## 인메모리 DBMS 대 디스크 기반 DBMS

- 인메모리 DBMS는 메모리에 데이터를 저장하고 디스크는 복구와 로그 저장 용도로 사용
- 디스크 기반 DBMS는 데이터를 디스크에 저장하고 메모리는 캐시 또는 임시 저장 용도로 사용
- OS의 메모리 추상화를 통해 개발자는 임의의 메모리 청크를 할당하고 해제하는 작업 정도로 메모리를 간단하게
  제어 가능함. 반면 디스크는 데이터 참조와 직렬화 포맷 설정, 메모리 해제, 메모리 단편화 등의 이슈를
  모두 직접 관리해야함

## 데이터 파일과 인덱스 파일

- DBMS는 데이터 파일과 인덱스 파일을 분리함
- 대부분의 최신 DBMS는 데이터를 즉시 페이지에서 삭제하지 않고 대신 키와 타임스탬프등의 삭제
  관련 메타데이터를 저장한 삭제 마커(delete marker, tombstone)를 사용함
- 수정되거나 삭제 마커로 가려진(shadowed) 레코드는 가비지 컬렉션 중에 최신 레코드로 갱신

### 데이터 파일
