import { isAppearanceMode, type AppearanceMode } from "../domain/appearance";
import { isProductKeymapPreset } from "../domain/productSettings";
import type { ProductSettings } from "../domain/productSettings";
import { tw } from "../styles/tailwind";
import { writeClipboardText } from "../platform/nativeActions";
import { Icon } from "./Icon";
import { useState } from "react";

type WelcomeSection = "projects" | "customize" | "plugins";

const IDE_FONT_SIZES = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72] as const;

function sectionLabel(section: WelcomeSection): string {
    if (section === "projects") return "Projects";
    if (section === "customize") return "Customize";
    return "Plugins";
}

export function WelcomeWorkspace({
    appearanceMode,
    onAppearanceModeChange,
    onCloneRepository,
    onNewProject,
    onOpenRepository,
    onOpenRecent,
    onOpenSettings,
    onImportSettings,
    onProductSettingsChange,
    productSettings,
    recentRepositories,
}: {
    readonly appearanceMode: AppearanceMode;
    readonly onAppearanceModeChange: (mode: AppearanceMode) => void;
    readonly onCloneRepository: () => void;
    readonly onNewProject: () => void;
    readonly onOpenRepository: () => void;
    readonly onOpenRecent: (path: string) => void;
    readonly onOpenSettings: () => void;
    readonly onImportSettings: () => void;
    readonly onProductSettingsChange: (settings: ProductSettings) => void;
    readonly productSettings: ProductSettings;
    readonly recentRepositories: readonly string[];
}) {
    const [section, setSection] = useState<WelcomeSection>("projects");

    const updateProductSettings = (
        update: Partial<
            Pick<
                ProductSettings,
                | "compactMode"
                | "ideFontSize"
                | "keymapPreset"
                | "adjustRedGreenVision"
            >
        >,
    ): void => onProductSettingsChange({ ...productSettings, ...update });

    return (
        <main className={tw.welcomeWorkspace}>
            <aside aria-label="Welcome screen categories" className={tw.welcomeSidebar}>
                <div
                    className={`${tw.welcomeBrand} ${section === "projects" ? "" : tw.welcomeBrandHidden}`}
                >
                    <a
                        aria-label="Copy About"
                        className={tw.welcomeBrandMark}
                        href="#copy-about"
                        onClick={(event) => {
                            event.preventDefault();
                            void writeClipboardText("Git Client 0.1.0");
                        }}
                    >
                        <Icon name="branch" size={19} />
                    </a>
                    <span>
                        <strong>Git Client</strong>
                        <small>0.1.0</small>
                    </span>
                </div>
                <nav aria-label="Welcome screen categories" role="tree">
                    {(["projects", "customize", "plugins"] as const).map(
                        (item) => (
                            <button
                                aria-current={section === item ? "page" : undefined}
                                aria-selected={section === item}
                                key={item}
                                onClick={() => setSection(item)}
                                role="treeitem"
                            >
                                {sectionLabel(item)}
                            </button>
                        ),
                    )}
                </nav>
                <button
                    aria-label="Options Menu"
                    className={tw.welcomeSettingsButton}
                    onClick={onOpenSettings}
                    title="Options Menu"
                >
                    <Icon name="settings" size={16} />
                </button>
            </aside>

            {section === "projects" && (
                <section aria-labelledby="welcome-title" className={tw.welcomeProjects}>
                    <header>
                        <h1 id="welcome-title">Welcome to Git Client</h1>
                        <p aria-readonly="true" role="textbox">
                            Create a new project to start from scratch.
                        </p>
                        <p aria-readonly="true" role="textbox">
                            Open existing project from disk or version control.
                        </p>
                    </header>
                    <div aria-label="Project actions" className={tw.welcomeProjectActions}>
                        <button onClick={onNewProject}>
                            <span><Icon name="plus" size={24} /></span>
                            New Project
                        </button>
                        <button onClick={onOpenRepository}>
                            <span><Icon name="folder" size={24} /></span>
                            Open
                        </button>
                        <button onClick={onCloneRepository}>
                            <span><Icon name="branch" size={24} /></span>
                            Clone Repository
                        </button>
                    </div>
                    {recentRepositories.length > 0 && (
                        <section aria-label="Recent Projects" className={tw.welcomeRecentProjects}>
                            <h2>Recent Projects</h2>
                            {recentRepositories.map((path) => {
                                const name = path.split("/").filter(Boolean).at(-1) ?? path;
                                return (
                                    <button key={path} onClick={() => onOpenRecent(path)}>
                                        <Icon name="folder" size={16} />
                                        <span><strong>{name}</strong><small>{path}</small></span>
                                    </button>
                                );
                            })}
                        </section>
                    )}
                    <button className={tw.welcomeMoreActions} onClick={onOpenSettings} role="link">
                        More Actions <Icon name="chevron" size={10} />
                    </button>
                </section>
            )}

            {section === "customize" && (
                <section aria-label="Customize" className={tw.welcomeCustomize}>
                    <h2>Appearance</h2>
                    <div className={tw.welcomeSettingGrid}>
                        <label htmlFor="welcome-theme">Theme:</label>
                        <select
                            aria-label="Appearance"
                            id="welcome-theme"
                            onChange={(event) => {
                                const value = event.currentTarget.value;
                                if (isAppearanceMode(value) && value !== "system") {
                                    onAppearanceModeChange(value);
                                }
                            }}
                            value={appearanceMode === "system" ? "dark" : appearanceMode}
                        >
                            <option value="dark">Islands Dark</option>
                            <option value="light">Islands Light</option>
                            <option value="darcula">Darcula</option>
                            <option value="highContrast">High Contrast</option>
                        </select>
                        <span className={tw.welcomeSettingActions}>
                            <label className={tw.welcomeInlineCheck}>
                                <input
                                    checked={appearanceMode === "system"}
                                    onChange={(event) =>
                                        onAppearanceModeChange(
                                            event.currentTarget.checked
                                                ? "system"
                                                : appearanceMode === "system"
                                                  ? "dark"
                                                  : appearanceMode,
                                        )
                                    }
                                    type="checkbox"
                                />
                                Sync with OS
                            </label>
                            <button
                                aria-label="Preferred Theme and Editor Color Scheme"
                                className={tw.welcomeSmallIconButton}
                                disabled
                            >
                                <Icon name="settings" size={15} />
                            </button>
                        </span>

                        <label className={tw.welcomeEditorSchemeLabel} htmlFor="welcome-editor-scheme">Editor color scheme:</label>
                        <select
                            id="welcome-editor-scheme"
                            value={appearanceMode === "system" ? "dark" : appearanceMode}
                            onChange={(event) => {
                                const value = event.currentTarget.value;
                                if (isAppearanceMode(value) && value !== "system") {
                                    onAppearanceModeChange(value);
                                }
                            }}
                        >
                            <option value="dark">Islands Dark — Theme default</option>
                            <option value="light">Islands Light — Theme default</option>
                            <option value="darcula">Darcula — Theme default</option>
                            <option value="highContrast">High Contrast — Theme default</option>
                        </select>
                        <button aria-label="Show Scheme Actions" className={`${tw.welcomeSmallIconButton} ${tw.welcomeEditorSchemeButton}`} onClick={onOpenSettings}>
                            <Icon name="settings" size={15} />
                        </button>
                    </div>

                    <h2>Language and Region</h2>
                    <div className={tw.welcomeSettingGrid}>
                        <label htmlFor="welcome-language">Language:</label>
                        <select defaultValue="English" id="welcome-language">
                            <option>English</option>
                        </select>
                        <small
                            aria-readonly="true"
                            className={tw.welcomeRestartHint}
                            role="textbox"
                        >
                            Requires restart
                        </small>
                        <label htmlFor="welcome-region">Region:</label>
                        <select defaultValue="Not specified" id="welcome-region">
                            <option>Not specified</option>
                        </select>
                        <span
                            aria-label="Region help"
                            className={`${tw.welcomeHelpButton} ${tw.welcomeRegionHelp}`}
                            role="img"
                            title="Region help"
                        >
                            ?
                        </span>
                    </div>

                    <h2>Accessibility</h2>
                    <div className={tw.welcomeSettingGrid}>
                        <label htmlFor="welcome-font-size">IDE font:</label>
                        <select
                            id="welcome-font-size"
                            onChange={(event) => updateProductSettings({ ideFontSize: Number(event.currentTarget.value) })}
                            value={productSettings.ideFontSize}
                        >
                            {IDE_FONT_SIZES.map((size) => <option key={size} value={size}>{size.toFixed(1)}</option>)}
                        </select>
                        <span />
                        <div className={tw.welcomeWideCheck}>
                            <input
                                aria-describedby="welcome-color-vision-help"
                                aria-label="Adjust colors for red-green vision deficiency"
                                checked={productSettings.adjustRedGreenVision}
                                onChange={(event) =>
                                    updateProductSettings({
                                        adjustRedGreenVision:
                                            event.currentTarget.checked,
                                    })
                                }
                                type="checkbox"
                            />
                            <span>
                                <span>
                                    Adjust colors for red-green vision deficiency
                                    <button
                                        className={tw.welcomeLinkButton}
                                        onClick={onOpenSettings}
                                        role="link"
                                    >
                                        How it works
                                    </button>
                                </span>
                                <small
                                    aria-readonly="true"
                                    id="welcome-color-vision-help"
                                    role="textbox"
                                >
                                    Requires restart. For protanopia and deuteranopia.
                                </small>
                            </span>
                        </div>
                    </div>

                    <h2>Keymap</h2>
                    <div className={`${tw.welcomeSettingGrid} ${tw.welcomeKeymapGrid}`}>
                        <label className={tw.srOnly} htmlFor="welcome-keymap">Keymap</label>
                        <select
                            id="welcome-keymap"
                            onChange={(event) => {
                                const value = event.currentTarget.value;
                                if (isProductKeymapPreset(value)) {
                                    updateProductSettings({ keymapPreset: value });
                                }
                            }}
                            value={productSettings.keymapPreset}
                        >
                            <option>macOS</option>
                            <option>Emacs</option>
                            <option>IntelliJ IDEA Classic</option>
                            <option>macOS System Shortcuts</option>
                            <option>Sublime Text</option>
                            <option>Sublime Text (macOS)</option>
                        </select>
                        <button className={tw.welcomeLinkButton} onClick={onOpenSettings} role="link">Configure…</button>
                    </div>
                    <button className={tw.welcomeLinkButton} onClick={onImportSettings} role="link">Import Settings…</button>
                    <button className={tw.welcomeLinkButton} onClick={onOpenSettings} role="link">All settings…</button>
                </section>
            )}

            {section === "plugins" && (
                <section aria-label="Plugins" className={tw.welcomePlugins}>
                    <h1>Plugins</h1>
                    <p>Git Client includes its supported Git, Terminal, GitHub, and GitLab features.</p>
                    <div>
                        {[
                            ["Git", "Version control, history, branches, changes, and recovery"],
                            ["Terminal", "Local PTY sessions in the repository working directory"],
                            ["GitHub", "Pull requests, reviews, discussions, and viewed state"],
                            ["GitLab", "Merge requests, reviews, discussions, and viewed state"],
                        ].map(([name, description]) => (
                            <article key={name}><strong>{name}</strong><p>{description}</p><span>Bundled</span></article>
                        ))}
                    </div>
                </section>
            )}
        </main>
    );
}
