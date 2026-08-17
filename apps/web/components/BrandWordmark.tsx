import styles from "./BrandWordmark.module.css";

export type BrandWordmarkSuffix = "invest" | "tech";

export function BrandWordmark({
    suffix,
    compact = false,
}: {
    readonly suffix?: BrandWordmarkSuffix;
    readonly compact?: boolean;
}): React.JSX.Element {
    return (
        <span
            className={`${styles.wordmark}${compact ? ` ${styles.compact}` : ""}`}
        >
            <span>jongminchung</span>
            {suffix === undefined ? null : (
                <span className={styles.suffix}>{suffix}</span>
            )}
        </span>
    );
}
