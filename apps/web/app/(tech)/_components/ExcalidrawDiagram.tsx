"use client";

import { Button, buttonVariants } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import type { ComponentType } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseExcalidrawSource } from "#lib/tech/excalidraw-scene";
import { excalidrawSceneQueryOptions } from "#lib/tech/queries";
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

export type ExcalidrawDiagramProps =
    | InlineExcalidrawDiagramProps
    | RemoteExcalidrawDiagramProps;

type CanvasComponent = ComponentType<ExcalidrawCanvasProps>;
function errorMessage(error: unknown): string {
    return error instanceof Error
        ? error.message
        : "Unknown Excalidraw rendering error.";
}

function localizedText(
    isKorean: boolean,
    korean: string,
    english: string,
): string {
    return isKorean ? korean : english;
}

/** `ExcalidrawDiagram` UI 컴포넌트를 렌더링함 */
export function ExcalidrawDiagram(
    props: ExcalidrawDiagramProps,
): React.JSX.Element {
    const figureRef = useRef<HTMLElement>(null);
    const [canvas, setCanvas] = useState<CanvasComponent | null>(null);
    const [isKorean, setIsKorean] = useState(false);
    const [rendererError, setRendererError] = useState<string | null>(null);
    const [interactionError, setInteractionError] = useState<string | null>(
        null,
    );
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [renderedElementCount, setRenderedElementCount] = useState<
        number | null
    >(null);
    const src = props.src;
    const source = props.source;
    const variant = props.variant ?? "embedded";
    const ariaLabel = props.ariaLabel ?? "Excalidraw diagram";
    const inlineScene = useMemo(() => {
        if (source === undefined) return { scene: null, error: null };
        try {
            return {
                scene: parseExcalidrawSource(source, "inline Excalidraw scene"),
                error: null,
            };
        } catch (error: unknown) {
            return { scene: null, error: errorMessage(error) };
        }
    }, [source]);
    const remoteScene = useQuery({
        ...excalidrawSceneQueryOptions(src ?? "/diagrams/disabled.excalidraw"),
        enabled: src !== undefined,
    });
    const scene =
        source === undefined ? (remoteScene.data ?? null) : inlineScene.scene;
    const sceneError =
        inlineScene.error ??
        (remoteScene.error === null ? null : errorMessage(remoteScene.error));

    useEffect(() => {
        setIsKorean(
            document.documentElement.lang.toLowerCase().startsWith("ko"),
        );
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
        setRenderedElementCount(null);
    }, [source, src]);

    useEffect(() => {
        const updateFullscreen = (): void =>
            setIsFullscreen(document.fullscreenElement === figureRef.current);
        document.addEventListener("fullscreenchange", updateFullscreen);
        return () =>
            document.removeEventListener("fullscreenchange", updateFullscreen);
    }, []);

    const toggleFullscreen = useCallback(async (): Promise<void> => {
        setInteractionError(null);
        try {
            if (document.fullscreenElement === figureRef.current)
                await document.exitFullscreen();
            else await figureRef.current?.requestFullscreen();
        } catch (error: unknown) {
            setInteractionError(errorMessage(error));
        }
    }, []);

    const onReady = useCallback((elementCount: number): void => {
        setRenderedElementCount(elementCount);
    }, []);

    const error = rendererError ?? sceneError;
    const ready =
        scene !== null &&
        canvas !== null &&
        renderedElementCount === scene.elementCount;
    const figureClassName = `${styles.figure} ${variant === "standalone" ? styles.standalone : ""}`;
    const Canvas = canvas;

    return (
        <figure
            ref={figureRef}
            aria-label={ariaLabel}
            className={figureClassName}
            data-excalidraw-state={
                error === null ? (ready ? "ready" : "loading") : "error"
            }
            data-rendered-element-count={renderedElementCount ?? undefined}
            data-source-element-count={scene?.elementCount}
        >
            <div className={styles.toolbar}>
                {interactionError === null ? null : (
                    <span className={styles.interactionError} role="status">
                        {interactionError}
                    </span>
                )}
                {src === undefined ? null : (
                    <a
                        className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "min-h-[30px] cursor-pointer px-2.5 py-[5px] text-xs leading-[1.2] font-[inherit] no-underline hover:border-input",
                        )}
                        download
                        href={src}
                    >
                        {localizedText(
                            isKorean,
                            "원본 다운로드",
                            "Download source",
                        )}
                    </a>
                )}
                <Button
                    className={cn(
                        "min-h-[30px] cursor-pointer px-2.5 py-[5px] text-xs leading-[1.2] font-[inherit]",
                        "hover:border-input",
                    )}
                    onClick={() => void toggleFullscreen()}
                    variant="outline"
                    size="default"
                >
                    {isFullscreen
                        ? localizedText(
                              isKorean,
                              "전체 화면 종료",
                              "Exit full screen",
                          )
                        : localizedText(isKorean, "전체 화면", "Full screen")}
                </Button>
            </div>
            <div className={styles.canvas}>
                {error === null && scene !== null && Canvas !== null ? (
                    <Canvas name={ariaLabel} onReady={onReady} scene={scene} />
                ) : error === null ? (
                    <div className={styles.loading} role="status">
                        {localizedText(
                            isKorean,
                            "다이어그램을 불러오는 중",
                            "Loading diagram",
                        )}
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
                            <a
                                className={cn(
                                    buttonVariants({
                                        variant: "outline",
                                        size: "sm",
                                    }),
                                    "min-h-[30px] cursor-pointer px-2.5 py-[5px] text-xs leading-[1.2] font-[inherit] no-underline hover:border-input",
                                )}
                                download
                                href={src}
                            >
                                {localizedText(
                                    isKorean,
                                    "원본 다운로드",
                                    "Download source",
                                )}
                            </a>
                        )}
                    </div>
                )}
                {scene !== null && scene.textContent.length > 0 ? (
                    <span
                        className={styles.screenReaderOnly}
                        data-excalidraw-text="true"
                    >
                        {scene.textContent.join(" · ")}
                    </span>
                ) : null}
            </div>
            {props.caption === undefined ? null : (
                <figcaption className={styles.caption}>
                    {props.caption}
                </figcaption>
            )}
        </figure>
    );
}
