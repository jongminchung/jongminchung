import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { listenWorkbenchEvent } from "../../application/workbench-events/WorkbenchEventPort";
import { isBottomPanelTab } from "./BottomPanelTabs";
import type { BottomPanelTab } from "./bottomPanelTypes";

export function useBottomPanelLifecycle({
  active,
  collapsed,
  onActiveChange,
  onShelveChanges,
  onStashChanges,
  onToggle,
  recoveryCount,
  shelfCount,
  stashCount,
}: {
  readonly active: BottomPanelTab;
  readonly collapsed: boolean;
  readonly onActiveChange: (active: BottomPanelTab) => void;
  readonly onShelveChanges: () => Promise<void>;
  readonly onStashChanges: () => Promise<void>;
  readonly onToggle: () => void;
  readonly recoveryCount: number;
  readonly shelfCount: number;
  readonly stashCount: number;
}) {
  const [explicitlyOpened, setExplicitlyOpened] = useState(false);
  const [localHistoryPath, setLocalHistoryPath] = useState<string>();
  const panelRef = useRef<HTMLElement>(null);
  const originFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const rememberExternalFocus = (event: FocusEvent): void => {
      if (!(event.target instanceof HTMLElement)) return;
      if (panelRef.current?.contains(event.target)) return;
      originFocusRef.current = event.target;
    };
    window.addEventListener("focusin", rememberExternalFocus);
    return () => window.removeEventListener("focusin", rememberExternalFocus);
  }, []);

  const explicitlyOpen = useCallback((): void => {
    setExplicitlyOpened(true);
    if (collapsed) onToggle();
  }, [collapsed, onToggle]);

  const hidePanel = useCallback((): void => {
    if (collapsed) return;
    onToggle();
    const target = originFocusRef.current;
    window.requestAnimationFrame(() => {
      if (target?.isConnected) target.focus();
    });
  }, [collapsed, onToggle]);

  const openPanelTab = useEffectEvent((requested: BottomPanelTab): void => {
    onActiveChange(requested);
    explicitlyOpen();
  });
  const stashChanges = useEffectEvent((): void => {
    openPanelTab("stash");
    void onStashChanges();
  });
  const shelveChanges = useEffectEvent((): void => {
    openPanelTab("shelf");
    void onShelveChanges();
  });

  useEffect(() => {
    return listenWorkbenchEvent("git-client:open-terminal", () => {
      openPanelTab("terminal");
      window.requestAnimationFrame(() => {
        const terminalInput = document.querySelector<HTMLElement>(
          '[data-command-scope="terminal"] textarea, [data-command-scope="terminal"] [contenteditable="true"], [data-command-scope="terminal"]',
        );
        terminalInput?.focus();
      });
    });
  }, []);

  useEffect(() => {
    return listenWorkbenchEvent("git-client:open-local-history", () => {
      setLocalHistoryPath(undefined);
      openPanelTab("localHistory");
    });
  }, []);

  useEffect(() => {
    return listenWorkbenchEvent("git-client:open-git-console", () => {
      openPanelTab("gitConsole");
      window.requestAnimationFrame(() => {
        panelRef.current
          ?.querySelector<HTMLElement>('[aria-label="Git Console"]')
          ?.focus();
      });
    });
  }, []);

  useEffect(() => {
    return listenWorkbenchEvent(
      "git-client:open-bottom-panel",
      ({ tab: requested }) => {
        if (!isBottomPanelTab(requested)) return;
        openPanelTab(requested);
      },
    );
  }, []);

  useEffect(() => {
    return listenWorkbenchEvent("git-client:stash-changes", () => {
      stashChanges();
    });
  }, []);

  useEffect(() => {
    return listenWorkbenchEvent("git-client:shelve-changes", () => {
      shelveChanges();
    });
  }, []);

  useEffect(() => {
    const activeIsEmpty =
      (active === "shelf" && shelfCount === 0) ||
      (active === "stash" && stashCount === 0) ||
      (active === "recovery" && recoveryCount === 0);
    if (!collapsed && !explicitlyOpened && activeIsEmpty) onToggle();
  }, [
    active,
    collapsed,
    explicitlyOpened,
    onToggle,
    recoveryCount,
    shelfCount,
    stashCount,
  ]);

  return { explicitlyOpen, hidePanel, localHistoryPath, panelRef };
}
