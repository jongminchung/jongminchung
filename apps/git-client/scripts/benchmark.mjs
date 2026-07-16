import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

const commitCount = Number.parseInt(process.env.GIT_CLIENT_BENCHMARK_COMMITS ?? "100000", 10);
const fixture = await mkdtemp(join(tmpdir(), "git-client-benchmark-"));

function command(program, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve(Buffer.concat(stdout))
        : reject(new Error(`${program} exited ${code}: ${Buffer.concat(stderr).toString()}`)),
    );
  });
}

async function write(stream, value) {
  if (!stream.write(value)) await once(stream, "drain");
}

try {
  await command("git", ["init", "--bare", fixture]);
  const importer = spawn("git", ["fast-import", "--quiet"], {
    cwd: fixture,
    stdio: ["pipe", "ignore", "pipe"],
  });
  const errors = [];
  importer.stderr.on("data", (chunk) => errors.push(chunk));
  await write(importer.stdin, "blob\nmark :1\ndata 1\nx\n");
  for (let index = 0; index < commitCount; index += 1) {
    const mark = index + 2;
    const timestamp = 1_700_000_000 + index;
    await write(
      importer.stdin,
      `commit refs/heads/main\nmark :${mark}\ncommitter Benchmark <benchmark@example.com> ${timestamp} +0000\ndata ${String(index).length}\n${index}\n${index > 0 ? `from :${mark - 1}\n` : ""}M 100644 :1 fixture.txt\n`,
    );
  }
  importer.stdin.end("done\n");
  const [exitCode] = await once(importer, "close");
  if (exitCode !== 0) throw new Error(`fast-import failed: ${Buffer.concat(errors).toString()}`);

  const started = performance.now();
  const output = await command(
    "git",
    ["log", "--max-count=500", "--topo-order", "--format=%H%x00%P%x00%an%x00%at%x00%s%x00%x1e"],
    { cwd: fixture },
  );
  const duration = performance.now() - started;
  const rows = output
    .toString()
    .split("\x1e")
    .filter((record) => record.trim().length > 0).length;
  if (rows !== 500) throw new Error(`expected 500 rows, received ${rows}`);
  if (duration > 2_000)
    throw new Error(`first page took ${duration.toFixed(1)}ms, exceeding 2000ms`);
  console.log(
    JSON.stringify({ commitCount, firstPageRows: rows, firstPageMs: Number(duration.toFixed(1)) }),
  );
} finally {
  await rm(fixture, { recursive: true, force: true });
}
