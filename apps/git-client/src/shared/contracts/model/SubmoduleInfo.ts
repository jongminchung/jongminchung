export type SubmoduleInfo = {
  path: string;
  oid: string | null;
  branch: string | null;
  status: string;
  initialized: boolean;
};
