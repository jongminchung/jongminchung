import assert from "node:assert/strict";
import { access, glob, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

interface SourceExport {
  readonly source: string;
  readonly types: string;
  readonly import: string;
}

const packageRoot = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(
  await readFile(resolve(packageRoot, "package.json"), "utf8"),
) as {
  readonly name: string;
  readonly exports: Record<string, string | SourceExport>;
};
const sourceMode = process.argv[2] === "source";
let verified = 0;

// 배포 JS glob만 확인하면 빌드에서 누락된 원본을 발견하지 못하므로 source에서 출발함.
for (const [subpath, target] of Object.entries(manifest.exports)) {
  if (typeof target === "string") {
    await access(resolve(packageRoot, target));
    assert.equal(
      import.meta.resolve(manifest.name + subpath.slice(1)),
      pathToFileURL(resolve(packageRoot, target)).href,
    );
    continue;
  }
  const sources = await Array.fromAsync(
    glob(target.source, { cwd: packageRoot }),
  );
  for (const source of sources) {
    const sourcePattern: string = target.source.replace(/^\.\//u, "");
    const star = sourcePattern.indexOf("*");
    const wildcard =
      star < 0
        ? ""
        : source.slice(star, source.length - (sourcePattern.length - star - 1));
    const specifier = manifest.name + subpath.slice(1).replace("*", wildcard);
    const resolveTarget = (pattern: string): string =>
      resolve(packageRoot, pattern.replace("*", wildcard));
    // 타입 선언·실행 파일이 모두 있어야 소비 프로젝트의 typecheck와 실행이 함께 성공함.
    await access(resolveTarget(target.types));
    await access(resolveTarget(target.import));
    assert.equal(
      import.meta.resolve(specifier),
      pathToFileURL(resolveTarget(sourceMode ? target.source : target.import))
        .href,
      specifier,
    );
    if (!sourceMode) await import(specifier);
    verified++;
  }
}
assert.ok(verified > 0, "No public source modules were checked");
console.log(
  `Verified ${verified} UI exports in ${sourceMode ? "source" : "Node ESM"} mode`,
);
