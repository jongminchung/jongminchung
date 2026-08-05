"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ComponentType } from "react";

const demoNames = [
  "traffic-pattern",
  "percentile",
  "survivorship",
  "cpu-pattern",
  "throttling",
  "memory-leak",
  "memory-spike",
  "thread-pool",
  "cascade",
  "event-loop",
  "bottleneck",
  "utilization-curve",
  "backpressure",
  "cache-stampede",
  "timeout-mismatch",
  "slow-burn",
  "deploy",
  "postmortem",
] as const;

export type ServerMonitoringDemoName = (typeof demoNames)[number];

const demos = {
  "traffic-pattern": dynamic(() =>
    import("./TrafficPatternDemo").then((module) => module.TrafficPatternDemo),
  ),
  percentile: dynamic(() => import("./PercentileDemo").then((module) => module.PercentileDemo)),
  survivorship: dynamic(() =>
    import("./SurvivorshipDemo").then((module) => module.SurvivorshipDemo),
  ),
  "cpu-pattern": dynamic(() => import("./CpuPatternDemo").then((module) => module.CpuPatternDemo)),
  throttling: dynamic(() => import("./ThrottlingDemo").then((module) => module.ThrottlingDemo)),
  "memory-leak": dynamic(() => import("./MemoryLeakDemo").then((module) => module.MemoryLeakDemo)),
  "memory-spike": dynamic(() =>
    import("./MemorySpikeDemo").then((module) => module.MemorySpikeDemo),
  ),
  "thread-pool": dynamic(() => import("./ThreadPoolDemo").then((module) => module.ThreadPoolDemo)),
  cascade: dynamic(() => import("./CascadeDemo").then((module) => module.CascadeDemo)),
  "event-loop": dynamic(() => import("./EventLoopDemo").then((module) => module.EventLoopDemo)),
  bottleneck: dynamic(() => import("./BottleneckDemo").then((module) => module.BottleneckDemo)),
  "utilization-curve": dynamic(() =>
    import("./UtilizationCurveDemo").then((module) => module.UtilizationCurveDemo),
  ),
  backpressure: dynamic(() =>
    import("./BackpressureDemo").then((module) => module.BackpressureDemo),
  ),
  "cache-stampede": dynamic(() =>
    import("./CacheStampedeDemo").then((module) => module.CacheStampedeDemo),
  ),
  "timeout-mismatch": dynamic(() =>
    import("./TimeoutMismatchDemo").then((module) => module.TimeoutMismatchDemo),
  ),
  "slow-burn": dynamic(() => import("./SlowBurnDemo").then((module) => module.SlowBurnDemo)),
  deploy: dynamic(() => import("./DeployDemo").then((module) => module.DeployDemo)),
  postmortem: dynamic(() => import("./PostmortemDemo").then((module) => module.PostmortemDemo)),
} satisfies Readonly<Record<ServerMonitoringDemoName, ComponentType>>;

export function ServerMonitoringDemo({ name }: { readonly name: ServerMonitoringDemoName }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;
    if (!("IntersectionObserver" in window)) {
      setShouldRender(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting !== true) return;
        setShouldRender(true);
        observer.disconnect();
      },
      { rootMargin: "256px 0px" },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const Demo = demos[name];
  return (
    <div ref={containerRef} data-server-monitoring-demo={name} style={{ minHeight: 192 }}>
      {shouldRender ? <Demo /> : null}
    </div>
  );
}
