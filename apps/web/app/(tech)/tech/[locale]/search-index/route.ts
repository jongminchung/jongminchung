import { NextResponse } from "next/server";
import { isLocale } from "#lib/content-model";
import {
    createSearchDocuments,
    readContentSnapshot,
} from "#lib/content-repository";

export const runtime = "nodejs";

/** 요청에 대한 응답을 생성함 */
export async function GET(
    _request: Request,
    { params }: RouteContext<"/tech/[locale]/search-index">,
): Promise<Response> {
    const { locale } = await params;
    if (!isLocale(locale)) return new Response("Not found", { status: 404 });
    const snapshot = await readContentSnapshot();
    return NextResponse.json(
        createSearchDocuments(snapshot.documents, snapshot.sources, locale),
    );
}
