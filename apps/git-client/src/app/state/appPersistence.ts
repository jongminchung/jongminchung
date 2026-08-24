import {
  storedAppearancePreference,
  type AppearancePreference,
} from "../../domain/appearance";
import {
  parseSavedMacros,
  SAVED_MACROS_KEY,
  type SavedMacro,
} from "../../domain/macros";
import {
  parseProductSettings,
  PRODUCT_SETTINGS_KEY,
  type ProductSettings,
} from "../../domain/productSettings";
import {
  parseRunConfigurationTemplates,
  RUN_CONFIGURATION_TEMPLATES_KEY,
  type RunConfigurationTemplate,
} from "../../domain/runConfigurationTemplates";
import {
  parseNamedToolWindowLayouts,
  TOOL_WINDOW_LAYOUT_KEY,
  type NamedToolWindowLayout,
} from "../../domain/toolWindowLayouts";
import {
  readElectronSetting,
  writeElectronSettings,
} from "../../platform/electronSettings";

const NEW_PROJECT_SETTINGS_KEY = "newProjectProductSettings";
const NEW_PROJECT_APPEARANCE_KEY = "newProjectAppearanceMode";

export interface ProjectDefaultsSnapshot {
  readonly settings: ProductSettings;
  readonly appearance: AppearancePreference;
  readonly templates: readonly RunConfigurationTemplate[];
}

export async function hydrateProductSettings(): Promise<ProductSettings> {
  return parseProductSettings(await readElectronSetting(PRODUCT_SETTINGS_KEY));
}

export async function persistProductSettings(
  settings: ProductSettings,
): Promise<void> {
  await writeElectronSettings({ [PRODUCT_SETTINGS_KEY]: settings });
}

export async function hydrateToolWindowLayouts(): Promise<
  readonly NamedToolWindowLayout[]
> {
  return parseNamedToolWindowLayouts(
    await readElectronSetting(TOOL_WINDOW_LAYOUT_KEY),
  );
}

export async function persistToolWindowLayouts(
  layouts: readonly NamedToolWindowLayout[],
): Promise<void> {
  await writeElectronSettings({ [TOOL_WINDOW_LAYOUT_KEY]: layouts });
}

export async function hydrateSavedMacros(): Promise<readonly SavedMacro[]> {
  return parseSavedMacros(await readElectronSetting(SAVED_MACROS_KEY));
}

export async function persistSavedMacros(
  macros: readonly SavedMacro[],
): Promise<void> {
  await writeElectronSettings({ [SAVED_MACROS_KEY]: macros });
}

export async function hydrateProjectDefaults(): Promise<ProjectDefaultsSnapshot> {
  const [settings, appearance, templates] = await Promise.all([
    readElectronSetting(NEW_PROJECT_SETTINGS_KEY),
    readElectronSetting(NEW_PROJECT_APPEARANCE_KEY),
    readElectronSetting(RUN_CONFIGURATION_TEMPLATES_KEY),
  ]);
  return {
    settings: parseProductSettings(settings),
    appearance: storedAppearancePreference(appearance),
    templates: parseRunConfigurationTemplates(templates),
  };
}

export async function persistProjectDefaults(
  snapshot: ProjectDefaultsSnapshot,
): Promise<void> {
  await writeElectronSettings({
    [NEW_PROJECT_SETTINGS_KEY]: snapshot.settings,
    [NEW_PROJECT_APPEARANCE_KEY]: snapshot.appearance,
    [RUN_CONFIGURATION_TEMPLATES_KEY]: snapshot.templates,
  });
}
