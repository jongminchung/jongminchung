import {
    setWorkbenchEventPort,
    type WorkbenchDispatchOptions,
    type WorkbenchEventDetailMap,
    type WorkbenchEventControl,
    type WorkbenchEventName,
    type WorkbenchEventPort,
} from "../../application/workbench-events/WorkbenchEventPort";

export type WorkbenchEventMap = {
    readonly [Name in WorkbenchEventName]: CustomEvent<
        WorkbenchEventDetailMap[Name]
    >;
};

declare global {
    interface WindowEventMap extends WorkbenchEventMap {}
}

export const browserWorkbenchEventPort: WorkbenchEventPort = {
    dispatch<Name extends WorkbenchEventName>(
        name: Name,
        detail: WorkbenchEventDetailMap[Name],
        options: WorkbenchDispatchOptions = {},
    ): boolean {
        return window.dispatchEvent(
            new CustomEvent(name, {
                cancelable: options.cancelable,
                detail,
            }),
        );
    },
    listen<Name extends WorkbenchEventName>(
        name: Name,
        listener: (
            detail: WorkbenchEventDetailMap[Name],
            control: WorkbenchEventControl,
        ) => void,
    ): () => void {
        const handle = (event: WindowEventMap[Name]): void =>
            listener(event.detail as WorkbenchEventDetailMap[Name], {
                preventDefault: () => event.preventDefault(),
            });
        window.addEventListener(name, handle);
        return () => window.removeEventListener(name, handle);
    },
};

export function installBrowserWorkbenchEventPort(): () => void {
    return setWorkbenchEventPort(browserWorkbenchEventPort);
}
