import { describe, expect, it } from "vitest";
import {
    DESKTOP_TRPC_CHANNELS,
    DesktopTrpcRequestSchema,
    LOCAL_HISTORY_TRPC_PROCEDURE_KEYS,
    MAIN_DESKTOP_TRPC_PROCEDURE_KEYS,
    desktopTrpcProcedureContract,
    type DesktopTrpcDomain,
} from "./desktop-trpc";

describe("tRPC 계약 종료", () => {
    it("[성공] 입력 및 출력 분석기를 사용하여 55개의 고유한 프로시저를 정의함", () => {
        const records = {
            ...MAIN_DESKTOP_TRPC_PROCEDURE_KEYS,
            ...LOCAL_HISTORY_TRPC_PROCEDURE_KEYS,
        };
        const paths = Object.entries(records).flatMap(([domain, procedures]) =>
            procedures.map((procedure) => `${domain}.${procedure}`),
        );

        expect(paths).toHaveLength(55);
        expect(new Set(paths).size).toBe(paths.length);
        expect(new Set(Object.values(DESKTOP_TRPC_CHANNELS)).size).toBe(5);
        const authorizationKinds = new Set<string>();
        for (const [rawDomain, procedures] of Object.entries(records)) {
            const domain = rawDomain as DesktopTrpcDomain;
            for (const procedure of procedures) {
                const contract = desktopTrpcProcedureContract(
                    domain,
                    procedure,
                );
                expect(contract?.input).toHaveProperty("safeParse");
                expect(contract?.output).toHaveProperty("safeParse");
                if (contract !== undefined)
                    authorizationKinds.add(contract.authorization.kind);
            }
        }
        expect(authorizationKinds).toEqual(
            new Set(["trusted", "activeCapability", "repositoryCapability"]),
        );
    });

    it("[실패] 알 수 없는 변형 버전 및 추가 캠프 필드를 유지함", () => {
        expect(() =>
            DesktopTrpcRequestSchema.parse({
                version: 2,
                type: "mutation",
                path: "git.query",
                input: {},
            }),
        ).toThrow();
        expect(() =>
            DesktopTrpcRequestSchema.parse({
                version: 1,
                type: "mutation",
                path: "git.query",
                input: {},
                channel: "git-client:git:query",
            }),
        ).toThrow();
    });
});
