export function selectNextParityItems(
  details: Readonly<Record<string, unknown>>,
  limit?: number,
): readonly Readonly<Record<string, unknown>>[];
export function explainParityItem(
  details: Readonly<Record<string, unknown>>,
  id: string,
): Readonly<Record<string, unknown>> | null;
export function selectScenarioTestFile(scenarioId: string): string;
export function mvpVerificationSteps(): readonly Readonly<{
  label: string;
  command: string;
  args: readonly string[];
}>[];
export function verificationCounts(
  counts: Readonly<Record<string, number>>,
  scoped: boolean,
  passed: boolean,
): Readonly<Record<string, number>>;
