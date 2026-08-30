import styles from "./PlatformArchitectureVisuals.module.css";

type ArchitectureLocale = "en" | "ko";
type C4Level = "container" | "context";

interface ArchitectureVisualProps {
  readonly locale: ArchitectureLocale;
}

interface C4ArchitectureMapProps extends ArchitectureVisualProps {
  readonly level: C4Level;
}

interface NodeCopy {
  readonly detail: string;
  readonly name: string;
}

const copy = {
  en: {
    pause: "Pause motion",
    c4: {
      context: {
        eyebrow: "C4 · Level 1 · System context",
        ariaLabel:
          "C4 system context showing an operator changing the jamie-kr-gitops environment repository, rke2spray converging an RKE2 cluster, and Argo CD reconciling workloads",
        operator: {
          name: "Platform operator",
          detail: "Reviews desired state and runs guarded operations",
        },
        environment: {
          name: "jamie-kr-gitops",
          detail: "Owns environment inventory and Kubernetes desired state",
        },
        engine: {
          name: "rke2spray",
          detail: "Interprets Kubespray-shaped input as an RKE2 lifecycle",
        },
        cluster: {
          name: "RKE2 platform",
          detail: "Runs Kubernetes API, Argo CD, platform and data workloads",
        },
        external: {
          name: "External systems",
          detail: "GitHub, DNS, TCP load balancer and managed NFS",
        },
        legend:
          "Arrows show control and reconciliation relationships, not runtime packet flow",
      },
      container: {
        eyebrow: "C4 · Level 2 · Containers and ownership",
        ariaLabel:
          "C4 container view showing inventory and Vault, rke2spray, the RKE2 API, Argo CD bootstrap, and GitOps applications",
        nodes: [
          {
            name: "Inventory + Vault",
            detail: "Hosts, topology and protected bootstrap inputs",
          },
          {
            name: "rke2spray",
            detail:
              "Ansible playbooks, roles, validation and lifecycle adapters",
          },
          {
            name: "RKE2 API",
            detail: "Server, embedded etcd, Cilium and native add-ons",
          },
          {
            name: "Argo CD bootstrap",
            detail: "Projects, repository credentials and Root Application",
          },
          {
            name: "GitOps applications",
            detail: "Platform, data, observability, storage and routes",
          },
        ],
        legend:
          "The ownership boundary changes at Kubernetes API readiness; it does not disappear",
      },
    },
    flow: {
      eyebrow: "Animated runtime view · two reconciliation engines",
      ariaLabel:
        "Animated sequence from a reviewed environment change through rke2spray convergence, Kubernetes readiness, Argo CD reconciliation, and verification",
      stages: [
        { name: "Review", detail: "Inventory and manifests" },
        { name: "Converge", detail: "Ansible + RKE2" },
        { name: "Ready gate", detail: "API, nodes and add-ons" },
        { name: "Reconcile", detail: "Argo CD sync waves" },
        { name: "Verify", detail: "Health and disruption contracts" },
      ],
      legend:
        "Animation explains order only; each transition is gated by executable checks",
    },
    observability: {
      pipeline: {
        eyebrow: "Observability runtime · authenticated durable path",
        ariaLabel:
          "Telemetry pipeline from workload and Kubernetes sources through the OpenTelemetry Gateway and ClickStack ingestion queues into ClickHouse hot storage and SeaweedFS S3 cold storage",
        stages: [
          {
            name: "Sources",
            detail: "Application OTLP, node logs and cluster metrics",
          },
          {
            name: "OTel Gateway ×2",
            detail: "Batch, retry and 1Gi PVC queue per replica",
          },
          {
            name: "ClickStack ingest ×2",
            detail: "Bearer auth and 1Gi PVC exporter queue",
          },
          {
            name: "ClickHouse ×3",
            detail: "ReplicatedMergeTree on hot durable-rwo volumes",
          },
          {
            name: "SeaweedFS S3",
            detail: "Private gateway ×3 and 001 two-copy cold volumes",
          },
        ],
        legend:
          "NetworkPolicies restrict each hop; k8s.cluster.name is added while SDK service.namespace is preserved",
      },
      lifecycle: {
        eyebrow: "ClickHouse lifecycle · compression and cold tier",
        ariaLabel:
          "Telemetry storage lifecycle from initial ClickHouse ingestion through ZSTD recompression, S3 cold movement, and deletion",
        stages: [
          {
            name: "Day 0",
            detail: "Ingest replicated telemetry into the hot volume",
          },
          {
            name: "Hot window",
            detail: "Query recent parts from local ClickHouse PVCs",
          },
          {
            name: "Day 2",
            detail: "Recompress eligible parts with ZSTD level 3",
          },
          { name: "Day 3", detail: "Move parts to the cold_s3 volume" },
          { name: "Day 14", detail: "Delete table parts and owned S3 objects" },
        ],
        legend:
          "ClickHouse table TTL owns object movement and deletion; no competing SeaweedFS bucket TTL is configured",
      },
    },
    arc42: {
      eyebrow: "arc42 coverage map",
      ariaLabel: "arc42 sections used to document the RKE2 and GitOps platform",
      items: [
        ["01", "Goals", "Scope and non-goals"],
        ["02", "Constraints", "RKE2, NFS and external systems"],
        ["03", "Context", "Repositories and operators"],
        ["04", "Strategy", "Two-stage reconciliation"],
        ["05", "Building blocks", "Ansible, RKE2 and Argo CD"],
        ["06", "Runtime", "Bootstrap and recovery flows"],
        ["07", "Deployment", "Sync waves and service exposure"],
        ["08", "Concepts", "Ownership, secrets and GitOps"],
        ["09", "Decisions", "RKE2 versus Kubespray"],
        ["10", "Quality", "Tests and readiness gates"],
        ["11", "Risks", "NFS and recovery boundaries"],
        ["12", "Glossary", "API names and meanings"],
      ],
    },
  },
  ko: {
    pause: "모션 일시 정지",
    c4: {
      context: {
        eyebrow: "C4 · Level 1 · 시스템 컨텍스트",
        ariaLabel:
          "운영자가 jamie-kr-gitops 환경 저장소를 변경하고 rke2spray가 RKE2 클러스터를 수렴시키며 Argo CD가 워크로드를 조정하는 C4 시스템 컨텍스트",
        operator: {
          name: "플랫폼 운영자",
          detail: "Desired state를 검토하고 보호된 운영 절차를 실행함",
        },
        environment: {
          name: "jamie-kr-gitops",
          detail: "환경 Inventory와 Kubernetes desired state를 소유함",
        },
        engine: {
          name: "rke2spray",
          detail: "Kubespray 형태의 입력을 RKE2 lifecycle로 해석함",
        },
        cluster: {
          name: "RKE2 플랫폼",
          detail: "Kubernetes API, Argo CD, 플랫폼과 데이터 workload를 실행함",
        },
        external: {
          name: "외부 시스템",
          detail: "GitHub, DNS, TCP load balancer와 관리형 NFS로 구성됨",
        },
        legend:
          "화살표는 runtime packet 경로가 아니라 제어와 수렴 관계를 나타냄",
      },
      container: {
        eyebrow: "C4 · Level 2 · 컨테이너와 소유권",
        ariaLabel:
          "Inventory와 Vault, rke2spray, RKE2 API, Argo CD bootstrap과 GitOps 애플리케이션을 나타내는 C4 컨테이너 뷰",
        nodes: [
          {
            name: "Inventory + Vault",
            detail: "Host, topology와 보호된 bootstrap 입력",
          },
          {
            name: "rke2spray",
            detail: "Ansible Playbook, Role, 검증과 lifecycle adapter",
          },
          {
            name: "RKE2 API",
            detail: "Server, embedded etcd, Cilium과 native AddOn",
          },
          {
            name: "Argo CD bootstrap",
            detail: "Project, 저장소 자격증명과 Root Application",
          },
          {
            name: "GitOps 애플리케이션",
            detail: "플랫폼, 데이터, 관측성, 스토리지와 공개 경로",
          },
        ],
        legend:
          "소유권 경계는 Kubernetes API Ready 시점에 전환되며 사라지지 않음",
      },
    },
    flow: {
      eyebrow: "애니메이션 Runtime View · 두 수렴 엔진",
      ariaLabel:
        "검토된 환경 변경에서 rke2spray 수렴, Kubernetes 준비, Argo CD 조정과 검증으로 이어지는 애니메이션 순서",
      stages: [
        { name: "검토", detail: "Inventory와 manifest" },
        { name: "수렴", detail: "Ansible + RKE2" },
        { name: "Ready gate", detail: "API, Node와 AddOn" },
        { name: "조정", detail: "Argo CD sync wave" },
        { name: "검증", detail: "Health와 장애 계약" },
      ],
      legend:
        "애니메이션은 순서만 설명하며 각 전이는 실행 가능한 검사로 통제됨",
    },
    observability: {
      pipeline: {
        eyebrow: "관측성 Runtime · 인증된 영속 경로",
        ariaLabel:
          "Workload와 Kubernetes source에서 OpenTelemetry Gateway와 ClickStack 수집 queue를 거쳐 ClickHouse hot storage와 SeaweedFS S3 cold storage로 이어지는 telemetry pipeline",
        stages: [
          {
            name: "Source",
            detail: "Application OTLP, Node log와 cluster metric",
          },
          {
            name: "OTel Gateway ×2",
            detail: "Batch, retry와 replica별 1Gi PVC queue",
          },
          {
            name: "ClickStack ingest ×2",
            detail: "Bearer 인증과 1Gi PVC exporter queue",
          },
          {
            name: "ClickHouse ×3",
            detail: "Hot durable-rwo의 ReplicatedMergeTree",
          },
          {
            name: "SeaweedFS S3",
            detail: "Private gateway ×3와 001 two-copy cold volume",
          },
        ],
        legend:
          "NetworkPolicy가 각 hop을 제한하며 SDK service.namespace는 보존하고 k8s.cluster.name을 추가함",
      },
      lifecycle: {
        eyebrow: "ClickHouse Lifecycle · 압축과 Cold Tier",
        ariaLabel:
          "ClickHouse 최초 적재에서 ZSTD 재압축, S3 cold 이동과 삭제로 이어지는 telemetry storage lifecycle",
        stages: [
          { name: "0일", detail: "Telemetry를 hot volume에 복제 적재함" },
          {
            name: "Hot 구간",
            detail: "최근 part를 ClickHouse local PVC에서 조회함",
          },
          { name: "2일", detail: "대상 part를 ZSTD level 3으로 재압축함" },
          { name: "3일", detail: "Part를 cold_s3 volume으로 이동함" },
          { name: "14일", detail: "Table part와 소유 S3 object를 삭제함" },
        ],
        legend:
          "ClickHouse table TTL이 object 이동과 삭제를 소유하며 중복 SeaweedFS bucket TTL은 구성하지 않음",
      },
    },
    arc42: {
      eyebrow: "arc42 커버리지 맵",
      ariaLabel: "RKE2와 GitOps 플랫폼 문서에 적용한 arc42 섹션",
      items: [
        ["01", "목표", "범위와 비목표"],
        ["02", "제약", "RKE2, NFS와 외부 시스템"],
        ["03", "컨텍스트", "저장소와 운영자"],
        ["04", "전략", "2단계 수렴"],
        ["05", "빌딩 블록", "Ansible, RKE2와 Argo CD"],
        ["06", "Runtime", "Bootstrap과 복구 흐름"],
        ["07", "배포", "Sync wave와 서비스 노출"],
        ["08", "공통 개념", "소유권, 비밀정보와 GitOps"],
        ["09", "결정", "RKE2와 Kubespray 선택"],
        ["10", "품질", "테스트와 Ready gate"],
        ["11", "위험", "NFS와 복구 경계"],
        ["12", "용어", "API 이름과 의미"],
      ],
    },
  },
} as const;

