import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const archive = process.argv[2];
if (!archive)
  throw new Error("Usage: verify-tooling-consumers.ts <tarball> [--published]");
const archivePath = resolve(archive);
const expectedIntegrity = `sha512-${createHash("sha512")
  .update(await readFile(archivePath))
  .digest("base64")}`;
const published = process.argv.includes("--published");
const directory = await mkdtemp(join(tmpdir(), "tooling-consumer-"));
const options = {
  cwd: directory,
  encoding: "utf8" as const,
  maxBuffer: 10 * 1024 * 1024,
};
const packageName = "@jongminchung/tooling";

try {
  await writeFile(
    join(directory, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
  );
  await writeFile(
    join(directory, ".npmrc"),
    "@jongminchung:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}\n",
  );
  if (published) {
    const { stdout } = await exec(
      "npm",
      [
        "view",
        `${packageName}@1.0.0`,
        "dist.integrity",
        "--json",
        "--prefer-online",
      ],
      options,
    );
    assert.equal(
      JSON.parse(stdout),
      expectedIntegrity,
      "registry must serve the exact validated archive",
    );
  }
  await exec(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      published ? `${packageName}@1.0.0` : archivePath,
      "oxfmt@0.66.0",
    ],
    options,
  );
  for (const dependency of ["oxlint", "oxlint-tsgolint"]) {
    await assert.rejects(
      access(join(directory, "node_modules", dependency)),
      `${dependency} must remain optional`,
    );
  }
  if (published) {
    const lock = JSON.parse(
      await readFile(join(directory, "package-lock.json"), "utf8"),
    ) as { packages: Record<string, { integrity?: string }> };
    assert.equal(
      lock.packages[`node_modules/${packageName}`]?.integrity,
      expectedIntegrity,
    );
  }
  await writeFile(
    join(directory, ".editorconfig"),
    "root = true\n[*]\nindent_style = space\nindent_size = 2\nmax_line_length = 80\nend_of_line = lf\ninsert_final_newline = true\n[*.md]\nindent_size = 4\ntrim_trailing_whitespace = false\n",
  );
  await writeFile(
    join(directory, "oxfmt.config.ts"),
    'import { defineOxfmtConfig } from "@jongminchung/tooling/oxfmt";\nexport default defineOxfmtConfig();\n',
  );
  await writeFile(join(directory, "sample.json"), '{\n"value":true\n}\n');
  await writeFile(
    join(directory, "sample.md"),
    "- parent\n  - child  \n    continued\n",
  );
  const formatter = join(directory, "node_modules/.bin/oxfmt");
  await exec(
    formatter,
    ["-c", "oxfmt.config.ts", "sample.json", "sample.md"],
    options,
  );
  const markdown = await readFile(join(directory, "sample.md"), "utf8");
  assert.match(markdown, /\n {4}- child {2}\n {6}continued/);
  assert.equal(
    await readFile(join(directory, "sample.json"), "utf8"),
    '{\n  "value": true\n}\n',
  );
  await exec(
    formatter,
    ["-c", "oxfmt.config.ts", "--check", "sample.json", "sample.md"],
    options,
  );

  await exec(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "oxlint@1.81.0",
      "oxlint-tsgolint@7.0.2001",
      "typescript@7.0.2",
    ],
    options,
  );
  await writeFile(
    join(directory, "oxlint.config.ts"),
    'import { defineOxlintConfig } from "@jongminchung/tooling/oxlint";\nexport default defineOxlintConfig();\n',
  );
  await writeFile(
    join(directory, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        target: "ESNext",
        module: "NodeNext",
        noEmit: true,
      },
      include: ["sample.ts"],
    }),
  );
  await writeFile(
    join(directory, "sample.ts"),
    "export const answer: number = 42;\n",
  );
  const linter = join(directory, "node_modules/.bin/oxlint");
  await exec(linter, ["-c", "oxlint.config.ts", "sample.ts"], options);
  await writeFile(
    join(directory, "sample.ts"),
    "const callback: () => void = async () => {};\nexport { callback };\n",
  );
  try {
    await exec(linter, ["-c", "oxlint.config.ts", "sample.ts"], options);
    assert.fail(
      "type-aware lint must reject a Promise assigned to a void callback",
    );
  } catch (error) {
    const output = error as { stdout?: string; stderr?: string };
    assert.match(
      `${output.stdout ?? ""}${output.stderr ?? ""}`,
      /no-misused-promises/,
    );
  }
  console.log(
    `Verified formatter-only and type-aware consumers: ${expectedIntegrity}`,
  );
} finally {
  await rm(directory, { force: true, recursive: true });
}
