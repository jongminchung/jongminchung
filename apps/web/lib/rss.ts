import type { Locale } from "./content-contracts.ts";
import { getLocaleProtocol } from "./locale.ts";

interface RssItem {
  readonly title: string;
  readonly href: string;
  readonly description: string;
  readonly publishedAt: string;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/** 사이트별 콘텐츠 선택과 분리된 RSS 직렬화·응답 계약. */
export function createRssResponse(channel: {
  readonly origin: string;
  readonly locale: Locale;
  readonly title: string;
  readonly description: string;
  readonly items: readonly RssItem[];
}): Response {
  const items = channel.items
    .map((item) => {
      const url = escapeXml(`${channel.origin}${item.href}`);
      return `<item><title>${escapeXml(item.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><description>${escapeXml(item.description)}</description><pubDate>${new Date(`${item.publishedAt}T00:00:00Z`).toUTCString()}</pubDate></item>`;
    })
    .join("");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escapeXml(channel.title)}</title><link>${escapeXml(`${channel.origin}/${channel.locale}`)}</link><description>${escapeXml(channel.description)}</description><language>${getLocaleProtocol(channel.locale).rss}</language>${items}</channel></rss>`,
    {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    },
  );
}
