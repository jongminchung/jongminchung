export type HostingFoundationErrorCode =
  | "invalidInput"
  | "accountNotFound"
  | "credential"
  | "offline"
  | "timeout"
  | "redirect"
  | "responseTooLarge"
  | "http"
  | "invalidResponse";

export class HostingFoundationError extends Error {
  readonly code: HostingFoundationErrorCode;

  constructor(code: HostingFoundationErrorCode, message: string) {
    super(message);
    this.name = "HostingFoundationError";
    this.code = code;
  }
}
