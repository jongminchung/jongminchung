export type CommitSignature = {
  status: string;
  fingerprint: string | null;
  signer: string | null;
  keyId: string | null;
  trust: string | null;
};
