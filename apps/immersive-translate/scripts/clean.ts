#!/usr/bin/env bun

const outputTargets = [".output"] as const;
const testTargets = ["test-results", "playwright-report"] as const;
const wxtTargets = [".wxt"] as const;
const viteTargets = ["node_modules/.vite", ".vite"] as const;

function hasFlag(name: string): boolean {
  return Bun.argv.includes(name);
}

function selectedTargets(): readonly string[] {
  const cleanAll = hasFlag("--all");
  const cleanOutputs = cleanAll || hasFlag("--outputs") || Bun.argv.length === 2;
  const cleanTests = cleanAll || hasFlag("--tests") || Bun.argv.length === 2;
  const cleanWxt = cleanAll || hasFlag("--wxt");
  const cleanVite = cleanAll || hasFlag("--vite");

  return [
    ...(cleanOutputs ? outputTargets : []),
    ...(cleanTests ? testTargets : []),
    ...(cleanWxt ? wxtTargets : []),
    ...(cleanVite ? viteTargets : []),
  ];
}

async function main(): Promise<void> {
  const targets = selectedTargets();

  if (targets.length === 0) {
    console.log("Nothing selected. Use --outputs, --tests, --wxt, --vite, or --all.");
    return;
  }

  await Bun.$`rm -rf ${targets}`;
  console.log(`Removed ${targets.join(", ")}`);
}

await main();

export {};
