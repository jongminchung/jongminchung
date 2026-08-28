"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@jongminchung/ui/components/dropdown-menu";
import { ChevronDownIcon, CheckIcon } from "lucide-react";
import Link from "next/link";

export interface EditorialNavigationMenuOption {
  readonly href: string;
  readonly label: string;
  readonly isActive?: boolean;
}

/** `EditorialNavigationMenu` 상단 탐색 항목의 하위 목적지를 드롭다운으로 제공함 */
export function EditorialNavigationMenu({
  label,
  menuLabel,
  options,
  isActive = false,
}: {
  readonly label: string;
  readonly menuLabel: string;
  readonly options: readonly EditorialNavigationMenuOption[];
  readonly isActive?: boolean;
}): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${label}: ${menuLabel}`}
        className="inline-flex items-center gap-1 hover:text-foreground data-popup-open:text-foreground data-[active=true]:font-medium data-[active=true]:text-foreground"
        data-active={isActive}
      >
        {label}
        <ChevronDownIcon aria-hidden="true" className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        aria-label={menuLabel}
        className="w-64"
        sideOffset={10}
      >
        {options.map((option) => (
          <DropdownMenuItem
            aria-current={option.isActive ? "page" : undefined}
            className="min-h-9 px-2.5 aria-[current=page]:bg-accent aria-[current=page]:font-medium"
            key={option.href}
            render={<Link href={option.href} />}
          >
            {option.label}
            {option.isActive ? (
              <CheckIcon aria-hidden="true" className="ml-auto size-3.5" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
