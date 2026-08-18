import { buttonVariants } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import { getLocalizedDocuments } from "#lib/documents";
import { getHomeContent } from "#lib/home/content";
import { getInvestmentNotes } from "#lib/invest/notes";
import type { Locale } from "#lib/site-routing";
import styles from "./home.module.css";

/** `HeroSection` UI 컴포넌트를 렌더링함 */
export function HeroSection({ locale }: { readonly locale: Locale }) {
    const { hero } = getHomeContent(locale);
    return (
        <section className={styles.hero} id="top" aria-labelledby="hero-title">
            <div className={styles.heroCopy}>
                <p className={styles.eyebrow}>
                    JONGMIN CHUNG · JAMIE ON THE WEB
                </p>
                <h1 id="hero-title">
                    {hero.title[0]}
                    <span>{hero.title[1]}</span>
                    {hero.title[2]}
                </h1>
                <p className={styles.heroLead}>{hero.lead}</p>
                <div className={styles.heroActions}>
                    <a
                        className={cn(
                            buttonVariants({ variant: "default", size: "lg" }),
                            styles.heroPrimaryAction,
                            "border-foreground bg-foreground font-mono text-xs text-inverse-foreground transition-[background,color,transform] hover:-translate-x-[3px] hover:-translate-y-[3px] hover:bg-accent hover:text-accent-foreground",
                            "min-h-[50px] gap-[26px] px-[18px]",
                        )}
                        href="#work"
                    >
                        {hero.workAction} <span aria-hidden="true">↓</span>
                    </a>
                    <a
                        className={cn(
                            buttonVariants({ variant: "outline", size: "lg" }),
                            "border-x-0 border-t-0 border-b border-foreground bg-transparent font-mono text-xs leading-[1.8] text-foreground hover:bg-muted hover:text-foreground",
                            "h-9 px-4",
                        )}
                        href={`https://tech.jamie.kr/${locale}`}
                    >
                        {hero.techAction} <span aria-hidden="true">↗</span>
                    </a>
                </div>
            </div>
        </section>
    );
}

/** `WorkSection` UI 컴포넌트를 렌더링함 */
export function WorkSection({ locale }: { readonly locale: Locale }) {
    const { projects } = getHomeContent(locale);
    return (
        <section className={styles.work} id="work" aria-labelledby="work-title">
            <div className={styles.sectionHeading}>
                <div>
                    <p className={styles.eyebrow}>SELECTED WORK / 2026</p>
                    <h2 id="work-title">
                        {locale === "ko"
                            ? "읽고 이해할 수 있게 만든 것"
                            : "Things built to be read."}
                    </h2>
                </div>
            </div>
            <div className={styles.projectList}>
                {projects.map((project) => (
                    <a
                        className={styles.project}
                        data-project="true"
                        href={project.href}
                        key={project.index}
                    >
                        <div className={styles.projectIdentity}>
                            <span className={styles.projectIndex}>
                                {project.index}
                            </span>
                            <span className={styles.projectCategory}>
                                {project.category}
                            </span>
                            <h3>{project.title}</h3>
                        </div>
                        <p>{project.description}</p>
                        <div className={styles.projectMeta}>
                            <ul aria-label={`${project.title} technologies`}>
                                {project.tags.map((tag) => (
                                    <li key={tag}>{tag}</li>
                                ))}
                            </ul>
                            <span
                                className={styles.projectArrow}
                                aria-hidden="true"
                            >
                                ↗
                            </span>
                        </div>
                    </a>
                ))}
            </div>
        </section>
    );
}

/** `WritingSection` UI 컴포넌트를 렌더링함 */
export async function WritingSection({ locale }: { readonly locale: Locale }) {
    const tech = (await getLocalizedDocuments(locale))
        .filter((document) => document.section !== "overview")
        .toSorted((a, b) => b.publishedAt.localeCompare(a.publishedAt))
        .slice(0, 3);
    const invest = (await getInvestmentNotes(locale)).slice(0, 3);
    return (
        <section
            className={styles.writing}
            id="writing"
            aria-labelledby="writing-title"
        >
            <div className={styles.sectionHeading}>
                <div>
                    <p className={styles.eyebrow}>LATEST WRITING</p>
                    <h2 id="writing-title">
                        {locale === "ko" ? "최근 기록" : "Recent notes."}
                    </h2>
                </div>
                <p>
                    {locale === "ko"
                        ? "지금 읽을 수 있는 기술과 투자 기록을 모음"
                        : "The latest engineering and investment notes, ready to read."}
                </p>
            </div>
            <div className={styles.writingColumns}>
                <div>
                    <h3>Engineering Notes</h3>
                    {tech.map((article) => (
                        <a
                            key={article.id}
                            href={`https://tech.jamie.kr${article.href}`}
                        >
                            <span>{article.publishedAt}</span>
                            <strong>{article.title}</strong>
                            <span aria-hidden="true">↗</span>
                        </a>
                    ))}
                </div>
                <div>
                    <h3>Investment Notes</h3>
                    {invest.length === 0 ? (
                        <p className={styles.emptyWriting}>
                            {locale === "ko"
                                ? "첫 리서치 노트를 준비 중임"
                                : "The first research note is in preparation."}
                        </p>
                    ) : (
                        invest.map((note) => (
                            <a
                                key={note.id}
                                href={`https://invest.jamie.kr${note.href}`}
                            >
                                <span>{note.publishedAt}</span>
                                <strong>{note.title}</strong>
                                <span aria-hidden="true">↗</span>
                            </a>
                        ))
                    )}
                </div>
            </div>
        </section>
    );
}

/** `PrinciplesSection` UI 컴포넌트를 렌더링함 */
export function PrinciplesSection({ locale }: { readonly locale: Locale }) {
    const { principles } = getHomeContent(locale);
    return (
        <section
            className={styles.principles}
            id="principles"
            aria-labelledby="principles-title"
        >
            <div className={styles.principlesIntro}>
                <p className={styles.eyebrow}>README / HOW I WORK</p>
                <h2 id="principles-title">
                    {locale === "ko" ? "일하는 원칙" : "Working principles."}
                </h2>
                <p>
                    {locale === "ko"
                        ? "언어를 맞추고 경계를 분명히 하며, 변경을 검증함"
                        : "Align language, clarify boundaries, and verify change."}
                </p>
            </div>
            <ol className={styles.principleList}>
                {principles.map((principle, index) => (
                    <li key={principle.key}>
                        <span>0{index + 1}</span>
                        <div>
                            <h3>{principle.title}</h3>
                            <p>{principle.body}</p>
                        </div>
                    </li>
                ))}
            </ol>
        </section>
    );
}
