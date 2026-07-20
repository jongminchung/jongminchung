import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  TERMINAL_ACTION_MENU,
  isTerminalActionAvailable,
  nextTerminalMenuIndex,
  type TerminalActionAvailability,
  type TerminalActionId,
  type TerminalNavigationKey,
} from "../domain/terminalActions";
import { tw } from "../styles/tailwind";
import { useDismissLayer } from "./CommandProvider";
import { DropdownMenuItem } from "./ui";
import { useLayer } from "./ui";

function menuNavigationKey(value: string): TerminalNavigationKey | null {
  if (value === "ArrowDown" || value === "ArrowUp" || value === "Home" || value === "End") {
    return value;
  }
  return null;
}

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
  const menu = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(true);
  const handleHide = useCallback((): void => {
    onClose();
    if (restoreFocus.current) {
      window.requestAnimationFrame(onRestoreFocus);
    }
  }, [onClose, onRestoreFocus]);
  const layer = useLayer({ mode: "fixed", lightDismiss: true, onHide: handleHide });

  useDismissLayer(
    useMemo(
      () => ({
        id: "terminal-options-menu",
        priority: 120,
        active: layer.isOpen,
        dismiss: layer.hide,
      }),
      [layer.hide, layer.isOpen],
    ),
  );

  useEffect(() => {
    layer.show();
  }, [layer.show]);

  useEffect(() => {
    if (!layer.isOpen) return;
    const frame = window.requestAnimationFrame(() => {
      menu.current
        ?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')
        ?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [layer.isOpen]);

  const select = (action: TerminalActionId): void => {
    restoreFocus.current = false;
    layer.hide();
    void onAction(action);
  };

  return layer.render(
    <div
      aria-label="Terminal Options"
      className={tw.terminalOptionsMenu}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          layer.hide();
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          if (
            event.target instanceof HTMLElement &&
            event.target.getAttribute("role") === "menuitem"
          ) {
            event.target.click();
            event.preventDefault();
          }
          return;
        }
        const navigationKey = menuNavigationKey(event.key);
        if (navigationKey === null) return;
        const items = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(
            '[role="menuitem"]:not([aria-disabled="true"])',
          ),
        ];
        const currentIndex = items.findIndex((item) => item === document.activeElement);
        const nextIndex = nextTerminalMenuIndex(items.length, currentIndex, navigationKey);
        if (nextIndex !== null) items[nextIndex]?.focus();
        event.preventDefault();
      }}
      ref={menu}
      role="menu"
    >
      {TERMINAL_ACTION_MENU.map((entry, index) =>
        entry.kind === "separator" ? (
          <hr className={tw.terminalMenuSeparator} key={`separator-${index}`} role="separator" />
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
    </div>,
    {
      x: Math.max(8, Math.min(x, window.innerWidth - 252)),
      y: Math.max(8, Math.min(y, window.innerHeight - 292)),
    },
  );
}
