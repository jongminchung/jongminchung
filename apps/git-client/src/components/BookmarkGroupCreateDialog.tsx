import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import { useState } from "react";
import { Dialog, DialogHeader } from "./ProductDialog";
import { CheckboxInput } from "./ProductFormControls";
import { TextInput } from "./ProductFormControls";

export function BookmarkGroupCreateDialog({
    existingNames,
    onClose,
    onCreate,
}: {
    readonly existingNames: ReadonlySet<string>;
    readonly onClose: () => void;
    readonly onCreate: (name: string, isDefault: boolean) => void;
}) {
    const [name, setName] = useState("New List");
    const [isDefault, setIsDefault] = useState(false);
    const normalized = name.trim();
    const error =
        normalized === ""
            ? "Enter a bookmark list name."
            : existingNames.has(normalized)
              ? "A list with the specified name already exists"
              : null;
    const submit = (): void => {
        if (error) return;
        onCreate(normalized, isDefault);
    };
    return (
        <Dialog
            aria-label="Create Bookmark List"
            isOpen
            onOpenChange={(open) => !open && onClose()}
            padding={0}
            purpose="info"
            width={410}
        >
            <form
                className={`bookmarkGroupCreateDialog [display:grid] [gap:10px] [padding-bottom:12px] [&>_*:not(:first-child)]:[margin-left:12px] [&>_*:not(:first-child)]:[margin-right:12px] [&>_p]:[color:var(--muted-foreground)] [&>_p]:[font-size:10px] [&>_p]:[margin-bottom:0] [&>_p]:[margin-top:-5px] [&>_footer]:[display:flex] [&>_footer]:[gap:7px] [&>_footer]:[justify-content:flex-end] bookmarkGroupCreateDialog`}
                onSubmit={(event) => {
                    event.preventDefault();
                    submit();
                }}
            >
                <DialogHeader
                    hasDivider
                    onOpenChange={(open) => !open && onClose()}
                    title="Create Bookmark List"
                />
                <TextInput
                    hasAutoFocus
                    label="Bookmark list:"
                    onChange={setName}
                    size="md"
                    status={
                        error ? { type: "error", message: error } : undefined
                    }
                    value={name}
                    width="100%"
                />
                <CheckboxInput
                    label="Use as default list"
                    onChange={setIsDefault}
                    size="sm"
                    value={isDefault}
                />
                <p>
                    New bookmarks will be added here automatically. You can
                    change the default list at any time in the Bookmarks tool
                    window.
                </p>
                <footer>
                    <Button
                        onClick={onClose}
                        type="button"
                        className={cn("h-8 px-3")}
                        variant="outline"
                        size="default"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={error !== null}
                        className={cn("h-8 px-3")}
                        variant="default"
                        size="default"
                    >
                        Create
                    </Button>
                </footer>
            </form>
        </Dialog>
    );
}
