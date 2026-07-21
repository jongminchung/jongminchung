import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { forwardRef, useEffect, useImperativeHandle, useRef, type MouseEventHandler } from "react";
import {
  TerminalActionExecutor,
  terminalActionForKeyboard,
  type TerminalActionId,
  type TerminalActionResult,
  type TerminalClipboardPort,
  type TerminalSurfaceActionId,
} from "../domain/terminalActions";
import { terminalService } from "../domain/TerminalService";
import { terminalThemeFor } from "../domain/terminalTheme";
import type { TerminalEvent } from "../shared/contracts/model";
import { useAppearance } from "./AppearanceProvider";

export interface XtermSurfaceCapabilities {
  readonly hasSelection: boolean;
  readonly hasClipboard: boolean;
}

export interface XtermSurfaceHandle {
  capabilities(): XtermSurfaceCapabilities;
  execute(action: TerminalSurfaceActionId): Promise<TerminalActionResult>;
  focus(): void;
}

interface XtermSurfaceProps {
  readonly sessionKey: string;
  readonly onAction: (action: TerminalActionId) => void;
  readonly onContextMenu: MouseEventHandler<HTMLDivElement>;
}

function browserClipboard(): TerminalClipboardPort | null {
  return typeof navigator === "undefined" || navigator.clipboard === undefined
    ? null
    : navigator.clipboard;
}

const XtermSurface = forwardRef<XtermSurfaceHandle, XtermSurfaceProps>(function XtermSurface(
  { sessionKey, onAction, onContextMenu },
  forwardedRef,
) {
  const container = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;
  const { colorScheme } = useAppearance();

  useImperativeHandle(
    forwardedRef,
    () => ({
      capabilities: (): XtermSurfaceCapabilities => ({
        hasSelection: terminalRef.current?.hasSelection() ?? false,
        hasClipboard: browserClipboard() !== null,
      }),
      execute: (action: TerminalSurfaceActionId): Promise<TerminalActionResult> => {
        const terminal = terminalRef.current;
        if (terminal === null) {
          return Promise.resolve({
            kind: "unavailable",
            reason: "Terminal is not ready.",
          });
        }
        return TerminalActionExecutor.of(terminal, browserClipboard()).execute(action);
      },
      focus: (): void => terminalRef.current?.focus(),
    }),
    [],
  );

  useEffect(() => {
    const parent = container.current;
    if (!parent) return;
    const terminal = new Terminal({
      allowProposedApi: false,
      convertEol: false,
      cursorBlink: true,
      fontFamily: '"JetBrains Mono Rebased", "JetBrains Mono", Menlo, monospace',
      fontSize: 13,
      lineHeight: 1,
      scrollback: 10_000,
      theme: terminalThemeFor(),
    });
    terminalRef.current = terminal;
    terminal.attachCustomKeyEventHandler((event) => {
      const action = terminalActionForKeyboard(event);
      if (action === null) return true;
      onActionRef.current(action);
      return false;
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(parent);
    parent
      .querySelector<HTMLTextAreaElement>(".xterm-helper-textarea")
      ?.setAttribute("aria-label", "Editor");
    fit.fit();
    let lastSequence = -1;
    const renderEvent = (event: TerminalEvent): void => {
      if (event.kind === "output") {
        if (event.sequence <= lastSequence) return;
        lastSequence = event.sequence;
        terminal.write(Uint8Array.from(event.data));
      } else if (event.kind === "exited") {
        terminal.writeln(
          `\r\n[process exited ${event.exitCode}${event.signal ? ` · ${event.signal}` : ""}]`,
        );
      } else {
        terminal.writeln(`\r\n[terminal error: ${event.message}]`);
      }
    };
    terminalService.events(sessionKey).forEach(renderEvent);
    const unsubscribe = terminalService.subscribeEvents(sessionKey, renderEvent);
    const input = terminal.onData((data) => void terminalService.write(sessionKey, data));
    const observer = new ResizeObserver(() => {
      fit.fit();
      void terminalService.resize(sessionKey, terminal.cols, terminal.rows);
    });
    observer.observe(parent);
    terminal.focus();
    return () => {
      observer.disconnect();
      input.dispose();
      unsubscribe();
      terminal.dispose();
      if (terminalRef.current === terminal) terminalRef.current = null;
    };
  }, [sessionKey]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    const frame = requestAnimationFrame(() => {
      terminal.options.theme = terminalThemeFor();
    });
    return () => cancelAnimationFrame(frame);
  }, [colorScheme]);

  return (
    <div
      data-command-scope="terminal"
      data-terminal-session={sessionKey}
      onContextMenu={onContextMenu}
      ref={container}
      style={{ height: "100%", minHeight: 0, width: "100%" }}
    />
  );
});

XtermSurface.displayName = "XtermSurface";

export default XtermSurface;
