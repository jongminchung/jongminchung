export type HostingMergeReadinessState =
  | "ready"
  | "blocked"
  | "pending"
  | "unknown";

export type HostingMergeReadinessReason =
  | "checks-failing"
  | "checks-pending"
  | "conflicts"
  | "draft"
  | "review-required"
  | "branch-update-required"
  | "permission-denied"
  | "rate-limited"
  | "provider-unsupported"
  | "provider-unavailable";

export interface HostingMergeReadinessCapability {
  readonly checks: boolean;
  readonly reviews: boolean;
  readonly conflicts: boolean;
  readonly branchUpdate: boolean;
}

export interface HostingMergeReadiness {
  readonly state: HostingMergeReadinessState;
  readonly reasons: readonly HostingMergeReadinessReason[];
  readonly capabilities: HostingMergeReadinessCapability;
  readonly checkedAt: string;
}
