export function selectNextParityItems(
  details: Readonly<Record<string, unknown>>,
  limit?: number,
): readonly Readonly<Record<string, unknown>>[];
export function explainParityItem(
  details: Readonly<Record<string, unknown>>,
  id: string,
): Readonly<Record<string, unknown>> | null;
