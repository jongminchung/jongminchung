import { AppShell } from "./app/AppShell";
import { AppStoreProvider } from "./app/state/AppStoreProvider";
import { AppearanceProvider } from "./components/AppearanceProvider";
import { CommandProvider } from "./components/CommandProvider";
import { GitClientTheme } from "./components/GitClientTheme";
import {
    GitSessionStoreProvider,
    type GitSessionStoreDependencies,
} from "./features/repository/session/GitSessionStoreProvider";

export default function App({
    gitSession,
}: {
    readonly gitSession: GitSessionStoreDependencies;
}) {
    return (
        <AppearanceProvider>
            <GitClientTheme>
                <CommandProvider>
                    <GitSessionStoreProvider {...gitSession}>
                        <AppStoreProvider>
                            <AppShell />
                        </AppStoreProvider>
                    </GitSessionStoreProvider>
                </CommandProvider>
            </GitClientTheme>
        </AppearanceProvider>
    );
}
