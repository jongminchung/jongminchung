import { lstat, readdir, realpath, rm } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

const ELECTRON_FRAMEWORK_RESOURCES = [
  "Contents",
  "Frameworks",
  "Electron Framework.framework",
  "Versions",
  "A",
  "Resources",
];

/**
 * Electron 43 ships separate gender variants for each Chromium locale. English
 * also needs the en_GB variants so a regional English macOS locale never falls
 * through to a locale that the product does not support.
 *
 * Rebased locale mapping:
 *   en      -> en / en_GB
 *   ja      -> ja
 *   ko      -> ko
 *   zh-Hans -> zh_CN
 *   zh-Hant -> zh_TW
 */
export const ELECTRON_LOCALE_ALLOWLIST = Object.freeze([
  "en.lproj",
  "en_FEMININE.lproj",
  "en_GB.lproj",
  "en_GB_FEMININE.lproj",
  "en_GB_MASCULINE.lproj",
  "en_GB_NEUTER.lproj",
  "en_MASCULINE.lproj",
  "en_NEUTER.lproj",
  "ja.lproj",
  "ja_FEMININE.lproj",
  "ja_MASCULINE.lproj",
  "ja_NEUTER.lproj",
  "ko.lproj",
  "ko_FEMININE.lproj",
  "ko_MASCULINE.lproj",
  "ko_NEUTER.lproj",
  "zh_CN.lproj",
  "zh_CN_FEMININE.lproj",
  "zh_CN_MASCULINE.lproj",
  "zh_CN_NEUTER.lproj",
  "zh_TW.lproj",
  "zh_TW_FEMININE.lproj",
  "zh_TW_MASCULINE.lproj",
  "zh_TW_NEUTER.lproj",
]);

const allowedLocales = new Set(ELECTRON_LOCALE_ALLOWLIST);

export function electronFrameworkResourcesPath(buildPath) {
  if (typeof buildPath !== "string" || !isAbsolute(buildPath)) {
    throw new Error("Electron build path must be absolute");
  }
  return packagedElectronFrameworkResourcesPath(join(resolve(buildPath), "Electron.app"));
}

export function packagedElectronFrameworkResourcesPath(appPath) {
  if (typeof appPath !== "string" || !isAbsolute(appPath) || !appPath.endsWith(".app")) {
    throw new Error("Packaged Electron app path must be an absolute .app path");
  }
  return join(resolve(appPath), ...ELECTRON_FRAMEWORK_RESOURCES);
}

async function readLocaleEntries(resourcesPath) {
  const entries = await readdir(resourcesPath, { withFileTypes: true });
  const localeEntries = entries.filter((entry) => entry.name.endsWith(".lproj"));

  for (const entry of localeEntries) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      throw new Error(`Refusing to modify non-directory Electron locale: ${entry.name}`);
    }
  }

  return localeEntries.sort((left, right) => left.name.localeCompare(right.name));
}

async function assertContainedLocaleDirectory(resourcesPath, localeName) {
  const resourcesRealPath = await realpath(resourcesPath);
  const localePath = join(resourcesRealPath, localeName);
  const localeStat = await lstat(localePath);

  if (!localeStat.isDirectory() || localeStat.isSymbolicLink()) {
    throw new Error(`Refusing to modify non-directory Electron locale: ${localeName}`);
  }

  const localeRealPath = await realpath(localePath);
  const relativePath = relative(resourcesRealPath, localeRealPath);
  if (
    relativePath.length === 0 ||
    relativePath.startsWith(`..${sep}`) ||
    relativePath === ".." ||
    isAbsolute(relativePath) ||
    dirname(localeRealPath) !== resourcesRealPath ||
    basename(localeRealPath) !== localeName
  ) {
    throw new Error(`Electron locale resolved outside the expected resources directory: ${localeName}`);
  }

  return localeRealPath;
}

function assertAllowlistPresent(localeNames) {
  const localeNameSet = new Set(localeNames);
  const missingLocales = ELECTRON_LOCALE_ALLOWLIST.filter((locale) => !localeNameSet.has(locale));
  if (missingLocales.length > 0) {
    throw new Error(`Electron locale allowlist is incomplete: ${missingLocales.join(", ")}`);
  }
}

export async function verifyElectronLocales(resourcesPath) {
  const resolvedResourcesPath = await realpath(resourcesPath);
  const localeEntries = await readLocaleEntries(resolvedResourcesPath);
  const localeNames = localeEntries.map((entry) => entry.name);
  assertAllowlistPresent(localeNames);

  const unexpectedLocales = localeNames.filter((locale) => !allowedLocales.has(locale));
  if (unexpectedLocales.length > 0) {
    throw new Error(`Unexpected Electron locales remain: ${unexpectedLocales.join(", ")}`);
  }

  for (const localeName of localeNames) {
    await assertContainedLocaleDirectory(resolvedResourcesPath, localeName);
  }

  return Object.freeze({ resourcesPath: resolvedResourcesPath, locales: Object.freeze(localeNames) });
}

export async function pruneElectronLocales({ buildPath, platform }) {
  if (platform !== "darwin") {
    return Object.freeze({ skipped: true, removed: Object.freeze([]), kept: Object.freeze([]) });
  }

  const resourcesPath = electronFrameworkResourcesPath(buildPath);
  const resolvedResourcesPath = await realpath(resourcesPath);
  const localeEntries = await readLocaleEntries(resolvedResourcesPath);
  const localeNames = localeEntries.map((entry) => entry.name);
  assertAllowlistPresent(localeNames);

  const removableLocales = localeNames.filter((locale) => !allowedLocales.has(locale));
  const removablePaths = [];
  for (const localeName of removableLocales) {
    removablePaths.push(await assertContainedLocaleDirectory(resolvedResourcesPath, localeName));
  }

  for (const localePath of removablePaths) {
    await rm(localePath, { recursive: true, force: false });
  }

  const verification = await verifyElectronLocales(resolvedResourcesPath);
  return Object.freeze({
    skipped: false,
    resourcesPath: verification.resourcesPath,
    removed: Object.freeze(removableLocales),
    kept: verification.locales,
  });
}
