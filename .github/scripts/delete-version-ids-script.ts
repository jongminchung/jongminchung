import { $ } from "bun";

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
const result = await $`gh api --paginate ${endpoint} --jq ${query} 2>&1`
  .quiet()
  .nothrow();
const output = result.stdout.toString();
if (result.exitCode !== 0 && !output.includes("HTTP 404")) {
  console.error(output.trimEnd());
  process.exit(1);
}

if (result.exitCode !== 0 || !output.trim()) {
  console.log(
    `No package version ${packageVersion} for ${packageName}; skipping deletion.`,
  );
} else {
  for (const versionId of output.split("\n").filter(Boolean)) {
    await $`gh api --method DELETE ${`${endpoint}/${versionId}`}`;
  }
}
