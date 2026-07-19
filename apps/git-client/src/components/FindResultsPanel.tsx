import { List, ListItem } from "@astryxdesign/core/List";
import type {
  ProjectSearchOptions,
  ProjectSearchResult,
} from "../domain/projectSearch";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";

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
        <button onClick={onSearchAgain}>Find in Files…</button>
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
              endContent={<code>{result.line}:{result.column}</code>}
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
