import { Menu } from "@base-ui/react/menu";
import { useCallback, useMemo, useRef } from "react";
import {
  TERMINAL_ACTION_MENU,
  isTerminalActionAvailable,
  type TerminalActionAvailability,
  type TerminalActionId,
} from "../domain/terminalActions";
import { tw } from "../styles/tailwind";
import { useDismissLayer } from "./CommandProvider";
import { DropdownMenuItem } from "./ui";

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
    <Menu.Root
      onOpenChange={(open) => {
        if (!open) handleHide();
      }}
      open
    >
      <Menu.Portal>
        <Menu.Positioner
          align="start"
          anchor={anchor}
          className="z-[130]"
          collisionPadding={8}
          positionMethod="fixed"
          side="bottom"
        >
          <Menu.Popup
            aria-label="Terminal Options"
            className={tw.terminalOptionsMenu}
            finalFocus={false}
          >
            {TERMINAL_ACTION_MENU.map((entry, index) =>
              entry.kind === "separator" ? (
                <Menu.Separator className={tw.terminalMenuSeparator} key={`separator-${index}`} />
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
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
