import { isAbsolute } from "node:path";
import { NodePtySpawner } from "./node-pty-spawner";
import { TerminalLaunchTargetResolver } from "./terminal-launch-target-resolver";
import { TerminalUtility } from "./terminal-utility";
import { TerminalUtilityProtocolServer } from "./utility-server";

const parentPort = process.parentPort;
if (parentPort === undefined) {
  throw new Error("Terminal utility entry requires an Electron utility process parent port");
}

function configuredShell(): string {
  const configured = process.env.SHELL;
  if (configured !== undefined && isAbsolute(configured) && !configured.includes("\0")) {
    return configured;
  }
  return process.platform === "darwin" ? "/bin/zsh" : "/bin/sh";
}

function fallbackShell(): string {
  return process.platform === "darwin" ? "/bin/zsh" : "/bin/sh";
}

function terminalEnvironment(): Readonly<Record<string, string>> {
  const environment: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined || key === "NODE_OPTIONS" || key === "ELECTRON_RUN_AS_NODE") {
      continue;
    }
    environment[key] = value;
  }
  return environment;
}

const environment = terminalEnvironment();
const utility = TerminalUtility.of(new NodePtySpawner(), {
  shell: fallbackShell(),
  environment,
  launchTargetResolver: TerminalLaunchTargetResolver.of({
    defaultShell: configuredShell(),
    environment,
  }),
});
const server = new TerminalUtilityProtocolServer(
  {
    postMessage: (message) => parentPort.postMessage(message),
    subscribe: (listener) => {
      const receive = (event: Electron.MessageEvent): void => listener(event.data);
      parentPort.on("message", receive);
      return () => parentPort.off("message", receive);
    },
  },
  utility,
  {
    onDispose: () => {
      setImmediate(() => process.exit(0));
    },
  },
);

server.start();
