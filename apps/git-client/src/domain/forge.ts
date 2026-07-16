export interface ForgeLocation {
  readonly forge: "github" | "gitlab";
  readonly webBaseUrl: string;
}

export function resolveForge(remote: string): ForgeLocation | undefined {
  const normalized = remote.trim().replace(/\.git$/, "");
  let host = "";
  let path = "";
  try {
    if (normalized.includes("://")) {
      const url = new URL(normalized);
      host = url.hostname.toLowerCase();
      path = url.pathname.replace(/^\//, "");
    } else {
      const match = /^(?:[^@]+@)?([^:]+):(.+)$/.exec(normalized);
      host = match?.[1]?.toLowerCase() ?? "";
      path = match?.[2] ?? "";
    }
  } catch {
    return undefined;
  }
  if (!host || !path) return undefined;
  const forge = host === "github.com" ? "github" : host.includes("gitlab") ? "gitlab" : undefined;
  return forge ? { forge, webBaseUrl: `https://${host}/${path}` } : undefined;
}

export function commitUrl(remote: string, oid: string): string | undefined {
  const location = resolveForge(remote);
  if (!location) return undefined;
  const segment = location.forge === "github" ? "commit" : "-/commit";
  return `${location.webBaseUrl}/${segment}/${oid}`;
}

export function branchUrl(remote: string, branch: string): string | undefined {
  const location = resolveForge(remote);
  if (!location) return undefined;
  const segment = location.forge === "github" ? "tree" : "-/tree";
  return `${location.webBaseUrl}/${segment}/${encodeURIComponent(branch)}`;
}
