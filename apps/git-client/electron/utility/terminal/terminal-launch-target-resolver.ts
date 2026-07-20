import { constants, accessSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, delimiter, isAbsolute, join, normalize } from "node:path";
import {
  TerminalLaunchTargetSchema,
  TerminalLaunchTargetsSchema,
  type TerminalAgentDescriptor,
  type TerminalAgentId,
  type TerminalLaunchTarget,
  type TerminalLaunchTargets,
  type TerminalShellDescriptor,
  type TerminalShellId,
} from "../../../src/shared/contracts/terminal";

interface TerminalProgramDefinition<Id extends string> {
  readonly id: Id;
  readonly displayName: string;
  readonly binaryName: string;
  readonly canonicalBasenames: readonly string[];
  readonly candidateDirectories: readonly string[];
}

interface DetectedTerminalProgram<Descriptor> {
  readonly descriptor: Descriptor;
  readonly executable: string;
}

export interface ResolvedTerminalLaunchTarget {
  readonly executable: string;
  readonly args: readonly string[];
  readonly title: string;
}

export interface TerminalLaunchTargetResolverPort {
  listTargets(): TerminalLaunchTargets;
  resolve(target: TerminalLaunchTarget): ResolvedTerminalLaunchTarget | null;
}

export const TERMINAL_AGENT_INSTALLATION_POLICY = Object.freeze({
  supportedMode: "RUN",
  excludedMode: "INSTALL_AND_RUN",
  divergenceId: "terminal-agent-installation",
  category: "external-service",
} as const);

const SHELL_DEFINITIONS = Object.freeze([
  {
    id: "zsh",
    displayName: "Zsh",
    binaryName: "zsh",
    canonicalBasenames: ["zsh"],
    candidateDirectories: ["/bin", "/opt/homebrew/bin", "/usr/local/bin"],
  },
  {
    id: "bash",
    displayName: "Bash",
    binaryName: "bash",
    canonicalBasenames: ["bash"],
    candidateDirectories: ["/bin", "/opt/homebrew/bin", "/usr/local/bin"],
  },
  {
    id: "sh",
    displayName: "sh",
    binaryName: "sh",
    canonicalBasenames: ["sh"],
    candidateDirectories: ["/bin"],
  },
  {
    id: "fish",
    displayName: "Fish",
    binaryName: "fish",
    canonicalBasenames: ["fish"],
    candidateDirectories: ["/opt/homebrew/bin", "/usr/local/bin", "$HOME/.local/bin"],
  },
  {
    id: "ksh",
    displayName: "Ksh",
    binaryName: "ksh",
    canonicalBasenames: ["ksh"],
    candidateDirectories: ["/bin", "/opt/homebrew/bin", "/usr/local/bin"],
  },
  {
    id: "csh",
    displayName: "Csh",
    binaryName: "csh",
    canonicalBasenames: ["csh"],
    candidateDirectories: ["/bin"],
  },
  {
    id: "tcsh",
    displayName: "Tcsh",
    binaryName: "tcsh",
    canonicalBasenames: ["tcsh"],
    candidateDirectories: ["/bin", "/opt/homebrew/bin", "/usr/local/bin"],
  },
] as const satisfies readonly TerminalProgramDefinition<TerminalShellId>[]);

const AGENT_DEFINITIONS = Object.freeze([
  {
    id: "junie",
    displayName: "Junie",
    binaryName: "junie",
    canonicalBasenames: ["junie"],
    candidateDirectories: ["$HOME/.local/bin"],
  },
  {
    id: "claude_code",
    displayName: "Claude Code",
    binaryName: "claude",
    canonicalBasenames: ["claude"],
    candidateDirectories: ["$HOME/.local/bin", "/usr/local/bin", "/opt/homebrew/bin"],
  },
  {
    id: "codex",
    displayName: "Codex",
    binaryName: "codex",
    canonicalBasenames: ["codex"],
    candidateDirectories: ["$HOME/.local/bin", "/usr/local/bin", "/opt/homebrew/bin"],
  },
] as const satisfies readonly TerminalProgramDefinition<TerminalAgentId>[]);

export interface TerminalLaunchTargetResolverOptions {
  readonly defaultShell: string;
  readonly environment: Readonly<Record<string, string>>;
  readonly homeDirectory?: string;
}

export class TerminalLaunchTargetResolver implements TerminalLaunchTargetResolverPort {
  readonly #defaultShell: string;
  readonly #environment: Readonly<Record<string, string>>;
  readonly #homeDirectory: string;

