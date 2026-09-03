import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Arc42CoverageMap,
  C4ArchitectureMap,
  ObservabilityPipelineFlow,
  PlatformConvergenceFlow,
  TelemetryStorageLifecycle,
} from "./PlatformArchitectureVisuals";

describe("플랫폼 아키텍처 MDX 시각화", () => {
  it("C4 수준과 한국어 소유권 경계를 렌더링함", () => {
    const context = renderToStaticMarkup(
      <C4ArchitectureMap level="context" locale="ko" />,
    );
    const container = renderToStaticMarkup(
      <C4ArchitectureMap level="container" locale="ko" />,
    );

    expect(context).toContain('data-c4-level="context"');
    expect(context).toContain("jamie-kr-gitops");
    expect(context).toContain("rke2spray");
    expect(container).toContain('data-c4-level="container"');
    expect(container).toContain("Argo CD bootstrap");
  });

  it("영어 수렴 흐름과 arc42 범위를 의미 구조로 렌더링함", () => {
    const flow = renderToStaticMarkup(<PlatformConvergenceFlow locale="en" />);
    const arc42 = renderToStaticMarkup(<Arc42CoverageMap locale="en" />);

    expect(flow).toContain('data-architecture-flow="convergence"');
    expect(flow).toContain("Ready gate");
    expect(arc42).toContain('data-architecture-map="arc42"');
    expect(arc42).toContain("Risks");
  });

  it("관측성 적재 경로와 ClickHouse lifecycle을 의미 구조로 렌더링함", () => {
    const pipeline = renderToStaticMarkup(
      <ObservabilityPipelineFlow locale="en" />,
    );
    const lifecycle = renderToStaticMarkup(
      <TelemetryStorageLifecycle locale="en" />,
    );

    expect(pipeline).toContain(
      'data-architecture-flow="observability-pipeline"',
    );
    expect(pipeline).toContain("ClickStack ingest ×2");
    expect(pipeline).toContain("SeaweedFS S3");
    expect(lifecycle).toContain(
      'data-architecture-flow="telemetry-storage-lifecycle"',
    );
    expect(lifecycle).toContain("ZSTD level 3");
    expect(lifecycle).toContain("Day 14");
  });
});
