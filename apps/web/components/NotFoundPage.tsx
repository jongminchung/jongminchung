import Link from "next/link";
import type { Locale } from "#lib/site-routing";
import styles from "./NotFoundPage.module.css";

export const notFoundCopy = {
    en: {
        heading: "Document not found",
        description:
            "The page may have moved, or the address may be incomplete.",
        link: "Return to the overview",
    },
    ko: {
        heading: "문서를 찾을 수 없습니다",
        description: "페이지가 이동했거나 주소가 불완전할 수 있습니다.",
        link: "개요로 돌아가기",
    },
} as const satisfies Record<
    Locale,
    {
        readonly heading: string;
        readonly description: string;
        readonly link: string;
    }
>;

export function NotFoundPage({
    locale,
}: {
    readonly locale: Locale;
}): React.JSX.Element {
    const text = notFoundCopy[locale];
    return (
        <main className={styles.page}>
            <p className={styles.mark}>404</p>
            <h1>{text.heading}</h1>
            <p>{text.description}</p>
            <Link href={`/${locale}`}>{text.link}</Link>
        </main>
    );
}
