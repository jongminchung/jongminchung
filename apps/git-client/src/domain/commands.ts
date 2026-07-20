import rawManifest from "../command-manifest.json";

export type CommandId = `${string}.${string}`;
export type CommandCategory =
  | "app"
  | "workspace"
  | "view"
  | "bookmarks"
  | "repository"
  | "changes"
  | "history"
  | "localHistory";
export type CommandMenu = "app" | "file" | "edit" | "view" | "code" | "repository" | "actions";
export type PaletteScope =
  | "all"
  | "files"
  | "recentFiles"
  | "recentLocations"
  | "recentlyChangedFiles"
  | "classes"
  | "symbols"
  | "text";

export interface KeyboardShortcut {
  readonly key: string;
  readonly meta: boolean;
  readonly ctrl: boolean;
  readonly platform: boolean;
  readonly shift: boolean;
  readonly alt: boolean;
}

export type CommandAvailability =
  | { readonly status: "enabled" }
  | { readonly status: "disabled"; readonly reason: string };

export interface CommandManifestEntry {
  readonly id: CommandId;
  readonly label: string;
  readonly category: CommandCategory;
  readonly accelerator: string | null;
  readonly menu: CommandMenu;
  readonly allowInTerminal: boolean;
  readonly allowInEditor: boolean;
  readonly allowInCodeEditor?: boolean;
  readonly mutation: boolean;
}

export interface CommandManifest {
  readonly schemaVersion: 1;
  readonly commands: readonly CommandManifestEntry[];
}

export interface CommandDefinition extends CommandManifestEntry {
  readonly availability: () => CommandAvailability;
  readonly execute: () => void | Promise<void>;
  readonly keywords?: readonly string[];
  readonly checked?: () => boolean;
  readonly priority?: number;
}

export interface PaletteItem {
  readonly id: string;
  readonly kind:
    | "command"
    | "repository"
    | "ref"
    | "commit"
    | "change"
    | "file"
    | "location"
    | "symbol"
    | "text";
  readonly label: string;
  readonly detail: string;
  readonly category: string;
  readonly keywords: readonly string[];
  readonly availability: CommandAvailability;
  readonly execute: () => void | Promise<void>;
  readonly shortcut?: string;
  readonly scopes?: readonly PaletteScope[];
}

export interface DismissLayer {
  readonly id: string;
  readonly priority: number;
  readonly active: boolean;
  readonly dismiss: () => void | Promise<void>;
  readonly order?: number;
}

export interface NativeMenuItemState {
  readonly id: CommandId;
  readonly label?: string;
  readonly enabled: boolean;
  readonly checked: boolean;
  readonly accelerator: string | null;
}

export interface KeyboardEventLike {
  readonly key: string;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly repeat: boolean;
  readonly isComposing: boolean;
}

const categories: readonly CommandCategory[] = [
  "app",
  "workspace",
  "view",
  "bookmarks",
  "repository",
  "changes",
  "history",
  "localHistory",
];
const menus: readonly CommandMenu[] = [
  "app",
  "file",
  "edit",
  "view",
  "code",
  "repository",
  "actions",
];
const ACCELERATOR_KEY_ALIASES: Readonly<Record<string, string>> = {
  left: "arrowleft",
  right: "arrowright",
  up: "arrowup",
  down: "arrowdown",
};

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCommandId(value: unknown): value is CommandId {
  return typeof value === "string" && /^[a-z]+(?:[A-Z][a-z]+|\.[a-z][A-Za-z]+)+$/.test(value);
}

function includesString<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function parseManifestEntry(value: unknown): CommandManifestEntry | null {
  if (!isRecord(value)) return null;
  if (!isCommandId(value.id) || typeof value.label !== "string" || value.label.trim() === "")
    return null;
  if (!includesString(categories, value.category) || !includesString(menus, value.menu))
    return null;
  if (
    value.accelerator !== null &&
    (typeof value.accelerator !== "string" ||
      keyboardShortcutFromAccelerator(value.accelerator) === null)
  )
    return null;
  if (
    typeof value.allowInTerminal !== "boolean" ||
    typeof value.allowInEditor !== "boolean" ||
    typeof value.mutation !== "boolean"
  )
    return null;
  if (value.allowInCodeEditor !== undefined && typeof value.allowInCodeEditor !== "boolean")
    return null;
  return {
    id: value.id,
    label: value.label,
    category: value.category,
    accelerator: value.accelerator,
    menu: value.menu,
    allowInTerminal: value.allowInTerminal,
    allowInEditor: value.allowInEditor,
    allowInCodeEditor: value.allowInCodeEditor,
    mutation: value.mutation,
  };
}

