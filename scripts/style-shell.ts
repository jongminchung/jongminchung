import { spawnSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const mode = process.argv[2];
if (!mode || !["write", "check", "syntax", "lint"].includes(mode)) {
  console.error("Usage: style-shell.ts write|check|syntax|lint");
  process.exit(2);
}
function run(command: string, args: string[], capture = false): string {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result.stdout ?? "";
}
const listed = run(
  "git",
  [
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "-z",
    "--",
    "*.sh",
  ],
  true,
);
const excluded = new Set([
  "node_modules",
  ".obsidian",
  "3_Resource",
  "vendor",
  ".venv",
  "venv",
  "dist",
  "build",
]);
const files: string[] = [];
for (const file of [...new Set(listed.split("\0"))].sort()) {
  if (!file || file.split("/").some((part) => excluded.has(part))) continue;
  if (
    await stat(resolve(root, file)).then(
      (entry) => entry.isFile(),
      () => false,
    )
  )
    files.push(file);
}
if (files.length === 0) process.exit(0);

switch (mode) {
  case "write":
  case "check":
    run(process.env.SHFMT_BIN || "shfmt", [
      mode === "write" ? "-w" : "-d",
      ...files,
    ]);
    break;
  case "lint":
    run(process.env.SHELLCHECK_BIN || "shellcheck", [
      `--severity=${process.env.SHELLCHECK_SEVERITY || "style"}`,
      ...files,
    ]);
    break;
  case "syntax":
    for (const file of files) {
      const firstLine =
        (await readFile(resolve(root, file), "utf8")).split("\n")[0] ?? "";
      run(firstLine.includes("bash") ? "bash" : "sh", ["-n", file]);
    }
    console.log("PASS shell syntax checks");
    break;
}
