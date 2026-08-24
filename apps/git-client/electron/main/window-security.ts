import type { Session } from "electron";

type PermissionSession = Pick<
  Session,
  "setPermissionCheckHandler" | "setPermissionRequestHandler"
>;

export function installDefaultDenyPermissionPolicy(
  electronSession: PermissionSession,
): void {
  electronSession.setPermissionCheckHandler(() => false);
  electronSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => {
      callback(false);
    },
  );
}

export function isTrustedRendererNavigation(
  value: string,
  developmentServerUrl: string | undefined,
): boolean {
  try {
    const url = new URL(value);
    if (url.username !== "" || url.password !== "") return false;
    if (url.protocol === "app:" && url.host === "git-client") return true;
    if (developmentServerUrl === undefined) return false;
    const developmentUrl = new URL(developmentServerUrl);
    if (developmentUrl.username !== "" || developmentUrl.password !== "")
      return false;
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.origin === developmentUrl.origin
    );
  } catch {
    return false;
  }
}

export function isTrustedRendererRoute(
  value: string,
  developmentServerUrl: string | undefined,
  pathname: string,
): boolean {
  if (!isTrustedRendererNavigation(value, developmentServerUrl)) return false;
  try {
    return new URL(value).pathname === pathname;
  } catch {
    return false;
  }
}
