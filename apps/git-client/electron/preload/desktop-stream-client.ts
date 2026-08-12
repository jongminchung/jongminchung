import { ipcRenderer } from "electron";
import {
    DESKTOP_STREAM_CHANNEL,
    DESKTOP_STREAM_PROTOCOL_VERSION,
    DesktopStreamEnvelopeSchema,
    type DesktopStreamEnvelope,
} from "../../src/shared/contracts/desktop-stream";

type StreamListener = (envelope: DesktopStreamEnvelope) => void;

class DesktopStreamClient {
    readonly #listeners = new Set<StreamListener>();
    readonly #ready: Promise<void>;
    #resolveReady: (() => void) | null = null;

    constructor() {
        this.#ready = new Promise<void>((resolve) => {
            this.#resolveReady = resolve;
        });
        const channel = new MessageChannel();
        channel.port2.onmessage = (message: MessageEvent): void => {
            const envelope = DesktopStreamEnvelopeSchema.parse(message.data);
            if (envelope.kind === "ready") {
                this.#resolveReady?.();
                this.#resolveReady = null;
                return;
            }
            for (const listener of this.#listeners) {
                try {
                    listener(envelope);
                } catch {
                    // One renderer callback cannot interrupt delivery to the remaining subscribers.
                }
            }
        };
        channel.port2.start();
        ipcRenderer.postMessage(
            DESKTOP_STREAM_CHANNEL,
            { version: DESKTOP_STREAM_PROTOCOL_VERSION },
            [channel.port1],
        );
    }

    ready(): Promise<void> {
        return this.#ready;
    }

    subscribe(listener: StreamListener): () => void {
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }
}

export const desktopStream = new DesktopStreamClient();
