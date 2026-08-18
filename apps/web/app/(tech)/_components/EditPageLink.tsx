import { buttonVariants } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import { Icon } from "#components/Icon";
import { EditIcon } from "./DocsIcons";

/** `EditPageLink` UI 컴포넌트를 렌더링함 */
export function EditPageLink({
    label,
    href,
}: {
    readonly label: string;
    readonly href: string;
}) {
    return (
        <a
            aria-label={label}
            className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "size-9",
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
