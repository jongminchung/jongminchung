import {
    chmod,
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
            .map((directory) =>
                rm(directory, { recursive: true, force: true }),
            ),
    );
});

describe("TerminalLaunchTargetResolver", () => {
    it("returns only source-defined descriptor IDs and resolves installed executables canonically", async () => {
        const bin = await mkdtemp(
            join(tmpdir(), "git-client-terminal-targets-"),
        );
        temporaryDirectories.push(bin);
        const codex = await executable(bin, "codex");
        await executable(bin, "claude");
        const resolver = TerminalLaunchTargetResolver.of({
            defaultShell: "/bin/sh",
            environment: { PATH: bin },
            homeDirectory: bin,
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

    it("rejects PATH symlinks whose canonical executable basename is not allowlisted", async () => {
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
        });

        expect(
            resolver.listTargets().agents.some(({ id }) => id === "codex"),
        ).toBe(false);
        expect(resolver.resolve({ kind: "agent", id: "codex" })).toBeNull();
    });

    it("keeps online INSTALL_AND_RUN outside the local execution policy", () => {
        expect(TERMINAL_AGENT_INSTALLATION_POLICY).toEqual({
            supportedMode: "RUN",
            excludedMode: "INSTALL_AND_RUN",
            divergenceId: "terminal-agent-installation",
            category: "external-service",
        });
    });
});
