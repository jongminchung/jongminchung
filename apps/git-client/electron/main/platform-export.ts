import { lstat, mkdir } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { EXPORTED_DOCUMENT_COLOR_VARIABLES } from "./static-color-boundary";

export function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

export function exportedHtml(
    path: string,
    content: string,
    lineNumbers: boolean,
): string {
    const lines = content.split("\n");
    const body = lineNumbers
        ? lines
              .map(
                  (line, index) =>
                      `<span class="line"><span class="number">${index + 1}</span><span class="source">${escapeHtml(line)}</span></span>`,
              )
              .join("\n")
        : escapeHtml(content);
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(path)}</title><style>
:root{color-scheme:light dark;${EXPORTED_DOCUMENT_COLOR_VARIABLES}}body{margin:0;background:var(--document-background-dark);color:var(--document-foreground-dark);font:13px/1.55 "JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace}header{position:sticky;top:0;padding:9px 14px;background:var(--document-header-dark);border-bottom:1px solid var(--document-border-dark);color:var(--document-header-foreground-dark)}pre{margin:0;padding:12px 0;tab-size:4}.line{display:grid;grid-template-columns:52px minmax(0,1fr);min-height:20px}.number{box-sizing:border-box;padding-right:12px;color:var(--document-line-number-dark);text-align:right;user-select:none}.source{padding-right:16px;white-space:pre-wrap}@media(prefers-color-scheme:light){body{background:var(--document-background-light);color:var(--document-foreground-light)}header{background:var(--document-header-light);border-color:var(--document-border-light)}.number{color:var(--document-line-number-light)}}</style></head>
<body><header>${escapeHtml(path)}</header><pre>${body}</pre></body></html>`;
}

export function exportedPath(path: string): string {
    return `${path}.html`;
}

export async function ensureExportDirectory(
    canonicalRoot: string,
    relativeDirectory: string,
): Promise<string> {
    let current = canonicalRoot;
    for (const segment of relativeDirectory.split("/").filter(Boolean)) {
        current = resolve(current, segment);
        const relation = relative(canonicalRoot, current);
        if (relation.startsWith("..") || relation === "") {
            throw new Error("HTML export path escaped the selected directory.");
        }
        try {
            const metadata = await lstat(current);
            if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
                throw new Error(
                    "HTML export refuses symbolic-link and non-directory parents.",
                );
            }
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
            await mkdir(current, { mode: 0o700 });
        }
    }
    return current;
}

export function htmlLink(path: string): string {
    return path.split("/").map(encodeURIComponent).join("/");
}
