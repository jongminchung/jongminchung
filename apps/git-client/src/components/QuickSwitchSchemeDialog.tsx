import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { RadioList, RadioListItem } from "@astryxdesign/core/RadioList";
import type { AppearanceMode } from "../domain/appearance";
import {
  isProductKeymapPreset,
  type ProductKeymapPreset,
  type ProductSettings,
  type ProductZoom,
} from "../domain/productSettings";
import { tw } from "../styles/tailwind";

const THEMES: readonly { readonly value: AppearanceMode; readonly label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Islands Light" },
  { value: "dark", label: "Islands Dark" },
  { value: "darcula", label: "Islands Darcula" },
  { value: "highContrast", label: "High Contrast" },
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
  appearanceMode,
  settings,
  onAppearanceModeChange,
  onClose,
  onSettingsChange,
}: {
  readonly appearanceMode: AppearanceMode;
  readonly settings: ProductSettings;
  readonly onAppearanceModeChange: (mode: AppearanceMode) => void;
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
        <DialogHeader
          hasDivider
          onOpenChange={(open) => !open && onClose()}
          title="Switch"
        />
        <div>
          <h3>Theme and Color Scheme</h3>
          <RadioList
            label="Theme and Color Scheme"
            onChange={(value) => {
              const mode = THEMES.find((theme) => theme.value === value)?.value;
              if (mode) onAppearanceModeChange(mode);
            }}
            value={appearanceMode}
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
            {KEYMAPS.map((keymap) => <option key={keymap}>{keymap}</option>)}
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
