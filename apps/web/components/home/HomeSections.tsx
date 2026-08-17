import { buttonVariants } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import { getLocalizedDocuments } from "#lib/documents";
import { getHomeContent } from "#lib/home/content";
import { getInvestmentNotes } from "#lib/investment-notes";
import type { Locale } from "#lib/site-routing";
import styles from "./home.module.css";

function RouteMap({ locale }: { readonly locale: Locale }) {
    const labels =
        locale === "ko"
            ? ["언어", "경계", "모델", "코드", "근거"]
            : ["LANGUAGE", "BOUNDARY", "MODEL", "CODE", "PROOF"];
    return (
        <figure className={styles.routeMap} aria-labelledby="route-map-title">
            <figcaption className={styles.routeCaption}>
                <span id="route-map-title">
                    {locale === "ko"
                        ? "문제를 통과하는 경로"
                        : "How I move through a problem"}
                </span>
                <span>
                    {locale === "ko"
                        ? "분리된 단계가 아닌 하나로 연결된 흐름"
                        : "One connected route, not four separate phases."}
                </span>
            </figcaption>
            <svg
                viewBox="0 0 1000 350"
                role="img"
                aria-label={
                    locale === "ko"
                        ? "언어가 모델과 코드, 근거로 이어지는 과정"
                        : "Language becomes a model, code, and proof"
                }
            >
                <defs>
                    <linearGradient id="route-gradient" x1="0" x2="1">
                        <stop offset="0" stopColor="var(--brand-highlight)" />
                        <stop
                            offset="0.48"
                            stopColor="var(--brand-gradient-mid)"
                        />
                        <stop offset="1" stopColor="var(--primary)" />
                    </linearGradient>
                </defs>
                <path
                    className={styles.routeGhost}
                    d="M90 72H430v100c0 76 62 120 140 120h350"
                />
                <path
                    className={styles.routeLine}
                    d="M90 72H430v100c0 76 62 120 140 120h350"
                />
                {[
                    [90, 72, 130],
                    [430, 72, 130],
                    [570, 292, 246],
                    [755, 292, 246],
                    [920, 292, 246],
                ].map(([x, y, textY], index) => (
                    <g className={styles.routeNode} key={labels[index]}>
                        <circle cx={x} cy={y} r="25" />
                        <text x={x} y={textY} textAnchor="middle">
                            {labels[index]}
                        </text>
                    </g>
                ))}
            </svg>
        </figure>
    );
}

/** `HeroSection` UI 컴포넌트를 렌더링함 */
export function HeroSection({ locale }: { readonly locale: Locale }) {
    const { hero, thesis } = getHomeContent(locale);
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
            <div
                className={styles.thesis}
                role="note"
                aria-label={locale === "ko" ? "작업 원칙" : "Working thesis"}
            >
                <div className={styles.thesisTopline}>
                    <span>WORKING THESIS</span>
                    <span>001</span>
                </div>
                <p>{thesis}</p>
                <span className={styles.thesisNote}>
                    language → model → code
                </span>
            </div>
            <RouteMap locale={locale} />
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
                <p>
                    {locale === "ko"
                        ? "제품과 문서 모두 공개된 계약이 실제 동작을 정확히 설명해야 한다는 원칙을 따름"
                        : "Products and documents share one rule: the public contract should tell the truth."}
                </p>
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
                        ? "같은 빌드에서 생성된 콘텐츠 manifest를 사용하므로 외부 요청 없이 최신 글을 연결함"
                        : "Latest entries come from manifests generated in the same build, without external requests."}
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
                    {locale === "ko"
                        ? "코드는 편집기보다 먼저 시작됨"
                        : "The code starts before the editor."}
                </h2>
                <p>
                    {locale === "ko"
                        ? "첫 재료는 팀이 함께 이름 붙여야 하는 결정·제약·실패 방식의 언어임"
                        : "The first material is language: the decisions, constraints, and failure modes that a team needs to name together."}
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
