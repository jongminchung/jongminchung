import { buttonVariants } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import type { SVGProps } from "react";

function EditIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
      {...props}
    >
      <path d="M4 20h4l11-11-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </svg>
  );
}

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
      <EditIcon className="size-4" />
    </a>
  );
}
