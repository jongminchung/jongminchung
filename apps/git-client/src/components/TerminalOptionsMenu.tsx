import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
} from "@jongminchung/ui/components/dropdown-menu";
import { useCallback, useMemo, useRef } from "react";
import {
  TERMINAL_ACTION_MENU,
  isTerminalActionAvailable,
  type TerminalActionAvailability,
  type TerminalActionId,
} from "../domain/terminalActions";
import { useDismissLayer } from "./CommandProvider";
import { DropdownMenuItem } from "./ProductOverlays";

export function TerminalOptionsMenu({
  x,
  y,
  availability,
  onAction,
  onClose,
  onRestoreFocus,
}: {
  readonly x: number;
  readonly y: number;
  readonly availability: TerminalActionAvailability;
  readonly onAction: (action: TerminalActionId) => Promise<void>;
  readonly onClose: () => void;
  readonly onRestoreFocus: () => void;
}): React.ReactNode {
  const restoreFocus = useRef(true);
  const handleHide = useCallback((): void => {
    onClose();
    if (restoreFocus.current) {
      window.requestAnimationFrame(onRestoreFocus);
    }
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
        id: "terminal-options-menu",
        priority: 120,
        active: true,
        dismiss: handleHide,
      }),
      [handleHide],
    ),
  );

  const select = (action: TerminalActionId): void => {
    restoreFocus.current = false;
    void onAction(action);
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
        aria-label="Terminal Options"
        className="z-[120] w-60 [&_[role=menuitem]]:min-h-7 [&_kbd]:text-[10px] [&_kbd]:text-muted-foreground"
        collisionPadding={8}
        finalFocus={false}
        positionMethod="fixed"
        side="bottom"
      >
        {TERMINAL_ACTION_MENU.map((entry, index) =>
          entry.kind === "separator" ? (
            <DropdownMenuSeparator key={`separator-${index}`} />
          ) : (
            <DropdownMenuItem
              endContent={entry.shortcut === null ? undefined : <kbd>{entry.shortcut}</kbd>}
              isDisabled={!isTerminalActionAvailable(entry.id, availability)}
              key={entry.id}
              label={entry.label}
              onClick={() => select(entry.id)}
            />
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
