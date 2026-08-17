// oxlint-disable typescript/no-explicit-any -- Native TypeScript entry points retain dynamic process, fixture, and injected test-double boundaries.
import { spawn, type SpawnOptions } from "node:child_process";

export interface CommandResult {
    readonly code: number;
    readonly stderr: string;
    readonly stdout: string;
}

export interface ExecuteCommandOptions {
    readonly allowFailure?: boolean;
    readonly capture?: boolean;
    readonly cwd?: string;
    readonly env?: NodeJS.ProcessEnv;
}

export class CommandError extends Error {
    readonly command: string;
    readonly arguments: readonly string[];
    readonly code: number;
    readonly stdout: string;
    readonly stderr: string;

    constructor(
        command: string,
        arguments_: readonly string[],
        code: number,
        stdout: string,
        stderr: string,
    ) {
        super(
            `${command} exited with status ${String(code)}: ${stderr.trim()}`,
        );
        this.name = "CommandError";
        this.command = command;
        this.arguments = arguments_;
        this.code = code;
        this.stdout = stdout;
        this.stderr = stderr;
    }
}

export function executeCommand(
    command: string,
    arguments_: readonly string[],
    options: ExecuteCommandOptions = {},
): Promise<CommandResult> {
    const capture = options.capture ?? false;
    const stdio: SpawnOptions["stdio"] = capture
        ? ["ignore", "pipe", "pipe"]
        : "inherit";

    return new Promise<CommandResult>((resolvePromise, rejectPromise) => {
        const child = spawn(command, arguments_, {
            cwd: options.cwd,
            env: options.env,
            shell: false,
            stdio,
        });
        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];

        if (capture) {
            child.stdout?.on("data", (chunk: Buffer) => stdout.push(chunk));
            child.stderr?.on("data", (chunk: Buffer) => stderr.push(chunk));
        }

        child.once("error", rejectPromise);
        child.once("close", (code: any) => {
            const result = {
                code: code ?? -1,
                stderr: Buffer.concat(stderr).toString("utf8"),
                stdout: Buffer.concat(stdout).toString("utf8"),
            };
            if (result.code === 0 || options.allowFailure === true)
                resolvePromise(result);
            else
                rejectPromise(
                    new CommandError(
                        command,
                        arguments_,
                        result.code,
                        result.stdout,
                        result.stderr,
                    ),
                );
        });
    });
}

export async function captureCommand(
    command: string,
    arguments_: readonly string[],
    options: ExecuteCommandOptions = {},
): Promise<string> {
    const result = await executeCommand(command, arguments_, {
        ...options,
        capture: true,
    });
    return result.stdout.trim();
}
