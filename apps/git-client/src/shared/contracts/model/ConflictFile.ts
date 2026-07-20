export type ConflictFile = {
  path: string;
  baseOid: string | null;
  localOid: string | null;
  remoteOid: string | null;
  binary: boolean;
};
