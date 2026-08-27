import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import type {
  ProjectSearchOptions,
  ProjectSearchResult,
} from "../domain/projectSearch";
import { Icon } from "./Icon";
import { EmptyState, List, ListItem } from "./ProductCollections";

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
  const fileCount = new Set(session?.results.map((result) => result.path) ?? [])
    .size;
  return (
    <section
      aria-label="Find"
      className={`findResultsPanel findResultsPanel [display:grid] [height:100%] [min-height:0] [grid-template-rows:32px_minmax(0,_1fr)] [&_li]:[min-height:37px] [&_li_code]:[font-size:9px] [&_li_code]:[color:var(--disabled-foreground)] [&>_header]:[display:flex] [&>_header]:[align-items:center] [&>_header]:[gap:7px] [&>_header]:[padding:0_7px] [&>_header]:[border-bottom:1px_solid_var(--border)] [&>_header_button]:[height:25px] [&>_header_button]:[padding:0_7px] [&>_header_button]:[background:var(--secondary)] [&>_header_button]:[border:1px_solid_var(--border)] [&>_header_span]:[flex:1] [&>_header_span]:[color:var(--muted-foreground)] [&>_header_strong]:[font-size:11px] [&>_ul]:[min-height:0] [&>_ul]:[overflow:auto] [&>_ul]:[padding:4px]`}
    >
      <header>
        <Icon name="search" size={14} />
        <strong>{session ? `“${session.query}”` : "Find in Files"}</strong>
        {session && (
          <span>
            {session.results.length.toLocaleString()} matches in{" "}
            {fileCount.toLocaleString()} files
          </span>
        )}
        <Button
          onClick={onSearchAgain}
          type="button"
          className={cn("h-7 px-2.5")}
          variant="outline"
          size="sm"
        >
          Find in Files…
        </Button>
      </header>
      {!session || session.results.length === 0 ? (
        <EmptyState title="Run Find in Files and open its results in this tool window." />
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
              aria-selected={false}
              role="option"
              startContent={<Icon name="file" size={13} />}
              tabIndex={-1}
            />
          ))}
        </List>
      )}
    </section>
  );
}
