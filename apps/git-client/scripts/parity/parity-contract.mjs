import { z } from "zod";

const dimensionSchema = z.enum([
  "structure",
  "visual",
  "accessibility",
  "interaction",
  "effects",
  "performance",
]);

const scenarioSchema = z
  .object({
    id: z.string().min(1),
    testId: z.string().min(1),
    obligationIds: z.array(z.string().min(1)).min(1),
    requiredDimensions: z.array(dimensionSchema).min(1),
    reference: z
      .object({
        authority: z.enum(["golden", "source", "legacy-manual"]),
        evidenceIds: z.array(z.string().min(1)),
        evidenceVerified: z.boolean(),
        expected: z.record(z.string(), z.unknown()),
      })
      .strict(),
  })
  .strict()
  .superRefine((scenario, context) => {
    for (const [label, values] of [
      ["obligationIds", scenario.obligationIds],
      ["requiredDimensions", scenario.requiredDimensions],
      ["evidenceIds", scenario.reference.evidenceIds],
    ]) {
      if (new Set(values).size !== values.length) {
        context.addIssue({ code: "custom", message: `${String(label)} must be unique` });
      }
    }
    for (const dimension of scenario.requiredDimensions) {
      if (!(dimension in scenario.reference.expected)) {
        context.addIssue({
          code: "custom",
          message: `required dimension ${dimension} has no reference expectation`,
        });
      }
    }
    if (scenario.reference.evidenceVerified && scenario.reference.evidenceIds.length === 0) {
      context.addIssue({ code: "custom", message: "verified references require evidence" });
    }
  });

const contractIndexSchema = z
  .object({
    schemaVersion: z.literal(1),
    referenceVersion: z.string().min(1),
    scenarios: z.array(scenarioSchema),
  })
  .strict()
  .superRefine((index, context) => {
    const ids = index.scenarios.map((scenario) => scenario.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: "custom", message: "scenario ids must be unique" });
    }
    const testIds = index.scenarios.map((scenario) => scenario.testId);
    if (new Set(testIds).size !== testIds.length) {
      context.addIssue({ code: "custom", message: "scenario test ids must be unique" });
    }
  });

const actionRegistrySchema = z
  .object({
    entries: z.array(z.object({ sourceId: z.string().min(1) }).passthrough()),
    summary: z.object({ sourceObligations: z.number().int().nonnegative() }).passthrough(),
  })
  .passthrough();

const candidateObservationSchema = z
  .object({
    scenarioId: z.string().min(1),
    buildHash: z.string().regex(/^[a-f0-9]{16}$/u),
    observed: z.record(z.string(), z.unknown()),
  })
  .strict();

const STATUS_PRIORITY = Object.freeze({ equal: 0, unverified: 1, invalid: 2, divergent: 3 });

export function parseParityContractIndex(value) {
  return contractIndexSchema.parse(value);
}

export function parseCandidateObservation(value) {
  return candidateObservationSchema.parse(value);
}

export function buildObligationInventory(actionRegistryValue, contracts, scenarioResults) {
  const actionRegistry = actionRegistrySchema.parse(actionRegistryValue);
  const registryIds = actionRegistry.entries.map((entry) => entry.sourceId);
  if (new Set(registryIds).size !== registryIds.length) {
    throw new Error("action registry source ids must be unique");
  }
  if (registryIds.length !== actionRegistry.summary.sourceObligations) {
    throw new Error(
      `action registry count mismatch: ${registryIds.length} entries, ${actionRegistry.summary.sourceObligations} declared`,
    );
  }

  const knownIds = new Set(registryIds);
  const scenariosByObligation = new Map();
  for (const scenario of contracts.scenarios) {
    for (const obligationId of scenario.obligationIds) {
      if (!knownIds.has(obligationId)) {
        throw new Error(`unknown source obligation in ${scenario.id}: ${obligationId}`);
      }
      const scenarioIds = scenariosByObligation.get(obligationId) ?? [];
      scenarioIds.push(scenario.id);
      scenariosByObligation.set(obligationId, scenarioIds);
    }
  }
  const resultByScenario = new Map(scenarioResults.map((result) => [result.scenarioId, result]));

  const results = registryIds.map((obligationId) => {
    const scenarioIds = scenariosByObligation.get(obligationId) ?? [];
    if (scenarioIds.length === 0) {
      return Object.freeze({
        obligationId,
        scenarioIds: Object.freeze([]),
        status: "unverified",
        reason: "no-scenario",
      });
    }
    let status = "equal";
    let reason;
    for (const scenarioId of scenarioIds) {
      const result = resultByScenario.get(scenarioId);
      const nextStatus = result?.status ?? "unverified";
      if (!result) reason = "scenario-not-run";
      if (STATUS_PRIORITY[nextStatus] > STATUS_PRIORITY[status]) status = nextStatus;
    }
    return Object.freeze({
      obligationId,
      scenarioIds: Object.freeze([...scenarioIds]),
      status,
      ...(reason ? { reason } : {}),
    });
  });

  const counts = { equal: 0, divergent: 0, unverified: 0, invalid: 0 };
  for (const result of results) counts[result.status] += 1;
  const summary = Object.freeze({
    status:
      counts.divergent === 0 && counts.unverified === 0 && counts.invalid === 0
        ? "passed"
        : "failed",
    total: results.length,
    passed: counts.equal,
    failed: counts.divergent,
    unverified: counts.unverified,
    invalid: counts.invalid,
  });
  return Object.freeze({ results: Object.freeze(results), summary });
}
