import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { compile } from "@mdx-js/mdx";
import matter from "gray-matter";
import { toString } from "hast-util-to-string";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";
import {
    parseDocMetadata,
    type DocMetadata,
    type OutlineEntry,
} from "../lib/content-model.ts";
import { listFiles, toPosixPath } from "./generation-utils.ts";

const appRoot = process.cwd().endsWith("/apps/web")
    ? process.cwd()
    : resolve(process.cwd(), "apps/web");
const contentRoot = resolve(appRoot, "content/tech");

export interface SourceDocument {
    readonly metadata: DocMetadata;
    readonly body: string;
    readonly filePath: string;
    readonly outline: readonly OutlineEntry[];
    readonly relativePath: string;
}

type HastNode = Parameters<typeof toString>[0];
type HeadingElement = HastNode & {
    readonly type: "element";
    readonly tagName: "h2" | "h3";
    readonly properties: Readonly<Record<string, unknown>>;
};

function isHeadingElement(node: {
    readonly type: string;
}): node is HeadingElement {
    if (node.type !== "element") return false;
    const candidate = node as {
        readonly tagName?: unknown;
        readonly properties?: unknown;
    };
    return (
        (candidate.tagName === "h2" || candidate.tagName === "h3") &&
        typeof candidate.properties === "object" &&
        candidate.properties !== null
    );
}

/** `createOutline` 결과를 생성함 */
export async function createOutline(
    body: string,
): Promise<readonly OutlineEntry[]> {
    const outline: OutlineEntry[] = [];
    const collectOutline =
        () =>
        (tree: Parameters<typeof visit>[0]): void => {
            visit(tree, (node) => {
                if (!isHeadingElement(node)) return;
                const id = node.properties.id;
                if (typeof id !== "string" || id.length === 0) {
                    throw new Error(
                        `Generated heading "${toString(node)}" has no ID.`,
                    );
                }
                outline.push(
                    Object.freeze({
                        id,
                        label: toString(node),
                        level: node.tagName === "h2" ? 2 : 3,
                    }),
                );
            });
        };

    await compile(body, {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypeSlug, collectOutline],
    });
    return Object.freeze(outline);
}

/** 검색 색인에 사용할 본문 문자열을 생성함 */
export function createSearchBody(body: string): string {
    return body
        .replace(/^---[\s\S]*?---/u, "")
        .replace(/```[\s\S]*?```/gu, " ")
        .replace(/<[^>]+>/gu, " ")
        .replace(/[#>*_`~\u005b\u005d()|]/gu, " ")
        .replace(/\s+/gu, " ")
        .trim();
}

/** 기술 문서 source를 읽고 정규화함 */
export async function readDocuments(): Promise<readonly SourceDocument[]> {
    const files = await listFiles(contentRoot, ".mdx");
    return Promise.all(
        files.map(async (filePath): Promise<SourceDocument> => {
            const source = await readFile(filePath, "utf8");
            const parsed = matter(source);
            const relativePath = toPosixPath(relative(contentRoot, filePath));
            const metadata = parseDocMetadata(parsed.data, relativePath);
            const expectedPath = `${metadata.locale}/${metadata.id}.mdx`;
            if (relativePath !== expectedPath) {
                throw new Error(
                    `${relativePath}: expected path ${expectedPath} from metadata.`,
                );
            }
            return Object.freeze({
                metadata,
                body: parsed.content,
                filePath,
                outline: await createOutline(parsed.content),
                relativePath,
            });
        }),
    );
}
