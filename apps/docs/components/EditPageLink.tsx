"use client";

import { cn } from "@/lib/utils";
import { EditIcon } from "./DocsIcons";
import { Icon } from "./Icon";

export function EditPageLink({ label, href }: { readonly label: string; readonly href: string }) {
  return (
    <a
      aria-label={label}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent bg-transparent p-0 text-sm font-medium outline-none transition-colors",
        "hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60",
      )}
      href={href}
      rel="noreferrer"
      target="_blank"
      title={label}
    >
      <Icon icon={EditIcon} />
    </a>
  );
}
