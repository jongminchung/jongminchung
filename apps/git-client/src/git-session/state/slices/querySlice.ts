import type {
    SessionQuerySlice,
    SessionSliceCreator,
} from "../gitSessionStoreTypes";
import { resolveStateAction } from "../resolveStateAction";

export function createSessionQuerySlice(
    initialWorkspace: SessionQuerySlice["workspace"],
): SessionSliceCreator<SessionQuerySlice> {
    return (set) => ({
        workspace: initialWorkspace,
        setWorkspace: (value) =>
            set((state) => ({
                workspace: resolveStateAction(value, state.workspace),
            })),
    });
}
