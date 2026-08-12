import { afterEach, describe, expect, it } from "vitest";
import type {
    RepositoryId,
    TerminalEvent,
    TerminalId,
} from "../../shared/contracts/model/index";
import type {
    TerminalLaunchTarget,
    TerminalLaunchTargets,
} from "../../shared/contracts/terminal";
import {
    installTerminalService,
    terminalService,
} from "./activeTerminalService";
import type { TerminalPort } from "./ports/TerminalPort";
import { TerminalService } from "./TerminalService";

const terminal: TerminalPort = {
    listLaunchTargets: async (): Promise<TerminalLaunchTargets> => ({
        shells: [],
        agents: [],
    }),
    create: async (
        _repositoryId: RepositoryId,
        _cols: number,
        _rows: number,
        _target: TerminalLaunchTarget,
        _onEvent: (event: TerminalEvent) => void,
    ): Promise<TerminalId> => "terminal-1",
    write: async () => undefined,
    resize: async () => undefined,
    close: async () => undefined,
    closeRepository: async () => undefined,
};

let restore: (() => void) | undefined;

afterEach(() => {
    restore?.();
    restore = undefined;
});

describe("active terminal service", () => {
    it("fails clearly before renderer composition installs a service", () => {
        expect(() => terminalService.snapshot()).toThrow(
            "Terminal service was not installed",
        );
    });

    it("forwards calls to the installed application service", async () => {
        const service = TerminalService.of(terminal);
        restore = installTerminalService(service);

        expect(terminalService.snapshot()).toBe(0);
        expect(await terminalService.listLaunchTargets()).toEqual({
            shells: [],
            agents: [],
        });
    });
});