function ArchitectureFigure({
  ariaLabel,
  children,
  eyebrow,
  legend,
  locale,
}: ArchitectureVisualProps & {
  readonly ariaLabel: string;
  readonly children: React.ReactNode;
  readonly eyebrow: string;
  readonly legend: string;
}): React.JSX.Element {
  const controlId = `architecture-motion-${eyebrow.replace(/[^a-z0-9]+/giu, "-").toLowerCase()}`;
  return (
    <figure aria-label={ariaLabel} className={styles.figure}>
      <div className={styles.header}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <label className={styles.pauseControl} htmlFor={controlId}>
          <input id={controlId} type="checkbox" />
          {copy[locale].pause}
        </label>
      </div>
      <div className={styles.canvas}>{children}</div>
      <figcaption className={styles.legend}>{legend}</figcaption>
    </figure>
  );
}

function ArchitectureNode({
  copy: nodeCopy,
  kind,
}: {
  readonly copy: NodeCopy;
  readonly kind?: "system";
}): React.JSX.Element {
  return (
    <div className={styles.node} data-kind={kind}>
      <strong>{nodeCopy.name}</strong>
      <span>{nodeCopy.detail}</span>
    </div>
  );
}

/** C4 System Context 또는 Container 수준의 플랫폼 소유권 지도를 렌더링함 */
export function C4ArchitectureMap({
  level,
  locale,
}: C4ArchitectureMapProps): React.JSX.Element {
  if (level === "context") {
    const view = copy[locale].c4.context;
    return (
      <ArchitectureFigure
        ariaLabel={view.ariaLabel}
        eyebrow={view.eyebrow}
        legend={view.legend}
        locale={locale}
      >
        <div className={styles.contextGrid} data-c4-level="context">
          <ArchitectureNode copy={view.operator} />
          <div className={styles.centerStack}>
            <ArchitectureNode copy={view.environment} kind="system" />
            <ArchitectureNode copy={view.engine} kind="system" />
            <ArchitectureNode copy={view.cluster} kind="system" />
          </div>
          <ArchitectureNode copy={view.external} />
        </div>
      </ArchitectureFigure>
    );
  }
  const view = copy[locale].c4.container;
  return (
    <ArchitectureFigure
      ariaLabel={view.ariaLabel}
      eyebrow={view.eyebrow}
      legend={view.legend}
      locale={locale}
    >
      <div className={styles.containerGrid} data-c4-level="container">
        {view.nodes.map((node) => (
          <ArchitectureNode copy={node} key={node.name} kind="system" />
        ))}
      </div>
    </ArchitectureFigure>
  );
}

