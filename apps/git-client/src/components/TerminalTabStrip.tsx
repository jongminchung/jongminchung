import { Button } from "@base-ui/react/button";
import { Tabs } from "@base-ui/react/tabs";
import { useRef, type MouseEvent } from "react";
import { terminalTabAfterClose } from "../domain/terminalActions";
import type { TerminalSessionSnapshot } from "../domain/TerminalService";
import { cn } from "../lib/utils";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui";

const TERMINAL_STATUS_CLASS = {
  starting: "bg-primary",
  running: "bg-primary",
  exited: "bg-success",
  failed: "bg-destructive",
} as const satisfies Readonly<Record<TerminalSessionSnapshot["status"], string>>;

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
  const tabs = useRef(new Map<string, HTMLElement>());
  const newTab = useRef<HTMLButtonElement>(null);
  const keys = sessions.map((session) => session.key);

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
      <Tabs.Root
        className="contents"
        onValueChange={(value) => {
          if (typeof value === "string") onActivate(value);
        }}
        value={activeKey}
      >
        <div className={cn("relative", tw.terminalTabList)}>
          <Tabs.List
            activateOnFocus
            aria-label="Terminal tabs"
            className="flex min-w-max items-stretch"
          >
            {sessions.map((session) => (
              <div className={tw.terminalTabItem} key={session.key} role="presentation">
                <Tabs.Tab
                  aria-label={session.title}
                  data-terminal-tab-key={session.key}
                  ref={(element) => {
                    if (element === null) tabs.current.delete(session.key);
                    else tabs.current.set(session.key, element);
                  }}
                  type="button"
                  value={session.key}
                  className={cn(
                    "inline-flex items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent text-xs text-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-7 px-2.5 text-muted-foreground data-active:bg-accent data-active:text-foreground",
                    `${tw.terminalTab}${activeKey === session.key ? ` ${tw.activeTerminalTab}` : ""}`,
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={`${tw.terminalStatus} ${TERMINAL_STATUS_CLASS[session.status]}`}
                    title={session.error ?? session.status}
                  />
                  <span>{session.title}</span>
                  <span aria-hidden="true" className="-ml-1.5 h-6 w-6 shrink-0" />
                </Tabs.Tab>
              </div>
            ))}
          </Tabs.List>
          <div
            aria-label="Terminal tab close actions"
            className="pointer-events-none absolute inset-y-0 left-0 flex min-w-max items-stretch"
            role="toolbar"
          >
            {sessions.map((session) => (
              <div className="my-[3px] flex min-w-0 items-center" key={session.key}>
                <span
                  aria-hidden="true"
                  className={cn(
                    "invisible inline-flex h-7 items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent px-2.5 text-xs text-muted-foreground [&_svg]:shrink-0",
                    `${tw.terminalTab}${activeKey === session.key ? ` ${tw.activeTerminalTab}` : ""}`,
                  )}
                >
                  <span
                    className={`${tw.terminalStatus} ${TERMINAL_STATUS_CLASS[session.status]}`}
                  />
                  <span>{session.title}</span>
                </span>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        data-slot="button"
                        onClick={() => void close(session.key)}
                        type="button"
                        aria-label={`Close ${session.title}`}
                        className={cn(
                          "pointer-events-auto inline-flex h-6 min-w-5 shrink-0 aspect-square items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent bg-transparent px-0 text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/55 active:bg-[var(--overlay-pressed)] disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0",
                        )}
                      >
                        <Icon name="close" size={11} />
                      </Button>
                    }
                  />
                  <TooltipContent>{`Close ${session.title}`}</TooltipContent>
                </Tooltip>
              </div>
            ))}
          </div>
        </div>
      </Tabs.Root>
      <div aria-label="Action Toolbar" className={tw.terminalToolbar} role="toolbar">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                data-slot="button"
                onClick={() => void onCreate()}
                ref={newTab}
                type="button"
                aria-label="New Tab"
                className={cn(
                  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-[29px] min-w-[29px] px-[7px] aspect-square px-0 rounded-none border-l border-y-0 border-r-0 border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground active:bg-[var(--overlay-pressed)]",
                )}
              >
                <Icon name="plus" size={13} />
              </Button>
            }
          />
          <TooltipContent>New Tab</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                data-slot="button"
                onClick={onOpenPredefined}
                ref={predefinedButtonRef}
                type="button"
                aria-label="New Predefined Session"
                disabled={!hasPredefinedSessions}
                className={cn(
                  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-[29px] min-w-[29px] px-[7px] aspect-square px-0 rounded-none border-l border-y-0 border-r-0 border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground active:bg-[var(--overlay-pressed)]",
                )}
              >
                <Icon name="chevron" size={12} />
              </Button>
            }
          />
          <TooltipContent>New Predefined Session</TooltipContent>
        </Tooltip>
      </div>
      <div aria-label="Action Toolbar" className={tw.terminalToolbar} role="toolbar">
        {showAgents && (
          <Button
            data-slot="button"
            onClick={onOpenAgents}
            ref={agentsButtonRef}
            type="button"
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-[29px] min-w-[29px] px-[7px] rounded-none border-l border-y-0 border-r-0 border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground active:bg-[var(--overlay-pressed)]",
            )}
          >
            AI Agents
            <Icon name="chevron" size={10} />
          </Button>
        )}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                data-slot="button"
                onClick={onOpenOptions}
                ref={optionsButtonRef}
                type="button"
                aria-label="Options"
                className={cn(
                  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-[29px] min-w-[29px] px-[7px] aspect-square px-0 rounded-none border-l border-y-0 border-r-0 border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground active:bg-[var(--overlay-pressed)]",
                )}
              >
                <Icon name="more" size={13} />
              </Button>
            }
          />
          <TooltipContent>Options</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                data-slot="button"
                onClick={onHide}
                type="button"
                aria-label="Hide"
                className={cn(
                  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-[29px] min-w-[29px] px-[7px] aspect-square px-0 rounded-none border-l border-y-0 border-r-0 border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground active:bg-[var(--overlay-pressed)]",
                )}
              >
                <Icon name="chevron" size={12} />
              </Button>
            }
          />
          <TooltipContent>Hide</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
