import { fileURLToPath } from "node:url";
import { generateIconAssets } from "./src/assets.ts";

const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url));

async function main(): Promise<void> {
  await generateIconAssets(workspaceRoot);
  process.stdout.write("Generated canonical icon assets for 3 apps.\n");
}

await main();
