import type { RemarkPlantUmlOptions } from "./index.js";
import remarkPlantUml from "./index.js";

export type AstroRemarkPlantUmlPlugin = [typeof remarkPlantUml, RemarkPlantUmlOptions];

export function createPlantUmlRemarkPlugin(
  options: RemarkPlantUmlOptions,
): AstroRemarkPlantUmlPlugin {
  return [remarkPlantUml, options];
}
