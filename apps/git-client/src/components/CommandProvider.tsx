import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  COMMAND_MANIFEST,
  CommandRegistry,
  canHandleShortcut,
  commandDefinition,
  commandDisabled,
  displayAccelerator,
  isEditableElement,
  isCodeEditorElement,
  isCommandSearchElement,
  isTerminalElement,
  matchesKeyboardShortcut,
  resolvedAccelerator,
  selectDismissLayer,
  type CommandAvailability,
  type CommandDefinition,
  type CommandId,
  type DismissLayer,
  type NativeMenuItemState,
  type PaletteScope,
  type PaletteItem,
} from "../domain/commands";
import { parseProductSettings, PRODUCT_SETTINGS_KEY } from "../domain/productSettings";
import { electronApi, isElectronRuntime } from "../platform/electron";
import { readElectronSetting } from "../platform/electronSettings";
import { tw } from "../styles/tailwind";
import { CommandPalette } from "./CommandPalette";

interface RegisteredDismissLayer extends DismissLayer {
  readonly order: number;
}

interface CommandContextValue {
  readonly registerCommands: (owner: string, commands: readonly CommandDefinition[]) => void;
  readonly unregisterCommands: (owner: string) => void;
  readonly registerPaletteItems: (owner: string, items: readonly PaletteItem[]) => void;
  readonly unregisterPaletteItems: (owner: string) => void;
  readonly registerDismissLayer: (owner: string, layer: DismissLayer) => void;
  readonly unregisterDismissLayer: (owner: string) => void;
  readonly execute: (id: CommandId) => Promise<void>;
  readonly openPalette: () => void;
  readonly openPaletteFor: (scope: PaletteScope) => void;
  readonly closePalette: () => void;
  readonly announce: (message: string) => void;
}

const CommandContext = createContext<CommandContextValue | null>(null);

function useCommandContext(): CommandContextValue {
  const value = useContext(CommandContext);
  if (value === null) throw new Error("Command hooks must be used inside CommandProvider");
  return value;
}

export function useCommandDefinitions(commands: readonly CommandDefinition[]): void {
  const owner = useId();
  const latest = useRef(commands);
  latest.current = commands;
  const { registerCommands, unregisterCommands } = useCommandContext();
  const commandIds = commands.map((command) => command.id).join("|");
  const stateSignature = JSON.stringify(
    commands.map((command) => [
      command.id,
      command.label,
      command.availability(),
      command.checked?.() ?? false,
    ]),
  );
  useEffect(() => {
    const definitions = latest.current.map((command) => ({
      ...command,
      availability: (): CommandAvailability =>
        latest.current.find((candidate) => candidate.id === command.id)?.availability() ??
        commandDisabled("This command is no longer available."),
      execute: (): void | Promise<void> =>
        latest.current.find((candidate) => candidate.id === command.id)?.execute(),
      checked: command.checked
        ? (): boolean =>
            latest.current.find((candidate) => candidate.id === command.id)?.checked?.() ?? false
        : undefined,
    }));
    registerCommands(owner, definitions);
    return () => unregisterCommands(owner);
  }, [commandIds, owner, registerCommands, stateSignature, unregisterCommands]);
}

export function usePaletteItems(items: readonly PaletteItem[]): void {
  const owner = useId();
  const latest = useRef(items);
  latest.current = items;
  const { registerPaletteItems, unregisterPaletteItems } = useCommandContext();
  const signature = JSON.stringify(
    items.map((item) => [item.id, item.label, item.detail, item.availability, item.scopes]),
  );
  useEffect(() => {
    const registered = latest.current.map((item) => ({
      ...item,
      execute: (): void | Promise<void> =>
        latest.current.find((candidate) => candidate.id === item.id)?.execute(),
    }));
    registerPaletteItems(owner, registered);
    return () => unregisterPaletteItems(owner);
  }, [owner, registerPaletteItems, signature, unregisterPaletteItems]);
}

