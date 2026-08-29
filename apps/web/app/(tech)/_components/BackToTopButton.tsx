import { buttonVariants } from "@jongminchung/ui/components/button";
import { Icon } from "#components/Icon";

/** JavaScript 없이 페이지 시작 위치로 이동하는 링크를 렌더링함 */
export function BackToTopButton({ label }: { readonly label: string }) {
  return (
    <a
      className={buttonVariants({
        className: "h-8 px-3 text-xs",
        size: "sm",
        variant: "ghost",
      })}
      href="#top"
    >
      <Icon icon="arrowUp" />
      {label}
    </a>
  );
}
