import type {
  SessionMutationSlice,
  SessionSliceCreator,
} from "../GitSessionStoreTypes";

export const createSessionMutationSlice: SessionSliceCreator<
  SessionMutationSlice
> = (set) => ({
  pendingMutationIds: new Set(),
  beginMutation: (id) =>
    set((state) => ({
      pendingMutationIds: new Set(state.pendingMutationIds).add(id),
    })),
  finishMutation: (id) =>
    set((state) => {
      if (!state.pendingMutationIds.has(id)) return state;
      const next = new Set(state.pendingMutationIds);
      next.delete(id);
      return { pendingMutationIds: next };
    }),
});
