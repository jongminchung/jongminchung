import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROFILE_NAME,
  QA_HOSTING_PROFILE_NAME,
  QA_RUNTIME_PROFILE_NAME,
  resolveRuntimeProfile,
  trustsQaHostingCertificate,
} from "./runtime-profile";

describe("Electron runtime profiles", () => {
  it("keeps the regular and repository QA profiles separate", () => {
    expect(resolveRuntimeProfile([])).toMatchObject({
      hostingCertificatePath: null,
      name: DEFAULT_PROFILE_NAME,
    });
    expect(resolveRuntimeProfile(["--qa-isolated-profile"])).toMatchObject({
      hostingCertificatePath: null,
      name: QA_RUNTIME_PROFILE_NAME,
    });
  });

  it("requires an absolute certificate only for the isolated hosting profile", () => {
    expect(
      resolveRuntimeProfile([
        "--qa-hosting-profile",
        "--qa-hosting-certificate=/private/tmp/loopback.pem",
      ]),
    ).toMatchObject({
      hostingCertificatePath: "/private/tmp/loopback.pem",
      name: QA_HOSTING_PROFILE_NAME,
    });
    expect(() => resolveRuntimeProfile(["--qa-hosting-profile"])).toThrow(/provided together/u);
    expect(() =>
      resolveRuntimeProfile(["--qa-hosting-certificate=/private/tmp/loopback.pem"]),
    ).toThrow(/provided together/u);
    expect(() =>
      resolveRuntimeProfile(["--qa-hosting-profile", "--qa-hosting-certificate=relative.pem"]),
    ).toThrow(/absolute/u);
  });

  it("rejects conflicting QA profiles", () => {
    expect(() => resolveRuntimeProfile(["--qa-fixture", "--qa-isolated-profile"])).toThrow(
      /mutually exclusive/u,
    );
  });

  it("trusts only the exact loopback certificate fingerprint", () => {
    expect(trustsQaHostingCertificate("127.0.0.1", "AA:BB", "AA:BB")).toBe(true);
    expect(trustsQaHostingCertificate("localhost", "AA:BB", "AA:BB")).toBe(false);
    expect(trustsQaHostingCertificate("127.0.0.1", "AA:BC", "AA:BB")).toBe(false);
  });
});
