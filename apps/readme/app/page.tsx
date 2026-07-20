import { createIconDataUrl } from "@jongminchung/icon";
import { Button } from "@jongminchung/ui/button";
import type { ReactElement } from "react";
import styles from "./page.module.css";

const personalIcon = createIconDataUrl("personal");

interface Project {
  readonly category: string;
  readonly description: string;
  readonly href: string;
  readonly index: string;
  readonly tags: readonly string[];
  readonly title: string;
}

const projects = [
  {
    index: "01",
    category: "Knowledge system",
    title: "Jongmin Chung Docs",
    description:
      "A bilingual path through collaboration rules, public package contracts, and the platform failures behind them.",
    tags: ["Next.js", "MDX", "shadcn/ui"],
    href: "https://jongminchung.dev/en/overview",
  },
  {
    index: "02",
    category: "Local-first product",
    title: "Immersive Translate",
    description:
      "A Chrome extension that translates DOCX and EPUB documents locally while keeping both languages in view.",
    tags: ["React", "WXT", "MLX"],
    href: "https://github.com/jongminchung/jongminchung/tree/main/apps/immersive-translate",
  },
  {
    index: "03",
    category: "Open package",
    title: "remark-plantuml",
    description:
      "A safe Markdown and Astro pipeline that turns PlantUML source into diagrams without losing document context.",
    tags: ["TypeScript", "Unified", "PlantUML"],
    href: "https://github.com/jongminchung/jongminchung/tree/main/packages/remark-plantuml",
  },
  {
    index: "04",
    category: "Developer tooling",
    title: "@jongminchung/tooling",
    description:
      "Shared lint, format, and package-map contracts that keep a workspace consistent without copying configuration.",
    tags: ["oxlint", "oxfmt", "pnpm"],
    href: "https://github.com/jongminchung/jongminchung/tree/main/packages/tooling",
  },
] as const satisfies readonly Project[];

const principles = [
  {
    key: "language",
    title: "Language is architecture.",
    body: "Meetings, issues, APIs, and tests should use the same words.",
  },
  {
    key: "boundaries",
    title: "Boundaries earn their keep.",
    body: "External values are translated before an internal model trusts them.",
  },
  {
    key: "evidence",
    title: "Evidence ships with change.",
    body: "Tests make intent observable and keep the cost of change inside its boundary.",
  },
] as const;

const personSchema = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Jongmin Chung",
  alternateName: "Jamie",
  url: "https://jamie.kr",
  sameAs: ["https://github.com/jongminchung"],
  knowsAbout: ["Domain-Driven Design", "TypeScript", "Next.js", "Developer tooling"],
};

function RouteMap(): ReactElement {
  return (
    <figure className={styles.routeMap} aria-labelledby="route-map-title">
      <figcaption className={styles.routeCaption}>
        <span id="route-map-title">How I move through a problem</span>
        <span>One connected route, not four separate phases.</span>
      </figcaption>
      <svg viewBox="0 0 1000 350" role="img" aria-label="Language becomes a model, code, and proof">
        <defs>
          <linearGradient id="route-gradient" x1="0" x2="1">
            <stop offset="0" stopColor="#ed2b83" />
            <stop offset="0.48" stopColor="#6c3eff" />
            <stop offset="1" stopColor="#2457ff" />
          </linearGradient>
        </defs>
        <path className={styles.routeGhost} d="M90 72H430v100c0 76 62 120 140 120h350" />
        <path className={styles.routeLine} d="M90 72H430v100c0 76 62 120 140 120h350" />
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

export default function HomePage(): ReactElement {
  return (
    <>
      <a className={styles.skipLink} href="#main-content">
        Skip to content
      </a>
      <header className={styles.siteHeader}>
        <a className={styles.brand} href="#top" aria-label="Jamie home">
          <img
            alt=""
            aria-hidden="true"
            className={styles.brandMark}
            height="37"
            src={personalIcon}
            width="37"
          />
          <span>
            JAMIE
            <small>README</small>
          </span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#work">Work</a>
          <a href="#principles">Principles</a>
          <a href="https://github.com/jongminchung" target="_blank" rel="noreferrer">
            GitHub <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </header>

      <main id="main-content">
        <section className={styles.hero} id="top" aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>JONGMIN CHUNG · JAMIE ON THE WEB</p>
            <h1 id="hero-title">
              Complex systems
              <span>should explain</span>
              themselves.
            </h1>
            <p className={styles.heroLead}>
              I turn shared language into clear boundaries, public APIs, and software that can prove
              what changed.
            </p>
            <div className={styles.heroActions}>
              <Button asChild className={styles.primaryAction}>
                <a href="#work">
                  Read the work <span aria-hidden="true">↓</span>
                </a>
              </Button>
              <Button asChild variant="ghost" className={styles.textAction}>
                <a href="https://jongminchung.dev/en/overview" target="_blank" rel="noreferrer">
                  Open the docs <span aria-hidden="true">↗</span>
                </a>
              </Button>
            </div>
          </div>

          <div className={styles.thesis} role="note" aria-label="Working thesis">
            <div className={styles.thesisTopline}>
              <span>WORKING THESIS</span>
              <span>001</span>
            </div>
            <p>
              A model is useful when it makes the next decision <strong>more obvious</strong> and
              the wrong state <strong>harder to build.</strong>
            </p>
            <span className={styles.thesisNote}>language → model → code</span>
          </div>

          <RouteMap />
        </section>

        <section className={styles.work} id="work" aria-labelledby="work-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>SELECTED WORK / 2026</p>
              <h2 id="work-title">Things built to be read.</h2>
            </div>
            <p>
              Products, packages, and documents share one rule: the public contract should tell the
              truth.
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
                  <span className={styles.projectIndex}>{project.index}</span>
                  <span className={styles.projectCategory}>{project.category}</span>
                  <h3>{project.title}</h3>
                </div>
                <p>{project.description}</p>
                <div className={styles.projectMeta}>
                  <ul aria-label={`${project.title} technologies`}>
                    {project.tags.map((tag) => (
                      <li key={tag}>{tag}</li>
                    ))}
                  </ul>
                  <span className={styles.projectArrow} aria-hidden="true">
                    ↗
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>

        <section className={styles.principles} id="principles" aria-labelledby="principles-title">
          <div className={styles.principlesIntro}>
            <p className={styles.eyebrow}>README / HOW I WORK</p>
            <h2 id="principles-title">The code starts before the editor.</h2>
            <p>
              The first material is language: the decisions, constraints, and failure modes that a
              team needs to name together.
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
      </main>

      <footer className={styles.footer}>
        <div>
          <p className={styles.footerPrompt}>Have a system that needs clearer words?</p>
          <a href="https://github.com/jongminchung" target="_blank" rel="noreferrer">
            Start with the repository <span aria-hidden="true">↗</span>
          </a>
        </div>
        <p className={styles.footerWordmark} aria-hidden="true">
          JAMIE.KR
        </p>
        <div className={styles.footerMeta}>
          <span>Jongmin Chung</span>
          <span>Language · Models · Code</span>
          <span>© 2026</span>
        </div>
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(personSchema).replaceAll("<", "\\u003c"),
        }}
      />
    </>
  );
}
