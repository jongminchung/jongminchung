export type TerminalActionId = "newTab" | "closeTab" | "copy" | "paste" | "selectAll" | "clear";

export type TerminalSurfaceActionId = Exclude<TerminalActionId, "newTab" | "closeTab">;

export type TerminalActionMenuEntry =
  | Readonly<{
      kind: "action";
      id: TerminalActionId;
      label: string;
      shortcut: string | null;
    }>
  | Readonly<{ kind: "separator" }>;

export const TERMINAL_ACTION_MENU = Object.freeze([
  { kind: "action", id: "newTab", label: "New Tab", shortcut: "⌘T" },
  { kind: "action", id: "closeTab", label: "Close Tab", shortcut: "⌘W" },
  { kind: "separator" },
  { kind: "action", id: "copy", label: "Copy", shortcut: "⌘C" },
  { kind: "action", id: "paste", label: "Paste", shortcut: "⌘V" },
  { kind: "action", id: "selectAll", label: "Select All", shortcut: "⌘A" },
  { kind: "separator" },
  { kind: "action", id: "clear", label: "Clear Terminal", shortcut: "⌘K" },
] as const satisfies readonly TerminalActionMenuEntry[]);

export interface TerminalActionAvailability {
  readonly hasSession: boolean;
  readonly hasSelection: boolean;
  readonly hasClipboard: boolean;
}

export interface TerminalKeyboardInput {
  readonly key: string;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  readonly isComposing: boolean;
  readonly repeat: boolean;
}

export interface TerminalEmulatorPort {
  focus(): void;
  getSelection(): string;
  paste(data: string): void;
  selectAll(): void;
  clear(): void;
}

export interface TerminalClipboardPort {
  readText(): Promise<string>;
  writeText(value: string): Promise<void>;
}

export type TerminalActionResult =
  | Readonly<{ kind: "completed" }>
  | Readonly<{ kind: "unavailable"; reason: string }>;

const SHORTCUT_ACTIONS: ReadonlyMap<string, TerminalActionId> = new Map([
  ["a", "selectAll"],
  ["c", "copy"],
  ["k", "clear"],
  ["t", "newTab"],
  ["v", "paste"],
  ["w", "closeTab"],
]);

export function terminalActionForKeyboard(input: TerminalKeyboardInput): TerminalActionId | null {
  if (
    input.isComposing ||
    input.repeat ||
    !input.metaKey ||
    input.ctrlKey ||
    input.altKey ||
    input.shiftKey
  ) {
    return null;
  }
  return SHORTCUT_ACTIONS.get(input.key.toLocaleLowerCase()) ?? null;
}

export function isTerminalActionAvailable(
  action: TerminalActionId,
  availability: TerminalActionAvailability,
): boolean {
  if (action === "newTab") return true;
  if (!availability.hasSession) return false;
  if (action === "copy") {
    return availability.hasSelection && availability.hasClipboard;
  }
  if (action === "paste") return availability.hasClipboard;
  return true;
}

export type TerminalNavigationKey =
  | "ArrowDown"
  | "ArrowLeft"
  | "ArrowRight"
  | "ArrowUp"
  | "End"
  | "Home";

export function nextTerminalMenuIndex(
  itemCount: number,
  currentIndex: number,
  key: TerminalNavigationKey,
): number | null {
  if (!Number.isSafeInteger(itemCount) || itemCount <= 0) return null;
  if (key === "Home") return 0;
  if (key === "End") return itemCount - 1;
  if (key !== "ArrowDown" && key !== "ArrowUp") return null;
  if (currentIndex < 0 || currentIndex >= itemCount) {
    return key === "ArrowDown" ? 0 : itemCount - 1;
  }
  return key === "ArrowDown"
    ? (currentIndex + 1) % itemCount
    : (currentIndex - 1 + itemCount) % itemCount;
}

export function terminalTabTarget(
  keys: readonly string[],
  currentKey: string,
  key: TerminalNavigationKey,
): string | null {
  if (keys.length === 0) return null;
  if (key === "Home") return keys[0] ?? null;
  if (key === "End") return keys.at(-1) ?? null;
  if (key !== "ArrowLeft" && key !== "ArrowRight") return null;
  const currentIndex = keys.indexOf(currentKey);
  const normalized = currentIndex < 0 ? 0 : currentIndex;
  const nextIndex =
    key === "ArrowRight"
      ? (normalized + 1) % keys.length
      : (normalized - 1 + keys.length) % keys.length;
  return keys[nextIndex] ?? null;
}

export function terminalTabAfterClose(keys: readonly string[], closingKey: string): string | null {
  const closingIndex = keys.indexOf(closingKey);
  if (closingIndex < 0) return keys[0] ?? null;
  return keys[closingIndex + 1] ?? keys[closingIndex - 1] ?? null;
}

export class TerminalActionExecutor {
  readonly #terminal: TerminalEmulatorPort;
  readonly #clipboard: TerminalClipboardPort | null;

  private constructor(terminal: TerminalEmulatorPort, clipboard: TerminalClipboardPort | null) {
    this.#terminal = terminal;
    this.#clipboard = clipboard;
  }

  static of(
    terminal: TerminalEmulatorPort,
    clipboard: TerminalClipboardPort | null,
  ): TerminalActionExecutor {
    return new TerminalActionExecutor(terminal, clipboard);
  }

  async execute(action: TerminalSurfaceActionId): Promise<TerminalActionResult> {
    try {
      if (action === "copy") return await this.#copy();
      if (action === "paste") return await this.#paste();
      if (action === "selectAll") this.#terminal.selectAll();
      else this.#terminal.clear();
      return { kind: "completed" };
    } finally {
      this.#terminal.focus();
    }
  }

  async #copy(): Promise<TerminalActionResult> {
    const selection = this.#terminal.getSelection();
    if (selection.length === 0) {
      return { kind: "unavailable", reason: "Select terminal text before copying." };
    }
    if (this.#clipboard === null) {
      return { kind: "unavailable", reason: "Clipboard access is unavailable." };
    }
    try {
      await this.#clipboard.writeText(selection);
      return { kind: "completed" };
    } catch {
      return { kind: "unavailable", reason: "Terminal text could not be copied." };
    }
  }

  async #paste(): Promise<TerminalActionResult> {
    if (this.#clipboard === null) {
      return { kind: "unavailable", reason: "Clipboard access is unavailable." };
    }
    try {
      this.#terminal.paste(await this.#clipboard.readText());
      return { kind: "completed" };
    } catch {
      return { kind: "unavailable", reason: "Clipboard text could not be pasted." };
    }
  }
}
