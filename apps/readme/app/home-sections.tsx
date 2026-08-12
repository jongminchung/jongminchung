import { buttonVariants } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import { principles, projects } from "./home-content";
import styles from "./page.module.css";

function RouteMap() {
    return (
        <figure className={styles.routeMap} aria-labelledby="route-map-title">
            <figcaption className={styles.routeCaption}>
                <span id="route-map-title">How I move through a problem</span>
                <span>One connected route, not four separate phases.</span>
            </figcaption>
            <svg
                viewBox="0 0 1000 350"
                role="img"
                aria-label="Language becomes a model, code, and proof"
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
                <g className={styles.routeNode}>
                    <circle cx="90" cy="72" r="25" />
                    <text x="90" y="130" textAnchor="middle">
                        LANGUAGE
                    </text>
                </g>
                <g className={styles.routeNode}>
                    <circle cx="430" cy="72" r="25" />
                    <text x="430" y="130" textAnchor="middle">
                        BOUNDARY
                    </text>
                </g>
                <g className={styles.routeNode}>
                    <circle cx="570" cy="292" r="25" />
                    <text x="570" y="246" textAnchor="middle">
                        MODEL
                    </text>
                </g>
                <g className={styles.routeNode}>
                    <circle cx="755" cy="292" r="25" />
                    <text x="755" y="246" textAnchor="middle">
                        CODE
                    </text>
                </g>
                <g className={styles.routeNode}>
                    <circle cx="920" cy="292" r="25" />
                    <text x="920" y="246" textAnchor="middle">
                        PROOF
                    </text>
                </g>
            </svg>
        </figure>
    );
}

export function HeroSection() {
    return (
        <section className={styles.hero} id="top" aria-labelledby="hero-title">
            <div className={styles.heroCopy}>
                <p className={styles.eyebrow}>
                    JONGMIN CHUNG · JAMIE ON THE WEB
                </p>
                <h1 id="hero-title">
                    Complex systems
                    <span>should explain</span>
                    themselves.
                </h1>
                <p className={styles.heroLead}>
                    I turn shared language into clear boundaries, public APIs,
                    and software that can prove what changed.
                </p>
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
                        Read the work <span aria-hidden="true">↓</span>
                    </a>
                    <a
                        className={cn(
                            buttonVariants({ variant: "outline", size: "lg" }),
                            "border-x-0 border-t-0 border-b border-foreground bg-transparent font-mono text-xs leading-[1.8] text-foreground hover:bg-muted hover:text-foreground",
                            "h-9 px-4",
                        )}
                        href="https://jongminchung.dev/en/overview"
                        rel="noreferrer"
                        target="_blank"
                    >
                        Open the docs <span aria-hidden="true">↗</span>
                    </a>
                </div>
            </div>

            <div
                className={styles.thesis}
                role="note"
                aria-label="Working thesis"
            >
                <div className={styles.thesisTopline}>
                    <span>WORKING THESIS</span>
                    <span>001</span>
                </div>
                <p>
                    A model is useful when it makes the next decision{" "}
                    <strong>more obvious</strong> and the wrong state{" "}
                    <strong>harder to build.</strong>
                </p>
                <span className={styles.thesisNote}>
                    language → model → code
                </span>
            </div>

            <RouteMap />
        </section>
    );
}

export function WorkSection() {
    return (
        <section className={styles.work} id="work" aria-labelledby="work-title">
            <div className={styles.sectionHeading}>
                <div>
                    <p className={styles.eyebrow}>SELECTED WORK / 2026</p>
                    <h2 id="work-title">Things built to be read.</h2>
                </div>
                <p>
                    Products, packages, and documents share one rule: the public
                    contract should tell the truth.
                </p>
            </div>

            <div className={styles.projectList}>
                {projects.map((project) => (
                    <a
                        className={styles.project}
                        data-project="true"
                        href={project.href}
                        key={project.index}
                        target="_blank"
                        rel="noreferrer"
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

export function PrinciplesSection() {
    return (
        <section
            className={styles.principles}
            id="principles"
            aria-labelledby="principles-title"
        >
            <div className={styles.principlesIntro}>
                <p className={styles.eyebrow}>README / HOW I WORK</p>
                <h2 id="principles-title">
                    The code starts before the editor.
                </h2>
                <p>
                    The first material is language: the decisions, constraints,
                    and failure modes that a team needs to name together.
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
