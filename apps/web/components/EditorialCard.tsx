import type { ReactNode } from "react";
import type { EditorialItem } from "#lib/editorial";
import { EditorialGraphic } from "./EditorialGraphic";
import { EditorialImage } from "./EditorialImage";
import { IntentLink } from "./IntentLink";

export interface EditorialCardProps {
  readonly item: EditorialItem;
  readonly eager?: boolean;
}

/** 카드 사이에서 동일한 이미지 로딩 계약만 공유함. */
export function EditorialCardMedia({
  item,
  eager = false,
  fallback,
}: EditorialCardProps & { readonly fallback?: ReactNode }): React.JSX.Element {
  return item.image === undefined ? (
    <>{fallback ?? <EditorialGraphic seed={item.mediaSeed} />}</>
  ) : (
    <EditorialImage
      alt={item.image.alt}
      className="aspect-[1.6] w-full border-b object-cover"
      data-editorial-image="true"
      eager={eager}
      height={1000}
      sizes="(max-width: 560px) calc(100vw - 32px), (max-width: 840px) calc((100vw - 68px) / 2), 373px"
      src={item.image.src}
      width={1600}
    />
  );
}

export function EditorialCardMetadata({
  item,
}: Pick<EditorialCardProps, "item">): React.JSX.Element {
  return (
    <span className="flex flex-wrap items-center gap-2 font-mono text-metadata tracking-metadata text-muted-foreground uppercase">
      <span>{item.kind}</span>
      <span aria-hidden="true">·</span>
      <time dateTime={item.publishedAt}>{item.publishedAt}</time>
    </span>
  );
}

/** 기본 editorial 카드의 type·date·title·summary 읽기 순서를 유지함. */
export function EditorialCard({
  item,
  eager = false,
}: EditorialCardProps): React.JSX.Element {
  return (
    <IntentLink
      className="group block overflow-hidden rounded-lg border bg-card text-card-foreground transition-[border-color,background-color] hover:border-input hover:bg-muted/35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      href={item.href}
    >
      <span className="block">
        <EditorialCardMedia item={item} eager={eager} />
      </span>
      <span className="block p-5">
        <EditorialCardMetadata item={item} />
        <span className="mt-3 block text-[20px] leading-[1.18] font-medium tracking-[-.025em] text-foreground">
          {item.title}
        </span>
        <span className="mt-3 block text-sm leading-[1.5] text-muted-foreground">
          {item.description}
        </span>
      </span>
    </IntentLink>
  );
}
