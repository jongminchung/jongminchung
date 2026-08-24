export function runInBackground(task: Promise<unknown>, label: string): void {
  void task.catch((error: unknown) => {
    console.error(`${label} failed`, error);
  });
}

export function toVoidHandler<Arguments extends unknown[]>(
  handler: (...arguments_: Arguments) => Promise<unknown>,
): (...arguments_: Arguments) => void {
  return (...arguments_) => {
    runInBackground(handler(...arguments_), "Background action");
  };
}
