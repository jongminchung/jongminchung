import { isAbsolute } from "node:path";

export const DEFAULT_PROFILE_NAME = "Git Client Electron";
export const QA_FIXTURE_PROFILE_NAME = "Git Client Electron QA Fixture";
export const QA_HOSTING_PROFILE_NAME = "Git Client Electron QA Hosting";
export const QA_RUNTIME_PROFILE_NAME = "Git Client Electron QA Runtime";
export const QA_SMOKE_PROFILE_NAME = "Git Client Electron QA Smoke";

const QA_HOSTING_CERTIFICATE_ARGUMENT = "--qa-hosting-certificate=";

export interface RuntimeProfile {
    readonly hostingCertificatePath: string | null;
    readonly name: string;
    readonly qaFixture: boolean;
    readonly qaSmokeTest: boolean;
}

function includes(args: readonly string[], argument: string): boolean {
    return args.includes(argument);
}

function hostingCertificatePath(args: readonly string[]): string | null {
    const values = args
        .filter((argument) =>
            argument.startsWith(QA_HOSTING_CERTIFICATE_ARGUMENT),
        )
        .map((argument) =>
            argument.slice(QA_HOSTING_CERTIFICATE_ARGUMENT.length),
        );
    if (values.length === 0) return null;
    if (values.length !== 1 || values[0]?.trim().length === 0)
        throw new Error("QA hosting requires exactly one certificate path");
    const value = values[0];
    if (value === undefined || !isAbsolute(value))
        throw new Error("QA hosting certificate path must be absolute");
    return value;
}

export function resolveRuntimeProfile(args: readonly string[]): RuntimeProfile {
    const qaFixture = includes(args, "--qa-fixture");
    const qaHosting = includes(args, "--qa-hosting-profile");
    const qaRuntime = includes(args, "--qa-isolated-profile");
    const qaSmokeTest = includes(args, "--qa-smoke-test");
    const enabledProfiles = [
        qaFixture,
        qaHosting,
        qaRuntime,
        qaSmokeTest,
    ].filter(Boolean).length;
    if (enabledProfiles > 1)
        throw new Error("Electron QA profile arguments are mutually exclusive");

    const certificatePath = hostingCertificatePath(args);
    if (qaHosting !== (certificatePath !== null)) {
        throw new Error(
            "QA hosting profile and certificate path must be provided together",
        );
    }

    const name = qaSmokeTest
        ? QA_SMOKE_PROFILE_NAME
        : qaFixture
          ? QA_FIXTURE_PROFILE_NAME
          : qaHosting
            ? QA_HOSTING_PROFILE_NAME
            : qaRuntime
              ? QA_RUNTIME_PROFILE_NAME
              : DEFAULT_PROFILE_NAME;
    return Object.freeze({
        hostingCertificatePath: certificatePath,
        name,
        qaFixture,
        qaSmokeTest,
    });
}

export function trustsQaHostingCertificate(
    hostname: string,
    fingerprint: string,
    expectedFingerprint: string,
): boolean {
    return (
        hostname === "127.0.0.1" &&
        fingerprint.length > 0 &&
        fingerprint === expectedFingerprint
    );
}
