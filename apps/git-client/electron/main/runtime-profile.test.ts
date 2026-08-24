import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROFILE_NAME,
  QA_HOSTING_PROFILE_NAME,
  QA_RUNTIME_PROFILE_NAME,
  resolveRuntimeProfile,
  trustsQaHostingCertificate,
} from "./runtime-profile";

describe("전자 프로필", () => {
  it("[성공] 일반 및 채용 QA 프로필을 유지함", () => {
    expect(resolveRuntimeProfile([])).toMatchObject({
      hostingCertificatePath: null,
      name: DEFAULT_PROFILE_NAME,
    });
    expect(resolveRuntimeProfile(["--qa-isolated-profile"])).toMatchObject({
      hostingCertificatePath: null,
      name: QA_RUNTIME_PROFILE_NAME,
    });
  });

  it("[성공] 선정된 유명인 프로필에 최고로 인정받는 사람이 필요함", () => {
    expect(
      resolveRuntimeProfile([
        "--qa-hosting-profile",
        "--qa-hosting-certificate=/private/tmp/loopback.pem",
      ]),
    ).toMatchObject({
      hostingCertificatePath: "/private/tmp/loopback.pem",
      name: QA_HOSTING_PROFILE_NAME,
    });
    expect(() => resolveRuntimeProfile(["--qa-hosting-profile"])).toThrow(
      /provided together/u,
    );
    expect(() =>
      resolveRuntimeProfile([
        "--qa-hosting-certificate=/private/tmp/loopback.pem",
      ]),
    ).toThrow(/provided together/u);
    expect(() =>
      resolveRuntimeProfile([
        "--qa-hosting-profile",
        "--qa-hosting-certificate=relative.pem",
      ]),
    ).toThrow(/absolute/u);
  });

  it("[실패]충돌하는 QA 프로필을 가지고 있음", () => {
    expect(() =>
      resolveRuntimeProfile(["--qa-fixture", "--qa-isolated-profile"]),
    ).toThrow(/mutually exclusive/u);
  });

  it("[성공] 루프백을 세우지 않고서는 믿음을 가질 수 없습니다", () => {
    expect(trustsQaHostingCertificate("127.0.0.1", "AA:BB", "AA:BB")).toBe(
      true,
    );
    expect(trustsQaHostingCertificate("localhost", "AA:BB", "AA:BB")).toBe(
      false,
    );
    expect(trustsQaHostingCertificate("127.0.0.1", "AA:BC", "AA:BB")).toBe(
      false,
    );
  });
});
