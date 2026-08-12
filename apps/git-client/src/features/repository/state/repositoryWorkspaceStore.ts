import { createStore } from "zustand/vanilla";
import type {
    RepositoryWorkspaceStore,
    RepositoryWorkspaceStoreOptions,
} from "./repositoryWorkspaceStoreTypes";
import { createEditorToolsSlice } from "./slices/editorToolsSlice";
import { createLayoutSlice } from "./slices/layoutSlice";
import { createReviewSlice } from "./slices/reviewSlice";
import { createRepositoryScopeSlice } from "./slices/scopeSlice";

export type * from "./repositoryWorkspaceStoreTypes";

export function createRepositoryWorkspaceStore(
    options: RepositoryWorkspaceStoreOptions,
) {
    const scope = createRepositoryScopeSlice(options);
    const review = createReviewSlice(options);
    const editorTools = createEditorToolsSlice(options);
    const layout = createLayoutSlice(options);

    return createStore<RepositoryWorkspaceStore>()((...arguments_) => ({
        ...scope(...arguments_),
        ...review(...arguments_),
        ...editorTools(...arguments_),
        ...layout(...arguments_),
    }));
}

export type RepositoryWorkspaceStoreApi = ReturnType<
    typeof createRepositoryWorkspaceStore
>;
