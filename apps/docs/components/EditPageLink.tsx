"use client";

import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { EditIcon } from "./DocsIcons";

export function EditPageLink({ label, href }: { readonly label: string; readonly href: string }) {
  return (
    <Button
      label={label}
      tooltip={label}
      href={href}
      target="_blank"
      rel="noreferrer"
      variant="ghost"
      size="sm"
      isIconOnly
      icon={<Icon icon={EditIcon} size="sm" />}
    />
  );
}
