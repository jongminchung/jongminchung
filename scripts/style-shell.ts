import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { $ } from "bun";

const root = resolve(import.meta.dir, "..");
const mode = process.argv[2];
if (!mode || !["write", "check", "syntax", "lint"].includes(mode)) {
  console.error("Usage: style-shell.ts write|check|syntax|lint");
  process.exit(2);
}

// Git excludes ignored output; stat excludes deleted files still in the index.
const listed =
  await $`git ls-files --cached --others --exclude-standard -z -- '*.sh'`
    .cwd(root)
    .text();
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
  // shfmt reads indentation and language settings from .editorconfig and shebangs.
  case "write":
  case "check":
    await $`${process.env.SHFMT_BIN || "shfmt"} ${mode === "write" ? "-w" : "-d"} ${files}`.cwd(
      root,
    );
    break;
  case "lint":
    await $`${process.env.SHELLCHECK_BIN || "shellcheck"} ${`--severity=${process.env.SHELLCHECK_SEVERITY || "style"}`} ${files}`.cwd(
      root,
    );
    break;
  case "syntax":
    for (const file of files) {
      const firstLine =
        (await Bun.file(resolve(root, file)).text()).split("\n")[0] ?? "";
      await $`${firstLine.includes("bash") ? "bash" : "sh"} -n ${file}`.cwd(
        root,
      );
    }
    console.log("PASS shell syntax checks");
    break;
}
