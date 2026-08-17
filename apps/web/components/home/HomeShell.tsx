import { personSchema } from "#lib/home/content";
import type { Locale } from "#lib/site-routing";
import { BrandWordmark } from "../BrandWordmark";
import styles from "./home.module.css";

/** `HomeHeader` UI 컴포넌트를 렌더링함 */
export function HomeHeader({ locale }: { readonly locale: Locale }) {
    return (
        <>
            <a className={styles.skipLink} href="#main-content">
                {locale === "ko" ? "본문으로 건너뛰기" : "Skip to content"}
            </a>
            <header className={styles.siteHeader}>
                <a
                    className={styles.brand}
                    href="#top"
                    aria-label="jongminchung home"
                >
                    <BrandWordmark />
                </a>
                <nav aria-label="Primary navigation">
                    <a href="#work">{locale === "ko" ? "프로젝트" : "Work"}</a>
                    <a href="#writing">{locale === "ko" ? "글" : "Writing"}</a>
                    <a href="#principles">
                        {locale === "ko" ? "원칙" : "Principles"}
                    </a>
                    <a
                        href={`/${locale === "ko" ? "en" : "ko"}`}
                        hrefLang={locale === "ko" ? "en" : "ko"}
                    >
                        {locale === "ko" ? "EN" : "KO"}
                    </a>
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

/** `HomeFooter` UI 컴포넌트를 렌더링함 */
export function HomeFooter({ locale }: { readonly locale: Locale }) {
    return (
        <footer className={styles.footer}>
            <div>
                <p className={styles.footerPrompt}>
                    {locale === "ko"
                        ? "더 명확한 언어가 필요한 시스템이 있나요?"
                        : "Have a system that needs clearer words?"}
                </p>
                <a
                    href="https://github.com/jongminchung"
                    target="_blank"
                    rel="noreferrer"
                >
                    {locale === "ko"
                        ? "저장소에서 시작하기"
                        : "Start with the repository"}{" "}
                    <span aria-hidden="true">↗</span>
                </a>
            </div>
            <p className={styles.footerWordmark} aria-hidden="true">
                JAMIE.KR
            </p>
            <div className={styles.footerMeta}>
                <span>Jongmin Chung</span>
                <span>
                    {locale === "ko"
                        ? "언어 · 모델 · 코드"
                        : "Language · Models · Code"}
                </span>
                <span>© 2026</span>
            </div>
        </footer>
    );
}

/** `PersonStructuredData` UI 컴포넌트를 렌더링함 */
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
