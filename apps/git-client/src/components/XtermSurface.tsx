import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef } from "react";
import { terminalService } from "../domain/TerminalService";
import type { TerminalEvent } from "../generated";

export default function XtermSurface({ sessionKey }: { readonly sessionKey: string }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parent = container.current;
    if (!parent) return;
    const terminal = new Terminal({
      allowProposedApi: false,
      convertEol: false,
      cursorBlink: true,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: 12,
      scrollback: 10_000,
      theme: {
        background: "#17171b",
        foreground: "#e6e6ea",
        cursor: "#a78bfa",
        selectionBackground: "#5b4a8a88",
      },
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(parent);
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
    };
  }, [sessionKey]);

  return <div ref={container} style={{ height: "100%", minHeight: 0, width: "100%" }} />;
}
