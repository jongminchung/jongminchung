export type TranslationProfile = "libretranslate" | "mlx";
export type TranslationFormat = "text" | "html";

export interface TranslationGatewayConfig {
  readonly profile: TranslationProfile;
  readonly host: string;
  readonly port: number;
  readonly libreTranslateUrl: string;
  readonly mlxBaseUrl: string;
  readonly mlxModel: string;
  readonly mlxTemperature: number;
  readonly mlxMaxTokens: number;
  readonly logRequests: boolean;
}

export interface TranslationProviderRequest {
  readonly texts: readonly string[];
  readonly source: string;
  readonly target: string;
  readonly format: TranslationFormat;
  readonly apiKey: string;
}

export interface TranslationProvider {
  readonly name: TranslationProfile;
  readonly upstream: string;
  readonly model: string | null;
  translate(request: TranslationProviderRequest): Promise<readonly string[]>;
}

export interface YouTubeCaptionRequest {
  readonly videoId: string;
  readonly languageCode: string;
}

export interface YouTubeCaptionPayload {
  readonly videoId: string;
  readonly languageCode: string;
  readonly label: string;
  readonly source: "yt-dlp";
  readonly payload: string;
}

export type YouTubeCaptionFetcher = (
  request: YouTubeCaptionRequest,
) => Promise<YouTubeCaptionPayload>;

export interface IncomingTranslateRequest {
  readonly q: string | readonly string[];
  readonly source: string;
  readonly target: string;
  readonly format: TranslationFormat;
  readonly apiKey: string;
  readonly originalWasArray: boolean;
}
