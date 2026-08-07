# 환경 변수와 설정 보안

애플리케이션은 하나의 빌드 결과물을 모든 배포 환경에서 재사용하고, 배포마다 달라지는 설정은 런타임에 주입한다. OpenTelemetry는 OS 환경 변수 전체를 자동으로 수집하지 않는다. 환경 변수 값이 telemetry에 포함되려면 표준 설정이나 instrumentation을 통해 OpenTelemetry resource 또는 signal attribute로 명시적으로 변환되어야 한다. 비밀값은 이 동작과 별개로 노출 경로를 줄이기 위해 파일로 마운트하고 Spring Boot의 `configtree:`로 읽는 방식을 우선한다.

이 문서에서 사용하는 용어는 다음과 같다.

- **환경 변수(environment variable)**: 프로세스에 설정을 전달하는 방법이다. 예: `DB_HOST`, `MANAGEMENT_SERVER_PORT`.
- **배포 환경(deployment environment)**: `development`, `staging`, `production`처럼 배포 대상을 구분하는 값이다.
- **Spring `Environment`**: 환경 변수, 설정 파일, JVM 시스템 속성 등을 통합해서 조회하는 Spring의 설정 추상화다.
- **config tree**: 파일 이름을 설정 키로, 파일 내용을 설정 값으로 읽는 외부 설정 방식이다.
- **OpenTelemetry resource**: telemetry를 생성한 서비스, 프로세스 또는 인프라를 설명하는 공통 attribute 집합이다.
- **resource detector**: 환경 변수나 플랫폼 metadata처럼 정해진 소스에서 resource attribute를 생성하는 구성 요소다.

## 12-Factor 원칙

