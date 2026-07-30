import { buttonVariants } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import { EditIcon } from "./DocsIcons";
import { Icon } from "./Icon";

export function EditPageLink({ label, href }: { readonly label: string; readonly href: string }) {
  return (
    <a
      aria-label={label}
      className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-9")}
      href={href}
      rel="noreferrer"
      target="_blank"
      title={label}
    >
      <Icon icon={EditIcon} />
    </a>
  );
}
