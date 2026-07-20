export type TerminalEvent =
  | { kind: "output"; sequence: number; data: Array<number> }
  | { kind: "exited"; exitCode: number; signal: string | null }
  | { kind: "failed"; message: string };
