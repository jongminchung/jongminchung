import { useMemo, useState } from "react";
import type {
  RunConfigurationTemplate,
  RunConfigurationTemplateKind,
} from "../domain/runConfigurationTemplates";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";
import { Button } from "./ui";
import { Dialog, DialogHeader } from "./ui";
import { TextInput } from "./ui";

export function RunConfigurationTemplatesDialog({
  onChange,
  onClose,
  templates,
}: {
  readonly onChange: (templates: readonly RunConfigurationTemplate[]) => void;
  readonly onClose: () => void;
  readonly templates: readonly RunConfigurationTemplate[];
}) {
  const [selectedKind, setSelectedKind] = useState<RunConfigurationTemplateKind>(
    templates[0]?.kind ?? "application",
  );
  const selected = useMemo(
    () => templates.find((template) => template.kind === selectedKind) ?? templates[0],
    [selectedKind, templates],
  );
  const update = (patch: Partial<RunConfigurationTemplate>): void => {
    if (!selected) return;
    onChange(
      templates.map((template) =>
        template.kind === selected.kind ? { ...template, ...patch } : template,
      ),
    );
  };

  return (
    <Dialog
      aria-label="Run Configuration Templates"
      isOpen
      maxHeight="90vh"
      onOpenChange={(open) => !open && onClose()}
      padding={0}
      purpose="form"
      width="min(860px, calc(100vw - 70px))"
    >
      <section className={tw.runConfigurationTemplatesDialog}>
        <DialogHeader
          hasDivider
          onOpenChange={(open) => !open && onClose()}
          title="Run Configuration Templates"
        />
        <aside aria-label="Run configuration template types">
          <strong>Templates</strong>
          {templates.map((template) => (
            <button
              aria-current={template.kind === selectedKind ? "page" : undefined}
              className={template.kind === selectedKind ? tw.activeButton : undefined}
              key={template.kind}
              onClick={() => setSelectedKind(template.kind)}
            >
              <Icon name={template.kind === "shell" ? "console" : "file"} size={15} />
              {template.name}
            </button>
          ))}
        </aside>
        <main>
          {selected && (
            <>
              <h2>{selected.name}</h2>
              <p>Default settings used for new {selected.name} run configurations.</p>
              <TextInput
                label="Working directory"
                onChange={(workingDirectory) => update({ workingDirectory })}
                placeholder="Project directory"
                value={selected.workingDirectory}
                width="100%"
              />
              <TextInput
                label="Environment variables"
                onChange={(environment) => update({ environment })}
                placeholder="NAME=value;OTHER=value"
                value={selected.environment}
                width="100%"
              />
              <TextInput
                label="Options"
                onChange={(options) => update({ options })}
                placeholder="Default command or runtime options"
                value={selected.options}
                width="100%"
              />
            </>
          )}
        </main>
        <footer>
          <Button label="OK" onClick={onClose} variant="primary" />
        </footer>
      </section>
    </Dialog>
  );
}
