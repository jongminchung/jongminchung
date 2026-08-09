import { Button } from "@jongminchung/ui/components/button";
import { Toggle } from "@jongminchung/ui/components/toggle";
import { cn } from "@jongminchung/ui/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  replacementExpression,
  type ProjectSearchOptions,
  type ProjectTextMatch,
} from "../domain/projectSearch";
import { Icon } from "./Icon";
import { List, ListItem } from "./ProductCollections";
import { Spinner } from "./ProductCollections";
import { Dialog, DialogHeader } from "./ProductDialog";
import { TextInput } from "./ProductFormControls";

const DEFAULT_OPTIONS: ProjectSearchOptions = {
  matchCase: false,
  words: false,
  regex: false,
};

export function ReplaceInFilesDialog({
  onClose,
  onOpenResult,
  onReplace,
  search,
}: {
  readonly onClose: () => void;
  readonly onOpenResult: (result: ProjectTextMatch) => void;
  readonly onReplace: (
    paths: readonly string[],
    query: string,
    replacement: string,
    options: ProjectSearchOptions,
  ) => Promise<number>;
  readonly search: (
    query: string,
    options: ProjectSearchOptions,
  ) => Promise<readonly ProjectTextMatch[]>;
}) {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [options, setOptions] = useState<ProjectSearchOptions>(DEFAULT_OPTIONS);
  const [matches, setMatches] = useState<readonly ProjectTextMatch[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<ReadonlySet<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [error, setError] = useState<string>();
  const generation = useRef(0);

  useEffect(() => {
    const value = query;
    const current = generation.current + 1;
    generation.current = current;
    setError(undefined);
    if (value === "") {
      setMatches([]);
      setSelectedPaths(new Set());
      setLoading(false);
      return;
    }
    try {
      replacementExpression(value, options);
    } catch (reason) {
      setMatches([]);
      setSelectedPaths(new Set());
      setError(reason instanceof Error ? reason.message : String(reason));
      return;
    }
    setLoading(true);
    const timer = window.setTimeout(() => {
      void search(value, options).then(
        (next) => {
          if (generation.current !== current) return;
          setMatches(next);
          setSelectedPaths(new Set(next.map((match) => match.path)));
          setLoading(false);
        },
        (reason: unknown) => {
          if (generation.current !== current) return;
          setError(reason instanceof Error ? reason.message : String(reason));
          setMatches([]);
          setSelectedPaths(new Set());
          setLoading(false);
        },
      );
    }, 180);
    return () => window.clearTimeout(timer);
  }, [options, query, search]);

  const files = useMemo(() => [...new Set(matches.map((match) => match.path))], [matches]);
  const replace = async (): Promise<void> => {
    if (query === "" || selectedPaths.size === 0 || replacing) return;
    setReplacing(true);
    setError(undefined);
    try {
      await onReplace([...selectedPaths], query, replacement, options);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setReplacing(false);
    }
  };

  return (
    <Dialog
      aria-label="Replace in Files"
      isOpen
      maxHeight="min(720px, calc(100vh - 70px))"
      onOpenChange={(open) => !open && onClose()}
      padding={0}
      purpose="form"
      width="min(820px, calc(100vw - 70px))"
    >
      <section
        className={`replaceInFilesDialog [display:grid] [grid-template-rows:auto_auto_auto_minmax(0,_1fr)_auto] [height:min(680px,_calc(100vh_-_70px))] [min-height:0] [&>_footer]:[border-top:1px_solid_var(--border)] [&>_footer]:[display:flex] [&>_footer]:[gap:8px] [&>_footer]:[justify-content:flex-end] [&>_footer]:[padding:9px_12px] replaceInFilesDialog`}
      >
        <DialogHeader
          hasDivider
          onOpenChange={(open) => !open && onClose()}
          title="Replace in Files"
        />
        <div
          className={`replaceInFilesQuery [border-bottom:1px_solid_var(--border)] [display:grid] [gap:8px] [grid-template-columns:minmax(0,_1fr)_minmax(0,_1fr)_auto] [padding:10px_12px] [&>_div:last-child]:[align-items:flex-end] [&>_div:last-child]:[display:flex] [&>_div:last-child]:[gap:4px] replaceInFilesQuery`}
        >
          <TextInput
            hasAutoFocus
            label="Text to find"
            onChange={setQuery}
            value={query}
            width="100%"
          />
          <TextInput
            label="Replace with"
            onChange={setReplacement}
            value={replacement}
            width="100%"
          />
          <div>
            <Toggle
              aria-label="Match case"
              className="inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2 text-xs outline-none hover:bg-accent data-pressed:bg-accent data-pressed:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/45 disabled:opacity-45"
              onPressedChange={(matchCase) =>
                setOptions((current) => ({
                  ...current,
                  matchCase,
                }))
              }
              pressed={options.matchCase}
              type="button"
            >
              Aa
            </Toggle>
            <Toggle
              aria-label="Words"
              className="inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2 text-xs outline-none hover:bg-accent data-pressed:bg-accent data-pressed:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/45 disabled:opacity-45"
              onPressedChange={(words) => setOptions((current) => ({ ...current, words }))}
              pressed={options.words}
              type="button"
            >
              W
            </Toggle>
            <Toggle
              aria-label="Regex"
              className="inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2 text-xs outline-none hover:bg-accent data-pressed:bg-accent data-pressed:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/45 disabled:opacity-45"
              onPressedChange={(regex) => setOptions((current) => ({ ...current, regex }))}
              pressed={options.regex}
              type="button"
            >
              .*
            </Toggle>
          </div>
        </div>
        <div
          className={`replaceInFilesStatus [align-items:center] [background:var(--muted)] [border-bottom:1px_solid_var(--border)] [color:var(--muted-foreground)] [display:flex] [min-height:30px] [padding:4px_12px] [&>_span]:[flex:1] [&>_button]:[background:transparent] [&>_button]:[color:var(--primary)] replaceInFilesStatus`}
        >
          <span>
            {loading ? "Searching…" : `${matches.length} matches in ${files.length} files`}
          </span>
          {files.length > 0 && (
            <Button
              onClick={() =>
                setSelectedPaths(new Set(selectedPaths.size === files.length ? [] : files))
              }
              type="button"
              className={cn("h-7 px-2.5")}
              variant="ghost"
              size="sm"
            >
              {selectedPaths.size === files.length ? "Unselect All" : "Select All"}
            </Button>
          )}
        </div>
        <div
          className={`replaceInFilesResults [min-height:0] [overflow:auto] [padding:5px_7px] [&>_p]:[color:var(--muted-foreground)] [&>_p]:[margin:24px] [&>_p[role=alert]]:[color:var(--destructive)] [&_li]:rounded-sm [&_li_code]:[color:var(--disabled-foreground)] [&_li_code]:[font-size:9px] replaceInFilesResults [&_li]:rounded-sm`}
        >
          {loading ? (
            <Spinner label="Searching project…" size="lg" />
          ) : error ? (
            <p role="alert">{error}</p>
          ) : matches.length === 0 ? (
            <p>{query ? "Nothing found" : "Enter text to find in the project."}</p>
          ) : (
            <List aria-label="Replace preview" density="compact">
              {matches.map((match, index) => (
                <ListItem
                  description={match.content.trim() || " "}
                  endContent={
                    <code>
                      {match.path}:{match.line}:{match.column}
                    </code>
                  }
                  id={`replace-match-${index}`}
                  key={`${match.path}:${match.line}:${match.column}:${index}`}
                  label={match.path}
                  onClick={() =>
                    setSelectedPaths((current) => {
                      const next = new Set(current);
                      if (next.has(match.path)) next.delete(match.path);
                      else next.add(match.path);
                      return next;
                    })
                  }
                  onDoubleClick={() => onOpenResult(match)}
                  startContent={
                    <Icon
                      aria-label={selectedPaths.has(match.path) ? "Selected" : "Not selected"}
                      name={selectedPaths.has(match.path) ? "check" : "minus"}
                      size={14}
                    />
                  }
                />
              ))}
            </List>
          )}
        </div>
        <footer>
          <Button
            onClick={onClose}
            type="button"
            className={cn("h-8 px-3")}
            variant="outline"
            size="default"
          >
            Cancel
          </Button>
          <Button
            onClick={() => void replace()}
            type="button"
            disabled={loading || replacing || selectedPaths.size === 0 || query === ""}
            className={cn("h-8 px-3")}
            variant="default"
            size="default"
          >
            {replacing ? "Replacing…" : "Replace All"}
          </Button>
        </footer>
      </section>
    </Dialog>
  );
}
