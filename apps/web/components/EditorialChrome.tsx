import Link from "next/link";
import type { ReactNode } from "react";
import {
  EditorialNavigationMenu,
  type EditorialNavigationMenuOption,
} from "./EditorialNavigationMenu";

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
}): React.JSX.Element {
  return (
    <header
      className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur-xl"
      id="top"
      tabIndex={-1}
    >
      <div className="mx-auto flex min-h-14 w-full max-w-[1200px] items-center gap-5 px-6 text-[12px] max-[680px]:px-4">
        <Link
          aria-label={brandLabel}
          className="mr-2 font-semibold tracking-[-.04em]"
          href={homeHref}
        >
          {brand}
        </Link>
        <nav
          aria-label={navigationLabel}
          className="flex items-center gap-5 text-muted-foreground max-[520px]:hidden"
        >
          {navigation.map((item) =>
            item.options === undefined || item.menuLabel === undefined ? (
              <Link
                aria-current={item.isActive ? "page" : undefined}
                className="hover:text-foreground aria-[current=page]:font-medium aria-[current=page]:text-foreground"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
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
        <div className="ml-auto flex items-center gap-2">
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
    <footer className="mx-auto grid w-full max-w-[1200px] grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-x-8 gap-y-10 border-t px-6 pt-10 pb-8 font-mono text-[10px] text-muted-foreground max-[640px]:grid-cols-1 max-[640px]:px-4">
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
