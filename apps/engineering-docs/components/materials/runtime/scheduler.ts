import { cancelFrame, frame } from "motion";

type MaterialFrameCallback = (time: number) => void;

const scheduled = new Map<number, () => void>();
const reducedCallbacks = new WeakSet<MaterialFrameCallback>();
let nextFrameId = 1;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function scheduleMaterialFrame(callback: MaterialFrameCallback): number {
  if (prefersReducedMotion()) {
    if (reducedCallbacks.has(callback)) return 0;
    reducedCallbacks.add(callback);
  }

  const id = nextFrameId;
  nextFrameId += 1;
  const scheduledCallback = (): void => {
    scheduled.delete(id);
    callback(performance.now());
  };
  scheduled.set(id, scheduledCallback);
  frame.update(scheduledCallback);
  return id;
}

export function cancelMaterialFrame(id: number): void {
  const callback = scheduled.get(id);
  if (callback === undefined) return;
  cancelFrame(callback);
  scheduled.delete(id);
}
