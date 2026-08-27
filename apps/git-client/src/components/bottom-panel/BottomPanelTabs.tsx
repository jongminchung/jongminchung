import { Button } from "@jongminchung/ui/components/button";
import { Tabs, TabsList, TabsTrigger } from "@jongminchung/ui/components/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@jongminchung/ui/components/tooltip";
import { cn } from "@jongminchung/ui/lib/utils";
import { Icon } from "../Icon";
import type { BottomPanelTab } from "./bottomPanelTypes";

const tabs: readonly {
  readonly id: BottomPanelTab;
  readonly label: string;
  readonly icon: Parameters<typeof Icon>[0]["name"];
}[] = [
  { id: "shelf", label: "Shelf", icon: "shelf" },
  { id: "stash", label: "Stash", icon: "stash" },
  { id: "recovery", label: "Recovery", icon: "history" },
  { id: "find", label: "Find", icon: "search" },
  { id: "localHistory", label: "Local History", icon: "history" },
  { id: "gitConsole", label: "Git Console", icon: "branch" },
  { id: "terminal", label: "Terminal", icon: "console" },
];

export function isBottomPanelTab(value: unknown): value is BottomPanelTab {
  return tabs.some((tab) => tab.id === value);
}

export function BottomPanelTabs({
  active,
  stashCount,
  onActiveChange,
  onHide,
  onExplicitOpen,
}: {
  readonly active: BottomPanelTab;
  readonly stashCount: number;
  readonly onActiveChange: (active: BottomPanelTab) => void;
  readonly onHide: () => void;
  readonly onExplicitOpen: () => void;
}) {
  return (
    <Tabs
      className="contents"
      onValueChange={(value) => {
        if (!isBottomPanelTab(value)) return;
        onActiveChange(value);
        onExplicitOpen();
      }}
      value={active}
    >
      <div
        className={`toolTabs toolTabs [display:flex] [align-items:stretch] [background:var(--card)] [background:var(--secondary)] [&_.activeToolTab]:[font-weight:600] [&_.activeToolTab]:[color:var(--foreground)] [&_.activeToolTab]:[box-shadow:inset_0_-2px_var(--primary)] [&_button]:[display:flex] [&_button]:[align-items:center] [&_button]:[gap:6px] [&_button]:[padding:0_12px] [&_button]:[color:var(--muted-foreground)] [&_button]:[background:transparent] [&_button]:[border-right:1px_solid_var(--border)] [&_button_em]:[display:flex] [&_button_em]:[height:14px] [&_button_em]:[min-width:14px] [&_button_em]:[align-items:center] [&_button_em]:[justify-content:center] [&_button_em]:rounded-lg [&_button_em]:[font-size:9px] [&_button_em]:[font-style:normal] [&_button_em]:[background:var(--muted)] [&_button:hover]:[color:var(--foreground)] [&_button:hover]:[background:var(--muted)] [&>_span]:[flex:1]`}
      >
        <TabsList
          activateOnFocus
          aria-label="Bottom tool windows"
          className="contents"
        >
          {tabs.map((tab) => (
            <TabsTrigger
              aria-controls="bottom-tool-panel"
              aria-label={`${tab.label} Tool Window Tab`}
              data-bottom-tab={tab.id}
              id={`bottom-tool-tab-${tab.id}`}
              key={tab.id}
              onClick={() => {
                if (tab.id !== active) onActiveChange(tab.id);
                onExplicitOpen();
              }}
              value={tab.id}
              className={cn(
                "inline-flex h-7 items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent px-2.5 text-xs text-muted-foreground transition-[color,background-color,border-color,box-shadow] outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 data-active:bg-accent data-active:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
                active === tab.id
                  ? `activeToolTab activeToolTab [font-weight:600] [color:var(--foreground)] [color:var(--foreground)]! [box-shadow:inset_0_-2px_var(--primary)] [background:var(--accent)]!`
                  : undefined,
              )}
            >
              <Icon name={tab.icon} size={14} />
              {tab.label}
              {tab.id === "stash" && stashCount > 0 && <em>{stashCount}</em>}
            </TabsTrigger>
          ))}
        </TabsList>
        <span />
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="Hide"
                onClick={onHide}
                type="button"
                className="text-muted-foreground"
                variant="ghost"
                size="icon-sm"
              >
                ⌄
              </Button>
            }
          />
          <TooltipContent>Hide</TooltipContent>
        </Tooltip>
      </div>
    </Tabs>
  );
}
