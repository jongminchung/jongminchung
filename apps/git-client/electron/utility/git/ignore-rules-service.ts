import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { RepositoryId } from "../../../src/shared/contracts/git-utility";
import type { IgnoreRules } from "../../../src/shared/contracts/model";
import { GitUtilityError } from "./git-error";
import type { RepositoryRegistry } from "./repository-registry";

export const MAX_IGNORE_RULE_BYTES = 1024 * 1024;

async function readFixedText(path: string): Promise<string> {
  try {
    const metadata = await lstat(path);
    if (metadata.isSymbolicLink()) {
      throw new GitUtilityError("invalidInput", "Ignore rule files must not be symbolic links");
    }
    if (metadata.size > MAX_IGNORE_RULE_BYTES) {
      throw new GitUtilityError("invalidInput", "Ignore rule files must not exceed 1 MiB");
    }
    const content = await readFile(path);
    if (content.byteLength > MAX_IGNORE_RULE_BYTES) {
      throw new GitUtilityError("invalidInput", "Ignore rule files must not exceed 1 MiB");
    }
    const text = content.toString("utf8");
    if (!Buffer.from(text, "utf8").equals(content)) {
      throw new GitUtilityError("invalidInput", "Ignore rule files must contain valid UTF-8");
    }
    return text;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return "";
    }
    throw error;
  }
}

function validateRules(rules: IgnoreRules): void {
  for (const content of [rules.gitignore, rules.infoExclude]) {
    if (Buffer.byteLength(content, "utf8") > MAX_IGNORE_RULE_BYTES) {
      throw new GitUtilityError("invalidInput", "Ignore rules must not exceed 1 MiB per file");
    }
    if (content.includes("\0")) {
      throw new GitUtilityError("invalidInput", "Ignore rules must not contain null bytes");
    }
  }
}

async function writeFixedText(path: string, content: string): Promise<void> {
  const parent = dirname(path);
  await mkdir(parent, { recursive: true });
  const temporaryPath = `${path}.git-client-${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, content, {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(temporaryPath, path);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export class IgnoreRulesService {
  readonly #registry: RepositoryRegistry;

  constructor(registry: RepositoryRegistry) {
    this.#registry = registry;
  }

  async read(repositoryId: RepositoryId): Promise<IgnoreRules> {
    const repository = this.#registry.get(repositoryId);
    const [gitignore, infoExclude] = await Promise.all([
      readFixedText(join(repository.path, ".gitignore")),
      readFixedText(join(repository.gitDirectory, "info", "exclude")),
    ]);
    return { gitignore, infoExclude };
  }

  async write(repositoryId: RepositoryId, rules: IgnoreRules): Promise<void> {
    validateRules(rules);
    const repository = this.#registry.get(repositoryId);
    await writeFixedText(join(repository.path, ".gitignore"), rules.gitignore);
    await writeFixedText(join(repository.gitDirectory, "info", "exclude"), rules.infoExclude);
  }
}
