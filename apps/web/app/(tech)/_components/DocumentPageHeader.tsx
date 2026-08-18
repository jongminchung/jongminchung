import { Badge } from "@jongminchung/ui/components/badge";
import Link from "next/link";
import { Icon } from "#components/Icon";
import {
    createSectionHref,
    displayTitleFor,
    type Locale,
} from "#lib/content-model";
import type { LoadedDocument } from "#lib/documents";
import { techSectionLabels } from "#lib/tech/copy";
import { EditPageLink } from "./EditPageLink";

function editHref(locale: Locale, id: string): string {
    return `https://github.com/jongminchung/jongminchung/edit/main/apps/web/content/tech/${locale}/${id}.mdx`;
}

/** `DocumentPageHeader` UI 컴포넌트를 렌더링함 */
export function DocumentPageHeader({
    locale,
    document,
}: {
    readonly locale: Locale;
    readonly document: LoadedDocument;
}) {
    const { metadata } = document;
    const title = displayTitleFor(metadata);
    return (
        <header className="border-b border-border pb-8">
            <nav aria-label={locale === "ko" ? "현재 위치" : "Breadcrumb"}>
                <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <li>
                        <Link href={`/${locale}`}>Articles</Link>
                    </li>
                    <li aria-hidden="true">
                        <Icon icon="chevronRight" className="size-3" />
                    </li>
                    <li>
                        <Link
                            href={createSectionHref(locale, metadata.section)}
                        >
                            {techSectionLabels[locale][metadata.section]}
                        </Link>
                    </li>
                    <li aria-hidden="true">
                        <Icon icon="chevronRight" className="size-3" />
                    </li>
                    <li aria-current="page" className="text-foreground">
                        {title}
                    </li>
                </ol>
            </nav>
            <div className="mt-6 mb-4 flex gap-1.5">
                <Badge variant="default">
                    {metadata.packageVersion ?? "v1"}
                </Badge>
                <Badge
                    className={
                        metadata.status === "deprecated"
                            ? "border-warning/30 bg-warning-muted text-warning-muted-foreground"
                            : undefined
                    }
                    variant={
                        metadata.status === "deprecated"
                            ? "outline"
                            : "secondary"
                    }
                >
                    {metadata.status}
                </Badge>
            </div>
            <div className="flex items-start gap-3">
                <h1 className="m-0 flex-1 font-sans text-[36px] leading-[1.1] font-medium tracking-[-0.025em] text-primary">
                    {title}
                </h1>
                <EditPageLink
                    label={
                        locale === "ko" ? "이 페이지 편집" : "Edit this page"
                    }
                    href={editHref(locale, metadata.id)}
                />
            </div>
            <p className="mt-4 mb-0 max-w-[720px] text-base leading-[1.55] text-muted-foreground">
                {metadata.description}
            </p>
            <div className="mt-5 flex flex-wrap gap-x-[18px] gap-y-2 text-xs text-muted-foreground">
                <span>
                    {metadata.verifiedAt === undefined
                        ? locale === "ko"
                            ? "업데이트"
                            : "Updated"
                        : locale === "ko"
                          ? "검증일"
                          : "Verified"}{" "}
                    <time dateTime={metadata.verifiedAt ?? metadata.updatedAt}>
                        {metadata.verifiedAt ?? metadata.updatedAt}
                    </time>
                </span>
                <a
                    className="inline-flex items-center gap-1 text-primary"
                    href={metadata.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                >
                    {locale === "ko" ? "공식 출처" : "Official source"}
                    <Icon icon="externalLink" className="size-3" />
                </a>
            </div>
        </header>
    );
}