/** Inventory 검토부터 배포 검증까지 두 수렴 엔진의 순서를 애니메이션으로 렌더링함 */
export function PlatformConvergenceFlow({
  locale,
}: ArchitectureVisualProps): React.JSX.Element {
  const view = copy[locale].flow;
  return (
    <ArchitectureFigure
      ariaLabel={view.ariaLabel}
      eyebrow={view.eyebrow}
      legend={view.legend}
      locale={locale}
    >
      <ol className={styles.timeline} data-architecture-flow="convergence">
        {view.stages.map((stage) => (
          <li className={styles.timelineItem} key={stage.name}>
            <strong>{stage.name}</strong>
            <span>{stage.detail}</span>
          </li>
        ))}
      </ol>
    </ArchitectureFigure>
  );
}

/** OTel 수집 지점부터 ClickHouse와 S3까지 인증·영속 telemetry 경로를 렌더링함 */
export function ObservabilityPipelineFlow({
  locale,
}: ArchitectureVisualProps): React.JSX.Element {
  const view = copy[locale].observability.pipeline;
  return (
    <ArchitectureFigure
      ariaLabel={view.ariaLabel}
      eyebrow={view.eyebrow}
      legend={view.legend}
      locale={locale}
    >
      <ol
        className={styles.timeline}
        data-architecture-flow="observability-pipeline"
      >
        {view.stages.map((stage) => (
          <li className={styles.timelineItem} key={stage.name}>
            <strong>{stage.name}</strong>
            <span>{stage.detail}</span>
          </li>
        ))}
      </ol>
    </ArchitectureFigure>
  );
}

