import {
  chmod,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  TERMINAL_AGENT_INSTALLATION_POLICY,
  TerminalLaunchTargetResolver,
} from "./terminal-launch-target-resolver";

const temporaryDirectories: string[] = [];

async function executable(directory: string, name: string): Promise<string> {
  const path = join(directory, name);
  await writeFile(path, "#!/bin/sh\nexit 0\n", "utf8");
  await chmod(path, 0o755);
  return path;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("TerminalLaunchTargetResolver", () => {
  it("[성공] 소스 설명자 ID만 무시하고 파일을 실행하여 확인함", async () => {
    const bin = await mkdtemp(join(tmpdir(), "git-client-terminal-targets-"));
    temporaryDirectories.push(bin);
    const codex = await executable(bin, "codex");
    await executable(bin, "claude");
    const resolver = TerminalLaunchTargetResolver.of({
      defaultShell: "/bin/sh",
      environment: { PATH: bin },
      homeDirectory: bin,
      includeDefaultAgentDirectories: false,
    });

    const targets = resolver.listTargets();
    expect(targets.agents).toEqual([
      { kind: "agent", id: "claude_code", displayName: "Claude Code" },
      { kind: "agent", id: "codex", displayName: "Codex" },
    ]);
    expect(
      targets.agents.every((agent) => !Reflect.has(agent, "executable")),
    ).toBe(true);
    expect(resolver.resolve({ kind: "agent", id: "codex" })).toEqual({
      executable: await realpath(codex),
      args: [],
      title: "Codex",
    });
    expect(resolver.resolve({ kind: "agent", id: "junie" })).toBeNull();
    expect(targets.shells.some(({ id }) => id === "sh")).toBe(true);
  });

  it("[실패] 표준 실행 파일 기본 이름이 허용되는 목록에 없는 PATH 표시 링크를 포함함", async () => {
    const bin = await mkdtemp(
      join(tmpdir(), "git-client-terminal-target-link-"),
    );
    temporaryDirectories.push(bin);
    const impostor = await executable(bin, "impostor");
    await symlink(impostor, join(bin, "codex"));
    const resolver = TerminalLaunchTargetResolver.of({
      defaultShell: "/bin/sh",
      environment: { PATH: bin },
      homeDirectory: bin,
      includeDefaultAgentDirectories: false,
    });

    expect(resolver.listTargets().agents.some(({ id }) => id === "codex")).toBe(
      false,
    );
    expect(resolver.resolve({ kind: "agent", id: "codex" })).toBeNull();
  });

  it("[성공] 기본적으로 무기 에이전트가 포함되었습니다", async () => {
    const home = await mkdtemp(
      join(tmpdir(), "git-client-terminal-target-home-"),
    );
    temporaryDirectories.push(home);
    const bin = join(home, ".local/bin");
    await mkdir(bin, { recursive: true });
    const codex = await executable(bin, "codex");
    const resolver = TerminalLaunchTargetResolver.of({
      defaultShell: "/bin/sh",
      environment: { PATH: "" },
      homeDirectory: home,
    });

    expect(resolver.resolve({ kind: "agent", id: "codex" })).toEqual({
      executable: await realpath(codex),
      args: [],
      title: "Codex",
    });
  });

  it("[성공]계획 실행을 외부에서 온라인 INSTALL_AND_RUN을 유지함", () => {
    expect(TERMINAL_AGENT_INSTALLATION_POLICY).toEqual({
      supportedMode: "RUN",
      excludedMode: "INSTALL_AND_RUN",
      divergenceId: "terminal-agent-installation",
      category: "external-service",
    });
  });
});
