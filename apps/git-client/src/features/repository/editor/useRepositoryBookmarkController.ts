import { useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppDialog } from "../../../components/AppDialog";
import {
    allLineBookmarks,
    assignBookmarkMnemonic,
    bookmarkAt,
    describeBookmark,
    removeBookmark,
    toggleLineBookmark,
    type BookmarkLocation,
    type BookmarkMnemonic,
    type LineBookmark,
} from "../../../domain/bookmarks";
import type { RepositoryView } from "../../../domain/types";
import { useRepositoryWorkspaceStore } from "../state/RepositoryWorkspaceStoreProvider";
import type {
    BookmarkMnemonicTarget,
    InspectorState,
} from "../state/workspaceTypes";

interface RepositoryBookmarkControllerOptions {
    readonly openInspector: (next: InspectorState, keepOpen?: boolean) => void;
    readonly repository: RepositoryView;
}

export function useRepositoryBookmarkController({
    openInspector,
    repository,
}: RepositoryBookmarkControllerOptions) {
    const dialog = useAppDialog();
    const {
        bookmarks,
        editorStatus,
        scratchFiles,
        setBookmarkGroupTarget,
        setBookmarkMnemonicTarget,
        setBookmarks,
        setRepositoryViewMode,
    } = useRepositoryWorkspaceStore(
        useShallow((state) => ({
            bookmarks: state.bookmarks,
            editorStatus: state.editorStatus,
            scratchFiles: state.scratchFiles,
            setBookmarkGroupTarget: state.setBookmarkGroupTarget,
            setBookmarkMnemonicTarget: state.setBookmarkMnemonicTarget,
            setBookmarks: state.setBookmarks,
            setRepositoryViewMode: state.setRepositoryViewMode,
        })),
    );

    const openLineBookmark = useCallback(
        (bookmark: LineBookmark): void => {
            if (bookmark.path.startsWith("Scratches/")) {
                const name = bookmark.path.slice("Scratches/".length);
                const scratch = scratchFiles.find((file) => file.name === name);
                if (scratch) {
                    openInspector({
                        revision: `scratch:${scratch.id}`,
                        source: {
                            kind: "revision",
                            revision: `scratch:${scratch.id}`,
                        },
                        path: scratch.name,
                        tab: "file",
                        line: bookmark.line,
                        column: bookmark.column,
                        scratchId: scratch.id,
                    });
                    return;
                }
            }
            setRepositoryViewMode("history");
            openInspector({
                revision: repository.snapshot.headOid ?? "HEAD",
                source: { kind: "workingTree" },
                path: bookmark.path,
                tab: "file",
                line: bookmark.line,
                column: bookmark.column,
            });
        },
        [
            openInspector,
            repository.snapshot.headOid,
            scratchFiles,
            setRepositoryViewMode,
        ],
    );

    const requestToggleBookmark = useCallback(
        (location: BookmarkLocation): void => {
            const existing = bookmarkAt(bookmarks, location);
            if (existing) {
                setBookmarks((current) => removeBookmark(current, existing.id));
                return;
            }
            const bookmarkId = crypto.randomUUID();
            if (
                bookmarks.groups.length > 1 &&
                !bookmarks.groups.some((group) => group.isDefault)
            ) {
                setBookmarkGroupTarget({
                    bookmarkId,
                    location,
                    mnemonic: null,
                    description: "",
                });
                return;
            }
            setBookmarks((current) =>
                toggleLineBookmark(current, location, bookmarkId),
            );
        },
        [bookmarks, setBookmarkGroupTarget, setBookmarks],
    );
    const toggleCurrentBookmark = useCallback((): void => {
        if (!editorStatus) return;
        requestToggleBookmark({
            path: editorStatus.path,
            line: editorStatus.line,
            column: editorStatus.column,
        });
    }, [editorStatus, requestToggleBookmark]);
    const beginMnemonicBookmark = useCallback((): void => {
        if (!editorStatus) return;
        const location = {
            path: editorStatus.path,
            line: editorStatus.line,
            column: editorStatus.column,
        };
        const existing = bookmarkAt(bookmarks, location);
        setBookmarkMnemonicTarget({
            bookmarkId: existing?.id ?? crypto.randomUUID(),
            location,
            current: existing?.mnemonic ?? null,
            description: existing?.description ?? "",
            creating: existing === null,
        });
    }, [bookmarks, editorStatus, setBookmarkMnemonicTarget]);
    const chooseBookmarkMnemonic = useCallback(
        async (
            target: BookmarkMnemonicTarget,
            mnemonic: BookmarkMnemonic,
            description: string,
        ): Promise<void> => {
            const conflict = allLineBookmarks(bookmarks).find(
                (bookmark) =>
                    bookmark.id !== target.bookmarkId &&
                    bookmark.mnemonic === mnemonic,
            );
            if (conflict) {
                const accepted = await dialog.confirm({
                    title: "Rewrite Mnemonic",
                    description: `‘${mnemonic}’ mnemonic is already taken by ‘${conflict.path}:${conflict.line}’. Do you want to rewrite it?`,
                    impact: "The existing bookmark will remain, but its mnemonic will be removed.",
                    confirmLabel: "Rewrite",
                    dangerous: true,
                });
                if (!accepted) return;
            }
            if (
                bookmarkAt(bookmarks, target.location) === null &&
                bookmarks.groups.length > 1 &&
                !bookmarks.groups.some((group) => group.isDefault)
            ) {
                setBookmarkMnemonicTarget(undefined);
                setBookmarkGroupTarget({
                    bookmarkId: target.bookmarkId,
                    location: target.location,
                    mnemonic,
                    description,
                });
                return;
            }
            setBookmarks((current) => {
                const atLocation = bookmarkAt(current, target.location);
                const withBookmark = atLocation
                    ? current
                    : toggleLineBookmark(
                          current,
                          target.location,
                          target.bookmarkId,
                          mnemonic,
                      );
                const bookmarkId =
                    bookmarkAt(withBookmark, target.location)?.id ??
                    target.bookmarkId;
                return describeBookmark(
                    assignBookmarkMnemonic(withBookmark, bookmarkId, mnemonic),
                    bookmarkId,
                    description,
                );
            });
            setBookmarkMnemonicTarget(undefined);
        },
        [
            bookmarks,
            setBookmarks,
            dialog,
            setBookmarkGroupTarget,
            setBookmarkMnemonicTarget,
        ],
    );

    return {
        beginMnemonicBookmark,
        chooseBookmarkMnemonic,
        openLineBookmark,
        requestToggleBookmark,
        toggleCurrentBookmark,
    };
}
