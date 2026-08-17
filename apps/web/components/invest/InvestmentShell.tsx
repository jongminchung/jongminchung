import Link from "next/link";
import type { ReactNode } from "react";
import type {
    InvestmentNoteManifestEntry,
    InvestmentSourceKind,
} from "#lib/investment-content";
import type { Locale } from "#lib/site-routing";
import { BrandWordmark } from "../BrandWordmark";
import styles from "./investment.module.css";

const copy = {
    ko: {
        label: "INVESTMENT NOTES",
        nav: ["노트", "책", "의견", "영상"],
        intro: "출처를 읽고, 요약과 해석 사이의 경계를 남깁니다",
        description:
            "책, 투자자의 공개 발언, 영상과 인터뷰를 근거로 핵심 주장과 Jamie의 판단을 분리해 기록합니다",
        empty: "첫 리서치 노트를 준비하고 있습니다",
        emptyBody:
            "모든 글은 출처 요약과 개인 의견을 구분하고 한국어와 영어를 함께 제공합니다",
        sourceSummary: "원자료",
        updated: "업데이트",
    },
    en: {
        label: "INVESTMENT NOTES",
        nav: ["Notes", "Books", "Voices", "Videos"],
        intro: "Read the source and preserve the boundary between summary and judgment",
        description:
            "Books, public commentary, videos, and interviews become source-grounded notes that separate the original claim from Jamie's interpretation",
        empty: "The first research note is in preparation",
        emptyBody:
            "Every note separates source summary from personal commentary and ships in Korean and English",
        sourceSummary: "Sources",
        updated: "Updated",
    },
} as const;

export function InvestmentLayout({
    locale,
    children,
}: {
    readonly locale: Locale;
    readonly children: ReactNode;
}): React.JSX.Element {
    const text = copy[locale];
    const otherLocale = locale === "ko" ? "en" : "ko";
    return (
        <div className={styles.site}>
            <header className={styles.header}>
                <Link
                    aria-label="jongminchung invest"
                    className={styles.brand}
                    href={`/${locale}`}
                >
                    <BrandWordmark suffix="invest" />
                </Link>
                <nav
                    aria-label={
                        locale === "ko" ? "투자 노트" : "Investment notes"
                    }
                >
                    <Link href={`/${locale}/notes`}>{text.nav[0]}</Link>
                    <Link href={`/${locale}/sources/book`}>{text.nav[1]}</Link>
                    <Link href={`/${locale}/sources/social`}>
                        {text.nav[2]}
                    </Link>
                    <Link href={`/${locale}/sources/video`}>{text.nav[3]}</Link>
                    <a href={`/${otherLocale}`}>{otherLocale.toUpperCase()}</a>
                </nav>
            </header>
            {children}
            <footer className={styles.footer}>
                <span>Investment Notes · Jamie</span>
                <a href="https://jamie.kr">jamie.kr ↗</a>
                <span>Source summary ≠ personal judgment</span>
            </footer>
        </div>
    );
}

export function InvestmentHome({
    locale,
    notes,
}: {
    readonly locale: Locale;
    readonly notes: readonly InvestmentNoteManifestEntry[];
}): React.JSX.Element {
    const text = copy[locale];
    return (
        <main className={styles.main}>
            <section className={styles.hero}>
                <p className={styles.kicker}>{text.label}</p>
                <h1>{text.intro}</h1>
                <p>{text.description}</p>
                <div className={styles.method}>
                    <span>01 · Source</span>
                    <span>02 · Summary</span>
                    <span>03 · Jamie&apos;s notes</span>
                </div>
            </section>
            <NoteCollection locale={locale} notes={notes} />
        </main>
    );
}

export function NoteCollection({
    locale,
    notes,
    title,
}: {
    readonly locale: Locale;
    readonly notes: readonly InvestmentNoteManifestEntry[];
    readonly title?: string;
}): React.JSX.Element {
    const text = copy[locale];
    return (
        <section className={styles.collection}>
            <div className={styles.collectionHeading}>
                <p>INDEX / {String(notes.length).padStart(2, "0")}</p>
                <h2>
                    {title ?? (locale === "ko" ? "최근 노트" : "Recent notes")}
                </h2>
            </div>
            {notes.length === 0 ? (
                <div className={styles.empty}>
                    <p>{text.empty}</p>
                    <span>{text.emptyBody}</span>
                </div>
            ) : (
                <ol className={styles.noteList}>
                    {notes.map((note, index) => (
                        <li key={note.id}>
                            <Link href={note.href}>
                                <span>
                                    {String(index + 1).padStart(2, "0")}
                                </span>
                                <div>
                                    <h3>{note.title}</h3>
                                    <p>{note.description}</p>
                                </div>
                                <time dateTime={note.updatedAt}>
                                    {note.updatedAt}
                                </time>
                            </Link>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}

export function InvestmentNotePage({
    locale,
    note,
    children,
}: {
    readonly locale: Locale;
    readonly note: InvestmentNoteManifestEntry;
    readonly children: ReactNode;
}): React.JSX.Element {
    const text = copy[locale];
    return (
        <main className={styles.notePage}>
            <header className={styles.noteHeader}>
                <p>{note.series ?? "Research note"}</p>
                <h1>{note.title}</h1>
                <p>{note.description}</p>
                <time dateTime={note.updatedAt}>
                    {text.updated} · {note.updatedAt}
                </time>
            </header>
            <aside className={styles.sources} aria-label={text.sourceSummary}>
                <p>{text.sourceSummary}</p>
                {note.sources.map((source) => (
                    <SourceCard
                        key={`${source.kind}:${source.title}`}
                        source={source}
                    />
                ))}
            </aside>
            <article className={styles.noteBody}>{children}</article>
            <p className={styles.disclaimer}>
                {locale === "ko"
                    ? "이 글은 출처를 이해하기 위한 개인 기록이며 투자 권유가 아닙니다"
                    : "This is a personal research note, not investment advice"}
            </p>
        </main>
    );
}

function SourceCard({
    source,
}: {
    readonly source: InvestmentNoteManifestEntry["sources"][number];
}): React.JSX.Element {
    const body = (
        <>
            <span>{source.kind}</span>
            <strong>{source.title}</strong>
            <small>{source.creator}</small>
        </>
    );
    return source.url === undefined ? (
        <div className={styles.sourceCard}>{body}</div>
    ) : (
        <a
            className={styles.sourceCard}
            href={source.url}
            rel="noreferrer"
            target="_blank"
        >
            {body}
        </a>
    );
}

export function sourceTitle(
    locale: Locale,
    kind: InvestmentSourceKind,
): string {
    const labels = {
        ko: {
            book: "책",
            social: "공개 의견",
            video: "영상",
            interview: "인터뷰",
            article: "아티클",
        },
        en: {
            book: "Books",
            social: "Public voices",
            video: "Videos",
            interview: "Interviews",
            article: "Articles",
        },
    } as const;
    return labels[locale][kind];
}
