import { Button } from "@jongminchung/ui/components/button";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@jongminchung/ui/components/tooltip";
import { cn } from "@jongminchung/ui/lib/utils";
import { useVirtualizer } from "@tanstack/react-virtual";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { DiffPreferences } from "../domain/changeReview";
import type { Commit, FileChange } from "../domain/types";
import type {
    CommitSignature,
    FileContent,
    FilePreview,
    FileSource,
    SubmoduleDiff,
} from "../shared/contracts/model/index";
import { useDismissLayer } from "./CommandProvider";
import { DiffViewer } from "./DiffViewer";
import { Icon } from "./Icon";
import { Notice } from "./Notice";
import { EmptyState, Spinner, StatusBadge } from "./ProductCollections";
import { CheckboxInput } from "./ProductFormControls";
import { Popover } from "./ProductOverlays";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ProductSelect";
import { VerticalResizeHandle } from "./VerticalResizeHandle";

function statusLetter(status: FileChange["status"]): string {
    return {
        added: "A",
        modified: "M",
        deleted: "D",
        renamed: "R",
        copied: "C",
        untracked: "?",
        conflicted: "!",
    }[status];
}

function statusClass(status: FileChange["status"]): string {
    if (status === "added")
        return `statusAdded [background:color-mix(in_oklch,_var(--success)_16%,_transparent)] [color:var(--success)] statusAdded`;
    if (status === "deleted")
        return `statusDeleted [background:color-mix(in_oklch,_var(--destructive)_16%,_transparent)] [color:var(--destructive)] statusDeleted`;
    if (status === "renamed" || status === "copied")
        return `statusRenamed [background:color-mix(in_oklch,_var(--primary)_16%,_transparent)] [color:var(--primary)] statusRenamed`;
    if (status === "conflicted")
        return `statusConflict [background:color-mix(in_oklch,_var(--destructive)_16%,_transparent)] [color:var(--destructive)] statusConflict`;
    if (status === "untracked")
        return `statusUnknown [background:var(--muted)] [color:var(--muted-foreground)] statusUnknown`;
    return `statusModified [background:color-mix(in_oklch,_var(--primary)_16%,_transparent)] [color:var(--primary)] statusModified`;
}

function ReviewAllRow({
    commit,
    file,
    loadDiff,
    readFile,
    parentRevision,
    preferences,
    onPreferencesChange,
}: {
    readonly commit: Commit;
    readonly file: FileChange;
    readonly loadDiff: (commit: Commit, file: FileChange) => Promise<string>;
    readonly readFile: (
        source: FileSource,
        path: string,
    ) => Promise<FileContent>;
    readonly parentRevision: string;
    readonly preferences: DiffPreferences;
    readonly onPreferencesChange: (preferences: DiffPreferences) => void;
}) {
    const [patch, setPatch] = useState("");
    const [content, setContent] = useState<{
        readonly before: FileContent | null;
        readonly after: FileContent | null;
    }>({ before: null, after: null });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        const load = async (): Promise<void> => {
            setLoading(true);
            setError(null);
            try {
                const [nextPatch, before, after] = await Promise.all([
                    loadDiff(commit, file),
                    readFile(
                        { kind: "revision", revision: parentRevision },
                        file.oldPath ?? file.path,
                    ),
                    readFile(
                        { kind: "revision", revision: commit.oid },
                        file.path,
                    ),
                ]);
                if (active) {
                    setPatch(nextPatch);
                    setContent({ before, after });
                }
            } catch (reason) {
                if (active)
                    setError(
                        reason instanceof Error
                            ? reason.message
                            : String(reason),
                    );
            } finally {
                if (active) setLoading(false);
            }
        };
        void load();
        return () => {
            active = false;
        };
    }, [commit, file, loadDiff, parentRevision, readFile]);

    return (
        <article
            className={`reviewAllRow [border-bottom:1px_solid_var(--border)] [min-height:340px] [&>_header]:[align-items:center] [&>_header]:[background:var(--secondary)] [&>_header]:[border-bottom:1px_solid_var(--border)] [&>_header]:[display:flex] [&>_header]:[gap:7px] [&>_header]:[height:32px] [&>_header]:[padding:0_9px] [&>_header]:[position:sticky] [&>_header]:[top:0] [&>_header_>_span:nth-last-child(2)]:[flex:1] [&>_header_small]:[color:var(--disabled-foreground)] [&_pre]:[font-family:var(--font-family-code)] [&_pre]:[font-size:11px] [&_pre]:[line-height:1.5] [&_pre]:[margin:0] [&_pre]:[max-height:480px] [&_pre]:[overflow:auto] [&_pre]:[padding:10px] reviewAllRow`}
        >
            <header>
                <StatusBadge className={statusClass(file.status)}>
                    {statusLetter(file.status)}
                </StatusBadge>
                <strong>{file.path}</strong>
                <span />
                <small>
                    +{file.additions ?? 0} −{file.deletions ?? 0}
                </small>
            </header>
            {loading ? (
                <Spinner
                    className="min-h-72 w-full justify-center"
                    label="Loading diff…"
                />
            ) : error ? (
                <Notice
                    className="m-3 w-auto"
                    role="alert"
                    size="sm"
                    tone="destructive"
                >
                    {error}
                </Notice>
            ) : (
                <DiffViewer
                    afterContent={content.after}
                    beforeContent={content.before}
                    file={file}
                    loading={false}
                    mode="readOnly"
                    onPreferencesChange={onPreferencesChange}
                    patch={patch}
                    preferences={preferences}
                    sourceLabel={`${parentRevision.slice(0, 8)} → ${commit.oid.slice(0, 8)}`}
                />
            )}
        </article>
    );
}

