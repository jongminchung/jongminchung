import { Button } from "@base-ui/react/button";
import { Tabs } from "@base-ui/react/tabs";
import { useState } from "react";
import type {
  RunConfigurationTemplate,
  RunConfigurationTemplateKind,
} from "../domain/runConfigurationTemplates";
import { cn } from "../lib/utils";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";
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
  const activeKind =
    templates.find((template) => template.kind === selectedKind)?.kind ??
    templates[0]?.kind ??
    selectedKind;
  const update = (
    kind: RunConfigurationTemplateKind,
    patch: Partial<RunConfigurationTemplate>,
  ): void => {
    onChange(
      templates.map((template) => (template.kind === kind ? { ...template, ...patch } : template)),
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
        <Tabs.Root
          className="contents"
          onValueChange={(value) => {
            const kind = templates.find((template) => template.kind === value)?.kind;
            if (kind !== undefined) setSelectedKind(kind);
          }}
          orientation="vertical"
          value={activeKind}
        >
          <Tabs.List aria-label="Run configuration template types" render={<aside />}>
            <strong>Templates</strong>
            {templates.map((template) => (
              <Tabs.Tab
                key={template.kind}
                value={template.kind}
                className={cn(
                  "inline-flex h-7 items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent px-2.5 text-xs text-muted-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 data-active:bg-accent data-active:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
                )}
              >
                <Icon name={template.kind === "shell" ? "console" : "file"} size={15} />
                {template.name}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {templates.map((template) => (
            <Tabs.Panel key={template.kind} render={<main />} value={template.kind}>
              <h2>{template.name}</h2>
              <p>Default settings used for new {template.name} run configurations.</p>
              <TextInput
                label="Working directory"
                onChange={(workingDirectory) => update(template.kind, { workingDirectory })}
                placeholder="Project directory"
                value={template.workingDirectory}
                width="100%"
              />
              <TextInput
                label="Environment variables"
                onChange={(environment) => update(template.kind, { environment })}
                placeholder="NAME=value;OTHER=value"
                value={template.environment}
                width="100%"
              />
              <TextInput
                label="Options"
                onChange={(options) => update(template.kind, { options })}
                placeholder="Default command or runtime options"
                value={template.options}
                width="100%"
              />
            </Tabs.Panel>
          ))}
        </Tabs.Root>
        <footer>
          <Button
            data-slot="button"
            onClick={onClose}
            type="button"
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-8 px-3 border-primary bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/80",
            )}
          >
            OK
          </Button>
        </footer>
      </section>
    </Dialog>
  );
}
