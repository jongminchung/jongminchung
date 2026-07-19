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

  static create(code: string, message: string, field: string | null = null): NativeError {
    return new NativeError(code, message, field);
  }

  static from(error: unknown, code = "native.unexpected"): NativeError {
    if (error instanceof NativeError) return error;
    if (error instanceof Error) return new NativeError(code, error.message, null, { cause: error });
    return new NativeError(code, String(error), null);
  }

  toPayload(): NativeErrorPayload {
    return { code: this.code, message: this.message, field: this.field };
  }
}
