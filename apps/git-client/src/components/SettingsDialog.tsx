import { Button } from "@astryxdesign/core/Button";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { RadioList, RadioListItem } from "@astryxdesign/core/RadioList";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useMemo, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { AppearanceMode } from "../domain/appearance";
import {
  COMMAND_MANIFEST,
  acceleratorFromKeyboardEvent,
  displayAccelerator,
  normalizeAccelerator,
  resolvedAccelerator,
} from "../domain/commands";
import {
  isProductKeymapPreset,
} from "../domain/productSettings";
import {
  type ProductSettings,
  type ProductZoom,
} from "../domain/productSettings";
import { tw } from "../styles/tailwind";
import { useAppearance } from "./AppearanceProvider";
import { Icon } from "./Icon";

type SettingsSection = "appearance" | "keymap" | "versionControl" | "notifications";

const APPEARANCE_MODES: readonly { readonly value: AppearanceMode; readonly label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Islands Light" },
  { value: "dark", label: "Islands Dark" },
  { value: "darcula", label: "Darcula" },
  { value: "highContrast", label: "High Contrast" },
];

export function SettingsDialog({
  appearanceMode,
  isOpen,
  onClose,
  onAppearanceModeChange,
  onOpenRepositorySettings,
  onSettingsChange,
  settings,
  showRepositorySettings = true,
  title = "Settings",
}: {
  readonly appearanceMode?: AppearanceMode;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onAppearanceModeChange?: (mode: AppearanceMode) => void;
  readonly onOpenRepositorySettings?: () => void;
  readonly onSettingsChange: (settings: ProductSettings) => void;
  readonly settings: ProductSettings;
  readonly showRepositorySettings?: boolean;
  readonly title?: string;
}) {
  const appearance = useAppearance();
  const mode = appearanceMode ?? appearance.mode;
  const setMode = onAppearanceModeChange ?? appearance.setMode;
  const [section, setSection] = useState<SettingsSection>("appearance");
  const [keymapFilter, setKeymapFilter] = useState("");
  const [capturingCommand, setCapturingCommand] = useState<string>();
  const [keymapError, setKeymapError] = useState<string>();

  const filteredCommands = useMemo(() => {
    const query = keymapFilter.trim().toLocaleLowerCase();
    return COMMAND_MANIFEST.commands.filter((command) =>
      !query || `${command.label} ${command.id} ${command.category}`.toLocaleLowerCase().includes(query),
    );
  }, [keymapFilter]);

  const captureShortcut = (
    commandId: string,
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ): void => {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      setCapturingCommand(undefined);
      setKeymapError(undefined);
      return;
    }
    if (event.key === "Backspace" || event.key === "Delete") {
      onSettingsChange({
        ...settings,
        keymapOverrides: { ...settings.keymapOverrides, [commandId]: null },
      });
      setCapturingCommand(undefined);
      setKeymapError(undefined);
      return;
    }
    const accelerator = acceleratorFromKeyboardEvent(event);
    if (accelerator === null) {
      setKeymapError("Use at least one modifier key with the shortcut.");
      return;
    }
    const conflict = COMMAND_MANIFEST.commands.find(
      (command) =>
        command.id !== commandId &&
        resolvedAccelerator(command, settings.keymapOverrides) !== null &&
        normalizeAccelerator(
          resolvedAccelerator(command, settings.keymapOverrides) ?? "",
        ) === normalizeAccelerator(accelerator),
    );
    if (conflict) {
      setKeymapError(`${displayAccelerator(accelerator)} is already assigned to ${conflict.label}.`);
      return;
    }
    onSettingsChange({
      ...settings,
      keymapOverrides: {
        ...settings.keymapOverrides,
        [commandId]: accelerator,
      },
    });
    setCapturingCommand(undefined);
    setKeymapError(undefined);
  };

  return (
    <Dialog
      aria-label={title}
      isOpen={isOpen}
      maxHeight="90vh"
      onOpenChange={(open) => !open && onClose()}
      padding={0}
      purpose="form"
      width="min(920px, calc(100vw - 70px))"
    >
      <section className={tw.settingsDialog}>
        <DialogHeader hasDivider onOpenChange={(open) => !open && onClose()} title={title} />
        <aside aria-label="Settings categories">
          <button className={section === "appearance" ? tw.activeButton : undefined} onClick={() => setSection("appearance")}><Icon name="appearance" size={15} /> Appearance & Behavior</button>
          <button className={section === "keymap" ? tw.activeButton : undefined} onClick={() => setSection("keymap")}><Icon name="settings" size={15} /> Keymap</button>
          <button className={section === "versionControl" ? tw.activeButton : undefined} onClick={() => setSection("versionControl")}><Icon name="branch" size={15} /> Version Control</button>
          <button className={section === "notifications" ? tw.activeButton : undefined} onClick={() => setSection("notifications")}><Icon name="warning" size={15} /> Notifications</button>
        </aside>
        <main>
          {section === "appearance" && (
            <div className={tw.settingsPage}>
              <h2>Appearance</h2>
              <RadioList label="Theme" onChange={(value) => APPEARANCE_MODES.some((item) => item.value === value) && setMode(value as AppearanceMode)} value={mode}>
                {APPEARANCE_MODES.map((item) => <RadioListItem key={item.value} label={item.label} value={item.value} />)}
              </RadioList>
              <CheckboxInput label="Compact mode" onChange={(compactMode) => onSettingsChange({ ...settings, compactMode })} value={settings.compactMode} />
              <CheckboxInput
                label="Adjust colors for red-green vision deficiency"
                onChange={(adjustRedGreenVision) =>
                  onSettingsChange({ ...settings, adjustRedGreenVision })
                }
                value={settings.adjustRedGreenVision}
              />
              <label>
                IDE font
                <select
                  onChange={(event) => onSettingsChange({ ...settings, ideFontSize: Number(event.currentTarget.value) })}
                  value={settings.ideFontSize}
                >
                  {[8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72].map((size) => <option key={size} value={size}>{size.toFixed(1)}</option>)}
                </select>
              </label>
              <label>
                Editor font
                <select
                  onChange={(event) => onSettingsChange({ ...settings, editorFontSize: Number(event.currentTarget.value) })}
                  value={settings.editorFontSize}
                >
                  {[8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72].map((size) => <option key={size} value={size}>{size.toFixed(1)}</option>)}
                </select>
              </label>
              <RadioList label="IDE zoom" onChange={(value) => onSettingsChange({ ...settings, zoom: Number(value) as ProductZoom })} value={String(settings.zoom)}>
                <RadioListItem label="100%" value="100" />
                <RadioListItem label="125%" value="125" />
                <RadioListItem label="150%" value="150" />
              </RadioList>
            </div>
          )}
          {section === "keymap" && (
            <div className={tw.settingsPage}>
              <h2>Keymap</h2>
              <label>
                Keymap
                <select
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    if (isProductKeymapPreset(value)) {
                      onSettingsChange({ ...settings, keymapPreset: value });
                    }
                  }}
                  value={settings.keymapPreset}
                >
                  <option>macOS</option>
                  <option>Emacs</option>
                  <option>IntelliJ IDEA Classic</option>
                  <option>macOS System Shortcuts</option>
                  <option>Sublime Text</option>
                  <option>Sublime Text (macOS)</option>
                </select>
              </label>
              <TextInput isLabelHidden label="Search keymap" onChange={setKeymapFilter} placeholder="Search actions" value={keymapFilter} width="100%" />
              {keymapError && <p className={tw.collectionError} role="alert">{keymapError}</p>}
              <div className={tw.keymapTable} role="table" aria-label="Keymap actions">
                {filteredCommands.map((command) => (
                  <div key={command.id} role="row">
                    <span role="cell"><strong>{command.label}</strong><small>{command.id}</small></span>
                    <button
                      aria-label={`Shortcut for ${command.label}`}
                      onClick={() => setCapturingCommand(command.id)}
                      onKeyDown={(event) => capturingCommand === command.id && captureShortcut(command.id, event)}
                      role="cell"
                    >
                      {capturingCommand === command.id
                        ? "Press shortcut…"
                        : displayAccelerator(resolvedAccelerator(command, settings.keymapOverrides)) || "—"}
                    </button>
                    {Object.hasOwn(settings.keymapOverrides, command.id) && (
                      <button
                        aria-label={`Reset shortcut for ${command.label}`}
                        onClick={() => {
                          const keymapOverrides = { ...settings.keymapOverrides };
                          delete keymapOverrides[command.id];
                          onSettingsChange({ ...settings, keymapOverrides });
                        }}
                        role="cell"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {section === "versionControl" && (
            <div className={tw.settingsPage}>
              <h2>Version Control</h2>
              {showRepositorySettings && onOpenRepositorySettings ? (
                <>
                  <p>Configure Git remotes, worktrees, submodules, ignore rules, and repository-local Git config.</p>
                  <Button label="Open Repository Settings" onClick={onOpenRepositorySettings} variant="secondary" />
                </>
              ) : (
                <p>These defaults are applied when a project is opened for the first time. Repository-local Git settings remain project-specific.</p>
              )}
            </div>
          )}
          {section === "notifications" && (
            <div className={tw.settingsPage}>
              <h2>Notifications</h2>
              <CheckboxInput label="Show operation notifications" onChange={(showNotifications) => onSettingsChange({ ...settings, showNotifications })} value={settings.showNotifications} />
              <CheckboxInput label="Show macOS shortcut conflict warning" onChange={(showShortcutConflictWarning) => onSettingsChange({ ...settings, showShortcutConflictWarning })} value={settings.showShortcutConflictWarning} />
              <p>Failures remain visible in the status bar and Git Console even when pop-up notifications are hidden.</p>
            </div>
          )}
        </main>
        <footer>
          <Button label="Close" onClick={onClose} variant="primary" />
        </footer>
      </section>
    </Dialog>
  );
}
