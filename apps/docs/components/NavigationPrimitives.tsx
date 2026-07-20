import { Badge } from "@jongminchung/ui/badge";
import type { ReactNode } from "react";
import { TransitionLink } from "./RouteTransition";

export function SideNav({
  className,
  header,
  children,
}: {
  readonly className?: string;
  readonly header?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <nav aria-label="Side navigation" className={className}>
      {header}
      {children}
    </nav>
  );
}

export function SideNavHeading({
  heading,
  superheading,
  headingHref,
}: {
  readonly heading: string;
  readonly superheading: string;
  readonly headingHref: string;
}) {
  return (
    <header className="border-b border-border px-5 py-5">
      <p className="m-0 text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
        {superheading}
      </p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <TransitionLink
          href={headingHref}
          className="text-base font-semibold text-foreground no-underline"
        >
          {heading}
        </TransitionLink>
        <Badge>v1</Badge>
      </div>
    </header>
  );
}

export function SideNavSection({
  children,
}: {
  readonly title?: string;
  readonly isHeaderHidden?: boolean;
  readonly children: ReactNode;
}) {
  return <div className="grid gap-1 p-3">{children}</div>;
}

export function SideNavItem({
  label,
  href,
  isSelected = false,
}: {
  readonly label: string;
  readonly href: string;
  readonly isSelected?: boolean;
  readonly size?: string;
}) {
  return (
    <TransitionLink
      href={href}
      className="side-nav-item flex min-h-10 items-center rounded-md px-3 text-sm text-muted-foreground no-underline hover:bg-muted hover:text-foreground data-[selected=true]:text-primary"
      data-selected={isSelected}
      aria-current={isSelected ? "page" : undefined}
    >
      {label}
    </TransitionLink>
  );
}