/** ClickHouse telemetry part의 hot·압축·S3 cold·삭제 lifecycle을 렌더링함 */
export function TelemetryStorageLifecycle({
  locale,
}: ArchitectureVisualProps): React.JSX.Element {
  const view = copy[locale].observability.lifecycle;
  return (
    <ArchitectureFigure
      ariaLabel={view.ariaLabel}
      eyebrow={view.eyebrow}
      legend={view.legend}
      locale={locale}
    >
      <ol
        className={styles.timeline}
        data-architecture-flow="telemetry-storage-lifecycle"
      >
        {view.stages.map((stage) => (
          <li className={styles.timelineItem} key={stage.name}>
            <strong>{stage.name}</strong>
            <span>{stage.detail}</span>
          </li>
        ))}
      </ol>
    </ArchitectureFigure>
  );
}

/** 문서가 다루는 arc42 장과 각 장의 현재 근거를 요약함 */
export function Arc42CoverageMap({
  locale,
}: ArchitectureVisualProps): React.JSX.Element {
  const view = copy[locale].arc42;
  return (
    <figure aria-label={view.ariaLabel} className={styles.figure}>
      <div className={styles.header}>
        <p className={styles.eyebrow}>{view.eyebrow}</p>
      </div>
      <div className={styles.canvas}>
        <div className={styles.arcGrid} data-architecture-map="arc42">
          {view.items.map(([number, title, detail]) => (
            <div className={styles.arcItem} key={number}>
              <span className={styles.arcNumber}>{number}</span>
              <span>
                <strong>{title}</strong>
                <span>{detail}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </figure>
  );
}
