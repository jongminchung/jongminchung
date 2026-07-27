import { Button } from "@base-ui/react/button";
import { Menu } from "@base-ui/react/menu";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { isValidElement } from "react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../lib/utils";

interface PopoverProps {
  readonly isOpen: boolean;
  readonly onOpenChange: (isOpen: boolean) => void;
  readonly label: string;
  readonly content: ReactNode;
  readonly children: ReactNode;
  readonly placement?: "above" | "below" | "left" | "right";
  readonly alignment?: "start" | "center" | "end";
  readonly width?: number | string;
  readonly hasAutoFocus?: boolean;
}

const SIDES = {
  above: "top",
  below: "bottom",
  left: "left",
  right: "right",
} as const;

export function Popover({
  isOpen,
  onOpenChange,
  label,
  content,
  children,
  placement = "below",
  alignment = "center",
  width,
  hasAutoFocus = false,
}: PopoverProps): ReactNode {
  const trigger = isValidElement(children) ? (
    children
  ) : (
    <Button
      data-slot="button"
      type="button"
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 border-border bg-card text-secondary-foreground shadow-xs hover:bg-accent active:bg-accent/80 h-7 px-2.5",
      )}
    >
      {children}
    </Button>
  );
  return (
    <PopoverPrimitive.Root onOpenChange={onOpenChange} open={isOpen}>
      <PopoverPrimitive.Trigger render={trigger} />
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          align={alignment}
          className="z-[110]"
          side={SIDES[placement]}
          sideOffset={5}
        >
          <PopoverPrimitive.Popup
            aria-label={label}
            className="max-h-[min(70vh,560px)] overflow-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none data-ending-style:animate-out data-starting-style:animate-in data-ending-style:fade-out-0 data-starting-style:fade-in-0"
            initialFocus={hasAutoFocus ? true : false}
            style={{ width }}
          >
            {content}
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

interface DropdownMenuItemProps extends Omit<
  ComponentProps<typeof Menu.Item>,
  "children" | "disabled" | "label" | "onClick"
> {
  readonly label?: string;
  readonly icon?: ReactNode;
  readonly endContent?: ReactNode;
  readonly isDisabled?: boolean;
  readonly onClick?: () => void;
}

export function DropdownMenuItem({
  label,
  icon,
  endContent,
  isDisabled = false,
  onClick,
  className,
  ...props
}: DropdownMenuItemProps): ReactNode {
  return (
    <Menu.Item
      disabled={isDisabled}
      label={label}
      onClick={onClick}
      {...props}
      className={cn(
        "grid min-h-7 w-full cursor-default grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 text-left text-xs text-popover-foreground outline-none transition-colors data-disabled:pointer-events-none data-disabled:opacity-45 data-highlighted:bg-accent data-highlighted:text-accent-foreground",
        className,
      )}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span>{label}</span>
      <span className="text-[10px] text-muted-foreground">{endContent}</span>
    </Menu.Item>
  );
}