function ReviewAll({
    commit,
    files,
    loadDiff,
    readFile,
    parentRevision,
    preferences,
    onPreferencesChange,
}: {
    readonly commit: Commit;
    readonly files: readonly FileChange[];
    readonly loadDiff: (commit: Commit, file: FileChange) => Promise<string>;
    readonly readFile: (
        source: FileSource,
        path: string,
    ) => Promise<FileContent>;
    readonly parentRevision: string;
    readonly preferences: DiffPreferences;
    readonly onPreferencesChange: (preferences: DiffPreferences) => void;
}) {
    const parent = useRef<HTMLDivElement>(null);
    const virtualizer = useVirtualizer({
        count: files.length,
        getScrollElement: () => parent.current,
        estimateSize: () => 360,
        overscan: 1,
    });
    return (
        <div
            className={`reviewAll [min-height:0] [overflow:auto] reviewAll`}
            ref={parent}
        >
            <div
                style={{
                    height: virtualizer.getTotalSize(),
                    position: "relative",
                }}
            >
                {virtualizer.getVirtualItems().map((item) => {
                    const file = files[item.index];
                    if (!file) return null;
                    return (
                        <div
                            data-index={item.index}
                            key={file.path}
                            ref={virtualizer.measureElement}
                            style={{
                                position: "absolute",
                                transform: `translateY(${item.start}px)`,
                                width: "100%",
                            }}
                        >
                            <ReviewAllRow
                                commit={commit}
                                file={file}
                                loadDiff={loadDiff}
                                onPreferencesChange={onPreferencesChange}
                                parentRevision={parentRevision}
                                preferences={preferences}
                                readFile={readFile}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export const DetailsPane = memo(function DetailsPane({
    commit,
    files,
    loading,
    signature,
    beforePreview,
    afterPreview,
    beforeContent,
    afterContent,
    submoduleDiff,
    selectedPath,
    patch,
    diffLoading,
    preferences,
    parentRevision,
    onParentRevisionChange,
    onPreferencesChange,
    onSelectFile,
    onLoadDiff,
    onReadFile,
    onOpenTree,
    onInspectFile,
    onPrevious,
    onNext,
    reviewWidth,
    onReviewWidthChange,
    onRevertSelectedChanges,
}: {
    readonly commit?: Commit;
    readonly files: readonly FileChange[];
    readonly loading: boolean;
    readonly signature?: CommitSignature;
    readonly beforePreview: FilePreview | null;
    readonly afterPreview: FilePreview | null;
    readonly beforeContent: FileContent | null;
    readonly afterContent: FileContent | null;
    readonly submoduleDiff: SubmoduleDiff | null;
    readonly selectedPath: string | null;
    readonly patch: string;
    readonly diffLoading: boolean;
    readonly preferences: DiffPreferences;
    readonly parentRevision: string | null;
    readonly onParentRevisionChange: (revision: string) => void;
    readonly onPreferencesChange: (preferences: DiffPreferences) => void;
    readonly onSelectFile: (file: FileChange) => void;
    readonly onLoadDiff: (commit: Commit, file: FileChange) => Promise<string>;
    readonly onReadFile: (
        source: FileSource,
        path: string,
    ) => Promise<FileContent>;
    readonly onOpenTree: () => void;
    readonly onInspectFile: (
        file: FileChange,
        view: "file" | "history" | "blame",
    ) => void;
    readonly onPrevious: () => void;
    readonly onNext: () => void;
    readonly reviewWidth: number;
    readonly onReviewWidthChange: (width: number) => void;
    readonly onRevertSelectedChanges: () => Promise<void>;
}) {
    const [reviewAll, setReviewAll] = useState(false);
    const [focused, setFocused] = useState(false);
    const [optionsOpen, setOptionsOpen] = useState(false);
    const selectedFile =
        files.find((file) => file.path === selectedPath) ?? null;
    const selectedIndex = selectedFile ? files.indexOf(selectedFile) : -1;
    const moveFile = (offset: number): void => {
        if (files.length === 0) return;
        const nextIndex = Math.min(
            files.length - 1,
            Math.max(0, selectedIndex + offset),
        );
        const next = files[nextIndex];
        if (next) onSelectFile(next);
    };

    useEffect(() => setReviewAll(false), [commit?.oid]);
    useDismissLayer(
        useMemo(
            () => ({
                id: "history-focused-diff",
                priority: 70,
                active: focused,
                dismiss: () => setFocused(false),
            }),
            [focused],
        ),
    );

    return (
        <aside
            className={`detailsPane [background:var(--card)] [min-height:0] [min-width:0] [border-left:1px_solid_var(--border)] [display:grid] [grid-template-rows:26px_minmax(0,_1fr)] [position:relative] [&>_.verticalResizeHandle]:[left:-4px] [&>_.verticalResizeHandle]:[right:auto] detailsPane`}
            aria-label="Revision review"
            data-commit-selection={commit ? "selected" : "empty"}
            style={
                {
                    "--history-review-width": `${reviewWidth}px`,
                } as CSSProperties
            }
        >
            <VerticalResizeHandle
                direction={-1}
                label="Resize revision review"
                onChange={onReviewWidthChange}
                value={reviewWidth}
            />
            <div
                className={`detailsToolbar [align-items:center] [border-bottom:1px_solid_var(--border)] [display:flex] [gap:1px] [padding:2px_5px] [&>_select]:[background:var(--secondary)] [&>_select]:[border:1px_solid_var(--border)] [&>_select]:[height:25px] [&>_select]:[max-width:170px] [&>_select]:[padding:0_6px] detailsToolbar`}
            >
                <Tooltip>
                    <TooltipTrigger
                        render={
                            <Button
                                aria-label="Show Diff"
                                disabled={!selectedFile}
                                onClick={() => setFocused(true)}
                                type="button"
                                className="text-muted-foreground"
                                variant="ghost"
                                size="icon-sm"
                            >
                                <Icon name="compare" size={14} />
                            </Button>
                        }
                    />
                    <TooltipContent>Show Diff</TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger
                        render={
                            <Button
                                aria-label="Revert Selected Changes"
                                disabled={
                                    !selectedFile || !patch || diffLoading
                                }
                                onClick={() => void onRevertSelectedChanges()}
                                type="button"
                                className="text-muted-foreground"
                                variant="ghost"
                                size="icon-sm"
                            >
                                <Icon name="undo" size={14} />
                            </Button>
                        }
                    />
                    <TooltipContent>Revert Selected Changes</TooltipContent>
                </Tooltip>
                <Tooltip>
                    <Popover
                        alignment="end"
                        hasAutoFocus
                        isOpen={optionsOpen}
                        label="View Options"
                        onOpenChange={setOptionsOpen}
                        placement="below"
                        width={250}
                        content={
                            <div
                                className={`detailsViewOptions [display:grid] [gap:3px] [padding:5px] detailsViewOptions`}
                            >
                                <CheckboxInput
                                    isDisabled={!commit || files.length === 0}
                                    label="Show All Changes"
                                    onChange={setReviewAll}
                                    size="sm"
                                    value={reviewAll}
                                />
                                <CheckboxInput
                                    label="Word Wrap"
                                    onChange={(wordWrap) =>
                                        onPreferencesChange({
                                            ...preferences,
                                            wordWrap,
                                        })
                                    }
                                    size="sm"
                                    value={preferences.wordWrap}
                                />
                            </div>
                        }
                    >
                        <TooltipTrigger
                            render={
                                <Button
                                    aria-label="View Options"
                                    type="button"
                                    className="text-muted-foreground"
                                    variant={reviewAll ? "secondary" : "ghost"}
                                    size="icon-sm"
                                >
                                    <Icon name="more" size={14} />
                                </Button>
                            }
                        />
                    </Popover>
                    <TooltipContent>View Options</TooltipContent>
                </Tooltip>
                <span className={`filterSpacer [flex:1] filterSpacer`} />
                <Tooltip>
                    <TooltipTrigger
                        render={
                            <Button
                                aria-label="Expand All"
                                disabled
                                type="button"
                                className="text-muted-foreground"
                                variant="ghost"
                                size="icon-sm"
                            >
                                <Icon name="plus" size={13} />
                            </Button>
                        }
                    />
                    <TooltipContent>Expand All</TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger
                        render={
                            <Button
                                aria-label="Collapse All"
                                disabled
                                type="button"
                                className="text-muted-foreground"
                                variant="ghost"
                                size="icon-sm"
                            >
                                <Icon name="minus" size={13} />
                            </Button>
                        }
                    />
                    <TooltipContent>Collapse All</TooltipContent>
                </Tooltip>
            </div>
            {!commit ? (
                <div
                    className="grid min-h-0 grid-rows-[7fr_3fr] text-center"
                    data-empty-revision-review
                >
                    <EmptyState
                        className="rounded-none border-b border-border p-0"
                        title="Select commit to view changes"
                    />
                    <EmptyState
                        className="rounded-none p-0"
                        title="Commit details"
                    />
                </div>
            ) : reviewAll ? (
                <ReviewAll
                    commit={commit}
                    files={files}
                    loadDiff={onLoadDiff}
                    onPreferencesChange={onPreferencesChange}
                    parentRevision={
                        parentRevision ??
                        "4b825dc642cb6eb9a060e54bf8d69288fbee4904"
                    }
                    preferences={preferences}
                    readFile={onReadFile}
                />
            ) : (
                <div
                    className={`revisionSummary [display:grid] [grid-template-rows:minmax(0,_2fr)_minmax(150px,_1fr)] [min-height:0] [min-width:0] [position:relative] revisionSummary`}
                >
                    <nav
                        aria-label="Changed files"
                        className={`revisionFileList [border-bottom:1px_solid_var(--border)] [min-height:0] [overflow:auto] [padding:4px] [&>_button]:[align-items:center] [&>_button]:[background:transparent] [&>_button]:[display:flex] [&>_button]:[gap:5px] [&>_button]:[min-height:28px] [&>_button]:[padding:3px_6px] [&>_button]:[text-align:left] [&>_button]:[width:100%] [&>_button.selected]:[background:var(--accent)] [&>_button[aria-current=true]]:[background:var(--accent)] [&>_button_small]:[color:var(--disabled-foreground)] [&>_button_small]:[flex:none] [&>_button_small]:[font-size:9px] revisionFileList`}
                    >
                        {loading ? (
                            <Spinner
                                className="h-full w-full justify-center"
                                label="Loading files…"
                            />
                        ) : files.length === 0 ? (
                            <EmptyState title="This commit has no file changes." />
                        ) : (
                            files.map((file) => (
                                <Button
                                    aria-current={
                                        selectedPath === file.path
                                            ? "true"
                                            : undefined
                                    }
                                    key={file.path}
                                    onClick={() => onSelectFile(file)}
                                    onDoubleClick={() => {
                                        onSelectFile(file);
                                        setFocused(true);
                                    }}
                                    type="button"
                                    className={cn(
                                        "gap-1.5 text-xs min-h-[29px] w-full justify-start whitespace-normal px-2 py-1 text-left aria-selected:bg-accent aria-current:bg-accent",
                                        selectedPath === file.path
                                            ? `selected [background:var(--accent)] [color:var(--foreground)] selected`
                                            : undefined,
                                    )}
                                    variant="ghost"
                                    size="default"
                                >
                                    <StatusBadge
                                        className={statusClass(file.status)}
                                    >
                                        {statusLetter(file.status)}
                                    </StatusBadge>
                                    <span
                                        className={`${`ellipsis [min-width:0] [overflow:hidden] [text-overflow:ellipsis] [white-space:nowrap] ellipsis`} grid`}
                                        title={file.path}
                                    >
                                        <strong className="truncate">
                                            {file.path.split("/").at(-1)}
                                        </strong>
                                        {file.path.includes("/") && (
                                            <small className="truncate">
                                                {file.path.slice(
                                                    0,
                                                    file.path.lastIndexOf("/"),
                                                )}
                                            </small>
                                        )}
                                    </span>
                                    <small>
                                        +{file.additions ?? 0} −
                                        {file.deletions ?? 0}
                                    </small>
                                </Button>
                            ))
                        )}
                    </nav>
                    <section
                        className={`revisionCommitDetails [border-top:1px_solid_var(--border)] [display:flex] [flex-direction:column] [gap:5px] [min-height:0] [overflow:auto] [padding:7px_8px] [&>_header]:[align-items:center] [&>_header]:[display:flex] [&>_header]:[gap:2px] [&>_header_strong]:[flex:1] [&>_header_button]:[background:transparent] [&>_header_button]:[height:22px] [&>_header_button]:[width:22px] [&>_strong]:[overflow-wrap:anywhere] [&>_span]:[color:var(--muted-foreground)] [&>_small]:[color:var(--disabled-foreground)] [&>_code]:[color:var(--disabled-foreground)] [&>_code]:[font-size:10px] [&>_code]:[overflow-wrap:anywhere] [&>_select]:[background:var(--secondary)] [&>_select]:[border:1px_solid_var(--border)] [&>_select]:[height:25px] [&>_select]:[width:100%] [&>_footer]:[display:flex] [&>_footer]:[flex-wrap:wrap] [&>_footer]:[gap:4px] [&>_footer_button]:[background:var(--secondary)] [&>_footer_button]:[border:1px_solid_var(--border)] [&>_footer_button]:[height:25px] [&>_footer_button]:[padding:0_6px] revisionCommitDetails`}
                    >
                        <header>
                            <strong>Commit details</strong>
                            <Tooltip>
                                <TooltipTrigger
                                    render={
                                        <Button
                                            aria-label="Previous commit"
                                            onClick={onPrevious}
                                            type="button"
                                            className={cn("h-7 px-2.5")}
                                            variant="outline"
                                            size="sm"
                                        >
                                            ↑
                                        </Button>
                                    }
                                />
                                <TooltipContent>Previous commit</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger
                                    render={
                                        <Button
                                            aria-label="Next commit"
                                            onClick={onNext}
                                            type="button"
                                            className={cn("h-7 px-2.5")}
                                            variant="outline"
                                            size="sm"
                                        >
                                            ↓
                                        </Button>
                                    }
                                />
                                <TooltipContent>Next commit</TooltipContent>
                            </Tooltip>
                        </header>
                        <strong>{commit.subject}</strong>
                        <span>{commit.author}</span>
                        <small>{commit.email}</small>
                        <code>{commit.oid}</code>
                        {commit.parents.length > 0 && (
                            <Select
                                onValueChange={(value) =>
                                    value && onParentRevisionChange(value)
                                }
                                value={parentRevision ?? commit.parents[0]}
                            >
                                <SelectTrigger
                                    aria-label="Compare commit parent"
                                    className="w-full"
                                    size="sm"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent align="start">
                                    {commit.parents.map((parent, index) => (
                                        <SelectItem key={parent} value={parent}>
                                            Parent {index + 1} ·{" "}
                                            {parent.slice(0, 8)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        {signature && (
                            <span
                                className={
                                    signature.status === "G"
                                        ? `signatureGood [color:var(--success)] signatureGood`
                                        : signature.status === "N"
                                          ? `muted [color:var(--disabled-foreground)] [font-size:10px] muted`
                                          : `signatureBad [color:var(--destructive)] signatureBad`
                                }
                            >
                                {signature.status === "G"
                                    ? "Verified signature"
                                    : signature.status === "N"
                                      ? "Unsigned"
                                      : `Signature ${signature.status}`}
                            </span>
                        )}
                        <footer>
                            <Button
                                onClick={onOpenTree}
                                type="button"
                                className={cn("h-7 px-2.5")}
                                variant="outline"
                                size="sm"
                            >
                                Browse Repository
                            </Button>
                            {selectedFile && (
                                <Button
                                    onClick={() =>
                                        onInspectFile(selectedFile, "file")
                                    }
                                    type="button"
                                    className={cn("h-7 px-2.5")}
                                    variant="outline"
                                    size="sm"
                                >
                                    View File
                                </Button>
                            )}
                        </footer>
                    </section>
                    {focused && selectedFile && (
                        <DiffViewer
                            afterContent={afterContent}
                            afterPreview={afterPreview}
                            beforeContent={beforeContent}
                            beforePreview={beforePreview}
                            submoduleDiff={submoduleDiff}
                            file={selectedFile}
                            focused
                            loading={diffLoading}
                            mode="readOnly"
                            onNextFile={
                                selectedIndex >= 0 &&
                                selectedIndex < files.length - 1
                                    ? () => moveFile(1)
                                    : undefined
                            }
                            onPreferencesChange={onPreferencesChange}
                            onPreviousFile={
                                selectedIndex > 0
                                    ? () => moveFile(-1)
                                    : undefined
                            }
                            onToggleFocus={() => setFocused(false)}
                            patch={patch}
                            preferences={preferences}
                            sourceLabel={
                                parentRevision
                                    ? `${parentRevision.slice(0, 8)} → ${commit.oid.slice(0, 8)}`
                                    : "Revision"
                            }
                        />
                    )}
                </div>
            )}
        </aside>
    );
});
