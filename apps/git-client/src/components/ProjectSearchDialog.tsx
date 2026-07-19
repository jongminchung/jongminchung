import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { List, ListItem } from "@astryxdesign/core/List";
import { Spinner } from "@astryxdesign/core/Spinner";
import { TextInput } from "@astryxdesign/core/TextInput";
import { ToggleButton } from "@astryxdesign/core/ToggleButton";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  projectSearchResults,
  type ProjectSearchMode,
  type ProjectSearchOptions,
  type ProjectSearchResult,
  type ProjectTextMatch,
} from "../domain/projectSearch";
import { tw } from "../styles/tailwind";
import { useDismissLayer } from "./CommandProvider";
import { Icon } from "./Icon";

export type ProjectSearchSurface = "find" | "class" | "symbol" | "text" | "definition" | "typeDefinition" | "usages" | "usagesFile" | "implementation" | "related" | "structure" | "typeHierarchy" | "callHierarchy";

const SURFACE_COPY = {
  find: {
    title: "Find in Files",
    placeholder: "Text to find",
    mode: "text",
    empty: "Enter text to search in the project.",
  },
  class: {
    title: "Go to Class",
    placeholder: "Enter class name",
    mode: "class",
    empty: "Enter a class name.",
  },
  symbol: {
    title: "Go to Symbol",
    placeholder: "Enter symbol name",
    mode: "symbol",
    empty: "Enter a symbol name.",
  },
  text: {
    title: "Text",
    placeholder: "Enter text to search",
    mode: "text",
    empty: "Enter text to search in the project.",
  },
  definition: {
    title: "Quick Definition",
    placeholder: "Enter a symbol name",
    mode: "symbol",
    empty: "Place the caret on a symbol or enter its name.",
  },
  typeDefinition: {
    title: "Quick Type Definition",
    placeholder: "Enter a type name",
    mode: "class",
    empty: "Place the caret on a type or enter its name.",
  },
  usages: {
    title: "Find Usages",
    placeholder: "Enter a symbol name",
    mode: "symbol",
    empty: "Place the caret on a symbol or enter its name.",
  },
  usagesFile: {
    title: "Find Usages in File",
    placeholder: "Enter a symbol name",
    mode: "symbol",
    empty: "Place the caret on a symbol or enter its name.",
  },
  implementation: {
    title: "Implementations",
    placeholder: "Enter a symbol name",
    mode: "symbol",
    empty: "Place the caret on a declaration or enter its name.",
  },
  related: {
    title: "Related Symbol",
    placeholder: "Enter a symbol name",
    mode: "symbol",
    empty: "Place the caret on a symbol or enter its name.",
  },
  structure: {
    title: "File Structure",
    placeholder: "Filter members",
    mode: "symbol",
    empty: "Enter a member name.",
  },
  typeHierarchy: {
    title: "Type Hierarchy",
    placeholder: "Enter a type name",
    mode: "class",
    empty: "Place the caret on a type or enter its name.",
  },
  callHierarchy: {
    title: "Call Hierarchy",
    placeholder: "Enter a symbol name",
    mode: "symbol",
    empty: "Place the caret on a symbol or enter its name.",
  },
} as const satisfies Readonly<Record<ProjectSearchSurface, Readonly<{
  title: string;
  placeholder: string;
  mode: ProjectSearchMode;
  empty: string;
}>>>;

const DEFAULT_OPTIONS: ProjectSearchOptions = {
  matchCase: false,
  words: false,
  regex: false,
};

