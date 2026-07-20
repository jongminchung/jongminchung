import type { AppearancePreference, AppearanceTheme } from "../domain/appearance";
import {
  isProductKeymapPreset,
  type ProductKeymapPreset,
  type ProductSettings,
  type ProductZoom,
} from "../domain/productSettings";
import { tw } from "../styles/tailwind";
import { Button } from "./ui";
import { Dialog, DialogHeader } from "./ui";
import { RadioList, RadioListItem } from "./ui";

const THEMES: readonly { readonly value: AppearanceTheme | "system"; readonly label: string }[] = [
  { value: "system", label: "Sync with OS" },
  { value: "light", label: "Islands Light" },
  { value: "dark", label: "Islands Dark" },
];

const KEYMAPS: readonly ProductKeymapPreset[] = [
  "macOS",
  "Emacs",
  "IntelliJ IDEA Classic",
  "macOS System Shortcuts",
  "Sublime Text",
  "Sublime Text (macOS)",
];

export function QuickSwitchSchemeDialog({
  appearancePreference,
  settings,
  onAppearancePreferenceChange,
  onClose,
  onSettingsChange,
}: {
  readonly appearancePreference: AppearancePreference;
  readonly settings: ProductSettings;
  readonly onAppearancePreferenceChange: (preference: AppearancePreference) => void;
  readonly onClose: () => void;
  readonly onSettingsChange: (settings: ProductSettings) => void;
}) {
  return (
    <Dialog
      aria-label="Switch"
      isOpen
      onOpenChange={(open) => !open && onClose()}
      padding={0}
      purpose="info"
      width={520}
    >
      <section className={tw.quickSwitchSchemeDialog}>
        <DialogHeader hasDivider onOpenChange={(open) => !open && onClose()} title="Switch" />
        <div>
          <h3>Theme and Color Scheme</h3>
          <RadioList
            label="Theme and Color Scheme"
            onChange={(value) => {
              const selection = THEMES.find((theme) => theme.value === value)?.value;
              if (selection === undefined) return;
              onAppearancePreferenceChange(
                selection === "system"
                  ? { ...appearancePreference, syncWithOs: true }
                  : { theme: selection, syncWithOs: false },
              );
            }}
            value={appearancePreference.syncWithOs ? "system" : appearancePreference.theme}
          >
            {THEMES.map((theme) => (
              <RadioListItem key={theme.value} label={theme.label} value={theme.value} />
            ))}
          </RadioList>
        </div>
        <div>
          <h3>Keymap</h3>
          <select
            aria-label="Keymap"
            onChange={(event) => {
              const value = event.currentTarget.value;
              if (isProductKeymapPreset(value)) {
                onSettingsChange({ ...settings, keymapPreset: value });
              }
            }}
            value={settings.keymapPreset}
          >
            {KEYMAPS.map((keymap) => (
              <option key={keymap}>{keymap}</option>
            ))}
          </select>
        </div>
        <div>
          <h3>IDE Scale</h3>
          <RadioList
            label="IDE Scale"
            onChange={(value) =>
              onSettingsChange({
                ...settings,
                zoom: Number(value) as ProductZoom,
              })
            }
            value={String(settings.zoom)}
          >
            <RadioListItem label="100%" value="100" />
            <RadioListItem label="125%" value="125" />
            <RadioListItem label="150%" value="150" />
          </RadioList>
        </div>
        <footer>
          <Button label="Close" onClick={onClose} size="md" variant="primary" />
        </footer>
      </section>
    </Dialog>
  );
}
