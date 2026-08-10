import { AppShell } from "./app/AppShell";
import { AppStoreProvider } from "./app/state/AppStoreProvider";
import { AppearanceProvider } from "./components/AppearanceProvider";
import { CommandProvider } from "./components/CommandProvider";
import { GitClientTheme } from "./components/GitClientTheme";
import { GitSessionStoreProvider } from "./git-session/GitSessionStoreProvider";

export default function App() {
  return (
    <AppearanceProvider>
      <GitClientTheme>
        <CommandProvider>
          <GitSessionStoreProvider>
            <AppStoreProvider>
              <AppShell />
            </AppStoreProvider>
          </GitSessionStoreProvider>
        </CommandProvider>
      </GitClientTheme>
    </AppearanceProvider>
  );
}
