export const RUN_CONFIGURATION_TEMPLATES_KEY = "runConfigurationTemplates";

export type RunConfigurationTemplateKind =
  | "application"
  | "node"
  | "npm"
  | "shell";

export interface RunConfigurationTemplate {
  readonly kind: RunConfigurationTemplateKind;
  readonly name: string;
  readonly workingDirectory: string;
  readonly environment: string;
  readonly options: string;
}

export const DEFAULT_RUN_CONFIGURATION_TEMPLATES: readonly RunConfigurationTemplate[] = [
  { kind: "application", name: "Application", workingDirectory: "", environment: "", options: "" },
  { kind: "node", name: "Node.js", workingDirectory: "", environment: "", options: "" },
  { kind: "npm", name: "npm", workingDirectory: "", environment: "", options: "" },
  { kind: "shell", name: "Shell Script", workingDirectory: "", environment: "", options: "" },
];

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isKind(value: unknown): value is RunConfigurationTemplateKind {
  return value === "application" || value === "node" || value === "npm" || value === "shell";
}

export function parseRunConfigurationTemplates(value: unknown): readonly RunConfigurationTemplate[] {
  if (!Array.isArray(value)) return DEFAULT_RUN_CONFIGURATION_TEMPLATES;
  const parsed = value.flatMap((candidate): readonly RunConfigurationTemplate[] => {
    if (!isRecord(candidate) || !isKind(candidate.kind) || typeof candidate.name !== "string") return [];
    const text = (key: "workingDirectory" | "environment" | "options"): string =>
      typeof candidate[key] === "string" ? candidate[key].slice(0, 16_384) : "";
    return [{
      kind: candidate.kind,
      name: candidate.name.slice(0, 128),
      workingDirectory: text("workingDirectory"),
      environment: text("environment"),
      options: text("options"),
    }];
  });
  const byKind = new Map(parsed.map((template) => [template.kind, template]));
  return DEFAULT_RUN_CONFIGURATION_TEMPLATES.map(
    (fallback) => byKind.get(fallback.kind) ?? fallback,
  );
}
