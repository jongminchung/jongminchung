import { fileURLToPath } from "node:url";
import { checkIconAssets } from "./src/assets.ts";

const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url));

async function main(): Promise<void> {
  const differences = await checkIconAssets(workspaceRoot);
  if (differences.length === 0) {
    process.stdout.write("Icon assets match the canonical source.\n");
    return;
  }

  process.stderr.write("Icon assets are stale, missing, or unmapped:\n");
  for (const difference of differences) {
    process.stderr.write(`- ${difference.path}: ${difference.reason}\n`);
  }
  process.stderr.write(
    "Resolve app mappings in packages/icon/src/targets.ts, then run `pnpm icon:generate`.\n",
  );
  process.exitCode = 1;
}

await main();
