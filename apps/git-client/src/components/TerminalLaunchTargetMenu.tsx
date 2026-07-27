import { Menu } from "@base-ui/react/menu";
import { useCallback, useMemo, useRef } from "react";
import type {
  TerminalAgentDescriptor,
  TerminalShellDescriptor,
} from "../shared/contracts/terminal";
import { tw } from "../styles/tailwind";
import { useDismissLayer } from "./CommandProvider";
import { DropdownMenuItem } from "./ui";

type TerminalLaunchDescriptor = TerminalShellDescriptor | TerminalAgentDescriptor;

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
          <Menu.Popup aria-label={label} className={tw.terminalOptionsMenu} finalFocus={false}>
            {items.map((item) => (
              <DropdownMenuItem
                key={`${item.kind}:${item.id}`}
                label={item.displayName}
                onClick={() => select(item)}
              />
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
