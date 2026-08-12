import { Button } from "@jongminchung/ui/components/button";
import { Checkbox } from "@jongminchung/ui/components/checkbox";
import { Input } from "@jongminchung/ui/components/input";
import { Textarea } from "@jongminchung/ui/components/textarea";
import { cn } from "@jongminchung/ui/lib/utils";
import { useState } from "react";

export interface HostingRequestDraft {
    readonly title: string;
    readonly body: string;
    readonly sourceBranch: string;
    readonly targetBranch: string;
    readonly draft: boolean;
}

interface HostingRequestComposerProps {
    readonly currentBranch?: string;
    readonly onCancel: () => void;
    readonly onCreate: (draft: HostingRequestDraft) => Promise<boolean>;
}

export function HostingRequestComposer({
    currentBranch,
    onCancel,
    onCreate,
}: HostingRequestComposerProps) {
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [sourceBranch, setSourceBranch] = useState(currentBranch ?? "");
    const [targetBranch, setTargetBranch] = useState("main");
    const [draft, setDraft] = useState(false);

    const create = async (): Promise<void> => {
        const created = await onCreate({
            title: title.trim(),
            body,
            sourceBranch: sourceBranch.trim(),
            targetBranch: targetBranch.trim(),
            draft,
        });
        if (!created) return;
        setTitle("");
        setBody("");
    };

    return (
        <section
            className={`hostingComposer [&>_footer]:[align-items:center] [&>_footer]:[display:flex] [&>_footer]:[gap:8px] [&_label]:[color:var(--muted-foreground)] [&_label]:[display:flex] [&_label]:[flex-direction:column] [&_label]:[font-size:11px] [&_label]:[gap:3px] [background:var(--secondary)] [border-bottom:1px_solid_var(--border)] [display:flex] [flex-direction:column] [gap:8px] [padding:11px] [&_textarea]:[min-height:64px] [&_textarea]:[resize:vertical] [&>_div]:[align-items:end] [&>_div]:[display:grid] [&>_div]:[gap:8px] [&>_div]:[grid-template-columns:1fr_1fr_auto] [&>_footer]:[justify-content:flex-end] hostingComposer`}
            id="hosting-create-request"
        >
            <strong>Create change request</strong>
            <label>
                Title
                <Input
                    onChange={(event) => setTitle(event.target.value)}
                    value={title}
                />
            </label>
            <label>
                Description
                <Textarea
                    onChange={(event) => setBody(event.target.value)}
                    value={body}
                />
            </label>
            <div>
                <label>
                    Source
                    <Input
                        onChange={(event) =>
                            setSourceBranch(event.target.value)
                        }
                        value={sourceBranch}
                    />
                </label>
                <label>
                    Target
                    <Input
                        onChange={(event) =>
                            setTargetBranch(event.target.value)
                        }
                        value={targetBranch}
                    />
                </label>
                <label
                    className={`inlineCheck [align-items:center] [flex-direction:row]! [min-height:29px] [&_input]:[min-height:auto] inlineCheck`}
                >
                    <Checkbox checked={draft} onCheckedChange={setDraft} />{" "}
                    Draft
                </label>
            </div>
            <footer>
                <Button
                    onClick={onCancel}
                    type="button"
                    className={cn("h-7 px-2.5")}
                    variant="outline"
                    size="sm"
                >
                    Cancel
                </Button>
                <Button
                    disabled={
                        !title.trim() ||
                        !sourceBranch.trim() ||
                        !targetBranch.trim()
                    }
                    onClick={() => void create()}
                    type="button"
                    className={cn("h-7 px-2.5")}
                    variant="outline"
                    size="sm"
                >
                    Create
                </Button>
            </footer>
        </section>
    );
}
