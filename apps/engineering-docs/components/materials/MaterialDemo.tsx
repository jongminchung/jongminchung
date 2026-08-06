"use client";

import { useEffect, useRef, useState } from "react";
import { materialRegistry } from "@/generated/materials-registry";
import { useMaterialLocale } from "./MaterialLocaleContext";
import { resetMaterialSeed } from "./runtime/random";
import type { MaterialDemoProps } from "./types";
import styles from "./MaterialDemo.module.css";

function useMaterialVisibility(containerRef: React.RefObject<HTMLElement | null>): {
  readonly active: boolean;
  readonly nearby: boolean;
} {
  const [active, setActive] = useState(false);
  const [nearby, setNearby] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;
    if (!("IntersectionObserver" in window)) {
      setActive(true);
      setNearby(true);
      return;
    }

    const preloadObserver = new IntersectionObserver(
      ([entry]) => setNearby((current) => current || entry?.isIntersecting === true),
      { rootMargin: "256px 0px" },
    );
    const playbackObserver = new IntersectionObserver(
      ([entry]) => setActive(entry?.isIntersecting === true),
      { threshold: 0.01 },
    );
    preloadObserver.observe(container);
    playbackObserver.observe(container);
    return () => {
      preloadObserver.disconnect();
      playbackObserver.disconnect();
    };
  }, [containerRef]);

  return { active, nearby };
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = (): void => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function MaterialDemo({ id }: MaterialDemoProps) {
  const entry = materialRegistry[id];
  const locale = useMaterialLocale();
  const containerRef = useRef<HTMLElement>(null);
  const { active, nearby } = useMaterialVisibility(containerRef);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!nearby || entry === undefined) return;
    void entry.preload();
  }, [entry, nearby]);

  if (entry === undefined) {
    return <p role="alert">Unknown material demo: {id}</p>;
  }

  const Demo = entry.component;
  if (active) resetMaterialSeed(id);
  const label = id.split("/").at(-1) ?? id;

  return (
    <figure
      ref={containerRef}
      className={styles.frame}
      data-material-active={active}
      data-material-demo={id}
      data-material-renderer={entry.renderer}
      style={{ minHeight: entry.minHeight }}
    >
      <div className={styles.stage} aria-describedby={`${id}-caption`}>
        {active ? (
          <Demo locale={locale} active={active} reducedMotion={reducedMotion} />
        ) : (
          <div className={styles.placeholder} aria-hidden="true" />
        )}
      </div>
      <figcaption className={styles.caption} id={`${id}-caption`}>
        {label} interactive engineering diagram
      </figcaption>
    </figure>
  );
}
