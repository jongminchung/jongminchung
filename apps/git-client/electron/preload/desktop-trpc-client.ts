import { createTRPCClient, TRPCClientError, type TRPCLink } from "@trpc/client";
import type { AnyTRPCRouter } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { ipcRenderer } from "electron";
import {
  DESKTOP_TRPC_CHANNELS,
  DESKTOP_TRPC_PROTOCOL_VERSION,
  DesktopTrpcRequestSchema,
  DesktopTrpcResponseSchema,
  type DesktopTrpcDomain,
} from "../../src/shared/contracts/desktop-trpc-wire";

function desktopDomain(path: string): DesktopTrpcDomain {
  const domain = path.split(".", 1)[0];
  if (domain === undefined || !Object.hasOwn(DESKTOP_TRPC_CHANNELS, domain)) {
    throw new Error(`Desktop tRPC path ${path} has an unknown domain`);
  }
  return domain as DesktopTrpcDomain;
}

export function createElectronTrpcLink<
  TRouter extends AnyTRPCRouter,
>(): TRPCLink<TRouter> {
  return () =>
    ({ op }) =>
      observable((observer) => {
        let active = true;
        void (async () => {
          try {
            if (op.type === "subscription") {
              throw new Error(
                "Desktop tRPC subscriptions must use the MessagePort stream",
              );
            }
            const domain = desktopDomain(op.path);
            const request = DesktopTrpcRequestSchema.parse({
              version: DESKTOP_TRPC_PROTOCOL_VERSION,
              type: op.type,
              path: op.path,
              input: op.input,
            });
            const response = DesktopTrpcResponseSchema.parse(
              await ipcRenderer.invoke(DESKTOP_TRPC_CHANNELS[domain], request),
            );
            if (!active) return;
            if (!response.ok) {
              observer.error(
                new TRPCClientError<TRouter>(response.error.message, {
                  meta: {
                    code: response.error.code,
                    field: response.error.field,
                  },
                }),
              );
              return;
            }
            observer.next({ result: { data: response.data } });
            observer.complete();
          } catch (error) {
            if (active)
              observer.error(TRPCClientError.from<TRouter>(error as Error));
          }
        })();
        return () => {
          active = false;
        };
      });
}

export function createDesktopTrpcClient<TRouter extends AnyTRPCRouter>() {
  return createTRPCClient<TRouter>({
    links: [createElectronTrpcLink<TRouter>()],
  });
}
