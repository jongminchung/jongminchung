import { Button } from "@jongminchung/ui/components/button";
import { ScrollArea } from "@jongminchung/ui/components/scroll-area";
import { Table, TableBody, TableCell, TableRow } from "@jongminchung/ui/components/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@jongminchung/ui/components/tabs";
import { cn } from "@jongminchung/ui/lib/utils";
import { useMemo, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { AppearancePreference, AppearanceTheme } from "../domain/appearance";
import {
  COMMAND_MANIFEST,
  acceleratorFromKeyboardEvent,
  displayAccelerator,
  normalizeAccelerator,
  resolvedAccelerator,
} from "../domain/commands";
import { isProductKeymapPreset } from "../domain/productSettings";
import { type ProductSettings, type ProductZoom } from "../domain/productSettings";
import { useAppearance } from "./AppearanceProvider";
import { Icon } from "./Icon";
import { Notice } from "./Notice";
import { RadioList, RadioListItem } from "./ProductCollections";
import { Dialog, DialogHeader } from "./ProductDialog";
import { CheckboxInput, Selector, TextInput } from "./ProductFormControls";

type SettingsSection = "appearance" | "keymap" | "versionControl" | "notifications";

function isSettingsSection(value: unknown): value is SettingsSection {
  return (
    value === "appearance" ||
    value === "keymap" ||
    value === "versionControl" ||
    value === "notifications"
  );
}

const APPEARANCE_MODES: readonly {
  readonly value: AppearanceTheme | "system";
  readonly label: string;
}[] = [
  { value: "system", label: "Sync with OS" },
  { value: "light", label: "Islands Light" },
  { value: "dark", label: "Islands Dark" },
];

export function SettingsDialog({
  appearancePreference,
  isOpen,
  onClose,
  onAppearancePreferenceChange,
  onOpenRepositorySettings,
  onSettingsChange,
  settings,
  showRepositorySettings = true,
  title = "Settings",
}: {
  readonly appearancePreference?: AppearancePreference;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onAppearancePreferenceChange?: (preference: AppearancePreference) => void;
  readonly onOpenRepositorySettings?: () => void;
  readonly onSettingsChange: (settings: ProductSettings) => void;
  readonly settings: ProductSettings;
  readonly showRepositorySettings?: boolean;
  readonly title?: string;
}) {
  const appearance = useAppearance();
  const preference = appearancePreference ?? appearance.preference;
  const setPreference = onAppearancePreferenceChange ?? appearance.setPreference;
  const appearanceSelection = preference.syncWithOs ? "system" : preference.theme;
  const [section, setSection] = useState<SettingsSection>("appearance");
  const [keymapFilter, setKeymapFilter] = useState("");
  const [capturingCommand, setCapturingCommand] = useState<string>();
  const [keymapError, setKeymapError] = useState<string>();

  const filteredCommands = useMemo(() => {
    const query = keymapFilter.trim().toLocaleLowerCase();
    return COMMAND_MANIFEST.commands.filter(
      (command) =>
        !query ||
        `${command.label} ${command.id} ${command.category}`.toLocaleLowerCase().includes(query),
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
        keymapOverrides: {
          ...settings.keymapOverrides,
          [commandId]: null,
        },
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
        normalizeAccelerator(resolvedAccelerator(command, settings.keymapOverrides) ?? "") ===
          normalizeAccelerator(accelerator),
    );
    if (conflict) {
      setKeymapError(
        `${displayAccelerator(accelerator)} is already assigned to ${conflict.label}.`,
      );
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
      <section
        className={`settingsDialog [display:grid] [grid-template-columns:230px_minmax(0,_1fr)] [grid-template-rows:auto_minmax(0,_1fr)_auto] [height:min(680px,_calc(100vh_-_70px))] [min-height:0] [&>_[data-slot=dialog-header]]:[grid-column:1/-1] [&>_aside]:[background:var(--muted)] [&>_aside]:[border-right:1px_solid_var(--border)] [&>_aside]:[display:flex] [&>_aside]:[flex-direction:column] [&>_aside]:[gap:2px] [&>_aside]:[padding:7px] [&>_aside_button]:[align-items:center] [&>_aside_button]:[background:transparent] [&>_aside_button]:[display:flex] [&>_aside_button]:[gap:8px] [&>_aside_button]:[height:31px] [&>_aside_button]:[padding:0_8px] [&>_aside_button]:[text-align:left] [&>_main]:[min-height:0] [&>_main]:[overflow:auto] [&>_footer]:[border-top:1px_solid_var(--border)] [&>_footer]:[display:flex] [&>_footer]:[grid-column:1/-1] [&>_footer]:[justify-content:flex-end] [&>_footer]:[padding:8px_12px] settingsDialog`}
      >
        <DialogHeader hasDivider onOpenChange={(open) => !open && onClose()} title={title} />
        <Tabs
          className="contents"
          onValueChange={(value) => {
            if (isSettingsSection(value)) setSection(value);
          }}
          orientation="vertical"
          value={section}
        >
          <TabsList aria-label="Settings categories" render={<aside />}>
            <TabsTrigger
              value="appearance"
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent text-xs text-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-7 px-2.5 text-muted-foreground data-active:bg-accent data-active:text-foreground",
              )}
            >
              <Icon name="appearance" size={15} /> Appearance & Behavior
            </TabsTrigger>
            <TabsTrigger
              value="keymap"
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent text-xs text-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-7 px-2.5 text-muted-foreground data-active:bg-accent data-active:text-foreground",
              )}
            >
              <Icon name="settings" size={15} /> Keymap
            </TabsTrigger>
            <TabsTrigger
              value="versionControl"
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent text-xs text-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-7 px-2.5 text-muted-foreground data-active:bg-accent data-active:text-foreground",
              )}
            >
              <Icon name="branch" size={15} /> Version Control
            </TabsTrigger>
            <TabsTrigger
              value="notifications"
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent text-xs text-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-7 px-2.5 text-muted-foreground data-active:bg-accent data-active:text-foreground",
              )}
            >
              <Icon name="warning" size={15} /> Notifications
            </TabsTrigger>
          </TabsList>
          <TabsContent render={<main />} value="appearance">
            <div
              className={`settingsPage [display:flex] [flex-direction:column] [gap:14px] [padding:18px_20px] [&>_h2]:[font-size:16px] [&>_h2]:[margin:0] [&>_p]:[color:var(--muted-foreground)] [&>_p]:[line-height:1.5] [&>_p]:[margin:0] settingsPage`}
            >
              <h2>Appearance</h2>
              <RadioList
                label="Theme"
                onChange={(value) => {
                  const selection = APPEARANCE_MODES.find((item) => item.value === value)?.value;
                  if (selection === undefined) return;
                  setPreference(
                    selection === "system"
                      ? {
                          theme: appearance.systemTheme,
                          syncWithOs: true,
                        }
                      : {
                          theme: selection,
                          syncWithOs: false,
                        },
                  );
                }}
                value={appearanceSelection}
              >
                {APPEARANCE_MODES.map((item) => (
                  <RadioListItem key={item.value} label={item.label} value={item.value} />
                ))}
              </RadioList>
              <CheckboxInput
                label="Compact mode"
                onChange={(compactMode) =>
                  onSettingsChange({
                    ...settings,
                    compactMode,
                  })
                }
                value={settings.compactMode}
              />
              <CheckboxInput
                label="Adjust colors for red-green vision deficiency"
                onChange={(adjustRedGreenVision) =>
                  onSettingsChange({
                    ...settings,
                    adjustRedGreenVision,
                  })
                }
                value={settings.adjustRedGreenVision}
              />
              <Selector
                label="IDE font"
                onChange={(value) =>
                  onSettingsChange({
                    ...settings,
                    ideFontSize: Number(value),
                  })
                }
                options={[8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72].map(
                  (size) => ({ label: size.toFixed(1), value: String(size) }),
                )}
                value={String(settings.ideFontSize)}
              />
              <Selector
                label="Editor font"
                onChange={(value) =>
                  onSettingsChange({
                    ...settings,
                    editorFontSize: Number(value),
                  })
                }
                options={[8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72].map(
                  (size) => ({ label: size.toFixed(1), value: String(size) }),
                )}
                value={String(settings.editorFontSize)}
              />
              <RadioList
                label="IDE zoom"
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
          </TabsContent>
          <TabsContent render={<main />} value="keymap">
            <div
              className={`settingsPage [display:flex] [flex-direction:column] [gap:14px] [padding:18px_20px] [&>_h2]:[font-size:16px] [&>_h2]:[margin:0] [&>_p]:[color:var(--muted-foreground)] [&>_p]:[line-height:1.5] [&>_p]:[margin:0] settingsPage`}
            >
              <h2>Keymap</h2>
              <Selector
                label="Keymap"
                onChange={(value) => {
                  if (isProductKeymapPreset(value)) {
                    onSettingsChange({
                      ...settings,
                      keymapPreset: value,
                    });
                  }
                }}
                options={[
                  "macOS",
                  "Emacs",
                  "IntelliJ IDEA Classic",
                  "macOS System Shortcuts",
                  "Sublime Text",
                  "Sublime Text (macOS)",
                ].map((value) => ({ label: value, value }))}
                value={settings.keymapPreset}
              />
              <TextInput
                isLabelHidden
                label="Search keymap"
                onChange={setKeymapFilter}
                placeholder="Search actions"
                value={keymapFilter}
                width="100%"
              />
              {keymapError && (
                <Notice
                  className="rounded-none px-3.5 py-1.5"
                  role="alert"
                  size="sm"
                  tone="destructive"
                >
                  {keymapError}
                </Notice>
              )}
              <ScrollArea className="min-h-0 flex-1 rounded-lg border border-border">
                <Table aria-label="Keymap actions" className="table-fixed text-xs">
                  <TableBody>
                    {filteredCommands.map((command) => (
                      <TableRow className="h-[39px]" key={command.id}>
                        <TableCell className="w-auto min-w-0 py-1">
                          <span className="grid min-w-0">
                            <strong>{command.label}</strong>
                            <small className="truncate text-[9px] text-muted-foreground">
                              {command.id}
                            </small>
                          </span>
                        </TableCell>
                        <TableCell className="w-[130px] py-1">
                          <Button
                            aria-label={`Shortcut for ${command.label}`}
                            onClick={() => setCapturingCommand(command.id)}
                            onKeyDown={(event) =>
                              capturingCommand === command.id && captureShortcut(command.id, event)
                            }
                            type="button"
                            className="h-[26px] w-full justify-start font-mono"
                            variant="outline"
                            size="sm"
                          >
                            {capturingCommand === command.id
                              ? "Press shortcut…"
                              : displayAccelerator(
                                  resolvedAccelerator(command, settings.keymapOverrides),
                                ) || "—"}
                          </Button>
                        </TableCell>
                        <TableCell className="w-[58px] py-1">
                          {Object.hasOwn(settings.keymapOverrides, command.id) ? (
                            <Button
                              aria-label={`Reset shortcut for ${command.label}`}
                              onClick={() => {
                                const keymapOverrides = {
                                  ...settings.keymapOverrides,
                                };
                                delete keymapOverrides[command.id];
                                onSettingsChange({
                                  ...settings,
                                  keymapOverrides,
                                });
                              }}
                              type="button"
                              className="h-[26px] px-2"
                              variant="outline"
                              size="sm"
                            >
                              Reset
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </TabsContent>
          <TabsContent render={<main />} value="versionControl">
            <div
              className={`settingsPage [display:flex] [flex-direction:column] [gap:14px] [padding:18px_20px] [&>_h2]:[font-size:16px] [&>_h2]:[margin:0] [&>_p]:[color:var(--muted-foreground)] [&>_p]:[line-height:1.5] [&>_p]:[margin:0] settingsPage`}
            >
              <h2>Version Control</h2>
              {showRepositorySettings && onOpenRepositorySettings ? (
                <>
                  <p>
                    Configure Git remotes, worktrees, submodules, ignore rules, and repository-local
                    Git config.
                  </p>
                  <Button
                    onClick={onOpenRepositorySettings}
                    type="button"
                    className={cn("h-8 px-3")}
                    variant="outline"
                    size="default"
                  >
                    Open Repository Settings
                  </Button>
                </>
              ) : (
                <p>
                  These defaults are applied when a project is opened for the first time.
                  Repository-local Git settings remain project-specific.
                </p>
              )}
            </div>
          </TabsContent>
          <TabsContent render={<main />} value="notifications">
            <div
              className={`settingsPage [display:flex] [flex-direction:column] [gap:14px] [padding:18px_20px] [&>_h2]:[font-size:16px] [&>_h2]:[margin:0] [&>_p]:[color:var(--muted-foreground)] [&>_p]:[line-height:1.5] [&>_p]:[margin:0] settingsPage`}
            >
              <h2>Notifications</h2>
              <CheckboxInput
                label="Show operation notifications"
                onChange={(showNotifications) =>
                  onSettingsChange({
                    ...settings,
                    showNotifications,
                  })
                }
                value={settings.showNotifications}
              />
              <CheckboxInput
                label="Show macOS shortcut conflict warning"
                onChange={(showShortcutConflictWarning) =>
                  onSettingsChange({
                    ...settings,
                    showShortcutConflictWarning,
                  })
                }
                value={settings.showShortcutConflictWarning}
              />
              <p>
                Failures remain visible in the status bar and Git Console even when pop-up
                notifications are hidden.
              </p>
            </div>
          </TabsContent>
        </Tabs>
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
