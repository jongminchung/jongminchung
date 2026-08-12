import { Button } from "@jongminchung/ui/components/button";
import { Input } from "@jongminchung/ui/components/input";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@jongminchung/ui/components/tooltip";
import { cn } from "@jongminchung/ui/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Ref } from "../domain/types";
import type {
    BranchComparison,
    GitOperation,
    RemoteInfo,
} from "../shared/contracts/model";
import { useDismissLayer } from "./CommandProvider";
import { GitBranchSelectionPanel } from "./git-branches/GitBranchSelectionPanel";
import { useGitBranchActions } from "./git-branches/useGitBranchActions";
import { Icon } from "./Icon";
import { Notice } from "./Notice";

interface BranchPopupRow {
    readonly ref: Ref;
    readonly label: string;
}

export function GitBranchesPopup({
    refs,
    currentBranch,
    onCheckout,
    onOperation,
    onCompare,
    onCommit,
    remotes = [],
    onOpenSettings,
    onClose,
}: {
    readonly refs: readonly Ref[];
    readonly currentBranch?: string | null;
    readonly onCheckout: (target: string) => Promise<void>;
    readonly onOperation?: (operation: GitOperation) => Promise<void>;
    readonly onCompare?: (
        left: string,
        right: string,
    ) => Promise<BranchComparison>;
    readonly onCommit?: () => void;
    readonly remotes?: readonly RemoteInfo[];
    readonly onOpenSettings: () => void;
    readonly onClose: () => void;
}) {
    const popup = useRef<HTMLDialogElement>(null);
    const search = useRef<HTMLInputElement>(null);
    const selectedActions = useRef<HTMLDivElement>(null);
    const [query, setQuery] = useState("");
    const [activeIndex, setActiveIndex] = useState(0);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const normalizedQuery = query.trim().toLowerCase();
    const rows = useMemo<readonly BranchPopupRow[]>(
        () =>
            refs
                .filter(
                    (ref) =>
                        !normalizedQuery ||
                        ref.shortName.toLowerCase().includes(normalizedQuery),
                )
                .sort((left, right) => {
                    if (left.current !== right.current)
                        return left.current ? -1 : 1;
                    if (left.kind !== right.kind) {
                        const order = { local: 0, remote: 1, tag: 2 } as const;
                        return order[left.kind] - order[right.kind];
                    }
                    return left.shortName.localeCompare(
                        right.shortName,
                        undefined,
                        {
                            numeric: true,
                            sensitivity: "base",
                        },
                    );
                })
                .map((ref) => ({ ref, label: ref.shortName })),
        [normalizedQuery, refs],
    );

    useDismissLayer(
        useMemo(
            () => ({
                id: "git-branches-popup",
                priority: 115,
                active: true,
                dismiss: onClose,
            }),
            [onClose],
        ),
    );

    useEffect(() => {
        search.current?.focus();
    }, []);

    useEffect(() => {
        setActiveIndex((current) =>
            Math.min(current, Math.max(0, rows.length - 1)),
        );
    }, [rows.length]);

    const activeRef = rows[activeIndex]?.ref ?? null;
    const actionMatches = (label: string): boolean =>
        !normalizedQuery || label.toLowerCase().includes(normalizedQuery);
    const {
        addWorktree,
        busy,
        checkoutActive,
        checkoutRevision,
        compareActive,
        comparison,
        createBranch,
        createTag,
        deleteActive,
        dialogNode,
        error,
        mergeActive,
        pushActiveTag,
        renameActive,
        run,
        setUpstream,
    } = useGitBranchActions({
        activeRef,
        currentBranch,
        onCheckout,
        onClose,
        onCompare,
        onOpenSettings,
        onOperation,
        remotes,
    });

    const moveFocusWithinPopup = (backward: boolean): void => {
        const elements = popup.current?.querySelectorAll<HTMLElement>(
            'input:not(:disabled), button:not(:disabled), [tabindex]:not([tabindex="-1"])',
        );
        if (!elements || elements.length === 0) return;
        const current = Array.from(elements).findIndex(
            (element) => element === document.activeElement,
        );
        const next =
            current < 0
                ? 0
                : (current + (backward ? -1 : 1) + elements.length) %
                  elements.length;
        elements[next]?.focus();
    };

    return (
        <dialog
            open
            aria-busy={busy || undefined}
            aria-label="Git Branches"
            className={`gitBranchesPopup [background:var(--popover)] [border:1px_solid_var(--input)] rounded-lg [box-shadow:var(--shadow-lg)] [display:grid] [grid-template-rows:36px_minmax(120px,_auto)] [left:0] [max-height:min(520px,_calc(100vh_-_70px))] [min-width:368px] [overflow:hidden] [position:absolute] [top:31px] [z-index:100] gitBranchesPopup rounded-lg`}
            onKeyDown={(event) => {
                if (event.key === "Escape") {
                    event.preventDefault();
                    onClose();
                } else if (event.key === "Tab") {
                    event.preventDefault();
                    moveFocusWithinPopup(event.shiftKey);
                } else if (event.key === "ArrowLeft" && detailsOpen) {
                    event.preventDefault();
                    setDetailsOpen(false);
                    search.current?.focus();
                } else if (
                    event.target instanceof HTMLElement &&
                    event.target.closest("button") !== null
                ) {
                    return;
                } else if (
                    event.key === "ArrowDown" ||
                    event.key === "ArrowUp"
                ) {
                    event.preventDefault();
                    setActiveIndex((current) => {
                        const offset = event.key === "ArrowDown" ? 1 : -1;
                        return (
                            (current + offset + rows.length) %
                            Math.max(1, rows.length)
                        );
                    });
                } else if (event.key === "Home" || event.key === "End") {
                    event.preventDefault();
                    setActiveIndex(
                        event.key === "Home" ? 0 : Math.max(0, rows.length - 1),
                    );
                } else if (event.key === "Enter") {
                    event.preventDefault();
                    void checkoutActive();
                } else if (event.key === " ") {
                    event.preventDefault();
                    void checkoutActive();
                } else if (event.key === "ArrowRight" && activeRef) {
                    event.preventDefault();
                    setDetailsOpen(true);
                    window.requestAnimationFrame(() =>
                        selectedActions.current
                            ?.querySelector<HTMLButtonElement>(
                                "button:not(:disabled)",
                            )
                            ?.focus(),
                    );
                }
            }}
            ref={popup}
        >
            <div
                className={`gitBranchesSearch [align-items:center] [border-bottom:1px_solid_var(--border)] [display:grid] [gap:5px] [grid-template-columns:minmax(0,_1fr)_auto] [padding:4px_5px] [&>_label]:[align-items:center] [&>_label]:[background:var(--secondary)] [&>_label]:[border:1px_solid_var(--border)] [&>_label]:rounded-sm [&>_label]:[display:flex] [&>_label]:[gap:5px] [&>_label]:[padding:0_6px] [&>_label:focus-within]:[border-color:var(--primary)] [&_input]:[background:transparent] [&_input]:[border:0] [&_input]:[height:25px] [&_input]:[min-width:0] [&_input]:[outline:0] [&_input]:[width:100%] [&_[role=toolbar]]:[display:flex] [&_[role=toolbar]_button]:[align-items:center] [&_[role=toolbar]_button]:[background:transparent] [&_[role=toolbar]_button]:[display:flex] [&_[role=toolbar]_button]:[height:26px] [&_[role=toolbar]_button]:[justify-content:center] [&_[role=toolbar]_button]:[width:26px] gitBranchesSearch [&>_label]:rounded-sm`}
            >
                <label>
                    <Icon name="search" size={14} />
                    <Input
                        aria-activedescendant={
                            rows[activeIndex]
                                ? `branch-${activeIndex}`
                                : undefined
                        }
                        aria-controls="git-branches-list"
                        aria-label="Search"
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setActiveIndex(0);
                            setDetailsOpen(false);
                        }}
                        placeholder="Search for branches and actions"
                        ref={search}
                        role="textbox"
                        value={query}
                    />
                </label>
                <div
                    aria-label="Action Toolbar"
                    data-branch-toolbar="true"
                    role="toolbar"
                >
                    <Tooltip>
                        <TooltipTrigger
                            render={
                                <Button
                                    aria-label="Fetch"
                                    disabled={busy}
                                    onClick={() =>
                                        void run(
                                            {
                                                kind: "fetch",
                                                remote: null,
                                                prune: false,
                                            },
                                            false,
                                        )
                                    }
                                    type="button"
                                    className={cn(
                                        "gap-1.5 text-xs min-h-[25px] px-1.5 text-muted-foreground",
                                    )}
                                    variant="ghost"
                                    size="default"
                                >
                                    <Icon name="fetch" size={14} />
                                </Button>
                            }
                        />
                        <TooltipContent>Fetch</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger
                            render={
                                <Button
                                    aria-label="Settings"
                                    onClick={onOpenSettings}
                                    type="button"
                                    className={cn(
                                        "gap-1.5 text-xs min-h-[25px] px-1.5 text-muted-foreground",
                                    )}
                                    variant="ghost"
                                    size="default"
                                >
                                    <Icon name="settings" size={14} />
                                </Button>
                            }
                        />
                        <TooltipContent>Settings</TooltipContent>
                    </Tooltip>
                </div>
            </div>
            <div
                aria-label="Branches Tree"
                className={`gitBranchesList [min-height:0] [overflow:auto] [padding:4px] [&_[role=separator]]:[border-top:1px_solid_var(--border)] [&_[role=separator]]:[height:5px] [&_[role=separator]]:[margin-top:4px] [&_[role=treeitem]]:[align-items:center] [&_[role=treeitem]]:[background:transparent] [&_[role=treeitem]]:rounded-sm [&_[role=treeitem]]:[display:grid] [&_[role=treeitem]]:[gap:6px] [&_[role=treeitem]]:[grid-template-columns:17px_minmax(0,_1fr)_auto_auto] [&_[role=treeitem]]:[height:27px] [&_[role=treeitem]]:[padding:0_7px] [&_[role=treeitem]]:[text-align:left] [&_[role=treeitem]]:[width:100%] [&_[role=treeitem]:hover]:[background:var(--muted)] [&_[role=treeitem][aria-selected=true]]:[background:var(--accent)] [&_[role=group]_[role=treeitem]]:[padding-left:25px] [&_[data-branch-group=true]]:[font-weight:600] [&_kbd]:[color:var(--disabled-foreground)] [&_kbd]:[font:inherit] [&_small]:[color:var(--disabled-foreground)] [&_small]:[font-size:10px] [&>_p]:[color:var(--muted-foreground)] [&>_p]:[padding:20px] [&>_p]:[text-align:center] gitBranchesList [&_[role=treeitem]]:rounded-sm`}
                id="git-branches-list"
                role="tree"
            >
                {actionMatches("Commit…") && (
                    <Button
                        data-branch-action="true"
                        disabled={busy}
                        onClick={() => {
                            onClose();
                            onCommit?.();
                        }}
                        role="treeitem"
                        type="button"
                        className={cn(
                            "gap-1.5 text-xs min-h-[29px] w-full justify-start whitespace-normal px-2 py-1 text-left aria-selected:bg-accent aria-current:bg-accent",
                        )}
                        variant="ghost"
                        size="default"
                    >
                        <Icon name="commit" size={14} />
                        <span>Commit…</span>
                        <kbd>⌘K</kbd>
                    </Button>
                )}
                <hr />
                {actionMatches("New Branch…") && (
                    <Button
                        data-branch-action="true"
                        disabled={busy}
                        onClick={() => void createBranch()}
                        role="treeitem"
                        type="button"
                        className={cn(
                            "gap-1.5 text-xs min-h-[29px] w-full justify-start whitespace-normal px-2 py-1 text-left aria-selected:bg-accent aria-current:bg-accent",
                        )}
                        variant="ghost"
                        size="default"
                    >
                        <Icon name="plus" size={14} />
                        <span>New Branch…</span>
                        <kbd>⌥⌘N</kbd>
                    </Button>
                )}
                {actionMatches("Checkout Tag or Revision…") && (
                    <Button
                        data-branch-action="true"
                        disabled={busy}
                        onClick={() => void checkoutRevision()}
                        role="treeitem"
                        type="button"
                        className={cn(
                            "gap-1.5 text-xs min-h-[29px] w-full justify-start whitespace-normal px-2 py-1 text-left aria-selected:bg-accent aria-current:bg-accent",
                        )}
                        variant="ghost"
                        size="default"
                    >
                        <Icon name="checkout" size={14} />
                        <span>Checkout Tag or Revision…</span>
                    </Button>
                )}
                <hr />
                {(["local", "remote", "tag"] as const).map((kind) => {
                    const group = rows
                        .map((row, index) => ({ row, index }))
                        .filter(({ row }) => row.ref.kind === kind);
                    if (group.length === 0) return null;
                    const label =
                        kind === "local"
                            ? "Local"
                            : kind === "remote"
                              ? "Remote"
                              : "Tags";
                    return (
                        <div key={kind} role="none">
                            <div
                                aria-expanded="true"
                                data-branch-group="true"
                                role="treeitem"
                            >
                                <Icon
                                    className={`rotated [transform:rotate(90deg)] rotated`}
                                    name="chevron"
                                    size={11}
                                />
                                <span>{label}</span>
                            </div>
                            <div role="group">
                                {group.map(({ row, index }) => (
                                    <Tooltip key={row.ref.name}>
                                        <TooltipTrigger
                                            render={
                                                <Button
                                                    aria-selected={
                                                        index === activeIndex
                                                    }
                                                    id={`branch-${index}`}
                                                    onClick={() => {
                                                        if (
                                                            index ===
                                                            activeIndex
                                                        )
                                                            setDetailsOpen(
                                                                true,
                                                            );
                                                        else {
                                                            setActiveIndex(
                                                                index,
                                                            );
                                                            setDetailsOpen(
                                                                false,
                                                            );
                                                        }
                                                    }}
                                                    onDoubleClick={() =>
                                                        void checkoutActive()
                                                    }
                                                    onMouseEnter={() =>
                                                        setActiveIndex(index)
                                                    }
                                                    role="treeitem"
                                                    type="button"
                                                    className={cn(
                                                        "gap-1.5 text-xs min-h-[29px] w-full justify-start whitespace-normal px-2 py-1 text-left aria-selected:bg-accent aria-current:bg-accent",
                                                        index === activeIndex
                                                            ? `selected [background:var(--accent)] [color:var(--foreground)] selected`
                                                            : undefined,
                                                    )}
                                                    variant="ghost"
                                                    size="default"
                                                    tabIndex={-1}
                                                >
                                                    <Icon
                                                        name={
                                                            row.ref.kind ===
                                                            "remote"
                                                                ? "remote"
                                                                : row.ref
                                                                        .kind ===
                                                                    "tag"
                                                                  ? "tag"
                                                                  : "branch"
                                                        }
                                                        size={14}
                                                    />
                                                    <span>{row.label}</span>
                                                    {row.ref.favorite && (
                                                        <Icon
                                                            className={`favorite [color:var(--bookmark)] [fill:var(--bookmark)] favorite`}
                                                            name="star"
                                                            size={12}
                                                        />
                                                    )}
                                                    {(row.ref.current ||
                                                        row.ref.shortName ===
                                                            currentBranch) && (
                                                        <small>
                                                            {row.ref.upstream?.replace(
                                                                /^refs\/remotes\//,
                                                                "",
                                                            ) ?? "Current"}
                                                        </small>
                                                    )}
                                                    <Icon
                                                        name="chevron"
                                                        size={10}
                                                    />
                                                </Button>
                                            }
                                        />
                                        <TooltipContent>
                                            {row.ref.subject}
                                        </TooltipContent>
                                    </Tooltip>
                                ))}
                            </div>
                        </div>
                    );
                })}
                {rows.length === 0 && <p>No branches found</p>}
            </div>
            {error && (
                <Notice
                    className="w-auto rounded-none border-x-0 p-1.5 px-2 text-[11px]"
                    role="alert"
                    size="sm"
                    tone="destructive"
                >
                    {error}
                </Notice>
            )}
            <GitBranchSelectionPanel
                activeRef={activeRef}
                actionsRef={selectedActions}
                busy={busy}
                canCompare={onCompare !== undefined}
                canOperate={onOperation !== undefined}
                comparison={comparison}
                currentBranch={currentBranch}
                detailsOpen={detailsOpen}
                onAddWorktree={addWorktree}
                onCheckout={checkoutActive}
                onCompare={compareActive}
                onCreateBranch={createBranch}
                onCreateTag={createTag}
                onDelete={deleteActive}
                onMerge={mergeActive}
                onPushTag={pushActiveTag}
                onRename={renameActive}
                onSetUpstream={setUpstream}
                remoteCount={remotes.length}
            />
            {dialogNode}
        </dialog>
    );
}
