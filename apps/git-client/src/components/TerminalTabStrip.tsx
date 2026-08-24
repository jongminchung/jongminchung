import { Button } from "@jongminchung/ui/components/button";
import { Tabs, TabsList, TabsTrigger } from "@jongminchung/ui/components/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@jongminchung/ui/components/tooltip";
import { cn } from "@jongminchung/ui/lib/utils";
import { useRef, type MouseEvent } from "react";
import type { TerminalSessionSnapshot } from "../application/terminal/TerminalService";
import { terminalTabAfterClose } from "../domain/terminalActions";
import { Icon } from "./Icon";

const TERMINAL_STATUS_CLASS = {
  starting: "bg-primary",
  running: "bg-primary",
  exited: "bg-success",
  failed: "bg-destructive",
} as const satisfies Readonly<
  Record<TerminalSessionSnapshot["status"], string>
>;

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
    <div
      className={`terminalTabs [align-items:stretch] [background:var(--card)] [border-bottom:1px_solid_var(--border)] [display:flex] [min-width:0] [&_.activeTerminalTab]:[background:var(--accent)] [&_.activeTerminalTab]:[color:var(--foreground)] [&>_.terminalToolbar:last-child]:[margin-left:auto] terminalTabs`}
    >
      <strong
        className={`terminalToolTitle [align-items:center] [display:flex] [font-size:12px] [padding:0_9px] terminalToolTitle`}
      >
        Terminal
      </strong>
      <Tabs
        className="contents"
        onValueChange={(value) => {
          if (typeof value === "string") onActivate(value);
        }}
        value={activeKey}
      >
        <div
          className={cn(
            "relative",
            `terminalTabList [align-items:stretch] [display:flex] [flex:none] [min-width:0] [overflow-x:auto] terminalTabList`,
          )}
        >
          <TabsList
            activateOnFocus
            aria-label="Terminal tabs"
            className="flex min-w-max items-stretch"
          >
            {sessions.map((session) => (
              <div
                className={`terminalTabItem [align-items:center] [background:var(--accent)] rounded-sm [display:flex] [margin:3px_0] [min-width:0] terminalTabItem rounded-sm`}
                key={session.key}
                role="presentation"
              >
                <TabsTrigger
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
                    `${`terminalTab [align-items:center] [background:transparent] [color:var(--muted-foreground)] [display:flex] [gap:6px] [min-width:0] [padding:0_4px_0_9px] [&>_span:last-child]:[overflow:hidden] [&>_span:last-child]:[text-overflow:ellipsis] [&>_span:last-child]:[white-space:nowrap] terminalTab`}${activeKey === session.key ? ` ${`activeTerminalTab [background:var(--card)] [color:var(--foreground)] activeTerminalTab`}` : ""}`,
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={`${`terminalStatus [display:none] terminalStatus`} ${TERMINAL_STATUS_CLASS[session.status]}`}
                    title={session.error ?? session.status}
                  />
                  <span>{session.title}</span>
                  <span
                    aria-hidden="true"
                    className="-ml-1.5 h-6 w-6 shrink-0"
                  />
                </TabsTrigger>
              </div>
            ))}
          </TabsList>
          <div
            aria-label="Terminal tab close actions"
            className="pointer-events-none absolute inset-y-0 left-0 flex min-w-max items-stretch"
            role="toolbar"
          >
            {sessions.map((session) => (
              <div
                className="my-[3px] flex min-w-0 items-center"
                key={session.key}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "invisible inline-flex h-7 items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent px-2.5 text-xs text-muted-foreground [&_svg]:shrink-0",
                    `${`terminalTab [align-items:center] [background:transparent] [color:var(--muted-foreground)] [display:flex] [gap:6px] [min-width:0] [padding:0_4px_0_9px] [&>_span:last-child]:[overflow:hidden] [&>_span:last-child]:[text-overflow:ellipsis] [&>_span:last-child]:[white-space:nowrap] terminalTab`}${activeKey === session.key ? ` ${`activeTerminalTab [background:var(--card)] [color:var(--foreground)] activeTerminalTab`}` : ""}`,
                  )}
                >
                  <span
                    className={`${`terminalStatus [display:none] terminalStatus`} ${TERMINAL_STATUS_CLASS[session.status]}`}
                  />
                  <span>{session.title}</span>
                </span>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        onClick={() => void close(session.key)}
                        type="button"
                        aria-label={`Close ${session.title}`}
                        className={cn(
                          "pointer-events-auto h-6 min-w-5 aspect-square gap-1.5 px-0 text-xs hover:text-accent-foreground active:bg-[var(--overlay-pressed)]",
                        )}
                        variant="ghost"
                        size="icon-xs"
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
      </Tabs>
      <div
        aria-label="Action Toolbar"
        className={`terminalToolbar [align-items:stretch] [display:flex] terminalToolbar`}
        role="toolbar"
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                onClick={() => void onCreate()}
                ref={newTab}
                type="button"
                aria-label="New Tab"
                className={cn(
                  "h-[29px] min-w-[29px] px-[7px] aspect-square px-0 rounded-none border-l border-y-0 border-r-0 bg-transparent text-muted-foreground hover:text-accent-foreground active:bg-[var(--overlay-pressed)]",
                )}
                variant="outline"
                size="icon"
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
                onClick={onOpenPredefined}
                ref={predefinedButtonRef}
                type="button"
                aria-label="New Predefined Session"
                disabled={!hasPredefinedSessions}
                className={cn(
                  "h-[29px] min-w-[29px] px-[7px] aspect-square px-0 rounded-none border-l border-y-0 border-r-0 bg-transparent text-muted-foreground hover:text-accent-foreground active:bg-[var(--overlay-pressed)]",
                )}
                variant="outline"
                size="icon"
              >
                <Icon name="chevron" size={12} />
              </Button>
            }
          />
          <TooltipContent>New Predefined Session</TooltipContent>
        </Tooltip>
      </div>
      <div
        aria-label="Action Toolbar"
        className={`terminalToolbar [align-items:stretch] [display:flex] terminalToolbar`}
        role="toolbar"
      >
        {showAgents && (
          <Button
            onClick={onOpenAgents}
            ref={agentsButtonRef}
            type="button"
            className={cn(
              "h-[29px] min-w-[29px] px-[7px] rounded-none border-l border-y-0 border-r-0 bg-transparent text-muted-foreground hover:text-accent-foreground active:bg-[var(--overlay-pressed)]",
            )}
            variant="outline"
            size="sm"
          >
            AI Agents
            <Icon name="chevron" size={10} />
          </Button>
        )}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                onClick={onOpenOptions}
                ref={optionsButtonRef}
                type="button"
                aria-label="Options"
                className={cn(
                  "h-[29px] min-w-[29px] px-[7px] aspect-square px-0 rounded-none border-l border-y-0 border-r-0 bg-transparent text-muted-foreground hover:text-accent-foreground active:bg-[var(--overlay-pressed)]",
                )}
                variant="outline"
                size="icon"
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
                onClick={onHide}
                type="button"
                aria-label="Hide"
                className={cn(
                  "h-[29px] min-w-[29px] px-[7px] aspect-square px-0 rounded-none border-l border-y-0 border-r-0 bg-transparent text-muted-foreground hover:text-accent-foreground active:bg-[var(--overlay-pressed)]",
                )}
                variant="outline"
                size="icon"
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
