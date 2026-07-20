import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { useCallback, useRef, useState } from "react";
import { isValidElement } from "react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { createPortal } from "react-dom";
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
  const trigger = isValidElement(children) ? children : <button type="button">{children}</button>;
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

interface LayerOptions {
  readonly mode?: "fixed" | "absolute";
  readonly lightDismiss?: boolean;
  readonly onHide?: () => void;
}

interface LayerPosition {
  readonly x: number;
  readonly y: number;
}

interface LayerController {
  readonly isOpen: boolean;
  readonly show: () => void;
  readonly hide: () => void;
  readonly render: (content: ReactNode, position: LayerPosition) => ReactNode;
}

export function useLayer({
  mode = "fixed",
  lightDismiss = false,
  onHide,
}: LayerOptions): LayerController {
  const [isOpen, setOpen] = useState(false);
  const onHideRef = useRef(onHide);
  onHideRef.current = onHide;
  const show = useCallback((): void => setOpen(true), []);
  const hide = useCallback((): void => {
    setOpen(false);
    onHideRef.current?.();
  }, []);
  const render = useCallback(
    (content: ReactNode, position: LayerPosition): ReactNode => {
      if (!isOpen) return null;
      return createPortal(
        <div
          className="fixed inset-0 z-[130]"
          onMouseDown={(event) => {
            if (lightDismiss && event.target === event.currentTarget) hide();
          }}
        >
          <div
            style={
              {
                left: position.x,
                position: mode,
                top: position.y,
              } as CSSProperties
            }
          >
            {content}
          </div>
        </div>,
        document.body,
      );
    },
    [hide, isOpen, lightDismiss, mode],
  );
  return { hide, isOpen, render, show };
}

interface DropdownMenuItemProps extends Omit<HTMLAttributes<HTMLButtonElement>, "onClick"> {
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
    <button
      aria-disabled={isDisabled || undefined}
      className={cn(
        "grid min-h-7 w-full grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 text-left text-xs outline-none hover:bg-accent focus:bg-accent focus-visible:ring-2 focus-visible:ring-ring/45 aria-disabled:pointer-events-none aria-disabled:opacity-45",
        className,
      )}
      onClick={isDisabled ? undefined : onClick}
      role="menuitem"
      tabIndex={-1}
      type="button"
      {...props}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span>{label}</span>
      <span className="text-[10px] text-muted-foreground">{endContent}</span>
    </button>
  );
}