export function ProjectSearchDialog({
  surface,
  onClose,
  onOpenResult,
  onOpenInFindWindow,
  search,
  initialQuery = "",
  pathScope,
  scrollToResults = true,
}: {
  readonly surface: ProjectSearchSurface;
  readonly onClose: () => void;
  readonly onOpenResult: (result: ProjectSearchResult) => void;
  readonly onOpenInFindWindow?: (
    query: string,
    options: ProjectSearchOptions,
    results: readonly ProjectSearchResult[],
  ) => void;
  readonly search: (
    query: string,
    options: ProjectSearchOptions,
  ) => Promise<readonly ProjectTextMatch[]>;
  readonly initialQuery?: string;
  readonly pathScope?: string;
  readonly scrollToResults?: boolean;
}) {
  const copy = SURFACE_COPY[surface];
  const [query, setQuery] = useState(initialQuery);
  const [options, setOptions] = useState<ProjectSearchOptions>(DEFAULT_OPTIONS);
  const [matches, setMatches] = useState<readonly ProjectTextMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [activeIndex, setActiveIndex] = useState(0);
  const generation = useRef(0);
  useEffect(() => setQuery(initialQuery), [initialQuery, surface]);
  useDismissLayer(useMemo(() => ({
    id: "project-search-dialog",
    priority: 135,
    active: true,
    dismiss: onClose,
  }), [onClose]));

  useEffect(
    () => () => {
      void search("", DEFAULT_OPTIONS);
    },
    [search],
  );

  useEffect(() => {
    const currentGeneration = generation.current + 1;
    generation.current = currentGeneration;
    const value = query.trim();
    setActiveIndex(0);
    setError(undefined);
    if (value.length === 0) {
      void search("", options);
      setMatches([]);
      setLoading(false);
      return;
    }
    setMatches([]);
    setLoading(true);
    const timer = window.setTimeout(() => {
      void search(value, options).then(
        (next) => {
          if (generation.current !== currentGeneration) return;
          setMatches(next);
          setLoading(false);
        },
        (reason: unknown) => {
          if (generation.current !== currentGeneration) return;
          setMatches([]);
          setLoading(false);
          setError(reason instanceof Error ? reason.message : String(reason));
        },
      );
    }, 180);
    return () => window.clearTimeout(timer);
  }, [options, query, search]);

  const results = useMemo(
    () => projectSearchResults(matches, copy.mode, query.trim(), options.matchCase)
      .filter((result) => pathScope === undefined || result.path === pathScope),
    [copy.mode, matches, options.matchCase, pathScope, query],
  );
  const resultFileCount = useMemo(
    () => new Set(results.map((result) => result.path)).size,
    [results],
  );
  useEffect(() => {
    if (!scrollToResults) return;
    document
      .getElementById(`project-search-result-${activeIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, scrollToResults]);
  const activate = (result: ProjectSearchResult): void => {
    onClose();
    onOpenResult(result);
  };
  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "ArrowDown") {
      setActiveIndex((current) => Math.min(results.length - 1, current + 1));
    } else if (event.key === "ArrowUp") {
      setActiveIndex((current) => Math.max(0, current - 1));
    } else if (event.key === "Home") {
      setActiveIndex(0);
    } else if (event.key === "End") {
      setActiveIndex(Math.max(0, results.length - 1));
    } else if (event.key === "Enter") {
      const result = results[activeIndex];
      if (result) activate(result);
    } else {
      return;
    }
    event.preventDefault();
  };

  return (
    <Dialog
      aria-label={copy.title}
      isOpen
      maxHeight="min(650px, calc(100vh - 82px))"
      onOpenChange={(open) => !open && onClose()}
      padding={0}
      purpose="info"
      width="min(760px, calc(100vw - 72px))"
    >
      <section className={tw.projectSearchDialog}>
        <DialogHeader
          hasDivider
          onOpenChange={(open) => !open && onClose()}
          title={copy.title}
        />
        <div className={tw.projectSearchQuery}>
          <TextInput
            hasAutoFocus
            hasClear
            isLabelHidden
            isLoading={loading}
            label={copy.title}
            onChange={setQuery}
            onKeyDown={onInputKeyDown}
            placeholder={copy.placeholder}
            size="md"
            value={query}
            width="100%"
          />
          {surface === "find" && (
            <>
              <ToggleButton
                icon={<Icon name="folder" size={14} />}
                isPressed
                label="In Project"
                size="sm"
              />
              <ToggleButton
                isPressed={options.matchCase}
                label="Match case"
                onPressedChange={(matchCase) => setOptions((current) => ({ ...current, matchCase }))}
                size="sm"
              >
                Aa
              </ToggleButton>
              <ToggleButton
                isPressed={options.words}
                label="Words"
                onPressedChange={(words) => setOptions((current) => ({ ...current, words }))}
                size="sm"
              >
                W
              </ToggleButton>
              <ToggleButton
                isPressed={options.regex}
                label="Regex"
                onPressedChange={(regex) => setOptions((current) => ({ ...current, regex }))}
                size="sm"
              >
                .*
              </ToggleButton>
            </>
          )}
        </div>
        <div className={tw.projectSearchStatus} aria-live="polite">
          <span>
            {loading
              ? "Searching…"
              : results.length > 0
                ? `${results.length.toLocaleString()} matches in ${resultFileCount.toLocaleString()} files`
                : query.trim().length > 0
                  ? "No matches"
                  : copy.empty}
          </span>
          {surface === "find" && onOpenInFindWindow && (
            <Button
              isDisabled={loading || results.length === 0}
              label="Open in Find Window"
              onClick={() => {
                onOpenInFindWindow(query.trim(), options, results);
                onClose();
              }}
              size="sm"
              variant="ghost"
            />
          )}
        </div>
        <div className={tw.projectSearchResults}>
          {loading && results.length === 0 ? (
            <Spinner label="Searching project…" size="lg" />
          ) : error ? (
            <p role="alert">{error}</p>
          ) : results.length === 0 ? (
            <p>{query.trim().length > 0 ? "Nothing found" : copy.empty}</p>
          ) : (
            <List aria-label={`${copy.title} results`} density="compact" role="listbox">
              {results.map((result, index) => (
                <ListItem
                  aria-selected={index === activeIndex}
                  description={result.content.trim() || " "}
                  endContent={<code>{result.path}:{result.line}:{result.column}</code>}
                  id={`project-search-result-${index}`}
                  isSelected={index === activeIndex}
                  key={`${result.path}:${result.line}:${result.column}:${index}`}
                  label={result.name}
                  onClick={() => activate(result)}
                  onMouseEnter={() => setActiveIndex(index)}
                  role="option"
                  startContent={<Icon name={result.kind === "class" ? "file" : "search"} size={14} />}
                />
              ))}
            </List>
          )}
        </div>
      </section>
    </Dialog>
  );
}