export function parseCommandManifest(value: unknown): CommandManifest {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.commands)) {
    throw new Error("Command manifest must use schema version 1");
  }
  const commands = value.commands.map(parseManifestEntry);
  if (commands.some((command) => command === null))
    throw new Error("Command manifest contains an invalid command");
  const validated = commands.filter((command): command is CommandManifestEntry => command !== null);
  const ids = new Set(validated.map((command) => command.id));
  const acceleratorValues = validated.flatMap((command) =>
    command.accelerator ? [normalizeAccelerator(command.accelerator)] : [],
  );
  const accelerators = new Set(acceleratorValues);
  if (ids.size !== validated.length) throw new Error("Command manifest contains duplicate IDs");
  if (accelerators.size !== acceleratorValues.length)
    throw new Error("Command manifest contains duplicate accelerators");
  return { schemaVersion: 1, commands: validated };
}

export const COMMAND_MANIFEST = parseCommandManifest(rawManifest);

export const COMMAND_ENABLED: CommandAvailability = { status: "enabled" };

export function commandDisabled(reason: string): CommandAvailability {
  return { status: "disabled", reason };
}

export function commandDefinition(
  id: CommandId,
  execute: () => void | Promise<void>,
  availability: () => CommandAvailability = () => COMMAND_ENABLED,
  keywords: readonly string[] = [],
): CommandDefinition {
  const manifest = COMMAND_MANIFEST.commands.find((command) => command.id === id);
  if (!manifest) throw new Error(`Unknown command ID: ${id}`);
  return { ...manifest, execute, availability, keywords };
}

export function normalizeAccelerator(accelerator: string): string {
  return accelerator
    .split("+")
    .map((part) => part.trim().toLocaleLowerCase())
    .sort()
    .join("+");
}

export function resolvedAccelerator(
  command: CommandManifestEntry,
  overrides: Readonly<Record<string, string | null>>,
): string | null {
  return Object.hasOwn(overrides, command.id)
    ? (overrides[command.id] ?? null)
    : command.accelerator;
}

export function acceleratorFromKeyboardEvent(
  event: Pick<KeyboardEventLike, "key" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey">,
): string | null {
  if (["Meta", "Control", "Shift", "Alt"].includes(event.key)) return null;
  if (
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !/^F\d+$/u.test(event.key)
  )
    return null;
  const parts: string[] = [];
  if (event.metaKey || event.ctrlKey) parts.push("CmdOrCtrl");
  if (event.altKey) parts.push("Option");
  if (event.shiftKey) parts.push("Shift");
  const key =
    event.key === " "
      ? "Space"
      : event.key.length === 1
        ? event.key.toLocaleUpperCase()
        : event.key;
  parts.push(key);
  return parts.join("+");
}

export function keyboardShortcutFromAccelerator(
  accelerator: string | null,
): KeyboardShortcut | null {
  if (accelerator === null) return null;
  const parts = accelerator
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 1) return null;
  const modifiers = new Set(parts.slice(0, -1).map((part) => part.toLocaleLowerCase()));
  if (
    [...modifiers].some(
      (part) =>
        ![
          "cmdorctrl",
          "command",
          "cmd",
          "meta",
          "control",
          "ctrl",
          "shift",
          "option",
          "alt",
        ].includes(part),
    )
  )
    return null;
  const key = parts.at(-1);
  if (!key) return null;
  const lowerKey = key.toLocaleLowerCase();
  const normalizedKey = ACCELERATOR_KEY_ALIASES[lowerKey] ?? lowerKey;
  const platform = modifiers.has("cmdorctrl");
  const meta = modifiers.has("command") || modifiers.has("cmd") || modifiers.has("meta");
  const ctrl = modifiers.has("control") || modifiers.has("ctrl");
  if (platform && (meta || ctrl)) return null;
  return {
    key: normalizedKey,
    meta,
    ctrl,
    platform,
    shift: modifiers.has("shift"),
    alt: modifiers.has("option") || modifiers.has("alt"),
  };
}

export function matchesKeyboardShortcut(
  event: KeyboardEventLike,
  accelerator: string | null,
): boolean {
  const shortcut = keyboardShortcutFromAccelerator(accelerator);
  if (shortcut === null) return false;
  const primaryMatches = shortcut.platform
    ? event.metaKey !== event.ctrlKey
    : event.metaKey === shortcut.meta && event.ctrlKey === shortcut.ctrl;
  return (
    event.key.toLocaleLowerCase() === shortcut.key &&
    primaryMatches &&
    event.shiftKey === shortcut.shift &&
    event.altKey === shortcut.alt
  );
}

export function displayAccelerator(accelerator: string | null): string {
  if (accelerator === null) return "";
  const shortcut = keyboardShortcutFromAccelerator(accelerator);
  if (shortcut === null) return accelerator;
  const key =
    shortcut.key === "enter"
      ? "↩"
      : shortcut.key === "arrowleft"
        ? "←"
        : shortcut.key === "arrowright"
          ? "→"
          : shortcut.key === "arrowup"
            ? "↑"
            : shortcut.key === "arrowdown"
              ? "↓"
              : shortcut.key.length === 1 || /^f\d+$/u.test(shortcut.key)
                ? shortcut.key.toLocaleUpperCase()
                : shortcut.key;
  return `${shortcut.ctrl ? "⌃" : ""}${shortcut.alt ? "⌥" : ""}${shortcut.shift ? "⇧" : ""}${shortcut.meta || shortcut.platform ? "⌘" : ""}${key}`;
}

