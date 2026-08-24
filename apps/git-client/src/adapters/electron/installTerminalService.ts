import { installTerminalService } from "../../application/terminal/activeTerminalService";
import type { TerminalSettingsPort } from "../../application/terminal/ports/TerminalSettingsPort";
import { TerminalService } from "../../application/terminal/TerminalService";
import { createTerminalBridge } from "../../bridge/createTerminalBridge";
import { repositoryAccessPolicy } from "../../domain/repositoryAccess";
import {
  readElectronSetting,
  writeElectronSettings,
} from "../../platform/electronSettings";

const TERMINAL_SESSIONS_SETTING = "terminalTabsByRepository";

const terminalSettings: TerminalSettingsPort = {
  read: () => readElectronSetting(TERMINAL_SESSIONS_SETTING),
  write: (value) =>
    writeElectronSettings({ [TERMINAL_SESSIONS_SETTING]: value }),
};

export function installElectronTerminalService(): () => void {
  return installTerminalService(
    TerminalService.of(
      createTerminalBridge(),
      repositoryAccessPolicy,
      terminalSettings,
    ),
  );
}
