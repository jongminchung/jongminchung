import {
  TRPCError,
  type AnyTRPCRouter,
  type inferRouterInputs,
  type inferRouterOutputs,
} from "@trpc/server";
import type { IpcMainInvokeEvent, WebContents } from "electron";
import {
  DESKTOP_TRPC_CHANNELS,
  DesktopTrpcRequestSchema,
  DesktopTrpcResponseSchema,
  desktopTrpcProcedureContract,
  type DesktopTrpcAuthorization,
  type DesktopTrpcDomain,
} from "../../src/shared/contracts/desktop-trpc";
import { NativeError } from "../shared/native-error";

type Awaitable<T> = T | Promise<T>;
type HandlerOutput<T> = [T] extends [never]
  ? void
  : [T] extends [undefined]
    ? void
    : T;
type RouterInputs<TRouter extends AnyTRPCRouter> = inferRouterInputs<TRouter>;
type RouterOutputs<TRouter extends AnyTRPCRouter> = inferRouterOutputs<TRouter>;
type RouterDomain<TRouter extends AnyTRPCRouter> = Extract<
  keyof RouterInputs<TRouter>,
  DesktopTrpcDomain
>;
type RouterProcedure<
  TRouter extends AnyTRPCRouter,
  TDomain extends RouterDomain<TRouter>,
> = Extract<
  keyof RouterInputs<TRouter>[TDomain] & keyof RouterOutputs<TRouter>[TDomain],
  string
>;

type UntypedHandler = (event: IpcMainInvokeEvent, input: never) => unknown;

interface DesktopTrpcHostOptions<TRouter extends AnyTRPCRouter> {
  readonly router: TRouter;
  readonly contents: WebContents;
  readonly procedureKeys: Readonly<{
    [TDomain in RouterDomain<TRouter>]: readonly RouterProcedure<
      TRouter,
      TDomain
    >[];
  }>;
  readonly authorize: (
    event: IpcMainInvokeEvent,
    authorization: DesktopTrpcAuthorization,
    domain: RouterDomain<TRouter>,
    procedure: string,
    input: unknown,
  ) => void | Promise<void>;
}

export class DesktopTrpcHost<TRouter extends AnyTRPCRouter> {
  readonly #router: TRouter;
  readonly #contents: WebContents;
  readonly #authorize: DesktopTrpcHostOptions<TRouter>["authorize"];
  readonly #procedureKeys = new Map<
    RouterDomain<TRouter>,
    ReadonlySet<string>
  >();
  readonly #handlers = new Map<string, UntypedHandler>();

  constructor({
    router,
    contents,
    procedureKeys,
    authorize,
  }: DesktopTrpcHostOptions<TRouter>) {
    this.#router = router;
    this.#contents = contents;
    this.#authorize = authorize;
    for (const [rawDomain, rawProcedureKeys] of Object.entries(procedureKeys)) {
      const domain = rawDomain as RouterDomain<TRouter>;
      const allowed = new Set(rawProcedureKeys as readonly string[]);
      this.#procedureKeys.set(domain, allowed);
      contents.ipc.handle(
        DESKTOP_TRPC_CHANNELS[domain],
        (event, raw: unknown) => this.#dispatch(event, domain, allowed, raw),
      );
    }
  }

  handle<
    TDomain extends RouterDomain<TRouter>,
    TProcedure extends RouterProcedure<TRouter, TDomain>,
  >(
    domain: TDomain,
    procedure: TProcedure,
    handler: (
      event: IpcMainInvokeEvent,
      input: RouterInputs<TRouter>[TDomain][TProcedure],
    ) => Awaitable<HandlerOutput<RouterOutputs<TRouter>[TDomain][TProcedure]>>,
  ): void {
    const allowed = this.#procedureKeys.get(domain);
    if (allowed?.has(procedure) !== true) {
      throw new Error(
        `Desktop tRPC procedure ${domain}.${procedure} is unavailable`,
      );
    }
    const path = `${domain}.${procedure}`;
    if (this.#handlers.has(path)) {
      throw new Error(`Desktop tRPC procedure ${path} is already registered`);
    }
    this.#handlers.set(path, handler as UntypedHandler);
  }

  async #dispatch(
    event: IpcMainInvokeEvent,
    channelDomain: RouterDomain<TRouter>,
    allowed: ReadonlySet<string>,
    raw: unknown,
  ): Promise<unknown> {
    try {
      const request = DesktopTrpcRequestSchema.parse(raw);
      const pathSegments = request.path.split(".");
      if (pathSegments.length !== 2)
        throw new Error("Desktop tRPC path must have two segments");
      const [domain, procedure] = pathSegments;
      if (domain !== channelDomain) {
        throw new Error(
          `Desktop tRPC procedure ${request.path} is on the wrong channel`,
        );
      }
      if (procedure === undefined || !allowed.has(procedure)) {
        throw new Error(
          `Desktop tRPC procedure ${request.path} is unavailable`,
        );
      }
      const contract = desktopTrpcProcedureContract(channelDomain, procedure);
      if (contract === undefined || contract.type !== request.type) {
        throw new Error(
          `Desktop tRPC procedure ${request.path} does not accept ${request.type}`,
        );
      }
      const caller = this.#router.createCaller({
        authorize: async (
          authorization: DesktopTrpcAuthorization,
          authorizedDomain: DesktopTrpcDomain,
          authorizedProcedure: string,
          input: unknown,
        ) => {
          await this.#authorize(
            event,
            authorization,
            authorizedDomain as RouterDomain<TRouter>,
            authorizedProcedure,
            input,
          );
        },
        invoke: (
          invokedDomain: DesktopTrpcDomain,
          invokedProcedure: string,
          input: unknown,
        ) => {
          const handler = this.#handlers.get(
            `${invokedDomain}.${invokedProcedure}`,
          );
          if (handler === undefined) {
            throw new Error(
              `Desktop tRPC procedure ${invokedDomain}.${invokedProcedure} is unavailable`,
            );
          }
          return handler(event, input as never);
        },
      });
      const domainCaller: unknown = Reflect.get(caller, channelDomain);
      const procedureCaller: unknown = Reflect.get(
        domainCaller as object,
        procedure,
      );
      if (typeof procedureCaller !== "function") {
        throw new Error(
          `Desktop tRPC procedure ${request.path} is unavailable`,
        );
      }
      const data: unknown = await Reflect.apply(procedureCaller, domainCaller, [
        request.input,
      ]);
      return DesktopTrpcResponseSchema.parse({ ok: true, data });
    } catch (error) {
      const nativeError = NativeError.find(error);
      const message =
        nativeError?.message ??
        (error instanceof Error && error.message.length > 0
          ? error.message
          : "Desktop RPC failed");
      const code =
        nativeError?.code ??
        (error instanceof TRPCError ? error.code : "INTERNAL_SERVER_ERROR");
      return DesktopTrpcResponseSchema.parse({
        ok: false,
        error: { code, message, field: nativeError?.field ?? null },
      });
    }
  }

  dispose(): void {
    for (const domain of this.#procedureKeys.keys()) {
      this.#contents.ipc.removeHandler(DESKTOP_TRPC_CHANNELS[domain]);
    }
    this.#procedureKeys.clear();
    this.#handlers.clear();
  }
}
