export type SubmoduleDiff = {
  path: string;
  beforeOid: string | null;
  afterOid: string | null;
  beforeSubject: string | null;
  afterSubject: string | null;
  ahead: number | null;
  behind: number | null;
};
