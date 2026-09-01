import { createRobotsResponse } from "#lib/robots";
import { siteOrigins } from "#lib/site-routing";

/** 요청에 대한 응답을 생성함 */
export const GET = (): Response => createRobotsResponse(siteOrigins.invest);
