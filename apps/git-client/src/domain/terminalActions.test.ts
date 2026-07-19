import { describe, expect, it } from "vitest";
import {
  TERMINAL_ACTION_MENU,
  TerminalActionExecutor,
  isTerminalActionAvailable,
  nextTerminalMenuIndex,
  terminalActionForKeyboard,
  terminalTabAfterClose,
  terminalTabTarget,
  type TerminalClipboardPort,
  type TerminalEmulatorPort,
  type TerminalKeyboardInput,
} from "./terminalActions";

class FakeTerminal implements TerminalEmulatorPort {
  selection = "selected output";
  readonly pasted: string[] = [];
  focusCount = 0;
  selectAllCount = 0;
  clearCount = 0;

  focus(): void {
    this.focusCount += 1;
  }

  getSelection(): string {
    return this.selection;
  }

  paste(data: string): void {
    this.pasted.push(data);
  }

  selectAll(): void {
    this.selectAllCount += 1;
  }

  clear(): void {
    this.clearCount += 1;
  }
}

class FakeClipboard implements TerminalClipboardPort {
  value = "clipboard input";
  readonly writes: string[] = [];

  readText(): Promise<string> {
    return Promise.resolve(this.value);
  }

  writeText(value: string): Promise<void> {
    this.writes.push(value);
    return Promise.resolve();
  }
}

function keyboard(
  key: string,
  overrides: Partial<TerminalKeyboardInput> = {},
): TerminalKeyboardInput {
  return {
    key,
    metaKey: true,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    isComposing: false,
    repeat: false,
    ...overrides,
  };
}

describe("terminal action manifest", () => {
  it("keeps the evidence-backed action order, labels, separators, and macOS shortcuts", () => {
    expect(TERMINAL_ACTION_MENU).toEqual([
      { kind: "action", id: "newTab", label: "New Tab", shortcut: "⌘T" },
      { kind: "action", id: "closeTab", label: "Close Tab", shortcut: "⌘W" },
      { kind: "separator" },
      { kind: "action", id: "copy", label: "Copy", shortcut: "⌘C" },
      { kind: "action", id: "paste", label: "Paste", shortcut: "⌘V" },
      { kind: "action", id: "selectAll", label: "Select All", shortcut: "⌘A" },
      { kind: "separator" },
      { kind: "action", id: "clear", label: "Clear Terminal", shortcut: "⌘K" },
    ]);
  });

  it("maps exact macOS shortcuts and ignores modified, repeated, and composing events", () => {
    expect(terminalActionForKeyboard(keyboard("t"))).toBe("newTab");
    expect(terminalActionForKeyboard(keyboard("w"))).toBe("closeTab");
    expect(terminalActionForKeyboard(keyboard("c"))).toBe("copy");
    expect(terminalActionForKeyboard(keyboard("v"))).toBe("paste");
    expect(terminalActionForKeyboard(keyboard("a"))).toBe("selectAll");
    expect(terminalActionForKeyboard(keyboard("k"))).toBe("clear");
    expect(terminalActionForKeyboard(keyboard("k", { repeat: true }))).toBeNull();
    expect(terminalActionForKeyboard(keyboard("k", { shiftKey: true }))).toBeNull();
    expect(terminalActionForKeyboard(keyboard("k", { isComposing: true }))).toBeNull();
  });

  it("derives enabled states from actual terminal and clipboard capabilities", () => {
    const ready = { hasSession: true, hasSelection: true, hasClipboard: true };
    expect(isTerminalActionAvailable("copy", ready)).toBe(true);
    expect(isTerminalActionAvailable("paste", ready)).toBe(true);
    expect(isTerminalActionAvailable("copy", { ...ready, hasSelection: false })).toBe(false);
    expect(isTerminalActionAvailable("paste", { ...ready, hasClipboard: false })).toBe(false);
    expect(isTerminalActionAvailable("closeTab", { ...ready, hasSession: false })).toBe(false);
    expect(isTerminalActionAvailable("newTab", { ...ready, hasSession: false })).toBe(true);
  });
});

describe("terminal keyboard navigation", () => {
  it("wraps menus and tabs while supporting Home and End", () => {
    expect(nextTerminalMenuIndex(4, 3, "ArrowDown")).toBe(0);
    expect(nextTerminalMenuIndex(4, 0, "ArrowUp")).toBe(3);
    expect(nextTerminalMenuIndex(4, -1, "ArrowDown")).toBe(0);
    expect(nextTerminalMenuIndex(4, -1, "ArrowUp")).toBe(3);
    expect(nextTerminalMenuIndex(4, 2, "Home")).toBe(0);
    expect(nextTerminalMenuIndex(4, 2, "End")).toBe(3);
    expect(terminalTabTarget(["one", "two", "three"], "three", "ArrowRight")).toBe("one");
    expect(terminalTabTarget(["one", "two", "three"], "one", "ArrowLeft")).toBe("three");
    expect(terminalTabTarget(["one", "two", "three"], "two", "Home")).toBe("one");
    expect(terminalTabTarget(["one", "two", "three"], "two", "End")).toBe("three");
  });

  it("chooses the following tab, then the preceding tab, after close", () => {
    expect(terminalTabAfterClose(["one", "two", "three"], "two")).toBe("three");
    expect(terminalTabAfterClose(["one", "two", "three"], "three")).toBe("two");
    expect(terminalTabAfterClose(["only"], "only")).toBeNull();
  });
});

describe("TerminalActionExecutor", () => {
  it("uses only xterm-supported surface methods and restores terminal focus", async () => {
    const terminal = new FakeTerminal();
    const clipboard = new FakeClipboard();
    const executor = TerminalActionExecutor.of(terminal, clipboard);

    await expect(executor.execute("copy")).resolves.toEqual({ kind: "completed" });
    await expect(executor.execute("paste")).resolves.toEqual({ kind: "completed" });
    await expect(executor.execute("selectAll")).resolves.toEqual({ kind: "completed" });
    await expect(executor.execute("clear")).resolves.toEqual({ kind: "completed" });

    expect(clipboard.writes).toEqual(["selected output"]);
    expect(terminal.pasted).toEqual(["clipboard input"]);
    expect(terminal.selectAllCount).toBe(1);
    expect(terminal.clearCount).toBe(1);
    expect(terminal.focusCount).toBe(4);
  });

  it("returns recoverable unavailable results and still restores focus", async () => {
    const terminal = new FakeTerminal();
    terminal.selection = "";
    const executor = TerminalActionExecutor.of(terminal, null);

    await expect(executor.execute("copy")).resolves.toMatchObject({ kind: "unavailable" });
    await expect(executor.execute("paste")).resolves.toMatchObject({ kind: "unavailable" });
    expect(terminal.focusCount).toBe(2);
  });
});
