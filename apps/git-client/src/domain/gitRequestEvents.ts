import type { GitEvent, RequestId } from "../shared/contracts/model";

export type GitRequestEventResult =
  | { readonly kind: "started"; readonly requestId: RequestId }
  | { readonly kind: "output"; readonly requestId: RequestId }
  | { readonly kind: "completed"; readonly requestId: RequestId; readonly output: string }
  | { readonly kind: "failed"; readonly requestId: RequestId; readonly message: string }
  | { readonly kind: "cancelled"; readonly requestId: RequestId };

/** Holds parser input only while one native request is active. */
export class GitRequestEventBuffer {
  readonly #chunks: string[] = [];

  consume(event: GitEvent): GitRequestEventResult {
    if (event.kind === "output") {
      this.#chunks.push(event.data);
      return { kind: "output", requestId: event.requestId };
    }
    if (event.kind === "completed") {
      const output = this.#chunks.join("");
      this.clear();
      return { kind: "completed", requestId: event.requestId, output };
    }
    if (event.kind === "failed") {
      this.clear();
      return { kind: "failed", requestId: event.requestId, message: event.message };
    }
    if (event.kind === "cancelled") {
      this.clear();
      return { kind: "cancelled", requestId: event.requestId };
    }
    return { kind: "started", requestId: event.requestId };
  }

  get retainedChunkCount(): number {
    return this.#chunks.length;
  }

  clear(): void {
    this.#chunks.length = 0;
  }
}
