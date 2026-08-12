import type { BrowserWindow, IpcMainEvent, MessagePortMain } from "electron";
import {
  DESKTOP_STREAM_CHANNEL,
  DESKTOP_STREAM_PROTOCOL_VERSION,
  DesktopStreamConnectSchema,
  DesktopStreamEnvelopeSchema,
  type DesktopStreamEnvelope,
} from "../../src/shared/contracts/desktop-stream";
import { assertTrustedSender } from "./ipc-security";

export interface DesktopStreamPublisher {
  publish(envelope: DesktopStreamEnvelope): void;
  onDisconnect?(listener: () => void): () => void;
}

export class DesktopStreamHub {
  #port: MessagePortMain | null = null;
  readonly #disconnectListeners = new Set<() => void>();

  readonly #connect = (event: IpcMainEvent, raw: unknown): void => {
    assertTrustedSender(event, this.window);
    DesktopStreamConnectSchema.parse(raw);
    const [port] = event.ports;
    if (port === undefined || event.ports.length !== 1) {
      throw new Error("Desktop stream connection requires exactly one MessagePort");
    }
    this.#replacePort(port);
  };

  constructor(private readonly window: BrowserWindow) {
    window.webContents.ipc.on(DESKTOP_STREAM_CHANNEL, this.#connect);
  }

  publish(envelope: DesktopStreamEnvelope): void {
    const port = this.#port;
    if (port === null) return;
    port.postMessage(DesktopStreamEnvelopeSchema.parse(envelope));
  }

  onDisconnect(listener: () => void): () => void {
    this.#disconnectListeners.add(listener);
    return () => this.#disconnectListeners.delete(listener);
  }

  dispose(): void {
    this.window.webContents.ipc.removeListener(DESKTOP_STREAM_CHANNEL, this.#connect);
    this.#disconnectPort();
    this.#disconnectListeners.clear();
  }

  #replacePort(port: MessagePortMain): void {
    this.#disconnectPort();
    this.#port = port;
    port.once("close", () => {
      if (this.#port !== port) return;
      this.#port = null;
      this.#notifyDisconnect();
    });
    port.start();
    port.postMessage({ kind: "ready", version: DESKTOP_STREAM_PROTOCOL_VERSION });
  }

  #disconnectPort(): void {
    const port = this.#port;
    if (port === null) return;
    this.#port = null;
    port.close();
    this.#notifyDisconnect();
  }

  #notifyDisconnect(): void {
    for (const listener of this.#disconnectListeners) {
      try {
        listener();
      } catch {
        // One cleanup callback cannot block the remaining stream owners.
      }
    }
  }
}
