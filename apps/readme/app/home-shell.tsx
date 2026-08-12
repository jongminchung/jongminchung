import { createIconDataUrl } from "@jongminchung/icon";
import { personSchema } from "./home-content";
import styles from "./page.module.css";

const personalIcon = createIconDataUrl("personal");

export function HomeHeader() {
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
                    <a
                        href="https://github.com/jongminchung"
                        target="_blank"
                        rel="noreferrer"
                    >
                        GitHub <span aria-hidden="true">↗</span>
                    </a>
                </nav>
            </header>
        </>
    );
}

export function HomeFooter() {
    return (
        <footer className={styles.footer}>
            <div>
                <p className={styles.footerPrompt}>
                    Have a system that needs clearer words?
                </p>
                <a
                    href="https://github.com/jongminchung"
                    target="_blank"
                    rel="noreferrer"
                >
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
    );
}

export function PersonStructuredData() {
    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
                __html: JSON.stringify(personSchema).replaceAll("<", "\\u003c"),
            }}
        />
    );
}