  private constructor(options: TerminalLaunchTargetResolverOptions) {
    this.#defaultShell = options.defaultShell;
    this.#environment = options.environment;
    this.#homeDirectory = options.homeDirectory ?? homedir();
  }

  static of(options: TerminalLaunchTargetResolverOptions): TerminalLaunchTargetResolver {
    return new TerminalLaunchTargetResolver(options);
  }

  listTargets(): TerminalLaunchTargets {
    const shells = this.#detectShells();
    const agents = this.#detectAgents();
    return TerminalLaunchTargetsSchema.parse({
      shells: shells.map(({ descriptor }) => descriptor),
      agents: agents.map(({ descriptor }) => descriptor),
    });
  }

  resolve(untrustedTarget: TerminalLaunchTarget): ResolvedTerminalLaunchTarget | null {
    const target = TerminalLaunchTargetSchema.parse(untrustedTarget);
    const shells = this.#detectShells();
    if (target.kind === "default") {
      const configured = this.#probeExactExecutable(
        this.#defaultShell,
        SHELL_DEFINITIONS.flatMap(({ canonicalBasenames }) => canonicalBasenames),
      );
      const detected =
        shells.find(({ executable }) => executable === configured) ?? shells[0] ?? null;
      if (detected === null) return null;
      return {
        executable: detected.executable,
        args: [],
        title: "Local",
      };
    }
    if (target.kind === "shell") {
      const detected = shells.find(({ descriptor }) => descriptor.id === target.id);
      if (detected === undefined) return null;
      return {
        executable: detected.executable,
        args: [],
        title: detected.descriptor.displayName,
      };
    }
    const detected = this.#detectAgents().find(({ descriptor }) => descriptor.id === target.id);
    if (detected === undefined) return null;
    return {
      executable: detected.executable,
      args: [],
      title: detected.descriptor.displayName,
    };
  }

  #detectShells(): readonly DetectedTerminalProgram<TerminalShellDescriptor>[] {
    return SHELL_DEFINITIONS.flatMap((definition) => {
      const executable = this.#firstExecutable(definition, definition.candidateDirectories);
      if (executable === null) return [];
      return [
        {
          descriptor: {
            kind: "shell",
            id: definition.id,
            displayName: definition.displayName,
          },
          executable,
        },
      ];
    });
  }

  #detectAgents(): readonly DetectedTerminalProgram<TerminalAgentDescriptor>[] {
    const pathDirectories = (this.#environment.PATH ?? "")
      .split(delimiter)
      .filter((value) => isAbsolute(value) && normalize(value) === value);
    return AGENT_DEFINITIONS.flatMap((definition) => {
      const executable = this.#firstExecutable(definition, [
        ...pathDirectories,
        ...definition.candidateDirectories,
      ]);
      if (executable === null) return [];
      return [
        {
          descriptor: {
            kind: "agent",
            id: definition.id,
            displayName: definition.displayName,
          },
          executable,
        },
      ];
    });
  }

  #firstExecutable<Id extends string>(
    definition: TerminalProgramDefinition<Id>,
    directories: readonly string[],
  ): string | null {
    const visited = new Set<string>();
    for (const directory of directories) {
      const expandedDirectory = this.#expandDirectory(directory);
      if (expandedDirectory === null) continue;
      const candidate = join(expandedDirectory, definition.binaryName);
      if (visited.has(candidate)) continue;
      visited.add(candidate);
      const executable = this.#probeExactExecutable(candidate, definition.canonicalBasenames);
      if (executable !== null) return executable;
    }
    return null;
  }

  #expandDirectory(directory: string): string | null {
    const expanded = directory.startsWith("$HOME/")
      ? join(this.#homeDirectory, directory.slice("$HOME/".length))
      : directory;
    if (!isAbsolute(expanded) || expanded.includes("\0")) return null;
    return normalize(expanded) === expanded ? expanded : null;
  }

  #probeExactExecutable(candidate: string, canonicalBasenames: readonly string[]): string | null {
    if (!isAbsolute(candidate) || candidate.includes("\0") || normalize(candidate) !== candidate) {
      return null;
    }
    try {
      const canonical = realpathSync.native(candidate);
      if (
        !isAbsolute(canonical) ||
        !canonicalBasenames.includes(basename(canonical)) ||
        !statSync(canonical).isFile()
      ) {
        return null;
      }
      accessSync(canonical, constants.X_OK);
      return canonical;
    } catch {
      return null;
    }
  }
}
