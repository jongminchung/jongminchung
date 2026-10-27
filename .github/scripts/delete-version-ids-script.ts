import { spawnSync } from "node:child_process";

const [owner, packageName, packageVersion] = process.argv.slice(2);
if (
  process.argv.length !== 5 ||
  owner === undefined ||
  packageName === undefined ||
  packageVersion === undefined
) {
  console.error(
    "Usage: delete-version-ids-script.ts OWNER PACKAGE_NAME VERSION",
  );
  process.exit(1);
}
const endpoint = `/users/${owner}/packages/npm/${packageName}/versions`;
const query = `.[] | select(.name == ${JSON.stringify(packageVersion)}) | .id`;
const result = spawnSync("gh", ["api", "--paginate", endpoint, "--jq", query], {
  encoding: "utf8",
});
if (result.error) throw result.error;
const output = result.stdout + result.stderr;
if (result.status !== 0 && !output.includes("HTTP 404")) {
  console.error(output.trimEnd());
  process.exit(1);
}
if (result.status !== 0 || !output.trim()) {
  console.log(
    `No package version ${packageVersion} for ${packageName}; skipping deletion.`,
  );
} else {
  for (const versionId of result.stdout.split("\n").filter(Boolean)) {
    const deletion = spawnSync(
      "gh",
      ["api", "--method", "DELETE", `${endpoint}/${versionId}`],
      { stdio: "inherit" },
    );
    if (deletion.error) throw deletion.error;
    if (deletion.status !== 0) process.exit(deletion.status ?? 1);
  }
}
