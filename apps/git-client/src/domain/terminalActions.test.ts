import { describe, expect, it } from "vitest";
import {
    TERMINAL_ACTION_MENU,
    TerminalActionExecutor,
    isTerminalActionAvailable,
    nextTerminalMenuIndex,
    terminalActionForKeyboard,
    terminalTabAfterClose,
    terminalTabTarget,
    type TerminalClipboardPort,
    type TerminalEmulatorPort,
    type TerminalKeyboardInput,
} from "./terminalActions";

class FakeTerminal implements TerminalEmulatorPort {
    selection = "selected output";
    readonly pasted: string[] = [];
    focusCount = 0;
    selectAllCount = 0;
    clearCount = 0;

    focus(): void {
        this.focusCount += 1;
    }

    getSelection(): string {
        return this.selection;
    }

    paste(data: string): void {
        this.pasted.push(data);
    }

    selectAll(): void {
        this.selectAllCount += 1;
    }

    clear(): void {
        this.clearCount += 1;
    }
}

class FakeClipboard implements TerminalClipboardPort {
    value = "clipboard input";
    readonly writes: string[] = [];

    readText(): Promise<string> {
        return Promise.resolve(this.value);
    }

    writeText(value: string): Promise<void> {
        this.writes.push(value);
        return Promise.resolve();
    }
}

function keyboard(
    key: string,
    overrides: Partial<TerminalKeyboardInput> = {},
): TerminalKeyboardInput {
    return {
        key,
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        isComposing: false,
        repeat: false,
        ...overrides,
    };
}

describe("터미널 작업 매니페스트", () => {
    it("[성공] 증거 기반 작업 목록, 레이블, 구분 기호 및 macOS 표시를 유지함", () => {
        expect(TERMINAL_ACTION_MENU).toEqual([
            { kind: "action", id: "newTab", label: "New Tab", shortcut: "⌘T" },
            {
                kind: "action",
                id: "closeTab",
                label: "Close Tab",
                shortcut: "⌘W",
            },
            { kind: "separator" },
            { kind: "action", id: "copy", label: "Copy", shortcut: "⌘C" },
            { kind: "action", id: "paste", label: "Paste", shortcut: "⌘V" },
            {
                kind: "action",
                id: "selectAll",
                label: "Select All",
                shortcut: "⌘A",
            },
            { kind: "separator" },
            {
                kind: "action",
                id: "clear",
                label: "Clear Terminal",
                shortcut: "⌘K",
            },
        ]);
    });

    it("[성공] macOS를 매핑하고 수정하고, 반복 및 구성 이벤트를 무시함", () => {
        expect(terminalActionForKeyboard(keyboard("t"))).toBe("newTab");
        expect(terminalActionForKeyboard(keyboard("w"))).toBe("closeTab");
        expect(terminalActionForKeyboard(keyboard("c"))).toBe("copy");
        expect(terminalActionForKeyboard(keyboard("v"))).toBe("paste");
        expect(terminalActionForKeyboard(keyboard("a"))).toBe("selectAll");
        expect(terminalActionForKeyboard(keyboard("k"))).toBe("clear");
        expect(
            terminalActionForKeyboard(keyboard("k", { repeat: true })),
        ).toBeNull();
        expect(
            terminalActionForKeyboard(keyboard("k", { shiftKey: true })),
        ).toBeNull();
        expect(
            terminalActionForKeyboard(keyboard("k", { isComposing: true })),
        ).toBeNull();
    });

    it("[성공] 실제 터미널 및 클립보드에서 활성화된 상태를 유지하는 기능", () => {
        const ready = {
            hasSession: true,
            hasSelection: true,
            hasClipboard: true,
        };
        expect(isTerminalActionAvailable("copy", ready)).toBe(true);
        expect(isTerminalActionAvailable("paste", ready)).toBe(true);
        expect(
            isTerminalActionAvailable("copy", {
                ...ready,
                hasSelection: false,
            }),
        ).toBe(false);
        expect(
            isTerminalActionAvailable("paste", {
                ...ready,
                hasClipboard: false,
            }),
        ).toBe(false);
        expect(
            isTerminalActionAvailable("closeTab", {
                ...ready,
                hasSession: false,
            }),
        ).toBe(false);
        expect(
            isTerminalActionAvailable("newTab", {
                ...ready,
                hasSession: false,
            }),
        ).toBe(true);
    });
});

describe("터미널 키보드 탐색", () => {
    it("[성공] Home과 End를 지원하면서 메뉴와 탭을 저장함", () => {
        expect(nextTerminalMenuIndex(4, 3, "ArrowDown")).toBe(0);
        expect(nextTerminalMenuIndex(4, 0, "ArrowUp")).toBe(3);
        expect(nextTerminalMenuIndex(4, -1, "ArrowDown")).toBe(0);
        expect(nextTerminalMenuIndex(4, -1, "ArrowUp")).toBe(3);
        expect(nextTerminalMenuIndex(4, 2, "Home")).toBe(0);
        expect(nextTerminalMenuIndex(4, 2, "End")).toBe(3);
        expect(
            terminalTabTarget(["one", "two", "three"], "three", "ArrowRight"),
        ).toBe("one");
        expect(
            terminalTabTarget(["one", "two", "three"], "one", "ArrowLeft"),
        ).toBe("three");
        expect(terminalTabTarget(["one", "two", "three"], "two", "Home")).toBe(
            "one",
        );
        expect(terminalTabTarget(["one", "two", "three"], "two", "End")).toBe(
            "three",
        );
    });

    it("[성공] 다음 탭을 선택하고 다음 선택은 후 이전 탭을 선택함", () => {
        expect(terminalTabAfterClose(["one", "two", "three"], "two")).toBe(
            "three",
        );
        expect(terminalTabAfterClose(["one", "two", "three"], "three")).toBe(
            "two",
        );
        expect(terminalTabAfterClose(["only"], "only")).toBeNull();
    });
});

describe("터미널 액션 실행자", () => {
    it("[성공] xterm이 지원하는 표면 방법만 사용하고 터미널 초점을 복원함", async () => {
        const terminal = new FakeTerminal();
        const clipboard = new FakeClipboard();
        const executor = TerminalActionExecutor.of(terminal, clipboard);

        await expect(executor.execute("copy")).resolves.toEqual({
            kind: "completed",
        });
        await expect(executor.execute("paste")).resolves.toEqual({
            kind: "completed",
        });
        await expect(executor.execute("selectAll")).resolves.toEqual({
            kind: "completed",
        });
        await expect(executor.execute("clear")).resolves.toEqual({
            kind: "completed",
        });

        expect(clipboard.writes).toEqual(["selected output"]);
        expect(terminal.pasted).toEqual(["clipboard input"]);
        expect(terminal.selectAllCount).toBe(1);
        expect(terminal.clearCount).toBe(1);
        expect(terminal.focusCount).toBe(4);
    });

    it("[성공]복구 가능하고 사용할 수 없는 결과를 반환하고 유지하는 것에 대한 복원", async () => {
        const terminal = new FakeTerminal();
        terminal.selection = "";
        const executor = TerminalActionExecutor.of(terminal, null);

        await expect(executor.execute("copy")).resolves.toMatchObject({
            kind: "unavailable",
        });
        await expect(executor.execute("paste")).resolves.toMatchObject({
            kind: "unavailable",
        });
        expect(terminal.focusCount).toBe(2);
    });
});
