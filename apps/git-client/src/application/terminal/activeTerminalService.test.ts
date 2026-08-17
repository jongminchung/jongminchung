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

describe("활성 터미널 서비스", () => {
    it("[실패] 렌더러 구성 서비스를 설치하기 전에는 실패함", () => {
        expect(() => terminalService.snapshot()).toThrow(
            "Terminal service was not installed",
        );
    });

    it("[성공] 예외적으로 서비스를 요청함을 전달함", async () => {
        const service = TerminalService.of(terminal);
        restore = installTerminalService(service);

        expect(terminalService.snapshot()).toBe(0);
        expect(await terminalService.listLaunchTargets()).toEqual({
            shells: [],
            agents: [],
        });
    });
});
