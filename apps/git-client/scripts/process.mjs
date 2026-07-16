import { spawn } from "node:child_process";

export class CommandError extends Error {
  constructor(command, arguments_, code, stdout, stderr) {
    super(`${command} exited with status ${String(code)}: ${stderr.trim()}`);
    this.name = "CommandError";
    this.command = command;
    this.arguments = arguments_;
    this.code = code;
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

export function executeCommand(command, arguments_, options = {}) {
  const capture = options.capture ?? false;
  const stdio = capture ? ["ignore", "pipe", "pipe"] : "inherit";

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, arguments_, {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      stdio,
    });
    const stdout = [];
    const stderr = [];

    if (capture) {
      child.stdout.on("data", (chunk) => stdout.push(chunk));
      child.stderr.on("data", (chunk) => stderr.push(chunk));
    }

    child.once("error", rejectPromise);
    child.once("close", (code) => {
      const result = {
        code: code ?? -1,
        stderr: Buffer.concat(stderr).toString("utf8"),
        stdout: Buffer.concat(stdout).toString("utf8"),
      };
      if (result.code === 0 || options.allowFailure === true) resolvePromise(result);
      else
        rejectPromise(
          new CommandError(command, arguments_, result.code, result.stdout, result.stderr),
        );
    });
  });
}

export async function captureCommand(command, arguments_, options = {}) {
  const result = await executeCommand(command, arguments_, { ...options, capture: true });
  return result.stdout.trim();
}
