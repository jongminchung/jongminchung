import { DropdownMenuItem } from "@astryxdesign/core/DropdownMenu";
import { useLayer } from "@astryxdesign/core/Layer";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { nextTerminalMenuIndex, type TerminalNavigationKey } from "../domain/terminalActions";
import type {
  TerminalAgentDescriptor,
  TerminalShellDescriptor,
} from "../shared/contracts/terminal";
import { tw } from "../styles/tailwind";
import { useDismissLayer } from "./CommandProvider";

type TerminalLaunchDescriptor = TerminalShellDescriptor | TerminalAgentDescriptor;

function menuNavigationKey(value: string): TerminalNavigationKey | null {
  if (value === "ArrowDown" || value === "ArrowUp" || value === "Home" || value === "End") {
    return value;
  }
  return null;
}

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
  const menu = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(true);
  const handleHide = useCallback((): void => {
    onClose();
    if (restoreFocus.current) window.requestAnimationFrame(onRestoreFocus);
  }, [onClose, onRestoreFocus]);
  const layer = useLayer({ mode: "fixed", lightDismiss: true, onHide: handleHide });

  useDismissLayer(
    useMemo(
      () => ({
        id: `terminal-${label.toLocaleLowerCase().replaceAll(" ", "-")}-menu`,
        priority: 120,
        active: layer.isOpen,
        dismiss: layer.hide,
      }),
      [label, layer.hide, layer.isOpen],
    ),
  );

  useEffect(() => {
    layer.show();
  }, [layer.show]);

  useEffect(() => {
    if (!layer.isOpen) return;
    const frame = window.requestAnimationFrame(() => {
      menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [layer.isOpen]);

  const select = (target: TerminalLaunchDescriptor): void => {
    restoreFocus.current = false;
    layer.hide();
    void onSelect(target);
  };

  return layer.render(
    <div
      aria-label={label}
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
        const menuItems = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')];
        const currentIndex = menuItems.findIndex((item) => item === document.activeElement);
        const nextIndex = nextTerminalMenuIndex(menuItems.length, currentIndex, navigationKey);
        if (nextIndex !== null) menuItems[nextIndex]?.focus();
        event.preventDefault();
      }}
      ref={menu}
      role="menu"
    >
      {items.map((item) => (
        <DropdownMenuItem
          key={`${item.kind}:${item.id}`}
          label={item.displayName}
          onClick={() => select(item)}
        />
      ))}
    </div>,
    {
      x: Math.max(8, Math.min(x, window.innerWidth - 252)),
      y: Math.max(8, Math.min(y, window.innerHeight - 292)),
    },
  );
}
