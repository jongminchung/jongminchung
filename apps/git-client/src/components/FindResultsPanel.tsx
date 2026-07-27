import { Button } from "@base-ui/react/button";
import type { ProjectSearchOptions, ProjectSearchResult } from "../domain/projectSearch";
import { cn } from "../lib/utils";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";
import { List, ListItem } from "./ui";

export interface FindResultsSession {
  readonly query: string;
  readonly options: ProjectSearchOptions;
  readonly results: readonly ProjectSearchResult[];
}

export function FindResultsPanel({
  session,
  onOpenResult,
  onSearchAgain,
}: {
  readonly session: FindResultsSession | null;
  readonly onOpenResult: (result: ProjectSearchResult) => void;
  readonly onSearchAgain: () => void;
}) {
  const fileCount = new Set(session?.results.map((result) => result.path) ?? []).size;
  return (
    <section aria-label="Find" className={tw.findResultsPanel}>
      <header>
        <Icon name="search" size={14} />
        <strong>{session ? `“${session.query}”` : "Find in Files"}</strong>
        {session && (
          <span>
            {session.results.length.toLocaleString()} matches in {fileCount.toLocaleString()} files
          </span>
        )}
        <Button
          data-slot="button"
          onClick={onSearchAgain}
          type="button"
          className={cn(
            "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 border-border bg-card text-secondary-foreground shadow-xs hover:bg-accent active:bg-accent/80 h-7 px-2.5",
          )}
        >
          Find in Files…
        </Button>
      </header>
      {!session || session.results.length === 0 ? (
        <div className={tw.emptyState}>
          Run Find in Files and open its results in this tool window.
        </div>
      ) : (
        <List aria-label="Find results" density="compact" role="listbox">
          {session.results.map((result, index) => (
            <ListItem
              description={result.content.trim() || " "}
              endContent={
                <code>
                  {result.line}:{result.column}
                </code>
              }
              key={`${result.path}:${result.line}:${result.column}:${index}`}
              label={result.path}
              onClick={() => onOpenResult(result)}
              role="option"
              startContent={<Icon name="file" size={13} />}
            />
          ))}
        </List>
      )}
    </section>
  );
}
