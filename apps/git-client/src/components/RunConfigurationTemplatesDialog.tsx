import { Button } from "@jongminchung/ui/components/button";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@jongminchung/ui/components/tabs";
import { cn } from "@jongminchung/ui/lib/utils";
import { useState } from "react";
import type {
    RunConfigurationTemplate,
    RunConfigurationTemplateKind,
} from "../domain/runConfigurationTemplates";
import { Icon } from "./Icon";
import { Dialog, DialogHeader } from "./ProductDialog";
import { TextInput } from "./ProductFormControls";

export function RunConfigurationTemplatesDialog({
    onChange,
    onClose,
    templates,
}: {
    readonly onChange: (templates: readonly RunConfigurationTemplate[]) => void;
    readonly onClose: () => void;
    readonly templates: readonly RunConfigurationTemplate[];
}) {
    const [selectedKind, setSelectedKind] =
        useState<RunConfigurationTemplateKind>(
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
            templates.map((template) =>
                template.kind === kind ? { ...template, ...patch } : template,
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
            <section
                className={`runConfigurationTemplatesDialog [display:grid] [grid-template-columns:220px_minmax(0,_1fr)] [grid-template-rows:auto_minmax(0,_1fr)_auto] [height:min(590px,_calc(100vh_-_70px))] [min-height:0] [&>_[data-slot=dialog-header]]:[grid-column:1/-1] [&>_aside]:[background:var(--muted)] [&>_aside]:[border-right:1px_solid_var(--border)] [&>_aside]:[display:flex] [&>_aside]:[flex-direction:column] [&>_aside]:[gap:2px] [&>_aside]:[padding:10px_7px] [&>_aside_>_strong]:[color:var(--muted-foreground)] [&>_aside_>_strong]:[font-size:10px] [&>_aside_>_strong]:[padding:2px_8px_7px] [&>_aside_button]:[align-items:center] [&>_aside_button]:[background:transparent] [&>_aside_button]:[display:flex] [&>_aside_button]:[gap:8px] [&>_aside_button]:[height:31px] [&>_aside_button]:[padding:0_8px] [&>_aside_button]:[text-align:left] [&>_main]:[display:flex] [&>_main]:[flex-direction:column] [&>_main]:[gap:15px] [&>_main]:[min-height:0] [&>_main]:[overflow:auto] [&>_main]:[padding:18px_20px] [&>_main_h2]:[font-size:16px] [&>_main_h2]:[margin:0] [&>_main_p]:[color:var(--muted-foreground)] [&>_main_p]:[margin:0] [&>_footer]:[border-top:1px_solid_var(--border)] [&>_footer]:[display:flex] [&>_footer]:[grid-column:1/-1] [&>_footer]:[justify-content:flex-end] [&>_footer]:[padding:8px_12px] runConfigurationTemplatesDialog`}
            >
                <DialogHeader
                    hasDivider
                    onOpenChange={(open) => !open && onClose()}
                    title="Run Configuration Templates"
                />
                <Tabs
                    className="contents"
                    onValueChange={(value) => {
                        const kind = templates.find(
                            (template) => template.kind === value,
                        )?.kind;
                        if (kind !== undefined) setSelectedKind(kind);
                    }}
                    orientation="vertical"
                    value={activeKind}
                >
                    <TabsList
                        aria-label="Run configuration template types"
                        render={<aside />}
                    >
                        <strong>Templates</strong>
                        {templates.map((template) => (
                            <TabsTrigger
                                key={template.kind}
                                value={template.kind}
                                className={cn(
                                    "inline-flex h-7 items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent px-2.5 text-xs text-muted-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 data-active:bg-accent data-active:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
                                )}
                            >
                                <Icon
                                    name={
                                        template.kind === "shell"
                                            ? "console"
                                            : "file"
                                    }
                                    size={15}
                                />
                                {template.name}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    {templates.map((template) => (
                        <TabsContent
                            key={template.kind}
                            render={<main />}
                            value={template.kind}
                        >
                            <h2>{template.name}</h2>
                            <p>
                                Default settings used for new {template.name}{" "}
                                run configurations.
                            </p>
                            <TextInput
                                label="Working directory"
                                onChange={(workingDirectory) =>
                                    update(template.kind, { workingDirectory })
                                }
                                placeholder="Project directory"
                                value={template.workingDirectory}
                                width="100%"
                            />
                            <TextInput
                                label="Environment variables"
                                onChange={(environment) =>
                                    update(template.kind, { environment })
                                }
                                placeholder="NAME=value;OTHER=value"
                                value={template.environment}
                                width="100%"
                            />
                            <TextInput
                                label="Options"
                                onChange={(options) =>
                                    update(template.kind, { options })
                                }
                                placeholder="Default command or runtime options"
                                value={template.options}
                                width="100%"
                            />
                        </TabsContent>
                    ))}
                </Tabs>
                <footer>
                    <Button
                        onClick={onClose}
                        type="button"
                        className={cn("h-8 px-3")}
                        variant="default"
                        size="default"
                    >
                        OK
                    </Button>
                </footer>
            </section>
        </Dialog>
    );
}
