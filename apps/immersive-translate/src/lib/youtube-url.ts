export function youtubeVideoIdFromUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (hostname === "youtu.be") return normalizeVideoId(url.pathname.slice(1));
    if (!hostname.endsWith("youtube.com")) return null;
    const watchVideoId = normalizeVideoId(url.searchParams.get("v"));
    if (watchVideoId) return watchVideoId;
    const pathParts = url.pathname.split("/").filter(Boolean);
    const [kind, videoId] = pathParts;
    if (kind === "shorts" || kind === "embed" || kind === "live") {
      return normalizeVideoId(videoId);
    }
    return null;
  } catch {
    return null;
  }
}

function normalizeVideoId(value: string | null | undefined): string | null {
  const videoId = value?.trim() ?? "";
  return /^[A-Za-z0-9_-]{6,64}$/.test(videoId) ? videoId : null;
}
