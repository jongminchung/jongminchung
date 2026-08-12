import { describe, expect, it } from "vitest";
import {
  DESKTOP_RPC_CHANNELS,
  DesktopRpcRequestSchema,
  RPC_PROCEDURES,
  desktopRpcChannel,
  desktopRpcDomain,
} from "./desktop-rpc";

describe("desktop RPC contract", () => {
  it("maps every unique procedure to one of five domain channels", () => {
    const procedures = Object.values(RPC_PROCEDURES);
    expect(procedures).toHaveLength(55);
    expect(new Set(procedures).size).toBe(procedures.length);
    expect(new Set(Object.values(DESKTOP_RPC_CHANNELS)).size).toBe(5);
    for (const procedure of procedures) {
      const domain = desktopRpcDomain(procedure);
      expect(desktopRpcChannel(procedure)).toBe(DESKTOP_RPC_CHANNELS[domain]);
    }
  });

  it("rejects unknown procedures and extra envelope fields", () => {
    expect(() =>
      DesktopRpcRequestSchema.parse({ procedure: "git.unknown", payload: {} }),
    ).toThrow();
    expect(() =>
      DesktopRpcRequestSchema.parse({
        procedure: RPC_PROCEDURES.gitQuery,
        payload: {},
        channel: "git-client:git:query",
      }),
    ).toThrow();
  });
});
