import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import { useMemo, useState } from "react";
import type { ScratchLanguage } from "../domain/scratchFiles";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";
import { Dialog, DialogHeader } from "./ProductDialog";
import { TextInput } from "./ProductFormControls";

export function ScratchFileChooserDialog({
  languages,
  onChoose,
  onClose,
}: {
  readonly languages: readonly ScratchLanguage[];
  readonly onChoose: (language: ScratchLanguage) => void;
  readonly onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return languages.filter(
      (language) =>
        !normalized ||
        `${language.label} ${language.extension}`.toLocaleLowerCase().includes(normalized),
    );
  }, [languages, query]);

  return (
    <Dialog
      aria-label="New Scratch File"
      isOpen
      onOpenChange={(open) => !open && onClose()}
      padding={0}
      purpose="info"
      width={440}
    >
      <section className={tw.scratchFileChooserDialog}>
        <DialogHeader
          hasDivider
          onOpenChange={(open) => !open && onClose()}
          title="New Scratch File"
        />
        <TextInput
          hasAutoFocus
          isLabelHidden
          label="File type"
          onChange={setQuery}
          placeholder="Search file types"
          value={query}
          width="100%"
        />
        <div aria-label="Scratch file types" role="listbox">
          {filtered.map((language, index) => (
            <Button
              autoFocus={index === 0 && query.length > 0}
              key={language.id}
              onClick={() => onChoose(language)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onChoose(language);
              }}
              role="option"
              type="button"
              className={cn(
                "gap-1.5 text-xs min-h-[29px] w-full justify-start whitespace-normal px-2 py-1 text-left aria-selected:bg-accent aria-current:bg-accent",
              )}
              variant="ghost"
              size="default"
            >
              <Icon name="file" size={15} />
              <span>{language.label}</span>
              <small>.{language.extension}</small>
            </Button>
          ))}
        </div>
      </section>
    </Dialog>
  );
}
