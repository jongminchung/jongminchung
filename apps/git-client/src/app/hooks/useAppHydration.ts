import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppearance } from "../../components/AppearanceProvider";
import { synchronizeAppearancePreference } from "../../domain/appearance";
import {
  hydrateProductSettings,
  hydrateProjectDefaults,
  hydrateSavedMacros,
  hydrateToolWindowLayouts,
  persistProductSettings,
  persistProjectDefaults,
  persistSavedMacros,
  persistToolWindowLayouts,
} from "../state/appPersistence";
import { useAppStore } from "../state/AppStoreProvider";

export function useAppHydration(): void {
  const systemTheme = useAppearance().systemTheme;
  const state = useAppStore(
    useShallow((store) => ({
      macroRecording: store.macroRecording,
      newProjectAppearancePreference: store.newProjectAppearancePreference,
      newProjectSettings: store.newProjectSettings,
      productSettings: store.productSettings,
      projectDefaultsLoaded: store.projectDefaultsLoaded,
      productSettingsLoaded: store.productSettingsLoaded,
      runConfigurationTemplates: store.runConfigurationTemplates,
      savedMacros: store.savedMacros,
      savedMacrosLoaded: store.savedMacrosLoaded,
      toolWindowLayouts: store.toolWindowLayouts,
      toolWindowLayoutsLoaded: store.toolWindowLayoutsLoaded,
      setNewProjectAppearancePreference: store.setNewProjectAppearancePreference,
      setNewProjectSettings: store.setNewProjectSettings,
      setProductSettings: store.setProductSettings,
      setProjectDefaultsLoaded: store.setProjectDefaultsLoaded,
      setProductSettingsLoaded: store.setProductSettingsLoaded,
      setRecordedCommandIds: store.setRecordedCommandIds,
      setRunConfigurationTemplates: store.setRunConfigurationTemplates,
      setSavedMacros: store.setSavedMacros,
      setSavedMacrosLoaded: store.setSavedMacrosLoaded,
      setToolWindowLayouts: store.setToolWindowLayouts,
      setToolWindowLayoutsLoaded: store.setToolWindowLayoutsLoaded,
    })),
  );
  const {
    macroRecording,
    newProjectAppearancePreference,
    newProjectSettings,
    productSettings,
    projectDefaultsLoaded,
    productSettingsLoaded,
    runConfigurationTemplates,
    savedMacros,
    savedMacrosLoaded,
    toolWindowLayouts,
    toolWindowLayoutsLoaded,
    setNewProjectAppearancePreference,
    setNewProjectSettings,
    setProductSettings,
    setProjectDefaultsLoaded,
    setProductSettingsLoaded,
    setRecordedCommandIds,
    setRunConfigurationTemplates,
    setSavedMacros,
    setSavedMacrosLoaded,
    setToolWindowLayouts,
    setToolWindowLayoutsLoaded,
  } = state;

  useEffect(() => {
    let active = true;
    void hydrateProductSettings()
      .then((value) => {
        if (active) setProductSettings(value);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setProductSettingsLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [setProductSettings, setProductSettingsLoaded]);

  useEffect(() => {
    let active = true;
    void hydrateToolWindowLayouts()
      .then((value) => {
        if (active) setToolWindowLayouts(value);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setToolWindowLayoutsLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [setToolWindowLayouts, setToolWindowLayoutsLoaded]);

  useEffect(() => {
    if (!toolWindowLayoutsLoaded) return;
    void persistToolWindowLayouts(toolWindowLayouts);
  }, [toolWindowLayouts, toolWindowLayoutsLoaded]);

  useEffect(() => {
    let active = true;
    void hydrateSavedMacros()
      .then((value) => {
        if (active) setSavedMacros(value);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setSavedMacrosLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [setSavedMacros, setSavedMacrosLoaded]);

  useEffect(() => {
    if (!savedMacrosLoaded) return;
    void persistSavedMacros(savedMacros);
  }, [savedMacros, savedMacrosLoaded]);

  useEffect(() => {
    if (!macroRecording) return;
    const recordCommand = (event: Event): void => {
      if (!(event instanceof CustomEvent)) return;
      const commandId = event.detail?.id;
      if (
        typeof commandId !== "string" ||
        commandId === "edit.startMacroRecording" ||
        commandId === "edit.playbackLastMacro" ||
        commandId === "edit.playSavedMacros"
      )
        return;
      setRecordedCommandIds((current) =>
        current.length >= 1_000 ? current : [...current, commandId],
      );
    };
    window.addEventListener("git-client:command-executed", recordCommand);
    return () => window.removeEventListener("git-client:command-executed", recordCommand);
  }, [macroRecording, setRecordedCommandIds]);

  useEffect(() => {
    let active = true;
    void hydrateProjectDefaults()
      .then(
        ({ settings, appearance, templates }) => {
          if (!active) return;
          setNewProjectSettings(settings);
          setNewProjectAppearancePreference(appearance);
          setRunConfigurationTemplates(templates);
        },
        () => undefined,
      )
      .finally(() => {
        if (active) setProjectDefaultsLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [
    setNewProjectSettings,
    setRunConfigurationTemplates,
    setNewProjectAppearancePreference,
    setProjectDefaultsLoaded,
  ]);

  useEffect(() => {
    if (
      !newProjectAppearancePreference.syncWithOs ||
      newProjectAppearancePreference.theme === systemTheme
    )
      return;
    setNewProjectAppearancePreference((current) =>
      synchronizeAppearancePreference(current, systemTheme),
    );
  }, [
    newProjectAppearancePreference.syncWithOs,
    newProjectAppearancePreference.theme,
    systemTheme,
    setNewProjectAppearancePreference,
  ]);

  useEffect(() => {
    if (!projectDefaultsLoaded) return;
    void persistProjectDefaults({
      settings: newProjectSettings,
      appearance: newProjectAppearancePreference,
      templates: runConfigurationTemplates,
    });
  }, [
    newProjectAppearancePreference,
    newProjectSettings,
    projectDefaultsLoaded,
    runConfigurationTemplates,
  ]);

  useEffect(() => {
    if (!productSettingsLoaded) return;
    const root = document.documentElement;
    root.dataset.compact = productSettings.compactMode ? "true" : "false";
    root.dataset.presentationMode = String(productSettings.presentationMode);
    root.dataset.distractionFreeMode = String(
      productSettings.distractionFreeMode || productSettings.zenMode,
    );
    root.dataset.zenMode = String(productSettings.zenMode);
    root.dataset.toolbarVisible = String(productSettings.toolbarVisible);
    root.dataset.navigationBar = productSettings.navigationBar;
    root.dataset.toolWindowBarsVisible = String(productSettings.toolWindowBarsVisible);
    root.dataset.statusBarVisible = String(productSettings.statusBarVisible);
    root.dataset.adjustRedGreenVision = String(productSettings.adjustRedGreenVision);
    root.dataset.powerSaveMode = String(productSettings.powerSaveMode);
    root.dataset.bidiTextDirection = productSettings.bidiTextDirection;
    root.style.setProperty(
      "--product-zoom",
      String(
        (productSettings.zoom / 100) *
          (productSettings.presentationMode ? 24 / productSettings.ideFontSize : 1),
      ),
    );
    root.style.setProperty("--font-size-base", `${productSettings.ideFontSize}px`);
    root.style.setProperty("--editor-font-size", `${productSettings.editorFontSize}px`);
    window.dispatchEvent(
      new CustomEvent("git-client:keymap-changed", {
        detail: productSettings.keymapOverrides,
      }),
    );
    window.dispatchEvent(
      new CustomEvent("git-client:product-settings-changed", {
        detail: productSettings,
      }),
    );
    void persistProductSettings(productSettings);
  }, [productSettings, productSettingsLoaded]);

  useEffect(() => {
    const handleRequest = (event: Event): void => {
      if (event instanceof CustomEvent && event.detail?.kind === "toggleCompact") {
        setProductSettings((current) => ({
          ...current,
          compactMode: !current.compactMode,
        }));
      }
    };
    window.addEventListener("git-client:product-settings-request", handleRequest);
    return () => window.removeEventListener("git-client:product-settings-request", handleRequest);
  }, [setProductSettings]);
}
