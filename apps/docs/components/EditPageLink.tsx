"use client";

import { Button } from "@/components/ui/button";
import { EditIcon } from "./DocsIcons";
import { Icon } from "./Icon";

export function EditPageLink({ label, href }: { readonly label: string; readonly href: string }) {
  return (
    <Button asChild variant="ghost" size="icon">
      <a aria-label={label} title={label} href={href} target="_blank" rel="noreferrer">
        <Icon icon={EditIcon} />
      </a>
    </Button>
  );
}
