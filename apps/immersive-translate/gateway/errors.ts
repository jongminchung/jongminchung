export class GatewayError extends Error {
  readonly status: number;
  readonly code: string;

  private constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "GatewayError";
    this.status = status;
    this.code = code;
  }

  static badRequest(message: string): GatewayError {
    return new GatewayError(400, "invalid_request", message);
  }

  static upstream(status: number, message: string): GatewayError {
    return new GatewayError(status, "upstream_error", message);
  }

  static invalidResponse(message: string): GatewayError {
    return new GatewayError(502, "invalid_response", message);
  }
}
