import { describe, expect, it, vi } from "vitest";
import {
  DESKTOP_TRPC_CHANNELS,
  DESKTOP_TRPC_PROTOCOL_VERSION,
  DesktopTrpcResponseSchema,
  MAIN_DESKTOP_TRPC_PROCEDURE_KEYS,
  mainDesktopTrpcRouter,
} from "../../src/shared/contracts/desktop-trpc";
import { NativeError } from "../shared/native-error";
import { DesktopTrpcHost } from "./desktop-trpc-host";

type Handler = (event: unknown, raw: unknown) => unknown;

function fixture() {
  const handlers = new Map<string, Handler>();
  const contents = {
    ipc: {
      handle: (channel: string, handler: Handler): void => {
        handlers.set(channel, handler);
      },
      removeHandler: (channel: string): void => {
        handlers.delete(channel);
      },
    },
  };
  const authorize = vi.fn();
  const host = new DesktopTrpcHost({
    router: mainDesktopTrpcRouter,
    contents: contents as never,
    procedureKeys: MAIN_DESKTOP_TRPC_PROCEDURE_KEYS,
    authorize,
  });
  return { authorize, contents, handlers, host };
}

async function dispatch(
  handlers: ReadonlyMap<string, Handler>,
  channel: string,
  request: unknown,
) {
  const handler = handlers.get(channel);
  if (handler === undefined) throw new Error(`Missing handler for ${channel}`);
  return DesktopTrpcResponseSchema.parse(
    await handler({ sender: {} }, request),
  );
}

describe("데스크탑Trpc호스트", () => {
  it("[성공] 창 영역 포트 채널을 통해 입력된 프로시저를 디스플레이함", async () => {
    const { authorize, handlers, host } = fixture();
    const procedure = vi.fn(() => ({
      kind: "electron" as const,
      appVersion: "1.0.0",
      electronVersion: "43.3.0",
      platform: "darwin",
      architecture: "arm64",
      qaFixture: false,
    }));
    host.handle("platform", "runtimeInfo", procedure);

    const response = await dispatch(handlers, DESKTOP_TRPC_CHANNELS.platform, {
      version: DESKTOP_TRPC_PROTOCOL_VERSION,
      type: "query",
      path: "platform.runtimeInfo",
      input: undefined,
    });

    expect(response).toEqual({
      ok: true,
      data: procedure.mock.results[0]?.value,
    });
    expect(authorize).toHaveBeenCalledWith(
      expect.anything(),
      { kind: "trusted" },
      "platform",
      "runtimeInfo",
      undefined,
    );
    expect(procedure).toHaveBeenCalledOnce();
  });

  it("[실패] 잘못된 채널, 작업 유형, 버전 및 사용할 수 없는 핸들러를 갖고 있음", async () => {
    const { handlers, host } = fixture();
    host.handle("platform", "runtimeInfo", () => ({
      kind: "electron" as const,
      appVersion: "1.0.0",
      electronVersion: "43.3.0",
      platform: "darwin",
      architecture: "arm64",
      qaFixture: false,
    }));
    const base = {
      version: DESKTOP_TRPC_PROTOCOL_VERSION,
      type: "query",
      path: "platform.runtimeInfo",
      input: undefined,
    } as const;

    await expect(
      dispatch(handlers, DESKTOP_TRPC_CHANNELS.git, base),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "INTERNAL_SERVER_ERROR", field: null },
    });
    await expect(
      dispatch(handlers, DESKTOP_TRPC_CHANNELS.platform, {
        ...base,
        type: "mutation",
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "INTERNAL_SERVER_ERROR", field: null },
    });
    await expect(
      dispatch(handlers, DESKTOP_TRPC_CHANNELS.platform, {
        ...base,
        version: 2,
      }),
    ).resolves.toMatchObject({ ok: false });
    await expect(
      dispatch(handlers, DESKTOP_TRPC_CHANNELS.platform, {
        ...base,
        path: "platform.clipboardReadText",
        input: undefined,
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "INTERNAL_SERVER_ERROR", field: null },
    });

    host.dispose();
    expect(handlers.size).toBe(0);
  });

  it("[성공] 반환을 인정하고 삭제된 것을 거부함", async () => {
    const { handlers, host } = fixture();
    host.handle(
      "platform",
      "windowGetFullScreen",
      () => "not-a-boolean" as never,
    );

    const response = await dispatch(handlers, DESKTOP_TRPC_CHANNELS.platform, {
      version: DESKTOP_TRPC_PROTOCOL_VERSION,
      type: "query",
      path: "platform.windowGetFullScreen",
      input: undefined,
    });

    expect(response).toMatchObject({
      ok: false,
      error: { code: "INTERNAL_SERVER_ERROR" },
    });
    expect(JSON.stringify(response)).not.toContain("stack");
  });

  it("[실패] 안정적인 native 오류 정보만 renderer 경계로 전달함", async () => {
    const { handlers, host } = fixture();
    host.handle("platform", "settingsGet", () => {
      throw NativeError.create(
        "settings.invalid",
        "Settings value is invalid.",
        "appearance",
      );
    });

    const response = await dispatch(handlers, DESKTOP_TRPC_CHANNELS.platform, {
      version: DESKTOP_TRPC_PROTOCOL_VERSION,
      type: "query",
      path: "platform.settingsGet",
      input: { key: "appearance" },
    });

    expect(response).toEqual({
      ok: false,
      error: {
        code: "settings.invalid",
        message: "Settings value is invalid.",
        field: "appearance",
      },
    });
  });
});
