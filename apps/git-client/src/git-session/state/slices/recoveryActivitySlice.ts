import type {
    SessionActivitySlice,
    SessionRecoverySlice,
    SessionSliceCreator,
} from "../gitSessionStoreTypes";
import { resolveStateAction } from "../resolveStateAction";

export const createSessionRecoverySlice: SessionSliceCreator<
    SessionRecoverySlice
> = (set) => ({
    recoveryRevision: 0,
    markRecoveryUpdated: () =>
        set((state) => ({ recoveryRevision: state.recoveryRevision + 1 })),
});

export const createSessionActivitySlice: SessionSliceCreator<
    SessionActivitySlice
> = (set) => ({
    activity: null,
    consoleEntries: [],
    setActivity: (value) =>
        set((state) => ({
            activity: resolveStateAction(value, state.activity),
        })),
    setConsoleEntries: (value) =>
        set((state) => ({
            consoleEntries: resolveStateAction(value, state.consoleEntries),
        })),
});
