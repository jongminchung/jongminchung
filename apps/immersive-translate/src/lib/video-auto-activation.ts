export interface AutoCaptionStatusLike {
  readonly localTranslationState: "enabled" | "disabled";
  readonly captionState: {
    readonly name: string;
  };
}

export interface AutoCaptionActivationInput {
  readonly status: AutoCaptionStatusLike;
  readonly currentUrl: string;
  readonly lastAutoCaptionUrl: string | null;
  readonly hasVideoContext: boolean;
}

export function shouldAutoStartCaptionTranslation(input: AutoCaptionActivationInput): boolean {
  if (!input.hasVideoContext) return false;
  if (input.lastAutoCaptionUrl === input.currentUrl) return false;
  if (input.status.localTranslationState !== "enabled") return false;
  return (
    input.status.captionState.name !== "detecting" &&
    input.status.captionState.name !== "translating" &&
    input.status.captionState.name !== "rendered"
  );
}