export function useDismissLayer(layer: DismissLayer): void {
  const owner = useId();
  const latest = useRef(layer);
  latest.current = layer;
  const { registerDismissLayer, unregisterDismissLayer } = useCommandContext();
  useEffect(() => {
    registerDismissLayer(owner, { ...latest.current, dismiss: () => latest.current.dismiss() });
    return () => unregisterDismissLayer(owner);
  }, [layer.active, layer.id, layer.priority, owner, registerDismissLayer, unregisterDismissLayer]);
}

export function useCommands(): Pick<
  CommandContextValue,
  "execute" | "openPalette" | "openPaletteFor" | "closePalette" | "announce"
> {
  const { execute, openPalette, openPaletteFor, closePalette, announce } = useCommandContext();
  return { execute, openPalette, openPaletteFor, closePalette, announce };
}

export function CommandProvider({ children }: { readonly children: ReactNode }) {
  const registryRef = useRef<CommandRegistry | null>(null);
  if (registryRef.current === null) registryRef.current = CommandRegistry.create();
  const registry = registryRef.current;
  const paletteItems = useRef(new Map<string, readonly PaletteItem[]>());
  const dismissLayers = useRef(new Map<string, RegisteredDismissLayer>());
  const dismissOrder = useRef(0);
  const [revision, setRevision] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteScope, setPaletteScope] = useState<PaletteScope>("all");
  const [liveMessage, setLiveMessage] = useState("");
  const [focusTarget, setFocusTarget] = useState<EventTarget | null>(null);
  const [keymapOverrides, setKeymapOverrides] = useState<Readonly<Record<string, string | null>>>(
    {},
  );
  const [presentationAssistant, setPresentationAssistant] = useState(false);
  const [assistantMessage, setAssistantMessage] = useState("");
  const assistantTimer = useRef<number | undefined>(undefined);
  const paletteTrigger = useRef<HTMLElement | null>(null);
  const runningMutations = useRef(new Set<CommandId>());
  const lastMutationAt = useRef(new Map<CommandId, number>());

  const openPalette = useCallback((): void => {
    paletteTrigger.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPaletteScope("all");
    setPaletteOpen(true);
  }, []);

  const openPaletteFor = useCallback((scope: PaletteScope): void => {
    paletteTrigger.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPaletteScope(scope);
    setPaletteOpen(true);
  }, []);

  const closePalette = useCallback((): void => {
    setPaletteOpen(false);
    const trigger = paletteTrigger.current;
    paletteTrigger.current = null;
    window.requestAnimationFrame(() => trigger?.isConnected && trigger.focus());
  }, []);

  const announce = useCallback((message: string): void => {
    setLiveMessage("");
    window.requestAnimationFrame(() => setLiveMessage(message));
  }, []);

  const registerCommands = useCallback(
    (owner: string, commands: readonly CommandDefinition[]): void => {
      registry.register(owner, commands);
      setRevision((current) => current + 1);
    },
    [registry],
  );
  const unregisterCommands = useCallback(
    (owner: string): void => {
      registry.unregister(owner);
      setRevision((current) => current + 1);
    },
    [registry],
  );
  const registerPaletteItems = useCallback((owner: string, items: readonly PaletteItem[]): void => {
    paletteItems.current.set(owner, items);
    setRevision((current) => current + 1);
  }, []);
  const unregisterPaletteItems = useCallback((owner: string): void => {
    if (paletteItems.current.delete(owner)) setRevision((current) => current + 1);
  }, []);
  const registerDismissLayer = useCallback((owner: string, layer: DismissLayer): void => {
    dismissLayers.current.set(owner, { ...layer, order: dismissOrder.current });
    dismissOrder.current += 1;
  }, []);
  const unregisterDismissLayer = useCallback((owner: string): void => {
    dismissLayers.current.delete(owner);
  }, []);

  const contextualAvailability = useCallback(
    (definition: CommandDefinition, target: EventTarget | null): CommandAvailability => {
      if (isTerminalElement(target) && !definition.allowInTerminal)
        return commandDisabled("This shortcut is reserved for the focused terminal.");
      if (isCodeEditorElement(target) && !definition.allowInCodeEditor)
        return commandDisabled("This shortcut is reserved for the focused code editor.");
      if (
        isEditableElement(target) &&
        !isCodeEditorElement(target) &&
        !definition.allowInEditor &&
        !(
          isCommandSearchElement(target) &&
          (definition.id === "view.findNext" || definition.id === "view.findPrevious")
        )
      )
        return commandDisabled("This shortcut is reserved for the focused editor.");
      return definition.availability();
    },
    [],
  );

  const execute = useCallback(
    async (id: CommandId): Promise<void> => {
      const definition = registry.find(id);
      if (!definition) {
        announce("This command is not available in the current view.");
        return;
      }
      const availability = contextualAvailability(definition, document.activeElement);
      if (availability.status === "disabled") {
        announce(availability.reason);
        return;
      }
      if (presentationAssistant) {
        const shortcut = displayAccelerator(resolvedAccelerator(definition, keymapOverrides));
        setAssistantMessage(shortcut ? `${definition.label}  ${shortcut}` : definition.label);
        if (assistantTimer.current !== undefined) window.clearTimeout(assistantTimer.current);
        assistantTimer.current = window.setTimeout(() => setAssistantMessage(""), 1_600);
      }
      if (definition.mutation) {
        const now = performance.now();
        if (runningMutations.current.has(id) || now - (lastMutationAt.current.get(id) ?? 0) < 350) {
          announce(`${definition.label} is already in progress.`);
          return;
        }
        runningMutations.current.add(id);
        lastMutationAt.current.set(id, now);
      }
      try {
        await definition.execute();
        window.dispatchEvent(
          new CustomEvent("git-client:command-executed", {
            detail: { id: definition.id },
          }),
        );
      } catch (error) {
        announce(error instanceof Error ? error.message : String(error));
      } finally {
        runningMutations.current.delete(id);
      }
    },
    [announce, contextualAvailability, keymapOverrides, presentationAssistant, registry],
  );

  useEffect(() => {
    let active = true;
    const restore = async (): Promise<void> => {
      try {
        const settings = parseProductSettings(await readElectronSetting(PRODUCT_SETTINGS_KEY));
        if (active) {
          setKeymapOverrides(settings.keymapOverrides);
          setPresentationAssistant(settings.presentationAssistant);
        }
      } catch {
        if (active) setKeymapOverrides({});
      }
    };
    void restore();
    const update = (event: Event): void => {
      if (!(event instanceof CustomEvent)) return;
      setKeymapOverrides(parseProductSettings({ keymapOverrides: event.detail }).keymapOverrides);
    };
    const updateProductSettings = (event: Event): void => {
      if (!(event instanceof CustomEvent)) return;
      const settings = parseProductSettings(event.detail);
      setKeymapOverrides(settings.keymapOverrides);
      setPresentationAssistant(settings.presentationAssistant);
    };
    window.addEventListener("git-client:keymap-changed", update);
    window.addEventListener("git-client:product-settings-changed", updateProductSettings);
    return () => {
      active = false;
      window.removeEventListener("git-client:keymap-changed", update);
      window.removeEventListener("git-client:product-settings-changed", updateProductSettings);
    };
  }, []);

  useEffect(
    () => () => {
      if (assistantTimer.current !== undefined) window.clearTimeout(assistantTimer.current);
    },
    [],
  );

  useEffect(() => {
    const definition = commandDefinition("palette.open", openPalette);
    registry.register("command-provider", [definition]);
    setRevision((current) => current + 1);
    return () => registry.unregister("command-provider");
  }, [openPalette, registry]);

  useEffect(() => {
    const focus = (event: FocusEvent): void => setFocusTarget(event.target);
    window.addEventListener("focusin", focus);
    return () => window.removeEventListener("focusin", focus);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.isComposing) return;
      if (event.key === "Escape") {
        if (event.repeat) return;
        const inputOwnsEscape =
          isTerminalElement(event.target) ||
          isEditableElement(event.target) ||
          isCodeEditorElement(event.target);
        const layer = selectDismissLayer([...dismissLayers.current.values()], inputOwnsEscape);
        if (!layer) return;
        event.preventDefault();
        event.stopPropagation();
        void layer.dismiss();
        return;
      }
      if (isElectronRuntime()) return;
      const entry = COMMAND_MANIFEST.commands.find((command) =>
        matchesKeyboardShortcut(event, resolvedAccelerator(command, keymapOverrides)),
      );
      if (!entry) return;
      const definition = registry.find(entry.id) ?? entry;
      if (!canHandleShortcut(event, definition, event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      void execute(entry.id);
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [execute, keymapOverrides, registry]);

  useEffect(() => {
    const electron = electronApi();
    if (electron !== null) {
      return electron.menu.onCommand((event) => {
        void execute(event.id as CommandId);
      });
    }
    return undefined;
  }, [execute]);

  useEffect(() => {
    const states: readonly NativeMenuItemState[] = COMMAND_MANIFEST.commands.map((entry) => {
      const definition = registry.find(entry.id);
      const availability = definition
        ? contextualAvailability(definition, focusTarget)
        : commandDisabled("Unavailable");
      return {
        id: entry.id,
        label: definition?.label ?? entry.label,
        enabled: availability.status === "enabled",
        checked: definition?.checked?.() ?? false,
        accelerator: resolvedAccelerator(entry, keymapOverrides),
      };
    });
    const sync = async (): Promise<void> => {
      const electron = electronApi();
      if (electron !== null) {
        await electron.menu.syncState(states.map((state) => ({ ...state, visible: true })));
        return;
      }
    };
    if (isElectronRuntime()) void sync();
  }, [contextualAvailability, focusTarget, keymapOverrides, registry, revision]);

  const commandItems = useMemo<readonly PaletteItem[]>(
    () =>
      COMMAND_MANIFEST.commands.map((entry) => {
        const definition = registry.find(entry.id);
        return {
          id: entry.id,
          kind: "command",
          label: definition?.label ?? entry.label,
          detail: definition?.category ?? entry.category,
          category: definition?.category ?? entry.category,
          keywords: definition?.keywords ?? [],
          availability: definition
            ? contextualAvailability(definition, focusTarget)
            : commandDisabled("This command is not available in the current view."),
          execute: () => execute(entry.id),
          shortcut: displayAccelerator(resolvedAccelerator(entry, keymapOverrides)) || undefined,
        };
      }),
    [contextualAvailability, execute, focusTarget, keymapOverrides, registry, revision],
  );
  const allPaletteItems = useMemo(
    () => [...commandItems, ...[...paletteItems.current.values()].flat()],
    [commandItems, revision],
  );

  useEffect(() => {
    const owner = "command-palette";
    if (paletteOpen)
      registerDismissLayer(owner, {
        id: owner,
        priority: 120,
        active: true,
        dismiss: closePalette,
      });
    else unregisterDismissLayer(owner);
    return () => unregisterDismissLayer(owner);
  }, [closePalette, paletteOpen, registerDismissLayer, unregisterDismissLayer]);

  const value = useMemo<CommandContextValue>(
    () => ({
      registerCommands,
      unregisterCommands,
      registerPaletteItems,
      unregisterPaletteItems,
      registerDismissLayer,
      unregisterDismissLayer,
      execute,
      openPalette,
      openPaletteFor,
      closePalette,
      announce,
    }),
    [
      announce,
      closePalette,
      execute,
      openPalette,
      openPaletteFor,
      registerCommands,
      registerDismissLayer,
      registerPaletteItems,
      unregisterCommands,
      unregisterDismissLayer,
      unregisterPaletteItems,
    ],
  );

  return (
    <CommandContext.Provider value={value}>
      {children}
      {paletteOpen && (
        <CommandPalette
          items={allPaletteItems}
          scope={paletteScope}
          onAnnounce={announce}
          onClose={closePalette}
          onExecute={async (item) => {
            try {
              await item.execute();
            } catch (error) {
              announce(error instanceof Error ? error.message : String(error));
            }
          }}
        />
      )}
      {assistantMessage && (
        <div className={tw.presentationAssistant} role="status">
          {assistantMessage}
        </div>
      )}
      <span aria-live="polite" className={tw.srOnly} data-command-status role="status">
        {liveMessage}
      </span>
    </CommandContext.Provider>
  );
}
