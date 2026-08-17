import { describe, expect, it, vi } from "vitest";
import {
    COMMAND_ENABLED,
    COMMAND_MANIFEST,
    CommandRegistry,
    acceleratorFromKeyboardEvent,
    canHandleShortcut,
    commandDisabled,
    displayAccelerator,
    matchesKeyboardShortcut,
    parseCommandManifest,
    resolvedAccelerator,
    sortPaletteItems,
    selectDismissLayer,
    type CommandDefinition,
    type KeyboardEventLike,
    type PaletteItem,
} from "./commands";

const keyboardEvent = (
    overrides: Partial<KeyboardEventLike> = {},
): KeyboardEventLike => ({
    key: "p",
    metaKey: true,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    repeat: false,
    isComposing: false,
    ...overrides,
});

describe("키보드 매니페스트", () => {
    it("[성공] 고유한 ID를 가속 장치에 연결하기", () => {
        expect(COMMAND_MANIFEST.commands.length).toBeGreaterThan(15);
        expect(
            new Set(COMMAND_MANIFEST.commands.map((command) => command.id))
                .size,
        ).toBe(COMMAND_MANIFEST.commands.length);
        expect(displayAccelerator("CmdOrCtrl+Option+Shift+C")).toBe("⌥⇧⌘C");
        expect(displayAccelerator(null)).toBe("");
        expect(
            COMMAND_MANIFEST.commands.some(
                (command) => command.accelerator === "CmdOrCtrl+C",
            ),
        ).toBe(false);
    });

    it("[실패] 잘못된 형식의 외부 값을 있음", () => {
        expect(() =>
            parseCommandManifest({ schemaVersion: 2, commands: [] }),
        ).toThrow(/schema version/);
        expect(() =>
            parseCommandManifest({
                schemaVersion: 1,
                commands: [{ id: "bad" }],
            }),
        ).toThrow(/invalid/);
    });
});

describe("바로가기 매칭", () => {
    it("[성공]문자, Shift, 옵션 및 Enter를 사용하는 정규화함", () => {
        expect(matchesKeyboardShortcut(keyboardEvent(), "CmdOrCtrl+P")).toBe(
            true,
        );
        expect(
            matchesKeyboardShortcut(
                keyboardEvent({ key: "Enter", shiftKey: true }),
                "CmdOrCtrl+Shift+Enter",
            ),
        ).toBe(true);
        expect(
            matchesKeyboardShortcut(
                keyboardEvent({ key: "c", shiftKey: true, altKey: true }),
                "CmdOrCtrl+Option+Shift+C",
            ),
        ).toBe(true);
    });

    it("[성공] 사용자 키 맵 금융을 감시하고 해결함", () => {
        expect(
            acceleratorFromKeyboardEvent({
                key: "k",
                metaKey: true,
                ctrlKey: false,
                shiftKey: true,
                altKey: false,
            }),
        ).toBe("CmdOrCtrl+Shift+K");
        expect(
            acceleratorFromKeyboardEvent({
                key: "k",
                metaKey: false,
                ctrlKey: false,
                shiftKey: false,
                altKey: false,
            }),
        ).toBeNull();
        const project = COMMAND_MANIFEST.commands.find(
            (command) => command.id === "view.project",
        );
        expect(project).toBeDefined();
        if (!project) return;
        expect(
            resolvedAccelerator(project, { "view.project": null }),
        ).toBeNull();
        expect(
            resolvedAccelerator(project, {
                "view.project": "CmdOrCtrl+Shift+K",
            }),
        ).toBe("CmdOrCtrl+Shift+K");
    });

    it("[성공] IME 및 반복되는 돌연변이를 보호함", () => {
        const mutation = COMMAND_MANIFEST.commands.find(
            (command) => command.id === "repository.push",
        );
        expect(mutation).toBeDefined();
        if (!mutation) return;
        expect(
            canHandleShortcut(
                keyboardEvent({ isComposing: true }),
                mutation,
                null,
            ),
        ).toBe(false);
        expect(
            canHandleShortcut(keyboardEvent({ repeat: true }), mutation, null),
        ).toBe(false);
    });
});

describe("다루기", () => {
    it("[성공] 최신 상황별 처리 방법을 사용하고 모집된 이유를 보고함", async () => {
        const registry = CommandRegistry.create();
        const first = vi.fn();
        const second = vi.fn();
        const entry = COMMAND_MANIFEST.commands[0];
        expect(entry).toBeDefined();
        if (!entry) return;
        const definition = (
            execute: () => void,
            enabled = true,
        ): CommandDefinition => ({
            ...entry,
            execute,
            availability: () =>
                enabled ? COMMAND_ENABLED : commandDisabled("Not now"),
        });
        registry.register("one", [definition(first)]);
        registry.register("two", [definition(second, false)]);
        expect(await registry.execute(entry.id)).toEqual(
            commandDisabled("Not now"),
        );
        registry.unregister("two");
        expect(await registry.execute(entry.id)).toEqual(COMMAND_ENABLED);
        expect(first).toHaveBeenCalledOnce();
        expect(second).not.toHaveBeenCalled();
    });
});

describe("순위", () => {
    const item = (id: string, label: string, enabled = true): PaletteItem => ({
        id,
        kind: "command",
        label,
        detail: "Repository",
        category: "Actions",
        keywords: [],
        availability: enabled
            ? COMMAND_ENABLED
            : commandDisabled("No repository"),
        execute: vi.fn(),
    });

    it("[성공] 채용된 결과를 유지하면서 일치 및 공개된 결과를 선거함", () => {
        const sorted = sortPaletteItems(
            [
                item("fetch", "Fetch", false),
                item("open", "Open Repository"),
                item("refresh", "Refresh"),
            ],
            "fetch",
        );
        expect(sorted.map((value) => value.id)).toEqual(["fetch"]);
        expect(sorted[0]?.availability).toEqual(
            commandDisabled("No repository"),
        );
    });
});

describe("탈출기각", () => {
    it("[성공] 가장 높은 레이어를 하나를 닫고 아래로 입력하여 탈출만 남겨두세요", () => {
        const dismiss = vi.fn();
        const layers = [
            { id: "selection", priority: 20, active: true, dismiss },
            { id: "diff", priority: 60, active: true, dismiss },
            { id: "dialog", priority: 120, active: true, dismiss },
        ];
        expect(selectDismissLayer(layers, false)?.id).toBe("dialog");
        expect(selectDismissLayer(layers.slice(0, 2), true)).toBeNull();
        expect(selectDismissLayer(layers.slice(0, 2), false)?.id).toBe("diff");
    });
});
