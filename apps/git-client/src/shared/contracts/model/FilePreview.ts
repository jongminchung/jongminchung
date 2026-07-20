import type { ImagePreview } from "./ImagePreview";

export type FilePreview =
  | { kind: "image"; preview: ImagePreview }
  | { kind: "binary"; path: string; sizeBytes: number }
  | { kind: "tooLarge"; path: string; sizeBytes: number }
  | { kind: "missing"; path: string };
