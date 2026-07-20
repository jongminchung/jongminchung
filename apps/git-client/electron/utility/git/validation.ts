import { isAbsolute, normalize, sep } from "node:path";
import { GitUtilityError } from "./git-error";

export function validateRepositoryPath(path: string): void {
  if (path.length === 0 || path.length > 16_384) {
    throw new GitUtilityError("invalidInput", "Repository path must contain 1 to 16384 characters");
  }
  if (path.includes("\0")) {
    throw new GitUtilityError("invalidInput", "Repository path must not contain a null byte");
  }
  if (!isAbsolute(path)) {
    throw new GitUtilityError("invalidInput", "Repository path must be absolute");
  }
}

export function validateRevision(revision: string): void {
  if (revision.length === 0 || revision.length > 512) {
    throw new GitUtilityError("invalidInput", "Revision must contain 1 to 512 characters");
  }
  const containsUnsafeCharacter = Array.from(revision).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x20 || codePoint === 0x7f;
  });
  if (revision.startsWith("-") || containsUnsafeCharacter) {
    throw new GitUtilityError("invalidInput", "Revision contains an unsafe character");
  }
}

export function validateRelativePath(path: string): void {
  if (path.length === 0 || path.length > 16_384 || path.includes("\0")) {
    throw new GitUtilityError(
      "invalidInput",
      "Path must contain 1 to 16384 characters without null bytes",
    );
  }
  const normalized = normalize(path);
  if (isAbsolute(path) || normalized === ".." || normalized.startsWith(`..${sep}`)) {
    throw new GitUtilityError("invalidInput", "Path must stay inside the repository");
  }
}
