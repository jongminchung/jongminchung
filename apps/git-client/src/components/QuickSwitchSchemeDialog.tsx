import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import type {
    AppearancePreference,
    AppearanceTheme,
} from "../domain/appearance";
import {
    isProductKeymapPreset,
    type ProductKeymapPreset,
    type ProductSettings,
    type ProductZoom,
} from "../domain/productSettings";
import { RadioList, RadioListItem } from "./ProductCollections";
import { Dialog, DialogHeader } from "./ProductDialog";
import { Selector } from "./ProductFormControls";

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
    readonly onAppearancePreferenceChange: (
        preference: AppearancePreference,
    ) => void;
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
            <section
                className={`quickSwitchSchemeDialog [display:grid] [gap:10px] [grid-template-columns:1fr_1fr] [padding-bottom:12px] [&>_*:not(:first-child)]:[margin-left:12px] [&>_*:not(:first-child)]:[margin-right:12px] [&>_header]:[grid-column:1_/_3] [&>_div:first-of-type]:[grid-column:1_/_3] [&_h3]:[font-size:11px] [&_h3]:[margin:0_0_5px] [&_select]:[background:var(--secondary)] [&_select]:[border:1px_solid_var(--border)] [&_select]:rounded-sm [&_select]:[color:var(--foreground)] [&_select]:[height:28px] [&_select]:[width:100%] [&>_footer]:[border-top:1px_solid_var(--border)] [&>_footer]:[display:flex] [&>_footer]:[grid-column:1_/_3] [&>_footer]:[justify-content:flex-end] [&>_footer]:[margin-left:0]! [&>_footer]:[margin-right:0]! [&>_footer]:[padding:10px_12px_0] quickSwitchSchemeDialog [&_select]:rounded-sm`}
            >
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
                            const selection = THEMES.find(
                                (theme) => theme.value === value,
                            )?.value;
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
                        value={
                            appearancePreference.syncWithOs
                                ? "system"
                                : appearancePreference.theme
                        }
                    >
                        {THEMES.map((theme) => (
                            <RadioListItem
                                key={theme.value}
                                label={theme.label}
                                value={theme.value}
                            />
                        ))}
                    </RadioList>
                </div>
                <div>
                    <h3>Keymap</h3>
                    <Selector
                        isLabelHidden
                        label="Keymap"
                        onChange={(value) => {
                            if (isProductKeymapPreset(value)) {
                                onSettingsChange({
                                    ...settings,
                                    keymapPreset: value,
                                });
                            }
                        }}
                        options={KEYMAPS.map((keymap) => ({
                            label: keymap,
                            value: keymap,
                        }))}
                        value={settings.keymapPreset}
                    />
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
                        onClick={onClose}
                        type="button"
                        className={cn("h-8 px-3")}
                        variant="default"
                        size="default"
                    >
                        Close
                    </Button>
                </footer>
            </section>
        </Dialog>
    );
}
