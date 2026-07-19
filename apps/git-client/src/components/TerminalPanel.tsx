import {
    lazy,
    Suspense,
    useCallback,
    useEffect,
    useRef,
    useState,
    useSyncExternalStore,
    type KeyboardEvent,
    type MouseEvent,
} from "react";
import {
    terminalActionForKeyboard,
    terminalTabAfterClose,
    type TerminalActionAvailability,
    type TerminalActionId,
} from "../domain/terminalActions";
import { terminalService } from "../domain/TerminalService";
import type { RepositoryId } from "../generated";
import { isNativeRuntime } from "../platform/electron";
import type {
    TerminalAgentDescriptor,
    TerminalLaunchTargets,
    TerminalShellDescriptor,
} from "../shared/contracts/terminal";
import { tw } from "../styles/tailwind";
import { useCommands } from "./CommandProvider";
import { Icon } from "./Icon";
import { TerminalOptionsMenu } from "./TerminalOptionsMenu";
import { TerminalLaunchTargetMenu } from "./TerminalLaunchTargetMenu";
import { TerminalTabStrip } from "./TerminalTabStrip";
import type { XtermSurfaceHandle } from "./XtermSurface";

const XtermSurface = lazy(() => import("./XtermSurface"));

type TerminalMenuRequest =
    | Readonly<{
          kind: "options";
          x: number;
          y: number;
          origin: "toolbar" | "terminal";
          availability: TerminalActionAvailability;
      }>
    | Readonly<{
          kind: "shells";
          x: number;
          y: number;
          items: readonly TerminalShellDescriptor[];
      }>
    | Readonly<{
          kind: "agents";
          x: number;
          y: number;
          items: readonly TerminalAgentDescriptor[];
      }>;

