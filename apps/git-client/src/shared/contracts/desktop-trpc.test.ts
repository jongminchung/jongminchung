import { describe, expect, it } from "vitest";
import {
    DESKTOP_TRPC_CHANNELS,
    DesktopTrpcRequestSchema,
    LOCAL_HISTORY_TRPC_PROCEDURE_KEYS,
    MAIN_DESKTOP_TRPC_PROCEDURE_KEYS,
    desktopTrpcProcedureContract,
    type DesktopTrpcDomain,
} from "./desktop-trpc";
import {
    BeginHostingOAuthSchema,
    HostingOAuthPromptSchema,
    HostingOAuthSessionIdSchema,
} from "./hosting";

const OAUTH_SESSION_ID = "91af28cc-4493-4ceb-b405-84878dd5dbe8";

describe("tRPC 계약 종료", () => {
    it("[성공] 입력 및 출력 분석기를 사용하여 58개의 고유한 프로시저를 정의함", () => {
        const records = {
            ...MAIN_DESKTOP_TRPC_PROCEDURE_KEYS,
            ...LOCAL_HISTORY_TRPC_PROCEDURE_KEYS,
        };
        const paths = Object.entries(records).flatMap(([domain, procedures]) =>
            procedures.map((procedure) => `${domain}.${procedure}`),
        );

        expect(paths).toHaveLength(58);
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

    it("[성공] OAuth 시작 입력과 두 prompt 변형을 엄격하게 정규화함", () => {
        expect(
            BeginHostingOAuthSchema.parse({
                provider: "gitLab",
                baseUrl: "https://gitlab.example.test/path",
                clientId: "  client-id  ",
            }),
        ).toEqual({
            provider: "gitLab",
            baseUrl: "https://gitlab.example.test",
            clientId: "client-id",
        });
        expect(
            BeginHostingOAuthSchema.parse({
                provider: "gitHub",
                baseUrl: "https://github.com",
                clientId: "   ",
            }).clientId,
        ).toBe("");
        expect(HostingOAuthSessionIdSchema.parse(OAUTH_SESSION_ID)).toBe(
            OAUTH_SESSION_ID,
        );

        expect(
            HostingOAuthPromptSchema.parse({
                kind: "device",
                sessionId: OAUTH_SESSION_ID,
                provider: "gitHub",
                baseUrl: "https://github.com",
                authorizationUrl: "https://github.com/login/device",
                userCode: "ABCD-EFGH",
                expiresAt: 2_000_000_000_000,
            }),
        ).toMatchObject({ kind: "device", userCode: "ABCD-EFGH" });
        expect(
            HostingOAuthPromptSchema.parse({
                kind: "browser",
                sessionId: OAUTH_SESSION_ID,
                provider: "gitLab",
                baseUrl: "https://gitlab.example.test",
                authorizationUrl: "https://gitlab.example.test/oauth/authorize",
                expiresAt: 2_000_000_000_000,
            }),
        ).toMatchObject({ kind: "browser" });
    });

    it("[실패] 잘못된 OAuth client ID와 prompt 자격 증명·변형을 거부함", () => {
        expect(() =>
            BeginHostingOAuthSchema.parse({
                provider: "gitHub",
                baseUrl: "https://github.com",
                clientId: "x".repeat(257),
            }),
        ).toThrow();
        for (const prompt of [
            {
                kind: "device",
                sessionId: OAUTH_SESSION_ID,
                provider: "gitHub",
                baseUrl: "https://github.com",
                authorizationUrl: "https://github.com/login/device",
                expiresAt: 2_000_000_000_000,
            },
            {
                kind: "browser",
                sessionId: OAUTH_SESSION_ID,
                provider: "gitHub",
                baseUrl: "https://github.com",
                authorizationUrl: "https://github.com/oauth/authorize",
                userCode: "MUST-NOT-EXIST",
                expiresAt: 2_000_000_000_000,
            },
            {
                kind: "device",
                sessionId: OAUTH_SESSION_ID,
                provider: "gitHub",
                baseUrl: "https://github.com",
                authorizationUrl: "https://user:secret@github.com/login/device",
                userCode: "ABCD-EFGH",
                expiresAt: 2_000_000_000_000,
            },
        ]) {
            expect(() => HostingOAuthPromptSchema.parse(prompt)).toThrow();
        }
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
