"use client";

import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ExcalidrawScene } from "../lib/excalidraw-scene";

type ExcalidrawApi = Parameters<NonNullable<ComponentProps<typeof Excalidraw>["excalidrawAPI"]>>[0];
type ExcalidrawInitialData = NonNullable<ComponentProps<typeof Excalidraw>["initialData"]>;
type ExcalidrawTheme = NonNullable<ComponentProps<typeof Excalidraw>["theme"]>;

export interface ExcalidrawCanvasProps {
  readonly name: string;
  readonly onReady: (elementCount: number) => void;
  readonly scene: ExcalidrawScene;
}

function readTheme(): ExcalidrawTheme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function ExcalidrawCanvas({
  name,
  onReady,
  scene,
}: ExcalidrawCanvasProps): React.JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  const [api, setApi] = useState<ExcalidrawApi | null>(null);
  const [theme, setTheme] = useState<ExcalidrawTheme>("light");

  useEffect(() => {
    setTheme(readTheme());
    const observer = new MutationObserver(() => setTheme(readTheme()));
    observer.observe(document.documentElement, {
      attributeFilter: ["data-theme"],
      attributes: true,
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (api === null) return;
    const frame = requestAnimationFrame(() => {
      const controls = rootRef.current?.querySelector('footer[role="contentinfo"]');
      controls?.setAttribute("aria-label", "Diagram controls");
      controls?.setAttribute("role", "group");
      const elements = api.getSceneElements();
      api.scrollToContent(elements, {
        fitToViewport: true,
        viewportZoomFactor: 0.82,
      });
      onReady(elements.length);
    });
    return () => cancelAnimationFrame(frame);
  }, [api, onReady]);

  const initialData = useMemo(
    () =>
      ({
        elements: scene.elements,
        appState: {
          ...scene.appState,
          gridModeEnabled: false,
          viewModeEnabled: true,
          zenModeEnabled: true,
        },
        files: scene.files,
        scrollToContent: true,
      }) as unknown as ExcalidrawInitialData,
    [scene],
  );

  const receiveApi = useCallback((api: ExcalidrawApi): void => {
    setApi(api);
  }, []);

  return (
    <div ref={rootRef} style={{ height: "100%", width: "100%" }}>
      <Excalidraw
        autoFocus={false}
        excalidrawAPI={receiveApi}
        gridModeEnabled={false}
        handleKeyboardGlobally={false}
        initialData={initialData}
        name={name}
        theme={theme}
        viewModeEnabled
        zenModeEnabled
      />
    </div>
  );
}
