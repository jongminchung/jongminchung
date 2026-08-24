export interface NativeErrorPayload {
  readonly code: string;
  readonly message: string;
  readonly field: string | null;
}

export class NativeError extends Error {
  private constructor(
    readonly code: string,
    message: string,
    readonly field: string | null,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "NativeError";
  }

  static create(
    code: string,
    message: string,
    field: string | null = null,
  ): NativeError {
    return new NativeError(code, message, field);
  }

  static from(
    error: unknown,
    code = "native.unexpected",
    message = "Native operation failed.",
  ): NativeError {
    if (error instanceof NativeError) return error;
    if (error instanceof Error)
      return new NativeError(code, message, null, { cause: error });
    return new NativeError(code, message, null, {
      cause: new Error("Non-Error native failure", { cause: error }),
    });
  }

  static find(error: unknown): NativeError | null {
    const visited = new Set<unknown>();
    let current = error;
    while (
      current instanceof Error &&
      !visited.has(current) &&
      visited.size < 8
    ) {
      if (current instanceof NativeError) return current;
      visited.add(current);
      current = current.cause;
    }
    return null;
  }

  toPayload(): NativeErrorPayload {
    return { code: this.code, message: this.message, field: this.field };
  }
}
