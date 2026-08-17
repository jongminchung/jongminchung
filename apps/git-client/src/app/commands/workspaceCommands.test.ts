import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    setWorkbenchEventPort,
    type WorkbenchEventPort,
} from "../../application/workbench-events/WorkbenchEventPort";
import type { AppDialogController } from "../../components/AppDialog";
import {
    COMMAND_MANIFEST,
    type CommandDefinition,
} from "../../domain/commands";
import { DEFAULT_PRODUCT_SETTINGS } from "../../domain/productSettings";
import {
    createAppearanceCommands,
    type AppearanceCommandPort,
} from "./appearanceCommands";
import { createHelpCommands, type HelpCommandPort } from "./helpCommands";
import { createLayoutCommands, type LayoutCommandPort } from "./layoutCommands";
import { createMacroCommands, type MacroCommandPort } from "./macroCommands";
import {
    createProjectCommands,
    type ProjectCommandPort,
} from "./projectCommands";

vi.mock("../../platform/electron", () => ({
    isElectronRuntime: () => true,
}));

vi.mock("../../platform/electronActions", () => ({
    collectDiagnosticLogs: vi.fn(async () => undefined),
    dumpDiagnosticThreads: vi.fn(async () => undefined),
    getElectronFullScreen: vi.fn(async () => false),
    openKeyboardShortcutsPdf: vi.fn(async () => undefined),
    revealDiagnosticPath: vi.fn(async () => undefined),
    setElectronFullScreen: vi.fn(async () => undefined),
    writeDiagnosticConfiguration: vi.fn(async () => undefined),
}));

vi.mock("../../platform/electronSettings", () => ({
    exportElectronSettings: vi.fn(async () => undefined),
}));

const fallback = new Proxy(vi.fn(), {
    get: () => fallback,
});

function fakePort<Port extends object>(overrides: Partial<Port>): Port {
    return new Proxy(overrides, {
        get: (target, key) =>
            Reflect.has(target, key) ? Reflect.get(target, key) : fallback,
    }) as Port;
}

const dialog: AppDialogController = {
    confirm: vi.fn(async () => false),
    input: vi.fn(async () => null),
    node: null,
};

function workspaceCommandDefinitions(): readonly CommandDefinition[] {
    const activeTab = { kind: "welcome" } as const;
    return [
        ...createProjectCommands(
            fakePort<ProjectCommandPort>({
                dialog,
                dirtyEditorCount: 0,
                importSettingsArchive: vi.fn(async () => undefined),
                openRepositoryFromPicker: vi.fn(async () => undefined),
                session: {
                    repository: { repository: null },
                    workspace: {
                        activeTab,
                        closeProject: vi.fn(async () => undefined),
                        openRepositories: [],
                        sessions: [],
                    },
                },
            }),
        ),
        ...createLayoutCommands(
            fakePort<LayoutCommandPort>({
                activeProjectName: "Git Client",
                applyToolWindowLayout: vi.fn(),
                captureToolWindowLayout: vi.fn(() => null),
                dialog,
                renameToolWindowLayout: vi.fn(async () => undefined),
                saveToolWindowLayout: vi.fn(),
                session: { workspace: { activeTab } },
                toolWindowLayouts: [],
            }),
        ),
        ...createHelpCommands(fakePort<HelpCommandPort>({ dialog })),
        ...createMacroCommands(
            fakePort<MacroCommandPort>({
                commands: fakePort<MacroCommandPort["commands"]>({
                    execute: vi.fn(async () => undefined),
                }),
                dialog,
                lastMacro: null,
                macroRecording: false,
                recordedCommandIds: [],
                savedMacros: [],
            }),
        ),
        ...createAppearanceCommands(
            fakePort<AppearanceCommandPort>({
                dialog,
                presentationPreviousFullScreen: { current: false },
                productSettings: DEFAULT_PRODUCT_SETTINGS,
                session: { workspace: { activeTab } },
                zenPreviousFullScreen: { current: false },
            }),
        ),
    ];
}

describe("작업 공간이 가능함", () => {
    let uninstallWorkbenchEvents: () => void;

    beforeEach(() => {
        const target = new EventTarget() as Window & typeof globalThis;
        Object.assign(target, { focus: vi.fn() });
        vi.stubGlobal("window", target);
        const events: WorkbenchEventPort = {
            dispatch: (name, detail, options = {}) =>
                target.dispatchEvent(
                    new CustomEvent(name, {
                        cancelable: options.cancelable,
                        detail,
                    }),
                ),
            listen: (name, listener) => {
                const handle = (event: Event): void =>
                    listener((event as CustomEvent).detail, {
                        preventDefault: () => event.preventDefault(),
                    });
                target.addEventListener(name, handle);
                return () => target.removeEventListener(name, handle);
            },
        };
        uninstallWorkbenchEvents = setWorkbenchEventPort(events);
    });

    afterEach(() => {
        uninstallWorkbenchEvents();
        vi.unstubAllGlobals();
    });

    it("[성공] 매칭 매니페스트의 모든 퍼즐을 해결함", () => {
        const definitions = workspaceCommandDefinitions();
        const manifestIds = new Set(
            COMMAND_MANIFEST.commands.map((entry) => entry.id),
        );

        expect(definitions.every(({ id }) => manifestIds.has(id))).toBe(true);
        expect(new Set(definitions.map(({ id }) => id)).size).toBe(
            definitions.length,
        );
    });

    it("[성공] 모든 압축기에 대한 가용성 및 확인된 상태를 평가함", () => {
        for (const definition of workspaceCommandDefinitions()) {
            expect(
                ["enabled", "disabled"],
                `${definition.id} availability`,
            ).toContain(definition.availability().status);
            if (definition.checked) {
                expect(
                    typeof definition.checked(),
                    `${definition.id} checked state`,
                ).toBe("boolean");
            }
        }
    });

    it("[성공] 좁은 쉬크 포트에 대해 모든 범위를 실행함", async () => {
        for (const definition of workspaceCommandDefinitions()) {
            try {
                await definition.execute();
            } catch (error) {
                throw new Error(`Command ${definition.id} failed`, {
                    cause: error,
                });
            }
        }
    });
});
