import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { List, ListItem } from "@astryxdesign/core/List";
import { Spinner } from "@astryxdesign/core/Spinner";
import { TextInput } from "@astryxdesign/core/TextInput";
import { ToggleButton } from "@astryxdesign/core/ToggleButton";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  replacementExpression,
  type ProjectSearchOptions,
  type ProjectTextMatch,
} from "../domain/projectSearch";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";

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

  const files = useMemo(
    () => [...new Set(matches.map((match) => match.path))],
    [matches],
  );
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
      <section className={tw.replaceInFilesDialog}>
        <DialogHeader hasDivider onOpenChange={(open) => !open && onClose()} title="Replace in Files" />
        <div className={tw.replaceInFilesQuery}>
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
            <ToggleButton isPressed={options.matchCase} label="Match case" onPressedChange={(matchCase) => setOptions((current) => ({ ...current, matchCase }))}>Aa</ToggleButton>
            <ToggleButton isPressed={options.words} label="Words" onPressedChange={(words) => setOptions((current) => ({ ...current, words }))}>W</ToggleButton>
            <ToggleButton isPressed={options.regex} label="Regex" onPressedChange={(regex) => setOptions((current) => ({ ...current, regex }))}>.*</ToggleButton>
          </div>
        </div>
        <div className={tw.replaceInFilesStatus}>
          <span>{loading ? "Searching…" : `${matches.length} matches in ${files.length} files`}</span>
          {files.length > 0 && (
            <Button
              label={selectedPaths.size === files.length ? "Unselect All" : "Select All"}
              onClick={() => setSelectedPaths(new Set(selectedPaths.size === files.length ? [] : files))}
              size="sm"
              variant="ghost"
            />
          )}
        </div>
        <div className={tw.replaceInFilesResults}>
          {loading ? <Spinner label="Searching project…" size="lg" /> : error ? (
            <p role="alert">{error}</p>
          ) : matches.length === 0 ? (
            <p>{query ? "Nothing found" : "Enter text to find in the project."}</p>
          ) : (
            <List aria-label="Replace preview" density="compact">
              {matches.map((match, index) => (
                <ListItem
                  description={match.content.trim() || " "}
                  endContent={<code>{match.path}:{match.line}:{match.column}</code>}
                  id={`replace-match-${index}`}
                  key={`${match.path}:${match.line}:${match.column}:${index}`}
                  label={match.path}
                  onClick={() => setSelectedPaths((current) => {
                    const next = new Set(current);
                    if (next.has(match.path)) next.delete(match.path);
                    else next.add(match.path);
                    return next;
                  })}
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
          <Button label="Cancel" onClick={onClose} variant="secondary" />
          <Button
            isDisabled={loading || replacing || selectedPaths.size === 0 || query === ""}
            label={replacing ? "Replacing…" : "Replace All"}
            onClick={() => void replace()}
            variant="primary"
          />
        </footer>
      </section>
    </Dialog>
  );
}
