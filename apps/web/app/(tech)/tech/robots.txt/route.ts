/** 요청에 대한 응답을 생성함 */
export function GET(): Response {
  return new Response(
    "User-agent: *\nAllow: /\nSitemap: https://tech.jamie.kr/sitemap.xml\n",
    {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    },
  );
}
