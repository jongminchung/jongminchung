import { resolve } from "node:path";
import { $ } from "bun";

const repositoryRoot = resolve(import.meta.dir, "..");
const lycheeImage =
  process.env.LYCHEE_IMAGE || "docker.io/lycheeverse/lychee:0.24.2";
const containerRuntime = Bun.which("podman") ?? Bun.which("docker");

if (containerRuntime === null) {
  console.error("Podman or Docker is required to run the link checker");
  process.exit(1);
}

await $`${containerRuntime} run --init --rm \
  --volume ${`${repositoryRoot}:/workspace:ro`} \
  --workdir /workspace \
  ${lycheeImage} \
  --offline \
  --no-progress \
  --include-fragments=anchor-only \
  --extensions md,html \
  .`;
