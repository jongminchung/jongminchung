import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const lycheeImage =
  process.env.LYCHEE_IMAGE || "docker.io/lycheeverse/lychee:0.24.2";
const containerRuntime = ["podman", "docker"].find(
  (name) => spawnSync("which", [name], { stdio: "ignore" }).status === 0,
);
if (!containerRuntime) {
  console.error("Podman or Docker is required to run the link checker");
  process.exit(1);
}
const result = spawnSync(
  containerRuntime,
  [
    "run",
    "--init",
    "--rm",
    "--volume",
    `${repositoryRoot}:/workspace:ro`,
    "--workdir",
    "/workspace",
    lycheeImage,
    "--offline",
    "--no-progress",
    "--include-fragments=anchor-only",
    "--extensions",
    "md,html",
    ".",
  ],
  { stdio: "inherit" },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
