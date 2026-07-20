import type { HostingProviderKind } from "./HostingProviderKind";

export type HostingAccount = {
  id: string;
  provider: HostingProviderKind;
  baseUrl: string;
  login: string;
};
