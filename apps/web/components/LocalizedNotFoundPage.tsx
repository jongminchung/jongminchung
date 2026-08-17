import { NotFoundPage } from "#components/NotFoundPage";
import styles from "./NotFoundPage.module.css";

export function LocalizedNotFoundPage(): React.JSX.Element {
    return (
        <>
            <div
                className={styles.localeOption}
                data-locale-option="en"
                lang="en"
            >
                <NotFoundPage locale="en" />
            </div>
            <div
                className={styles.localeOption}
                data-locale-option="ko"
                lang="ko"
            >
                <NotFoundPage locale="ko" />
            </div>
        </>
    );
}
