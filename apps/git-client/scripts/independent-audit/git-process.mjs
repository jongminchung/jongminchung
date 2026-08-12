import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const ISOLATED_GIT_ENV = Object.freeze({
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0",
    LC_ALL: "C",
    TZ: "UTC",
});

export async function runGit(
    repositoryPath,
    args,
    { env = {}, acceptedExitCodes = [0] } = {},
) {
    try {
        const result = await execFileAsync("git", args, {
            cwd: repositoryPath,
            encoding: "utf8",
            env: { ...process.env, ...ISOLATED_GIT_ENV, ...env },
            maxBuffer: 16 * 1024 * 1024,
        });
        return Object.freeze({
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: 0,
        });
    } catch (error) {
        if (!isExecFileError(error) || !acceptedExitCodes.includes(error.code))
            throw error;
        return Object.freeze({
            stdout: error.stdout ?? "",
            stderr: error.stderr ?? "",
            exitCode: error.code,
        });
    }
}

function isExecFileError(error) {
    return (
        error instanceof Error &&
        "code" in error &&
        typeof error.code === "number" &&
        "stdout" in error &&
        "stderr" in error
    );
}
