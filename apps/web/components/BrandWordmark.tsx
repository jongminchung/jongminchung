import { cn } from "@jongminchung/ui/lib/utils";

export type BrandWordmarkSuffix = "invest" | "tech";

/** `BrandWordmark` UI 컴포넌트를 렌더링함 */
export function BrandWordmark({
  suffix,
  compact = false,
}: {
  readonly suffix?: BrandWordmarkSuffix;
  readonly compact?: boolean;
}): React.JSX.Element {
  "use memo";

  return (
    <span
      className={cn(
        "inline-flex items-start gap-[.22em] [font-family:var(--font-family-heading)] text-[20px] leading-none font-bold tracking-[-.065em] whitespace-nowrap text-current",
        compact && "text-[15px]",
      )}
    >
      <span>jongminchung</span>
      {suffix === undefined ? null : (
        <span className="-mt-[.18em] text-[.5em] font-semibold tracking-[-.035em]">
          {suffix}
        </span>
      )}
    </span>
  );
}
