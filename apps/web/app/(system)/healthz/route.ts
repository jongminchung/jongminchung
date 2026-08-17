/** 요청에 대한 응답을 생성함 */
export function GET(): Response {
    return Response.json({ status: "ok" });
}
