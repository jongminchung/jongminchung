import { resolve } from "node:path";
import { $ } from "bun";

const repositoryRoot = resolve(import.meta.dir, "..");
const lycheeImage = process.env.LYCHEE_IMAGE || "lycheeverse/lychee:0.24.2";

if (!Bun.which("docker")) {
  console.error("Docker is required to run the link checker");
  process.exit(1);
}

await $`docker run --init --rm \
  --volume ${`${repositoryRoot}:/workspace:ro`} \
  --workdir /workspace \
  ${lycheeImage} \
  --offline \
  --no-progress \
  --include-fragments=anchor-only \
  --extensions md,html \
  .`;