export function TerminalPanel({
    repositoryId,
    fixture,
    onHide,
}: {
    readonly repositoryId: RepositoryId;
    readonly fixture: boolean;
    readonly onHide: () => void;
}) {
    useSyncExternalStore(
        terminalService.subscribe,
        terminalService.snapshot,
        terminalService.snapshot,
    );
    const { announce } = useCommands();
    const sessions = terminalService.sessions(repositoryId);
    const [activeKey, setActiveKey] = useState<string | null>(
        sessions[0]?.key ?? null,
    );
    const [menuRequest, setMenuRequest] = useState<TerminalMenuRequest | null>(
        null,
    );
    const [launchTargets, setLaunchTargets] = useState<TerminalLaunchTargets>({
        shells: [],
        agents: [],
    });
    const [launchError, setLaunchError] = useState<string | null>(null);
    const root = useRef<HTMLDivElement>(null);
    const agentsButton = useRef<HTMLButtonElement>(null);
    const optionsButton = useRef<HTMLButtonElement>(null);
    const predefinedButton = useRef<HTMLButtonElement>(null);
    const xterm = useRef<XtermSurfaceHandle>(null);
    useEffect(() => {
        if (fixture || !isNativeRuntime()) return;
        let cancelled = false;
        const openInitialTerminal = async (): Promise<void> => {
            try {
                await terminalService.restore(repositoryId);
                if (
                    cancelled ||
                    terminalService.sessions(repositoryId).length > 0
                )
                    return;
                const key = await terminalService.create(repositoryId);
                if (!cancelled) {
                    setLaunchError(null);
                    setActiveKey(key);
                }
            } catch (error) {
                if (cancelled) return;
                const message =
                    error instanceof Error ? error.message : String(error);
                setLaunchError(message);
                announce(message);
            }
        };
        void openInitialTerminal();
        return () => {
            cancelled = true;
        };
    }, [announce, fixture, repositoryId]);

    useEffect(() => {
        if (fixture || !isNativeRuntime()) return;
        let cancelled = false;
        const load = async (): Promise<void> => {
            try {
                const targets = await terminalService.listLaunchTargets();
                if (!cancelled) setLaunchTargets(targets);
            } catch (error) {
                if (!cancelled)
                    announce(
                        error instanceof Error ? error.message : String(error),
                    );
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [announce, fixture]);

    useEffect(() => {
        if (!sessions.some((session) => session.key === activeKey)) {
            setActiveKey(sessions[0]?.key ?? null);
        }
    }, [activeKey, sessions]);

    const create = useCallback(async (): Promise<void> => {
        if (fixture || !isNativeRuntime()) return;
        try {
            const key = await terminalService.create(repositoryId);
            setLaunchError(null);
            setActiveKey(key);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            setLaunchError(message);
            announce(message);
        }
    }, [announce, fixture, repositoryId]);

    const createLaunchTarget = useCallback(
        async (
            target: TerminalShellDescriptor | TerminalAgentDescriptor,
        ): Promise<void> => {
            if (fixture || !isNativeRuntime()) return;
            const launchTarget =
                target.kind === "shell"
                    ? ({ kind: "shell", id: target.id } as const)
                    : ({ kind: "agent", id: target.id } as const);
            try {
                const key = await terminalService.create(repositoryId, {
                    target: launchTarget,
                    title: target.displayName,
                });
                setLaunchError(null);
                setActiveKey(key);
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : String(error);
                setLaunchError(message);
                announce(message);
            }
        },
        [announce, fixture, repositoryId],
    );

    const close = useCallback(
        async (key: string): Promise<void> => {
            const wasActive = activeKey === key;
            const nextKey = terminalTabAfterClose(
                sessions.map((session) => session.key),
                key,
            );
            if (wasActive) setActiveKey(nextKey);
            await terminalService.close(key);
            if (!wasActive) return;
            window.requestAnimationFrame(() => {
                if (nextKey !== null) xterm.current?.focus();
                else
                    root.current
                        ?.querySelector<HTMLButtonElement>(
                            'button[aria-label="New Tab"]',
                        )
                        ?.focus();
            });
        },
        [activeKey, sessions],
    );
    const activeKeyRef = useRef(activeKey);
    const closeTabRef = useRef(close);
    activeKeyRef.current = activeKey;
    closeTabRef.current = close;

    useEffect(() => {
        const navigateTab = (event: Event): void => {
            if (!(event instanceof CustomEvent)) return;
            const offset = event.detail?.offset;
            if (offset !== -1 && offset !== 1) return;
            const keys = terminalService
                .sessions(repositoryId)
                .map((session) => session.key);
            if (keys.length < 2) return;
            const currentIndex = Math.max(
                0,
                keys.indexOf(activeKeyRef.current ?? ""),
            );
            const target = keys[(currentIndex + offset + keys.length) % keys.length];
            if (!target) return;
            setActiveKey(target);
            window.requestAnimationFrame(() => xterm.current?.focus());
        };
        const closeActiveTab = (): void => {
            const key = activeKeyRef.current;
            if (key !== null) void closeTabRef.current(key);
        };
        window.addEventListener("git-client:terminal-tab-navigate", navigateTab);
        window.addEventListener("git-client:terminal-tab-close", closeActiveTab);
        return () => {
            window.removeEventListener(
                "git-client:terminal-tab-navigate",
                navigateTab,
            );
            window.removeEventListener(
                "git-client:terminal-tab-close",
                closeActiveTab,
            );
        };
    }, [repositoryId]);

    const performAction = useCallback(
        async (action: TerminalActionId): Promise<void> => {
            if (action === "newTab") {
                await create();
                return;
            }
            if (action === "closeTab") {
                if (activeKey !== null) await close(activeKey);
                return;
            }
            const result = await xterm.current?.execute(action);
            if (result === undefined) {
                announce("Terminal is not ready.");
            } else if (result.kind === "unavailable") {
                announce(result.reason);
            }
        },
        [activeKey, announce, close, create],
    );

    const requestAction = useCallback(
        (action: TerminalActionId): void => void performAction(action),
        [performAction],
    );

    const capabilities = (): TerminalActionAvailability => {
        const surface = xterm.current?.capabilities();
        return {
            hasSession: activeKey !== null,
            hasSelection: surface?.hasSelection ?? false,
            hasClipboard: surface?.hasClipboard ?? false,
        };
    };

    const openOptions = (event: MouseEvent<HTMLButtonElement>): void => {
        const bounds = event.currentTarget.getBoundingClientRect();
        setMenuRequest({
            kind: "options",
            x: bounds.right - 240,
            y: bounds.bottom + 4,
            origin: "toolbar",
            availability: capabilities(),
        });
    };

    const openContextMenu = (event: MouseEvent<HTMLDivElement>): void => {
        event.preventDefault();
        setMenuRequest({
            kind: "options",
            x: event.clientX,
            y: event.clientY,
            origin: "terminal",
            availability: capabilities(),
        });
    };

    const openLaunchMenu = (
        kind: "shells" | "agents",
        event: MouseEvent<HTMLButtonElement>,
    ): void => {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (kind === "shells") {
            if (launchTargets.shells.length === 0) return;
            setMenuRequest({
                kind,
                x: bounds.right - 240,
                y: bounds.bottom + 4,
                items: launchTargets.shells,
            });
            return;
        }
        if (launchTargets.agents.length === 0) return;
        setMenuRequest({
            kind,
            x: bounds.right - 240,
            y: bounds.bottom + 4,
            items: launchTargets.agents,
        });
    };

    const closeMenu = useCallback((): void => setMenuRequest(null), []);
    const restoreMenuFocus = useCallback((): void => {
        if (menuRequest?.kind === "shells") predefinedButton.current?.focus();
        else if (menuRequest?.kind === "agents") agentsButton.current?.focus();
        else if (menuRequest?.origin === "toolbar")
            optionsButton.current?.focus();
        else xterm.current?.focus();
    }, [menuRequest]);

    if (fixture || !isNativeRuntime()) {
        return (
            <div className={tw.terminalEmpty}>
                <Icon name="console" size={22} />
                <strong>Native Terminal</strong>
                <p>The deterministic QA fixture does not start a shell.</p>
            </div>
        );
    }

    return (
        <div
            aria-label="Local Tool Window"
            className={tw.terminalTool}
            onKeyDownCapture={(event: KeyboardEvent<HTMLDivElement>) => {
                if (terminalActionForKeyboard(event.nativeEvent) !== "newTab")
                    return;
                event.preventDefault();
                event.stopPropagation();
                void create();
            }}
            ref={root}
            role="region"
        >
            <TerminalTabStrip
                activeKey={activeKey}
                agentsButtonRef={agentsButton}
                hasPredefinedSessions={launchTargets.shells.length > 0}
                onActivate={setActiveKey}
                onClose={close}
                onCreate={create}
                onHide={onHide}
                onOpenAgents={(event) => openLaunchMenu("agents", event)}
                onOpenOptions={openOptions}
                onOpenPredefined={(event) => openLaunchMenu("shells", event)}
                optionsButtonRef={optionsButton}
                predefinedButtonRef={predefinedButton}
                sessions={sessions}
                showAgents
            />
            <div className={tw.terminalSurface}>
                {activeKey ? (
                    <Suspense
                        fallback={
                            <div className={tw.emptyState}>
                                Starting terminal…
                            </div>
                        }
                    >
                        <XtermSurface
                            onAction={requestAction}
                            onContextMenu={openContextMenu}
                            ref={xterm}
                            sessionKey={activeKey}
                        />
                    </Suspense>
                ) : (
                    <div className={tw.terminalEmpty}>
                        <Icon name="console" size={22} />
                        <strong>
                            {launchError === null
                                ? "No terminal session"
                                : "Terminal failed to start"}
                        </strong>
                        {launchError !== null && (
                            <p role="alert">{launchError}</p>
                        )}
                        <button onClick={() => void create()}>
                            New Terminal
                        </button>
                    </div>
                )}
            </div>
            {menuRequest?.kind === "options" && (
                <TerminalOptionsMenu
                    availability={menuRequest.availability}
                    onAction={performAction}
                    onClose={closeMenu}
                    onRestoreFocus={restoreMenuFocus}
                    x={menuRequest.x}
                    y={menuRequest.y}
                />
            )}
            {(menuRequest?.kind === "shells" ||
                menuRequest?.kind === "agents") && (
                <TerminalLaunchTargetMenu
                    items={menuRequest.items}
                    label={
                        menuRequest.kind === "shells"
                            ? "New Predefined Session"
                            : "AI Agents"
                    }
                    onClose={closeMenu}
                    onRestoreFocus={restoreMenuFocus}
                    onSelect={createLaunchTarget}
                    x={menuRequest.x}
                    y={menuRequest.y}
                />
            )}
        </div>
    );
}
