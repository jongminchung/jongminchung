const STATUS_PRIORITY = Object.freeze({
  equal: 0,
  unverified: 1,
  invalid: 2,
  divergent: 3,
});

export const PARITY_COMPARATOR_VERSION = 1;

function compactValue(value) {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) return String(value);
  if (serialized.length <= 500) return value;
  return `${serialized.slice(0, 499)}…`;
}

function firstDifference(expected, actual, path = "") {
  if (Object.is(expected, actual)) return null;
  if (Array.isArray(expected) && Array.isArray(actual)) {
    const length = Math.max(expected.length, actual.length);
    for (let index = 0; index < length; index += 1) {
      const difference = firstDifference(expected[index], actual[index], `${path}[${index}]`);
      if (difference) return difference;
    }
    return null;
  }
  if (
    expected !== null &&
    actual !== null &&
    typeof expected === "object" &&
    typeof actual === "object" &&
    !Array.isArray(expected) &&
    !Array.isArray(actual)
  ) {
    const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort();
    for (const key of keys) {
      const difference = firstDifference(
        expected[key],
        actual[key],
        path.length === 0 ? key : `${path}.${key}`,
      );
      if (difference) return difference;
    }
    return null;
  }
  return {
    path: path || "$",
    expected: compactValue(expected),
    actual: compactValue(actual),
  };
}

export function compareParityScenario(
  reference,
  candidate,
  expectedBuildHash = candidate.buildHash,
) {
  if (reference.id !== candidate.scenarioId) {
    return Object.freeze({
      scenarioId: reference.id,
      comparatorVersion: PARITY_COMPARATOR_VERSION,
      obligationIds: reference.obligationIds,
      status: "invalid",
      dimensions: [],
      firstFailure: {
        scenario: reference.id,
        dimension: "metadata",
        path: "scenarioId",
        expected: reference.id,
        actual: candidate.scenarioId,
      },
    });
  }
  if (candidate.buildHash !== expectedBuildHash) {
    return Object.freeze({
      scenarioId: reference.id,
      comparatorVersion: PARITY_COMPARATOR_VERSION,
      obligationIds: reference.obligationIds,
      status: "invalid",
      dimensions: [],
      firstFailure: {
        scenario: reference.id,
        dimension: "metadata",
        path: "buildHash",
        expected: expectedBuildHash,
        actual: candidate.buildHash,
      },
    });
  }

  const dimensions = reference.requiredDimensions.map((dimension) => {
    if (!reference.reference.evidenceVerified) {
      return Object.freeze({ dimension, status: "unverified", reason: "reference-evidence" });
    }
    if (!(dimension in reference.reference.expected)) {
      return Object.freeze({ dimension, status: "unverified", reason: "reference-observation" });
    }
    if (!(dimension in candidate.observed)) {
      return Object.freeze({ dimension, status: "unverified", reason: "candidate-observation" });
    }
    const difference = firstDifference(
      reference.reference.expected[dimension],
      candidate.observed[dimension],
    );
    if (!difference) return Object.freeze({ dimension, status: "equal" });
    return Object.freeze({ dimension, status: "divergent", difference });
  });

  const status = dimensions.reduce(
    (current, dimension) =>
      STATUS_PRIORITY[dimension.status] > STATUS_PRIORITY[current] ? dimension.status : current,
    "equal",
  );
  const failedDimension = dimensions.find((dimension) => dimension.status !== "equal");
  const firstFailure = failedDimension
    ? {
        scenario: reference.id,
        dimension: failedDimension.dimension,
        ...(failedDimension.difference ?? { reason: failedDimension.reason }),
      }
    : undefined;

  return Object.freeze({
    scenarioId: reference.id,
    comparatorVersion: PARITY_COMPARATOR_VERSION,
    obligationIds: reference.obligationIds,
    status,
    dimensions,
    ...(firstFailure ? { firstFailure } : {}),
  });
}

export function summarizeParityResults(results) {
  const obligationStatuses = new Map();
  for (const result of results) {
    for (const obligationId of result.obligationIds) {
      const previous = obligationStatuses.get(obligationId);
      if (!previous || STATUS_PRIORITY[result.status] > STATUS_PRIORITY[previous]) {
        obligationStatuses.set(obligationId, result.status);
      }
    }
  }

  const summary = {
    total: obligationStatuses.size,
    passed: 0,
    failed: 0,
    unverified: 0,
    invalid: 0,
  };
  for (const status of obligationStatuses.values()) {
    if (status === "equal") summary.passed += 1;
    else if (status === "divergent") summary.failed += 1;
    else if (status === "invalid") summary.invalid += 1;
    else summary.unverified += 1;
  }

  return Object.freeze({
    status:
      summary.failed === 0 && summary.unverified === 0 && summary.invalid === 0
        ? "passed"
        : "failed",
    ...summary,
  });
}
