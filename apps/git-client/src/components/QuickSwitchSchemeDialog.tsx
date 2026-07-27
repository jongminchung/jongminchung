import { Button } from "@base-ui/react/button";
import type { AppearancePreference, AppearanceTheme } from "../domain/appearance";
import {
  isProductKeymapPreset,
  type ProductKeymapPreset,
  type ProductSettings,
  type ProductZoom,
} from "../domain/productSettings";
import { cn } from "../lib/utils";
import { tw } from "../styles/tailwind";
import { Dialog, DialogHeader } from "./ui";
import { RadioList, RadioListItem } from "./ui";

const THEMES: readonly {
  readonly value: AppearanceTheme | "system";
  readonly label: string;
}[] = [
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
                  ? {
                      ...appearancePreference,
                      syncWithOs: true,
                    }
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
                onSettingsChange({
                  ...settings,
                  keymapPreset: value,
                });
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
          <Button
            data-slot="button"
            onClick={onClose}
            type="button"
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-8 px-3 border-primary bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/80",
            )}
          >
            Close
          </Button>
        </footer>
      </section>
    </Dialog>
  );
}
