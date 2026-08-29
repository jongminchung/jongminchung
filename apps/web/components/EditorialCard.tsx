import Image from "next/image";
import Link from "next/link";
import type { EditorialItem } from "#lib/editorial";
import { EditorialGraphic } from "./EditorialGraphic";

/** `EditorialCard` type·date·title·summary 순서의 단일 링크 카드임 */
export function EditorialCard({
  item,
  eager = false,
  variant = "default",
}: {
  readonly item: EditorialItem;
  readonly eager?: boolean;
  readonly variant?: "default" | "engineering";
}): React.JSX.Element {
  return (
    <Link
      className="group block overflow-hidden border bg-card text-card-foreground transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-input hover:shadow-[var(--elevation-medium)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[variant=engineering]:overflow-visible data-[variant=engineering]:border-0 data-[variant=engineering]:bg-transparent data-[variant=engineering]:hover:translate-y-0 data-[variant=engineering]:hover:shadow-none"
      data-variant={variant}
      href={item.href}
      prefetch={eager}
    >
      <span
        className="block data-[variant=engineering]:overflow-hidden data-[variant=engineering]:rounded-[.2rem]"
        data-variant={variant}
      >
        {item.image === undefined ? (
          <EditorialGraphic seed={item.mediaSeed} variant={variant} />
        ) : (
          <Image
            alt={item.image.alt}
            className="aspect-[1.6] w-full border-b object-cover"
            data-editorial-image="true"
            height={1000}
            loading={eager ? "eager" : "lazy"}
            sizes="(max-width: 560px) calc(100vw - 32px), (max-width: 840px) calc((100vw - 68px) / 2), 373px"
            src={item.image.src}
            width={1600}
          />
        )}
      </span>
      <span
        className="block p-5 data-[variant=engineering]:px-0 data-[variant=engineering]:pt-3 data-[variant=engineering]:pb-0"
        data-variant={variant}
      >
        <span className="flex flex-wrap items-center gap-2 font-mono text-[10px] tracking-[.08em] text-muted-foreground uppercase">
          <span>{item.kind}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={item.publishedAt}>{item.publishedAt}</time>
        </span>
        <span className="mt-3 block text-[20px] leading-[1.18] font-medium tracking-[-.025em] text-foreground data-[variant=engineering]:mt-2 data-[variant=engineering]:text-[15px] data-[variant=engineering]:leading-[1.25] data-[variant=engineering]:tracking-[-.015em]">
          {item.title}
        </span>
        <span className="mt-3 block text-sm leading-[1.5] text-muted-foreground data-[variant=engineering]:hidden">
          {item.description}
        </span>
      </span>
    </Link>
  );
}
