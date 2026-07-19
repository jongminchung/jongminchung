"use client";

import type { ComponentType } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  parseExcalidrawAssetSrc,
  parseExcalidrawSource,
  type ExcalidrawScene,
} from "../lib/excalidraw-scene";
import type { ExcalidrawCanvasProps } from "./ExcalidrawCanvas";
import styles from "./ExcalidrawDiagram.module.css";

interface ExcalidrawDiagramBaseProps {
  readonly ariaLabel?: string;
  readonly caption?: string;
  readonly variant?: "embedded" | "standalone";
}

interface InlineExcalidrawDiagramProps extends ExcalidrawDiagramBaseProps {
  readonly source: string;
  readonly src?: never;
}

interface RemoteExcalidrawDiagramProps extends ExcalidrawDiagramBaseProps {
  readonly source?: never;
  readonly src: string;
}

export type ExcalidrawDiagramProps = InlineExcalidrawDiagramProps | RemoteExcalidrawDiagramProps;

type CanvasComponent = ComponentType<ExcalidrawCanvasProps>;
type SceneState =
  | Readonly<{ kind: "error"; message: string }>
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "ready"; scene: ExcalidrawScene }>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown Excalidraw rendering error.";
}

function localizedText(isKorean: boolean, korean: string, english: string): string {
  return isKorean ? korean : english;
}

async function loadRemoteSource(src: string, signal: AbortSignal): Promise<string> {
  parseExcalidrawAssetSrc(src);
  const response = await fetch(src, { signal });
  if (!response.ok) throw new Error(`Excalidraw source request failed with ${response.status}.`);
  return response.text();
}

export function ExcalidrawDiagram(props: ExcalidrawDiagramProps): React.JSX.Element {
  const figureRef = useRef<HTMLElement>(null);
  const [canvas, setCanvas] = useState<CanvasComponent | null>(null);
  const [isKorean, setIsKorean] = useState(false);
  const [rendererError, setRendererError] = useState<string | null>(null);
  const [interactionError, setInteractionError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [renderedElementCount, setRenderedElementCount] = useState<number | null>(null);
  const [sceneState, setSceneState] = useState<SceneState>({ kind: "loading" });
  const src = props.src;
  const source = props.source;
  const variant = props.variant ?? "embedded";
  const ariaLabel = props.ariaLabel ?? "Excalidraw diagram";

  useEffect(() => {
    setIsKorean(document.documentElement.lang.toLowerCase().startsWith("ko"));
  }, []);

  useEffect(() => {
    let active = true;
    const loadRenderer = async (): Promise<void> => {
      try {
        const module = await import("./ExcalidrawCanvas");
        if (active) setCanvas(() => module.ExcalidrawCanvas);
      } catch (error: unknown) {
        if (active) setRendererError(errorMessage(error));
      }
    };
    void loadRenderer();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setSceneState({ kind: "loading" });
    setRenderedElementCount(null);

    const loadScene = async (): Promise<void> => {
      try {
        let sceneSource: string;
        if (source !== undefined) sceneSource = source;
        else if (src !== undefined) sceneSource = await loadRemoteSource(src, controller.signal);
        else throw new Error("Excalidraw source is required.");
        const scene = parseExcalidrawSource(sceneSource, src ?? "inline Excalidraw scene");
        if (!controller.signal.aborted) setSceneState({ kind: "ready", scene });
      } catch (error: unknown) {
        if (!controller.signal.aborted) {
          setSceneState({ kind: "error", message: errorMessage(error) });
        }
      }
    };
    void loadScene();
    return () => controller.abort();
  }, [source, src]);

  useEffect(() => {
    const updateFullscreen = (): void =>
      setIsFullscreen(document.fullscreenElement === figureRef.current);
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () => document.removeEventListener("fullscreenchange", updateFullscreen);
  }, []);

  const toggleFullscreen = useCallback(async (): Promise<void> => {
    setInteractionError(null);
    try {
      if (document.fullscreenElement === figureRef.current) await document.exitFullscreen();
      else await figureRef.current?.requestFullscreen();
    } catch (error: unknown) {
      setInteractionError(errorMessage(error));
    }
  }, []);

  const onReady = useCallback((elementCount: number): void => {
    setRenderedElementCount(elementCount);
  }, []);

  const error = rendererError ?? (sceneState.kind === "error" ? sceneState.message : null);
  const ready =
    sceneState.kind === "ready" &&
    canvas !== null &&
    renderedElementCount === sceneState.scene.elementCount;
  const figureClassName = `${styles.figure} ${variant === "standalone" ? styles.standalone : ""}`;
  const Canvas = canvas;

  return (
    <figure
      ref={figureRef}
      aria-label={ariaLabel}
      className={figureClassName}
      data-excalidraw-state={error === null ? (ready ? "ready" : "loading") : "error"}
      data-rendered-element-count={renderedElementCount ?? undefined}
      data-source-element-count={
        sceneState.kind === "ready" ? sceneState.scene.elementCount : undefined
      }
    >
      <div className={styles.toolbar}>
        {interactionError === null ? null : (
          <span className={styles.interactionError} role="status">
            {interactionError}
          </span>
        )}
        {src === undefined ? null : (
          <a className={styles.action} download href={src}>
            {localizedText(isKorean, "원본 다운로드", "Download source")}
          </a>
        )}
        <button className={styles.action} type="button" onClick={() => void toggleFullscreen()}>
          {isFullscreen
            ? localizedText(isKorean, "전체 화면 종료", "Exit full screen")
            : localizedText(isKorean, "전체 화면", "Full screen")}
        </button>
      </div>
      <div className={styles.canvas}>
        {error === null && sceneState.kind === "ready" && Canvas !== null ? (
          <Canvas name={ariaLabel} onReady={onReady} scene={sceneState.scene} />
        ) : error === null ? (
          <div className={styles.loading} role="status">
            {localizedText(isKorean, "다이어그램을 불러오는 중", "Loading diagram")}
          </div>
        ) : (
          <div className={styles.error} role="alert">
            <p>
              {localizedText(
                isKorean,
                "다이어그램을 렌더링할 수 없습니다.",
                "Unable to render diagram.",
              )}
            </p>
            <p>{error}</p>
            {src === undefined ? null : (
              <a className={styles.action} download href={src}>
                {localizedText(isKorean, "원본 다운로드", "Download source")}
              </a>
            )}
          </div>
        )}
        {sceneState.kind === "ready" && sceneState.scene.textContent.length > 0 ? (
          <span className={styles.screenReaderOnly} data-excalidraw-text="true">
            {sceneState.scene.textContent.join(" · ")}
          </span>
        ) : null}
      </div>
      {props.caption === undefined ? null : (
        <figcaption className={styles.caption}>{props.caption}</figcaption>
      )}
    </figure>
  );
}
