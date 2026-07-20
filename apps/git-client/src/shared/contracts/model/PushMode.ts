export type PushMode = { kind: "normal" } | { kind: "forceWithLease"; expectedRemoteOid: string };
