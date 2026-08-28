import { isLocale, locales, type Locale } from "./content-contracts.ts";

export const siteIds = ["home", "tech", "invest"] as const;

export type SiteId = (typeof siteIds)[number];
export { isLocale, locales };
export type { Locale };

const productionHosts: Readonly<Record<string, SiteId>> = {
  "jamie.kr": "home",
  "www.jamie.kr": "home",
  "tech.jamie.kr": "tech",
  "invest.jamie.kr": "invest",
};

const developmentHosts: Readonly<Record<string, SiteId>> = {
  localhost: "home",
  "127.0.0.1": "home",
  "::1": "home",
  "jamie.localhost": "home",
  "tech.jamie.localhost": "tech",
  "invest.jamie.localhost": "invest",
};

const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const vercelDeploymentHostPattern =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.vercel\.app$/u;

/** `parseLocalSiteOverride` 개발 환경의 사이트 선택값을 검증함 */
export function parseLocalSiteOverride(
  nodeEnvironment: string | undefined,
  value: string | undefined,
): SiteId | null {
  if (nodeEnvironment !== "development" || value === undefined) return null;
  if (siteIds.some((site) => site === value)) return value as SiteId;
  throw new Error(
    `JAMIE_LOCAL_SITE must be one of ${siteIds.join(", ")}; received ${JSON.stringify(value)}`,
  );
}

/** `normalizeHost` 공개 기능을 제공함 */
export function normalizeHost(value: string | null): string {
  const host = value?.trim().toLowerCase() ?? "";
  if (host.startsWith("[")) {
    const closingBracket = host.indexOf("]");
    return closingBracket === -1 ? host : host.slice(1, closingBracket);
  }
  return host.replace(/:\d+$/u, "");
}

/** Vercel이 발급한 preview·production hostname인지 확인함 */
export function isVercelDeploymentHost(host: string): boolean {
  return vercelDeploymentHostPattern.test(normalizeHost(host));
}

/** `resolveSite` 공개 기능을 제공함 */
export function resolveSite(
  host: string,
  localSiteOverride: SiteId | null = null,
): SiteId | null {
  const fixedSite = productionHosts[host];
  if (fixedSite !== undefined) return fixedSite;
  if (localSiteOverride !== null && loopbackHosts.has(host))
    return localSiteOverride;
  return developmentHosts[host] ?? null;
}

/** `localeFromPath` 공개 기능을 제공함 */
export function localeFromPath(pathname: string): Locale | null {
  const firstSegment = pathname.split("/")[1];
  return isLocale(firstSegment) ? firstSegment : null;
}

/** `selectLocale` 공개 기능을 제공함 */
export function selectLocale(
  savedLocale: string | undefined,
  acceptLanguage: string | null,
): Locale {
  if (isLocale(savedLocale)) return savedLocale;

  const preferences = (acceptLanguage ?? "")
    .split(",")
    .map((entry, order) => {
      const [languageRange = "", ...parameters] = entry
        .trim()
        .toLowerCase()
        .split(";");
      let quality = 1;
      let hasInvalidQuality = false;
      for (const parameter of parameters) {
        if (!/^\s*q\s*=/u.test(parameter)) continue;
        const match = /^\s*q\s*=\s*(\d(?:\.\d{0,3})?|\.\d{1,3})\s*$/u.exec(
          parameter,
        );
        if (match === null) {
          hasInvalidQuality = true;
          break;
        }
        quality = Number(match[1]);
      }
      if (
        hasInvalidQuality ||
        !Number.isFinite(quality) ||
        quality <= 0 ||
        quality > 1
      ) {
        return null;
      }
      const primaryLanguage = languageRange.split("-", 1)[0];
      return {
        locale: isLocale(primaryLanguage)
          ? primaryLanguage
          : languageRange === "*"
            ? "en"
            : null,
        order,
        quality,
      };
    })
    .filter(
      (
        preference,
      ): preference is {
        readonly locale: Locale;
        readonly order: number;
        readonly quality: number;
      } => preference !== null && preference.locale !== null,
    )
    .sort(
      (left, right) => right.quality - left.quality || left.order - right.order,
    );

  return preferences[0]?.locale ?? "en";
}

/** `createInternalSitePath` 결과를 생성함 */
export function createInternalSitePath(site: SiteId, pathname: string): string {
  return `/${site}${pathname === "/" ? "" : pathname}`;
}

/** `localeCookieName` 공개 기능을 제공함 */
export function localeCookieName(site: SiteId): `${SiteId}-locale` {
  return `${site}-locale`;
}

/** `isSharedAssetPath` 조건을 판별함 */
export function isSharedAssetPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname === "/icon.svg" ||
    pathname.startsWith("/excalidraw-assets/") ||
    /\.(?:avif|css|excalidraw|gif|ico|jpe?g|mp4|png|svg|webm|webp|woff2?)$/u.test(
      pathname,
    )
  );
}
