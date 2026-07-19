import { describe, expect, it, vi } from "vitest";
import {
  COMMAND_ENABLED,
  COMMAND_MANIFEST,
  CommandRegistry,
  acceleratorFromKeyboardEvent,
  canHandleShortcut,
  commandDisabled,
  displayAccelerator,
  matchesKeyboardShortcut,
  parseCommandManifest,
  resolvedAccelerator,
  sortPaletteItems,
  selectDismissLayer,
  type CommandDefinition,
  type KeyboardEventLike,
  type PaletteItem,
} from "./commands";

const keyboardEvent = (overrides: Partial<KeyboardEventLike> = {}): KeyboardEventLike => ({
  key: "p",
  metaKey: true,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  repeat: false,
  isComposing: false,
  ...overrides,
});

describe("command manifest", () => {
  it("has unique IDs and accelerators and renders macOS shortcuts", () => {
    expect(COMMAND_MANIFEST.commands.length).toBeGreaterThan(15);
    expect(new Set(COMMAND_MANIFEST.commands.map((command) => command.id)).size).toBe(COMMAND_MANIFEST.commands.length);
    expect(displayAccelerator("CmdOrCtrl+Option+Shift+C")).toBe("⌥⇧⌘C");
    expect(displayAccelerator(null)).toBe("");
    expect(COMMAND_MANIFEST.commands.some((command) => command.accelerator === "CmdOrCtrl+C")).toBe(false);
  });

  it("rejects malformed external values", () => {
    expect(() => parseCommandManifest({ schemaVersion: 2, commands: [] })).toThrow(/schema version/);
    expect(() => parseCommandManifest({ schemaVersion: 1, commands: [{ id: "bad" }] })).toThrow(/invalid/);
  });
});

describe("shortcut matching", () => {
  it("normalizes command, shift, option and enter", () => {
    expect(matchesKeyboardShortcut(keyboardEvent(), "CmdOrCtrl+P")).toBe(true);
    expect(matchesKeyboardShortcut(keyboardEvent({ key: "Enter", shiftKey: true }), "CmdOrCtrl+Shift+Enter")).toBe(true);
    expect(matchesKeyboardShortcut(keyboardEvent({ key: "c", shiftKey: true, altKey: true }), "CmdOrCtrl+Option+Shift+C")).toBe(true);
  });

  it("captures and resolves user keymap overrides", () => {
    expect(
      acceleratorFromKeyboardEvent({
        key: "k",
        metaKey: true,
        ctrlKey: false,
        shiftKey: true,
        altKey: false,
      }),
    ).toBe("CmdOrCtrl+Shift+K");
    expect(
      acceleratorFromKeyboardEvent({
        key: "k",
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      }),
    ).toBeNull();
    const project = COMMAND_MANIFEST.commands.find(
      (command) => command.id === "view.project",
    );
    expect(project).toBeDefined();
    if (!project) return;
    expect(resolvedAccelerator(project, { "view.project": null })).toBeNull();
    expect(
      resolvedAccelerator(project, { "view.project": "CmdOrCtrl+Shift+K" }),
    ).toBe("CmdOrCtrl+Shift+K");
  });

  it("protects IME and repeated mutations", () => {
    const mutation = COMMAND_MANIFEST.commands.find((command) => command.id === "repository.push");
    expect(mutation).toBeDefined();
    if (!mutation) return;
    expect(canHandleShortcut(keyboardEvent({ isComposing: true }), mutation, null)).toBe(false);
    expect(canHandleShortcut(keyboardEvent({ repeat: true }), mutation, null)).toBe(false);
  });
});

describe("CommandRegistry", () => {
  it("uses the newest contextual handler and reports disabled reasons", async () => {
    const registry = CommandRegistry.create();
    const first = vi.fn();
    const second = vi.fn();
    const entry = COMMAND_MANIFEST.commands[0];
    expect(entry).toBeDefined();
    if (!entry) return;
    const definition = (execute: () => void, enabled = true): CommandDefinition => ({
      ...entry,
      execute,
      availability: () => enabled ? COMMAND_ENABLED : commandDisabled("Not now"),
    });
    registry.register("one", [definition(first)]);
    registry.register("two", [definition(second, false)]);
    expect(await registry.execute(entry.id)).toEqual(commandDisabled("Not now"));
    registry.unregister("two");
    expect(await registry.execute(entry.id)).toEqual(COMMAND_ENABLED);
    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
  });
});

describe("palette ranking", () => {
  const item = (id: string, label: string, enabled = true): PaletteItem => ({
    id,
    kind: "command",
    label,
    detail: "Repository",
    category: "Actions",
    keywords: [],
    availability: enabled ? COMMAND_ENABLED : commandDisabled("No repository"),
    execute: vi.fn(),
  });

  it("ranks exact and prefix matches while keeping disabled results", () => {
    const sorted = sortPaletteItems([item("fetch", "Fetch", false), item("open", "Open Repository"), item("refresh", "Refresh")], "fetch");
    expect(sorted.map((value) => value.id)).toEqual(["fetch"]);
    expect(sorted[0]?.availability).toEqual(commandDisabled("No repository"));
  });
});

describe("Escape dismiss order", () => {
  it("closes one highest layer and leaves input-owned Escape alone below overlays", () => {
    const dismiss = vi.fn();
    const layers = [
      { id: "selection", priority: 20, active: true, dismiss },
      { id: "diff", priority: 60, active: true, dismiss },
      { id: "dialog", priority: 120, active: true, dismiss },
    ];
    expect(selectDismissLayer(layers, false)?.id).toBe("dialog");
    expect(selectDismissLayer(layers.slice(0, 2), true)).toBeNull();
    expect(selectDismissLayer(layers.slice(0, 2), false)?.id).toBe("diff");
  });
});