export function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.matches("input, textarea, select, [contenteditable=true]");
}

export function isCodeEditorElement(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest(".cm-editor") !== null;
}

export function isCommandSearchElement(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest("[data-command-search]") !== null;
}

export function isTerminalElement(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement && target.closest('[data-command-scope="terminal"]') !== null
  );
}

export function canHandleShortcut(
  event: KeyboardEventLike,
  command: CommandManifestEntry,
  target: EventTarget | null,
): boolean {
  if (event.isComposing) return false;
  if (event.repeat && command.mutation) return false;
  if (isTerminalElement(target) && !command.allowInTerminal) return false;
  if (isCodeEditorElement(target) && !command.allowInCodeEditor) return false;
  if (
    isEditableElement(target) &&
    !isCodeEditorElement(target) &&
    !command.allowInEditor &&
    !(
      isCommandSearchElement(target) &&
      (command.id === "view.findNext" || command.id === "view.findPrevious")
    )
  )
    return false;
  return true;
}

function normalizedSearchText(item: PaletteItem): string {
  return [item.label, item.detail, item.category, ...item.keywords].join(" ").toLocaleLowerCase();
}

export function paletteScore(item: PaletteItem, rawQuery: string): number {
  const query = rawQuery.trim().toLocaleLowerCase();
  if (!query) return item.availability.status === "enabled" ? 1 : 0;
  const label = item.label.toLocaleLowerCase();
  const haystack = normalizedSearchText(item);
  if (label === query) return 1000;
  if (label.startsWith(query)) return 700 - label.length;
  const words = haystack.split(/\s+/);
  if (words.some((word) => word.startsWith(query))) return 500 - query.length;
  const position = haystack.indexOf(query);
  if (position >= 0) return 300 - position;
  let cursor = 0;
  for (const character of haystack) {
    if (character === query[cursor]) cursor += 1;
    if (cursor === query.length) return 100 - haystack.length;
  }
  return Number.NEGATIVE_INFINITY;
}

export function sortPaletteItems(
  items: readonly PaletteItem[],
  query: string,
): readonly PaletteItem[] {
  return items
    .map((item) => ({ item, score: paletteScore(item, query) }))
    .filter(({ score }) => Number.isFinite(score))
    .sort(
      (left, right) => right.score - left.score || left.item.label.localeCompare(right.item.label),
    )
    .map(({ item }) => item);
}

export function selectDismissLayer<T extends DismissLayer>(
  layers: readonly T[],
  inputOwnsEscape: boolean,
): T | null {
  const layer =
    [...layers]
      .filter((candidate) => candidate.active)
      .sort(
        (left, right) => right.priority - left.priority || (right.order ?? 0) - (left.order ?? 0),
      )[0] ?? null;
  if (layer === null || (inputOwnsEscape && layer.priority < 100)) return null;
  return layer;
}

interface RegisteredCommand {
  readonly owner: string;
  readonly order: number;
  readonly definition: CommandDefinition;
}

export class CommandRegistry {
  readonly #definitions = new Map<CommandId, readonly RegisteredCommand[]>();
  #order = 0;

  private constructor() {}

  static create(): CommandRegistry {
    return new CommandRegistry();
  }

  register(owner: string, definitions: readonly CommandDefinition[]): void {
    this.unregister(owner);
    for (const definition of definitions) {
      const registrations = this.#definitions.get(definition.id) ?? [];
      this.#definitions.set(definition.id, [
        ...registrations,
        { owner, order: this.#order, definition },
      ]);
      this.#order += 1;
    }
  }

  unregister(owner: string): void {
    for (const [id, definitions] of this.#definitions) {
      const remaining = definitions.filter((definition) => definition.owner !== owner);
      if (remaining.length === 0) this.#definitions.delete(id);
      else if (remaining.length !== definitions.length) this.#definitions.set(id, remaining);
    }
  }

  find(id: CommandId): CommandDefinition | null {
    const definitions = this.#definitions.get(id);
    if (!definitions || definitions.length === 0) return null;
    return (
      [...definitions].sort(
        (left, right) =>
          (right.definition.priority ?? 0) - (left.definition.priority ?? 0) ||
          right.order - left.order,
      )[0]?.definition ?? null
    );
  }

  createSnapshot(): readonly CommandDefinition[] {
    return COMMAND_MANIFEST.commands.flatMap((entry) => {
      const definition = this.find(entry.id);
      return definition ? [definition] : [];
    });
  }

  async execute(id: CommandId): Promise<CommandAvailability> {
    const definition = this.find(id);
    if (!definition) return commandDisabled("This command is not available in the current view.");
    const availability = definition.availability();
    if (availability.status === "disabled") return availability;
    await definition.execute();
    return COMMAND_ENABLED;
  }
}
