import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://jamie.kr",
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
