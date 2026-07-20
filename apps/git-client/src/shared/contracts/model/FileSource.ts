export type FileSource =
  | { kind: "workingTree" }
  | { kind: "index" }
  | { kind: "revision"; revision: string };
