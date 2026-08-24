export type TerminalAvailability =
  | Readonly<{ kind: "available" }>
  | Readonly<{ kind: "unavailable" }>;

export const AVAILABLE_TERMINAL: TerminalAvailability = {
  kind: "available",
};

export const UNAVAILABLE_TERMINAL: TerminalAvailability = {
  kind: "unavailable",
};
