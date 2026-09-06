import {
  EditorialCardMedia,
  EditorialCardMetadata,
  type EditorialCardProps,
} from "#components/EditorialCard";
import { IntentLink } from "#components/IntentLink";
import { EngineeringGraphic } from "./EngineeringGraphic";

/** Tech가 카드의 표현을 직접 소유하고 미디어·metadata 계약만 재사용함. */
export function EngineeringCard({
  item,
  eager = false,
}: EditorialCardProps): React.JSX.Element {
  return (
    <IntentLink
      className="group block overflow-visible rounded-none border-0 bg-transparent text-card-foreground transition-[border-color,background-color] hover:border-input hover:bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      href={item.href}
    >
      <span className="block overflow-hidden rounded-lg">
        <EditorialCardMedia
          item={item}
          eager={eager}
          fallback={<EngineeringGraphic seed={item.mediaSeed} />}
        />
      </span>
      <span className="block p-5 px-0 pt-3 pb-0">
        <EditorialCardMetadata item={item} />
        <span className="mt-2 block text-[15px] leading-[1.25] font-medium tracking-[-.015em] text-foreground">
          {item.title}
        </span>
        <span className="mt-3 hidden text-sm leading-[1.5] text-muted-foreground">
          {item.description}
        </span>
      </span>
    </IntentLink>
  );
}
