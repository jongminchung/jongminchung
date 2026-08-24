import type { HostingProviderKind } from "./HostingProviderKind";

interface HostingOAuthPromptBase {
  sessionId: string;
  provider: HostingProviderKind;
  baseUrl: string;
  authorizationUrl: string;
  expiresAt: number;
}

export type HostingOAuthPrompt =
  | (HostingOAuthPromptBase & { kind: "device"; userCode: string })
  | (HostingOAuthPromptBase & { kind: "browser"; userCode?: never });
