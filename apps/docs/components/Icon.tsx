import {
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Menu,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

export type IconType =
  | "arrowUp"
  | "check"
  | "chevronLeft"
  | "chevronRight"
  | "externalLink"
  | "menu"
  | "search"
  | "close"
  | ComponentType<SVGProps<SVGSVGElement>>;

const icons: Readonly<
  Record<Exclude<IconType, ComponentType<SVGProps<SVGSVGElement>>>, LucideIcon>
> = {
  arrowUp: ArrowUp,
  check: Check,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  externalLink: ExternalLink,
  menu: Menu,
  search: Search,
  close: X,
};

export function Icon({
  icon,
  className,
}: {
  readonly icon: IconType;
  readonly className?: string;
}) {
  const Component = typeof icon === "string" ? icons[icon] : icon;
  return <Component aria-hidden="true" className={className ?? "size-4"} />;
}
