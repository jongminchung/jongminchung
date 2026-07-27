import { Button } from "@base-ui/react/button";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  applyRepositoryCreationEvent,
  completeRepositoryCreation,
  failRepositoryCreation,
  IDLE_REPOSITORY_CREATION,
  requestRepositoryCreationCancellation,
  rejectRepositoryCreationCancellation,
  startRepositoryCreation,
  type RepositoryCreationState,
} from "../domain/repositoryCreation";
import { cn } from "../lib/utils";
import { electronApi, isElectronRuntime } from "../platform/electron";
import type { GitCreationEventListener } from "../shared/contracts/git-utility";
import type { CloneOptions } from "../shared/contracts/model";
import { useDismissLayer } from "./CommandProvider";
import {
  CheckboxInput,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Notice,
  SegmentedControl,
  SegmentedControlItem,
  TextInput,
} from "./ui";

export type RepositoryDialogMode = "open" | "clone" | "init";

function isRepositoryDialogMode(value: string): value is RepositoryDialogMode {
  return value === "open" || value === "clone" || value === "init";
}

export function RepositoryDialog({
  onClose,
  onOpen,
  onClone,
  onInit,
  onCancelCreation,
  initialMode = "open",
}: {
  readonly onClose: () => void;
  readonly onOpen: (path: string) => Promise<void>;
  readonly onClone: (
    url: string,
    path: string,
    options: CloneOptions,
    onEvent: GitCreationEventListener,
  ) => Promise<void>;
  readonly onInit: (
    path: string,
    bare: boolean,
    onEvent: GitCreationEventListener,
  ) => Promise<void>;
  readonly onCancelCreation: (requestId: string) => Promise<void>;
  readonly initialMode?: RepositoryDialogMode;
}) {
  const [mode, setMode] = useState<RepositoryDialogMode>(initialMode);
  const [path, setPath] = useState("");
  const [url, setUrl] = useState("");
  const [shallow, setShallow] = useState(false);
  const [branch, setBranch] = useState("");
  const [recurseSubmodules, setRecurseSubmodules] = useState(true);
  const [bare, setBare] = useState(false);
  const [pathError, setPathError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [creation, setCreation] = useState<RepositoryCreationState>(IDLE_REPOSITORY_CREATION);
  const creationRef = useRef<RepositoryCreationState>(creation);
  const commitCreation = useCallback(
    (update: (current: RepositoryCreationState) => RepositoryCreationState): void => {
      setCreation((current) => {
        const next = update(current);
        creationRef.current = next;
        return next;
      });
    },
    [],
  );
  const requestClose = useCallback((): void => {
    if (creationRef.current.kind !== "running") onClose();
  }, [onClose]);
  useDismissLayer(
    useMemo(
      () => ({
        id: "repository-dialog",
        priority: 120,
        active: true,
        dismiss: requestClose,
      }),
      [requestClose],
    ),
  );

  const running = creation.kind === "running";
  const fieldsLocked = running || creation.kind === "completed";

  const browse = async (): Promise<void> => {
    if (!isElectronRuntime() || fieldsLocked) return;
    const api = electronApi();
    const selected = await api?.dialog.openDirectory({
      title: "Choose Repository Directory",
      defaultPath: null,
      filters: [],
    });
    if (typeof selected === "string") {
      setPath(selected);
      setPathError(null);
    }
  };

  const submit = async (): Promise<void> => {
    if (running) return;
    const normalizedPath = path.trim();
    const normalizedUrl = url.trim();
    const nextPathError = normalizedPath.length === 0 ? "Enter a repository directory." : null;
    const nextUrlError =
      mode === "clone" && normalizedUrl.length === 0 ? "Enter a remote URL." : null;
    setPathError(nextPathError);
    setUrlError(nextUrlError);
    setOpenError(null);
    setCancelError(null);
    if (nextPathError !== null || nextUrlError !== null) return;
    if (mode === "open") {
      try {
        await onOpen(normalizedPath);
        onClose();
      } catch (error) {
        setOpenError(error instanceof Error ? error.message : String(error));
      }
      return;
    }

    const operation = mode === "clone" ? "clone" : "initialize";
    const started = startRepositoryCreation(operation);
    creationRef.current = started;
    setCreation(started);
    const onEvent: GitCreationEventListener = (event) => {
      commitCreation((current) => applyRepositoryCreationEvent(current, event));
    };
    try {
      if (mode === "clone") {
        await onClone(
          normalizedUrl,
          normalizedPath,
          {
            depth: shallow ? 1 : null,
            branch: branch.trim() || null,
            recurseSubmodules,
          },
          onEvent,
        );
      } else {
        await onInit(normalizedPath, bare, onEvent);
      }
      commitCreation(completeRepositoryCreation);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      commitCreation((current) => failRepositoryCreation(current, message));
    }
  };

  const cancelCreation = async (): Promise<void> => {
    const current = creationRef.current;
    if (
      current.kind !== "running" ||
      current.requestId === null ||
      current.cancellation === "requested"
    ) {
      return;
    }
    setCancelError(null);
    commitCreation(requestRepositoryCreationCancellation);
    try {
      await onCancelCreation(current.requestId);
    } catch (error) {
      commitCreation(rejectRepositoryCreationCancellation);
      setCancelError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <Dialog
      aria-label="Add repository"
      isOpen
      maxHeight="85vh"
      onOpenChange={(isOpen) => {
        if (!isOpen) requestClose();
      }}
      padding={0}
      purpose="form"
      width={560}
    >
      <form
        aria-busy={running}
        className="flex min-h-0 flex-col"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <DialogHeader
          hasDivider
          onOpenChange={(isOpen) => !isOpen && requestClose()}
          title="Repository"
        />
        <div className="border-b border-border px-4 py-3">
          <SegmentedControl
            label="Repository action"
            layout="fill"
            isDisabled={fieldsLocked}
            onChange={(value) => {
              if (isRepositoryDialogMode(value)) setMode(value);
            }}
            size="sm"
            value={mode}
          >
            <SegmentedControlItem label="Open Existing" value="open" />
            <SegmentedControlItem label="Clone" value="clone" />
            <SegmentedControlItem label="Initialize" value="init" />
          </SegmentedControl>
        </div>
        <DialogBody className="grid gap-4 p-4">
          {mode === "clone" && (
            <TextInput
              isRequired
              isDisabled={fieldsLocked}
              label="Remote URL"
              onChange={(value) => {
                setUrl(value);
                setUrlError(null);
              }}
              placeholder="git@github.com:owner/repository.git"
              value={url}
              width="100%"
              status={urlError === null ? undefined : { type: "error", message: urlError }}
            />
          )}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
            <TextInput
              isRequired
              isDisabled={fieldsLocked}
              label={mode === "clone" ? "Empty destination" : "Directory"}
              onChange={(value) => {
                setPath(value);
                setPathError(null);
              }}
              placeholder="/Users/you/Code/repository"
              value={path}
              width="100%"
              status={pathError === null ? undefined : { type: "error", message: pathError }}
            />
            <Button
              data-slot="button"
              onClick={() => void browse()}
              type="button"
              disabled={fieldsLocked}
              className={cn(
                "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-7 px-2.5 border-border bg-card text-secondary-foreground shadow-xs hover:bg-accent active:bg-accent/80",
              )}
            >
              Browse…
            </Button>
          </div>
          {mode === "clone" && (
            <>
              <TextInput
                description="Optional"
                isDisabled={fieldsLocked}
                label="Branch or tag"
                onChange={setBranch}
                placeholder="main"
                value={branch}
                width="100%"
              />
              <CheckboxInput
                isDisabled={fieldsLocked}
                label="Shallow clone (depth 1)"
                onChange={setShallow}
                value={shallow}
              />
              <CheckboxInput
                isDisabled={fieldsLocked}
                label="Recursively clone submodules"
                onChange={setRecurseSubmodules}
                value={recurseSubmodules}
              />
            </>
          )}
          {mode === "init" && (
            <CheckboxInput
              isDisabled={fieldsLocked}
              label="Bare repository"
              onChange={setBare}
              value={bare}
            />
          )}
          {openError !== null && (
            <Notice role="alert" tone="destructive">
              {openError}
            </Notice>
          )}
          {creation.kind === "running" && (
            <Notice
              aria-label="Repository creation progress"
              aria-live="polite"
              role="status"
              tone="neutral"
            >
              <section className="grid gap-2">
                <strong>{creation.phase}</strong>
                {creation.percent !== null && (
                  <progress max={100} value={creation.percent}>
                    {creation.percent}%
                  </progress>
                )}
                {creation.percent !== null && <span>{creation.percent}%</span>}
                {creation.requestId === null && <small>Waiting for Git to start…</small>}
                {creation.cancellation === "requested" && <small>Cancellation requested…</small>}
              </section>
            </Notice>
          )}
          {creation.kind === "completed" && (
            <Notice role="status" tone="success">
              {creation.message}
            </Notice>
          )}
          {creation.kind === "failed" && (
            <Notice role="alert" tone="destructive">
              {creation.message}
            </Notice>
          )}
          {creation.kind === "cancelled" && (
            <Notice role="status" tone="neutral">
              {creation.message}
            </Notice>
          )}
          {cancelError !== null && (
            <Notice role="alert" tone="destructive">
              {cancelError}
            </Notice>
          )}
        </DialogBody>
        <DialogFooter>
          {creation.kind === "running" ? (
            <Button
              data-slot="button"
              onClick={() => void cancelCreation()}
              type="button"
              disabled={creation.requestId === null || creation.cancellation === "requested"}
              className={cn(
                "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-7 px-2.5 border-transparent bg-transparent hover:bg-accent hover:text-accent-foreground active:bg-[var(--overlay-pressed)]",
              )}
            >
              {creation.cancellation === "requested" ? "Cancelling…" : "Cancel operation"}
            </Button>
          ) : creation.kind === "completed" ? (
            <Button
              data-slot="button"
              onClick={onClose}
              type="button"
              className={cn(
                "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-7 px-2.5 border-primary bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/80",
              )}
            >
              Done
            </Button>
          ) : (
            <>
              <Button
                data-slot="button"
                onClick={onClose}
                type="button"
                className={cn(
                  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-7 px-2.5 border-transparent bg-transparent hover:bg-accent hover:text-accent-foreground active:bg-[var(--overlay-pressed)]",
                )}
              >
                Cancel
              </Button>
              <Button
                data-slot="button"
                type="submit"
                className={cn(
                  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-7 px-2.5 border-primary bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/80",
                )}
              >
                {mode === "open"
                  ? "Open"
                  : creation.kind === "failed" || creation.kind === "cancelled"
                    ? mode === "clone"
                      ? "Retry Clone"
                      : "Retry Initialize"
                    : mode === "clone"
                      ? "Clone"
                      : "Initialize"}
              </Button>
            </>
          )}
        </DialogFooter>
      </form>
    </Dialog>
  );
}
