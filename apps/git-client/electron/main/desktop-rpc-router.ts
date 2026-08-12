import type { IpcMainInvokeEvent, WebContents } from "electron";
import {
  DESKTOP_RPC_CHANNELS,
  DesktopRpcRequestSchema,
  desktopRpcDomain,
  type DesktopRpcDomain,
  type DesktopRpcProcedure,
} from "../../src/shared/contracts/desktop-rpc";

type DesktopRpcHandler = (event: IpcMainInvokeEvent, payload: unknown) => unknown;

export class DesktopRpcRouter {
  readonly #handlers = new Map<DesktopRpcProcedure, DesktopRpcHandler>();
  readonly #registeredDomains = new Set<DesktopRpcDomain>();

  constructor(private readonly contents: WebContents) {}

  handle(procedure: DesktopRpcProcedure, handler: DesktopRpcHandler): void {
    if (this.#handlers.has(procedure)) {
      throw new Error(`Desktop RPC procedure ${procedure} is already registered`);
    }
    this.#handlers.set(procedure, handler);
    const domain = desktopRpcDomain(procedure);
    if (this.#registeredDomains.has(domain)) return;
    this.#registeredDomains.add(domain);
    this.contents.ipc.handle(DESKTOP_RPC_CHANNELS[domain], (event, raw: unknown) => {
      const request = DesktopRpcRequestSchema.parse(raw);
      if (desktopRpcDomain(request.procedure) !== domain) {
        throw new Error(`Desktop RPC procedure ${request.procedure} is on the wrong channel`);
      }
      const registered = this.#handlers.get(request.procedure);
      if (registered === undefined) {
        throw new Error(`Desktop RPC procedure ${request.procedure} is unavailable`);
      }
      return registered(event, request.payload);
    });
  }

  dispose(): void {
    for (const domain of this.#registeredDomains) {
      this.contents.ipc.removeHandler(DESKTOP_RPC_CHANNELS[domain]);
    }
    this.#registeredDomains.clear();
    this.#handlers.clear();
  }
}
