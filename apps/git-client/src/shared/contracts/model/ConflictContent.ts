export type ConflictContent = {
  path: string;
  base: string | null;
  local: string | null;
  remote: string | null;
  result: string | null;
  binary: boolean;
  localLabel: string;
  remoteLabel: string;
};
