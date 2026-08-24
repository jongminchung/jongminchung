import {
  DropdownMenu,
  DropdownMenuContent,
} from "@jongminchung/ui/components/dropdown-menu";
import { useCallback, useMemo, useRef } from "react";
import type {
  TerminalAgentDescriptor,
  TerminalShellDescriptor,
} from "../shared/contracts/terminal";
import { useDismissLayer } from "./CommandProvider";
import { DropdownMenuItem } from "./ProductOverlays";

type TerminalLaunchDescriptor =
  | TerminalShellDescriptor
  | TerminalAgentDescriptor;

export function TerminalLaunchTargetMenu({
  x,
  y,
  label,
  items,
  onSelect,
  onClose,
  onRestoreFocus,
}: {
  readonly x: number;
  readonly y: number;
  readonly label: string;
  readonly items: readonly TerminalLaunchDescriptor[];
  readonly onSelect: (target: TerminalLaunchDescriptor) => Promise<void>;
  readonly onClose: () => void;
  readonly onRestoreFocus: () => void;
}): React.ReactNode {
  const restoreFocus = useRef(true);
  const handleHide = useCallback((): void => {
    onClose();
    if (restoreFocus.current) window.requestAnimationFrame(onRestoreFocus);
  }, [onClose, onRestoreFocus]);
  const anchor = useMemo(
    () => ({
      getBoundingClientRect: () => new DOMRect(x, y),
    }),
    [x, y],
  );

  useDismissLayer(
    useMemo(
      () => ({
        id: `terminal-${label.toLocaleLowerCase().replaceAll(" ", "-")}-menu`,
        priority: 120,
        active: true,
        dismiss: handleHide,
      }),
      [handleHide, label],
    ),
  );

  const select = (target: TerminalLaunchDescriptor): void => {
    restoreFocus.current = false;
    void onSelect(target);
  };

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open) handleHide();
      }}
      open
    >
      <DropdownMenuContent
        align="start"
        anchor={anchor}
        aria-label={label}
        className="z-(--layer-menu) w-60 [&_[role=menuitem]]:min-h-7"
        collisionPadding={8}
        finalFocus={false}
        positionMethod="fixed"
        side="bottom"
      >
        {items.map((item) => (
          <DropdownMenuItem
            key={`${item.kind}:${item.id}`}
            label={item.displayName}
            onClick={() => select(item)}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
