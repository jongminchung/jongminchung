/** 사이트 origin에 맞는 robots.txt 응답을 생성함 */
export function createRobotsResponse(origin: string): Response {
  return new Response(
    `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`,
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
}
