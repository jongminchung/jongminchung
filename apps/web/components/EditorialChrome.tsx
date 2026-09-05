import Link from "next/link";
import type { ReactNode } from "react";
import { EditorialMobileNavigation } from "./EditorialMobileNavigation";
import {
  EditorialNavigationMenu,
  type EditorialNavigationMenuOption,
} from "./EditorialNavigationMenu";
import { IntentLink } from "./IntentLink";

export interface EditorialNavigationItem {
  readonly href: string;
  readonly label: string;
  readonly isActive?: boolean;
  readonly menuLabel?: string;
  readonly options?: readonly EditorialNavigationMenuOption[];
}

/** 두 editorial 도메인의 공통 header 탐색을 렌더링함 */
export function EditorialHeader({
  brand,
  brandLabel,
  navigationLabel,
  homeHref,
  navigation,
  localeHref,
  localeLabel,
  localeControl,
  actions,
  mobileMenuLabel,
  mobileMenuCloseLabel,
}: {
  readonly brand: ReactNode;
  readonly brandLabel: string;
  readonly navigationLabel: string;
  readonly homeHref: string;
  readonly navigation: readonly EditorialNavigationItem[];
  readonly localeHref: string;
  readonly localeLabel: string;
  readonly localeControl?: ReactNode;
  readonly actions?: ReactNode;
  readonly mobileMenuLabel: string;
  readonly mobileMenuCloseLabel: string;
}): React.JSX.Element {
  return (
    <header className="sticky top-0 z-40 h-16 border-b bg-background/95 backdrop-blur-xl">
      <div className="flex h-full w-full items-center gap-4 px-4 text-sm md:px-8 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-6">
        <Link
          aria-label={brandLabel}
          className="flex min-h-11 min-w-11 items-center font-semibold tracking-[-.045em] lg:justify-self-start"
          href={homeHref}
        >
          {brand}
        </Link>
        <nav
          aria-label={navigationLabel}
          className="flex items-center justify-center gap-1 text-muted-foreground max-[640px]:hidden lg:justify-self-center"
        >
          {navigation.map((item) =>
            item.options === undefined || item.menuLabel === undefined ? (
              <IntentLink
                aria-current={item.isActive ? "page" : undefined}
                className="rounded-md px-2.5 py-1 text-sm transition-colors hover:bg-accent hover:text-foreground aria-[current=page]:bg-secondary aria-[current=page]:font-medium aria-[current=page]:text-foreground"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </IntentLink>
            ) : (
              <EditorialNavigationMenu
                isActive={item.isActive}
                key={item.href}
                label={item.label}
                menuLabel={item.menuLabel}
                options={item.options}
              />
            ),
          )}
        </nav>
        <div className="ml-auto flex items-center gap-1 lg:ml-0 lg:justify-self-end">
          <EditorialMobileNavigation
            closeLabel={mobileMenuCloseLabel}
            label={mobileMenuLabel}
            navigation={navigation}
          />
          {actions}
          {localeControl ?? (
            <Link className="font-mono text-[11px]" href={localeHref}>
              {localeLabel}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

/** 실제 탐색 가능한 링크만 가진 공통 footer를 렌더링함 */
export function EditorialFooter({
  groups,
  note,
}: {
  readonly groups: readonly {
    readonly label: string;
    readonly links: readonly EditorialNavigationItem[];
  }[];
  readonly note: string;
}): React.JSX.Element {
  return (
    <footer className="mx-auto grid w-full max-w-[1200px] grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-x-8 gap-y-10 border-t px-6 pt-10 pb-8 text-xs text-muted-foreground max-[640px]:grid-cols-1 max-[640px]:px-4">
      {groups.map((group) => (
        <section key={group.label}>
          <p className="mb-3 text-foreground">{group.label}</p>
          <ul className="m-0 grid list-none gap-2 p-0">
            {group.links.map((link) => (
              <li key={link.href}>
                {link.href.startsWith("http") ? (
                  <a href={link.href} rel="noreferrer" target="_blank">
                    {link.label}
                  </a>
                ) : (
                  <Link href={link.href}>{link.label}</Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="col-span-full m-0 border-t pt-4 max-[640px]:col-auto">
        {note}
      </p>
    </footer>
  );
}