[The Twelve-Factor App의 Config 원칙](https://12factor.net/config)은 배포마다 달라지는 값을 코드와 분리해 환경 변수로 제공하도록 권장한다. 같은 소스와 이미지로 여러 환경을 실행할 수 있고, 설정 변경을 위해 이미지를 다시 빌드할 필요가 없기 때문이다.

환경 변수는 서로 독립적인 설정이어야 한다. `APP_ENV=production` 하나를 읽어 애플리케이션 내부에서 DB 주소, 기능 플래그, 제한값을 한꺼번에 선택하는 방식은 피한다. 배포 환경 이름은 식별과 관측을 위한 차원으로 사용하고, 실제 설정은 `DB_HOST`, `FEATURE_X_ENABLED`, `REQUEST_TIMEOUT`처럼 각각 주입한다.

12-Factor의 Config 항목을 엄격하게 해석하면 config는 환경 변수에 저장해야 하므로 config tree는 해당 항목에서 벗어난다. 다만 비밀값의 노출 경로를 줄여야 하는 현실적인 보안 요구가 더 중요할 수 있다. config tree도 같은 빌드 결과물을 유지하고 배포별 설정을 코드 밖에서 주입한다는 목적은 지키므로, 이 문서에서는 일반 설정은 환경 변수로, 비밀값은 파일로 분리한다.

권장 책임은 다음과 같다.

| 위치                                    | 용도                                                 |
| --------------------------------------- | ---------------------------------------------------- |
| `application.yaml`                      | 모든 환경에 공통이며 공개되어도 안전한 기본값        |
| OS 환경 변수, ConfigMap                 | 배포마다 달라지는 일반 설정                          |
| Vault, Kubernetes Secret, secret volume | 비밀번호, API 키, 인증서 같은 비밀값을 파일로 마운트 |
| 배포 매니페스트                         | 포트, Service, probe, 리소스 제한과 설정 주입        |
| OpenTelemetry 리소스 속성               | 서비스, 버전, 배포 환경 등 telemetry 식별 정보       |

비밀값을 이미지나 Git에 포함하지 않는다. 환경 변수를 사용할 때도 프로세스 정보, 진단 엔드포인트, 오류 로그에 값이 노출되지 않도록 해야 한다. 특히 비밀값과 개인정보는 telemetry의 resource, baggage, span, metric label 또는 log attribute로 보내면 안 된다.

## Spring Boot 설정

`src/main/resources/application.yaml`은 빌드 후 JAR의 `BOOT-INF/classes/application.yaml`에 포함된다. Spring Boot 레이어를 풀어서 만든 이미지라면 `${PROJECT_PATH}/BOOT-INF/classes/application.yaml`과 같은 위치에 배치될 수 있다. 이것은 애플리케이션의 기본값이지 배포 환경별 설정을 굽는 위치가 아니다.

Dockerfile은 설정을 직접 병합하지 않는다. Dockerfile이 `config/`를 작업 디렉터리 아래로 복사하면 실행 시 Spring Boot가 외부 설정 디렉터리를 검색하고 설정을 병합한다. 기본 검색 위치에는 현재 디렉터리와 현재 디렉터리의 `config/`가 포함된다.

자주 사용하는 설정 소스의 우선순위는 높은 순서부터 대략 다음과 같다.

1. 명령행 옵션
2. `SPRING_APPLICATION_JSON`
3. JVM 시스템 속성
4. OS 환경 변수
5. 외부의 profile별 `application-{profile}.yaml`
6. 외부의 `application.yaml`
7. JAR 내부의 profile별 `application-{profile}.yaml`
8. JAR 내부의 `application.yaml`

정확한 전체 순서는 [Spring Boot Externalized Configuration](https://docs.spring.io/spring-boot/reference/features/external-config.html)을 따른다. `spring.config.import`로 가져오는 Vault 같은 외부 저장소는 Config Data로 처리되며, import를 선언한 문서와 위치에 따라 우선순위가 정해진다. 따라서 Vault가 모든 설정 소스보다 항상 우선한다고 가정하면 안 된다. 다만 OS 환경 변수는 Config Data보다 우선한다.

`application-default.yaml`은 활성 profile을 지정하지 않았을 때 `default` profile 설정으로 읽힌다. 파일이 비어 있으면 아무 설정도 추가하지 않는다. 환경 변수를 명시할 때는 Spring Boot의 relaxed binding에 따라 점을 밑줄로 바꾸고 대문자를 사용한다.

```text
management.server.port -> MANAGEMENT_SERVER_PORT
spring.profiles.active -> SPRING_PROFILES_ACTIVE
spring.config.import   -> SPRING_CONFIG_IMPORT
```

예를 들어 `MANAGEMENT_SERVER_PORT=8090`을 주입하면 `management.server.port`를 덮어쓴다. 애플리케이션이 `8080`, 관리 엔드포인트가 `8090`에서 수신한다면 이미지 수정은 필요 없다. Kubernetes에서는 actuator probe의 포트와 관리 포트를 의도적으로 노출할 때 Service의 `targetPort`를 `8090`으로 지정한다. `containerPort` 선언은 선택 사항이지만 이름 기반 포트 참조와 문서화를 위해 실제 수신 포트와 일치시키는 것이 좋다. 로컬 Docker에서는 호스트에서 접근할 때 `-p 8090:8090`을 추가한다.

Vault를 사용하는 방법은 두 가지로 구분한다.

- 배포 플랫폼이 Vault 값을 읽어 secret volume으로 마운트한다.
- 애플리케이션이 Spring Cloud Vault를 사용하고 `SPRING_CONFIG_IMPORT=vault://`와 접속 및 인증 설정을 받아 직접 조회한다.

두 방식 모두 Dockerfile이 Vault 값을 읽는 구조는 아니다. 가능하면 짧은 수명의 워크로드 인증을 사용하고, 장기 토큰을 이미지나 일반 설정 파일에 저장하지 않는다.

## config tree로 비밀값 읽기

[Spring Boot Configuration Trees](https://docs.spring.io/spring-boot/reference/features/external-config.html#features.external-config.files.configtree)는 Kubernetes Secret, ConfigMap, Docker secret처럼 디렉터리에 마운트된 설정을 읽는다. 파일 이름은 property key가 되고 파일 내용은 property value가 된다.

다음과 같이 마운트되어 있다고 가정한다.

```text
/run/secrets/
├── db.username
├── db.password
└── external-api.token
```

`application.yaml`에서 디렉터리를 import한다.

```yaml
spring:
  config:
    import: "configtree:/run/secrets/"
```

애플리케이션에서는 기존과 동일하게 `db.username`, `db.password`, `external-api.token`을 `@ConfigurationProperties`, `@Value` 또는 Spring `Environment`로 읽을 수 있다. 값은 Spring `Environment`에는 들어가지만 OS 환경 변수에는 등록되지 않는다.

비밀값이 반드시 필요한 운영 환경에서는 `optional:`을 붙이지 않는다. 마운트 실패나 경로 오타가 있으면 애플리케이션이 즉시 시작에 실패해야 하기 때문이다. 로컬 개발처럼 파일이 없어도 되는 경우에만 다음과 같이 사용한다.

```yaml
spring:
  config:
    import: "optional:configtree:/run/secrets/"
```

Kubernetes Secret을 사용하는 예시는 다음과 같다.

```yaml
spec:
  template:
    spec:
      containers:
        - name: app
          volumeMounts:
            - name: app-secrets
              mountPath: /run/secrets
              readOnly: true
      volumes:
        - name: app-secrets
          secret:
            secretName: cloud-s3-app
```

Secret의 key가 `db.password`라면 `/run/secrets/db.password` 파일로 마운트되고 같은 이름의 Spring property로 읽힌다. 이름을 바꿔야 하면 `secret.items[].path`로 파일 경로를 명시한다. Kubernetes secret volume은 읽기 전용이며 메모리 기반 파일 시스템을 사용한다. 그래도 애플리케이션이나 같은 마운트를 받은 sidecar는 파일을 읽을 수 있으므로 필요한 컨테이너에만 마운트하고 파일 권한과 RBAC를 최소화한다. 자세한 기준은 [Kubernetes Secrets 권장 사항](https://kubernetes.io/docs/concepts/security/secrets-good-practices/)을 따른다.

마운트된 파일이 갱신되더라도 Spring Boot가 시작 시 import한 값이 자동으로 다시 bind된다고 가정하면 안 된다. Secret 회전 방식에 맞춰 애플리케이션 재시작 또는 검증된 refresh 전략을 마련한다.

## OpenTelemetry의 환경 변수 수집 방식

환경 변수는 OpenTelemetry resource가 아니다. 환경 변수의 key와 value가 resource attribute로 변환되어야 trace, metric, log와 함께 export된다. 이 변환은 애플리케이션의 OpenTelemetry SDK와 Collector에서 서로 독립적으로 일어날 수 있다.

### 애플리케이션 SDK

[OpenTelemetry Resource SDK](https://opentelemetry.io/docs/specs/otel/resource/sdk/)는 애플리케이션 프로세스의 `OTEL_RESOURCE_ATTRIBUTES`를 읽어 resource에 병합한다. `OTEL_SERVICE_NAME`은 `service.name`을 설정하는 별도 표준 환경 변수다.

```bash
OTEL_SERVICE_NAME=cloud-s3-app
OTEL_RESOURCE_ATTRIBUTES=service.version=1.2.3,deployment.environment.name=production
```

이 경우 두 환경 변수의 값은 resource attribute가 되어 애플리케이션이 생성한 telemetry와 함께 export된다. 반대로 `DB_PASSWORD`, `SPRING_DATASOURCE_PASSWORD`처럼 이름이 다른 환경 변수는 SDK가 자동으로 열거하거나 resource로 복사하지 않는다.

`OTEL_RESOURCE_ATTRIBUTES`와 `OTEL_SERVICE_NAME`을 모두 지정하지 않으면 다음과 같이 동작한다.

- 환경 변수에서 사용자 정의 resource attribute는 추가되지 않는다.
- SDK는 `telemetry.sdk.name`, `telemetry.sdk.language`, `telemetry.sdk.version` 같은 기본 attribute를 제공한다.
- `service.name`을 정하지 않으면 SDK는 `unknown_service:<process executable name>` 형식의 fallback을 사용한다. 실행 파일 이름도 알 수 없으면 `unknown_service`가 된다.
- 언어 SDK나 auto-instrumentation이 별도의 host, process, container, Kubernetes 또는 cloud detector를 활성화했다면 해당 detector가 정의한 metadata가 추가될 수 있다.
- detector는 자신이 정의한 항목만 수집하며 OS 환경 변수 전체를 자동으로 resource에 복사하지 않는다.

따라서 resource attribute가 보인다면 SDK 기본값, 명시적인 `OTEL_*` 설정, 활성화된 resource detector 또는 애플리케이션 코드 중 어느 경로에서 생성했는지 확인해야 한다.

### Collector의 environment detector

[Collector `resource_detection/env` processor](https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/processor/resourcedetectionprocessor/README.md#environment-variable)의 `env` detector도 환경 변수 전체를 읽지 않는다. Collector 프로세스에 설정된 `OTEL_RESOURCE_ATTRIBUTES` 하나만 읽어 수신한 telemetry의 resource에 추가한다.

```yaml
processors:
  resource_detection/env:
    detectors: [env]
    timeout: 2s
    override: false

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [resource_detection/env]
      exporters: [otlp]
```

동작 조건은 모두 충족되어야 한다.

1. Collector 설정의 `processors`에 `resource_detection/env`를 정의한다.
2. 처리할 trace, metric 또는 log pipeline의 `processors` 목록에 등록한다.
3. Collector 프로세스에 `OTEL_RESOURCE_ATTRIBUTES`를 설정한다.

processor를 정의만 하고 pipeline에 등록하지 않으면 실행되지 않는다. pipeline에는 등록했지만 Collector의 `OTEL_RESOURCE_ATTRIBUTES`가 없거나 비어 있으면 `env` detector가 추가할 resource attribute도 없다. Collector는 수신한 기존 resource를 그대로 다음 processor 또는 exporter로 전달한다.

애플리케이션 SDK가 생성한 resource는 trace, metric, log의 OTLP payload에 이미 포함된다. 따라서 Collector의 `env` detector를 사용하지 않아도 Collector receiver는 애플리케이션 resource를 받아 전달한다. Collector detector는 누락된 metadata를 보강하거나 정책에 따라 덮어쓰는 별도 단계다.

여기서 읽는 값은 애플리케이션이 아니라 Collector 프로세스의 환경 변수다. 애플리케이션 컨테이너와 Collector sidecar는 같은 Pod에 있어도 환경 변수를 자동으로 공유하지 않는다. DaemonSet이나 gateway Collector에 애플리케이션의 `DB_PASSWORD`가 전달되지 않았다면 `env` detector가 그 값을 읽을 수 없다.

`override`의 기본값은 `true`다. Collector에서 감지한 값이 애플리케이션 SDK가 이미 보낸 같은 key를 덮어쓰지 않게 하려면 `override: false`를 명시한다. 특히 여러 애플리케이션의 telemetry를 처리하는 gateway Collector에는 Collector 자신의 서비스 metadata를 모든 workload에 덮어쓰지 않도록 주의한다.

### `process.environment_variable.<key>`

OpenTelemetry semantic convention registry에는 [`process.environment_variable.<key>`](https://opentelemetry.io/docs/specs/semconv/registry/attributes/process/)라는 attribute 이름이 정의되어 있다. 예를 들어 `USER=ubuntu`를 수집했다면 `process.environment_variable.USER=ubuntu`로 표현하는 규칙이다.

attribute 이름이 registry에 있다는 사실은 SDK나 Collector가 해당 값을 기본 수집한다는 뜻이 아니다. 이 값이 telemetry에 나타나려면 instrumentation, custom resource detector 또는 사용 중인 receiver가 대상 환경 변수를 실제로 읽고 attribute를 만들어야 한다. `resource_detection/env` detector는 이 규칙으로 환경 변수를 열거하지 않으며 `OTEL_RESOURCE_ATTRIBUTES`만 처리한다.

환경 변수를 수집하는 custom instrumentation이 필요한 경우에도 전체 수집 대신 공개 가능한 key의 allowlist를 사용한다. 비밀번호, token, private key가 포함될 가능성이 있는 환경 변수는 `process.environment_variable.*`로 변환하지 않는다.

### 수집 경로별 결과

| 입력 또는 설정                                                       | 결과                                             |
| -------------------------------------------------------------------- | ------------------------------------------------ |
| 애플리케이션에 `DB_PASSWORD`만 설정                                  | 표준 SDK는 resource로 수집하지 않음              |
| 애플리케이션의 `OTEL_RESOURCE_ATTRIBUTES`에 `db.password` 설정       | 애플리케이션 resource로 export됨                 |
| Collector의 `OTEL_RESOURCE_ATTRIBUTES` 설정 및 `env` detector 활성화 | Collector를 통과하는 telemetry resource에 병합됨 |
| `env` detector를 pipeline에 등록하지 않음                            | Collector environment detection이 실행되지 않음  |
| `env` detector는 활성화했지만 `OTEL_RESOURCE_ATTRIBUTES`가 없음      | 새 resource attribute가 추가되지 않음            |
| custom instrumentation이 환경 변수를 attribute로 복사                | 복사한 값이 telemetry로 export됨                 |

## config tree와 OpenTelemetry의 관계

표준 OpenTelemetry 동작만 비교하면 일반 환경 변수와 config tree 모두 자동 수집 대상이 아니다. `DB_PASSWORD`를 환경 변수로 주입했다고 해서 표준 SDK나 Collector `env` detector가 자동으로 export하지는 않는다.

config tree를 사용하는 이유는 OpenTelemetry의 기본 수집을 피하기 위해서가 아니라 비밀값을 프로세스 환경과 분리해 노출 경로를 줄이기 위해서다. custom instrumentation이 환경 변수를 수집하거나 진단 도구가 프로세스 환경을 출력하더라도 config tree 파일의 값은 직접적인 수집 대상이 아니다. 다만 애플리케이션이 Spring `Environment`에서 값을 읽어 span이나 log attribute에 기록하면 config tree의 값도 동일하게 유출될 수 있다.

환경 변수와 config tree의 차이는 다음과 같다.

| 항목                    | 환경 변수              | config tree 파일                         |
| ----------------------- | ---------------------- | ---------------------------------------- |
| Spring property binding | 가능                   | 가능                                     |
| 하위 프로세스 상속      | 기본적으로 상속        | 상속하지 않음                            |
| 표준 OTel 자동 수집     | 일반 key는 수집 안 함  | 수집 안 함                               |
| custom 환경 수집 대상   | 될 수 있음             | 직접적인 대상이 아님                     |
| 접근 범위 제한          | 프로세스 환경 단위     | volume과 파일 권한 단위                  |
| 값 변경 반영            | 일반적으로 재시작 필요 | 파일은 갱신될 수 있으나 재bind 전략 필요 |

config tree도 완전한 유출 방지 수단은 아니다. 애플리케이션이 값을 로그나 telemetry attribute에 기록하면 동일하게 유출된다. config tree의 장점은 비밀값을 프로세스 환경에서 분리하고, secret volume이 필요한 컨테이너에만 파일 접근 권한을 줄 수 있다는 것이다.

## 권장 정책

다음 운영 규칙을 적용한다.

- 포트, timeout, feature flag 같은 비밀이 아닌 값은 환경 변수나 ConfigMap으로 주입한다.
- 비밀번호, API token, private key 같은 비밀값은 Secret 또는 Vault에서 파일로 마운트하고 `configtree:`로 읽는다.
- custom detector나 instrumentation으로 `process.environment_variable.*`를 만들지 않는다. 필요하면 공개 가능한 환경 변수만 allowlist로 등록한다.
- 서비스 이름은 `OTEL_SERVICE_NAME`으로 설정하고, `OTEL_RESOURCE_ATTRIBUTES`에는 `service.version`, `deployment.environment.name`처럼 공개 가능한 식별 정보만 넣는다.
- Collector의 resource detection processor를 사용한다면 적용할 각 signal pipeline에 명시하고 `override: false`를 기본 정책으로 사용한다.
- key 이름에 `password`, `secret`, `token`, `authorization`, `cookie`가 포함된 telemetry attribute는 instrumentation 단계에서 만들지 않고 Collector의 attributes, transform 또는 redaction processor로 다시 차단한다.
- 비운영 환경에서 Collector `debug` exporter로 최종 resource와 signal attribute를 확인한다.
- Spring Boot Actuator의 `env`, `configprops` 엔드포인트는 외부에 공개하지 않고 권한을 제한한다. 기본 마스킹만 보안 경계로 신뢰하지 않는다.
- 배포 전 telemetry 백엔드와 support bundle에서 알려진 테스트 secret을 검색해 유출 여부를 검증한다.

핵심은 일반 설정과 비밀값의 전달 경로를 분리하는 것이다. 12-Factor의 설정 외부화 원칙은 유지하되, telemetry 노출 가능성이 있는 비밀값은 OS 환경 변수가 아닌 제한된 파일 마운트와 config tree로 제공한다.
