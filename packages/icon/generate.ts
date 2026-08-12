import { fileURLToPath } from "node:url";
import { generateIconAssets } from "./src/assets.ts";
import { iconAssetTargets } from "./src/targets.ts";

const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url));

async function main(): Promise<void> {
    await generateIconAssets(workspaceRoot);
    process.stdout.write(
        `Generated ${iconAssetTargets.length} canonical icon assets.\n`,
    );
}

await main();
