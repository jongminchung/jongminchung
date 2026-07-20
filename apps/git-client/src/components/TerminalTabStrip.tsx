import { useRef, type MouseEvent } from "react";
import {
  terminalTabAfterClose,
  terminalTabTarget,
  type TerminalNavigationKey,
} from "../domain/terminalActions";
import type { TerminalSessionSnapshot } from "../domain/TerminalService";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";
import { Button } from "./ui";

const TERMINAL_STATUS_CLASS = {
  starting: "bg-accent-bg",
  running: "bg-accent-bg",
  exited: "bg-success",
  failed: "bg-error",
} as const satisfies Readonly<Record<TerminalSessionSnapshot["status"], string>>;

function tabNavigationKey(value: string): TerminalNavigationKey | null {
  if (value === "ArrowLeft" || value === "ArrowRight" || value === "Home" || value === "End") {
    return value;
  }
  return null;
}

export function TerminalTabStrip({
  sessions,
  activeKey,
  agentsButtonRef,
  optionsButtonRef,
  predefinedButtonRef,
  showAgents,
  hasPredefinedSessions,
  onActivate,
  onClose,
  onCreate,
  onHide,
  onOpenAgents,
  onOpenOptions,
  onOpenPredefined,
}: {
  readonly sessions: readonly TerminalSessionSnapshot[];
  readonly activeKey: string | null;
  readonly agentsButtonRef: React.RefObject<HTMLButtonElement | null>;
  readonly optionsButtonRef: React.RefObject<HTMLButtonElement | null>;
  readonly predefinedButtonRef: React.RefObject<HTMLButtonElement | null>;
  readonly showAgents: boolean;
  readonly hasPredefinedSessions: boolean;
  readonly onActivate: (key: string) => void;
  readonly onClose: (key: string) => Promise<void>;
  readonly onCreate: () => Promise<void>;
  readonly onHide: () => void;
  readonly onOpenAgents: (event: MouseEvent<HTMLButtonElement>) => void;
  readonly onOpenOptions: (event: MouseEvent<HTMLButtonElement>) => void;
  readonly onOpenPredefined: (event: MouseEvent<HTMLButtonElement>) => void;
}): React.ReactNode {
  const tabs = useRef(new Map<string, HTMLButtonElement>());
  const newTab = useRef<HTMLButtonElement>(null);
  const keys = sessions.map((session) => session.key);

  const activateFromKeyboard = (sessionKey: string, value: string): void => {
    const navigationKey = tabNavigationKey(value);
    if (navigationKey === null) return;
    const target = terminalTabTarget(keys, sessionKey, navigationKey);
    if (target === null) return;
    onActivate(target);
    window.requestAnimationFrame(() => tabs.current.get(target)?.focus());
  };

  const close = async (sessionKey: string): Promise<void> => {
    const focusKey = terminalTabAfterClose(keys, sessionKey);
    await onClose(sessionKey);
    window.requestAnimationFrame(() => {
      if (focusKey !== null) tabs.current.get(focusKey)?.focus();
      else newTab.current?.focus();
    });
  };

  return (
    <div className={tw.terminalTabs}>
      <strong className={tw.terminalToolTitle}>Terminal</strong>
      <div aria-label="Terminal tabs" className={tw.terminalTabList} role="tablist">
        {sessions.map((session) => (
          <div className={tw.terminalTabItem} key={session.key}>
            <button
              aria-label={session.title}
              aria-selected={activeKey === session.key}
              className={`${tw.terminalTab}${activeKey === session.key ? ` ${tw.activeTerminalTab}` : ""}`}
              data-terminal-tab-key={session.key}
              onClick={() => onActivate(session.key)}
              onKeyDown={(event) => {
                activateFromKeyboard(session.key, event.key);
                if (tabNavigationKey(event.key) !== null) event.preventDefault();
              }}
              ref={(element) => {
                if (element === null) tabs.current.delete(session.key);
                else tabs.current.set(session.key, element);
              }}
              role="tab"
              tabIndex={activeKey === session.key ? 0 : -1}
              type="button"
            >
              <span
                aria-hidden="true"
                className={`${tw.terminalStatus} ${TERMINAL_STATUS_CLASS[session.status]}`}
                title={session.error ?? session.status}
              />
              <span>{session.title}</span>
            </button>
            <Button
              className={tw.terminalTabClose}
              icon={<Icon name="close" size={11} />}
              isIconOnly
              label={`Close ${session.title}`}
              onClick={() => void close(session.key)}
              size="sm"
              tooltip={`Close ${session.title}`}
              variant="ghost"
            />
          </div>
        ))}
      </div>
      <div aria-label="Action Toolbar" className={tw.terminalToolbar} role="toolbar">
        <Button
          className={tw.terminalToolbarAction}
          icon={<Icon name="plus" size={13} />}
          isIconOnly
          label="New Tab"
          onClick={() => void onCreate()}
          ref={newTab}
          size="sm"
          tooltip="New Tab"
          variant="ghost"
        />
        <Button
          className={tw.terminalToolbarAction}
          icon={<Icon name="chevron" size={12} />}
          isDisabled={!hasPredefinedSessions}
          isIconOnly
          label="New Predefined Session"
          onClick={onOpenPredefined}
          ref={predefinedButtonRef}
          size="sm"
          tooltip="New Predefined Session"
          variant="ghost"
        />
      </div>
      <div aria-label="Action Toolbar" className={tw.terminalToolbar} role="toolbar">
        {showAgents && (
          <Button
            className={tw.terminalAgentToolbarAction}
            endContent={<Icon name="chevron" size={10} />}
            label="AI Agents"
            onClick={onOpenAgents}
            ref={agentsButtonRef}
            size="sm"
            variant="ghost"
          />
        )}
        <Button
          className={tw.terminalToolbarAction}
          icon={<Icon name="more" size={13} />}
          isIconOnly
          label="Options"
          onClick={onOpenOptions}
          ref={optionsButtonRef}
          size="sm"
          tooltip="Options"
          variant="ghost"
        />
        <Button
          className={tw.terminalToolbarAction}
          icon={<Icon name="chevron" size={12} />}
          isIconOnly
          label="Hide"
          onClick={onHide}
          size="sm"
          tooltip="Hide"
          variant="ghost"
        />
      </div>
    </div>
  );
}
