import { Button } from "@base-ui/react/button";
import { useMemo, useState } from "react";
import type { ScratchLanguage } from "../domain/scratchFiles";
import { cn } from "../lib/utils";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";
import { Dialog, DialogHeader } from "./ui";
import { TextInput } from "./ui";

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
              data-slot="button"
              autoFocus={index === 0 && query.length > 0}
              key={language.id}
              onClick={() => onChoose(language)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onChoose(language);
              }}
              role="option"
              type="button"
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent text-xs text-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 min-h-[29px] w-full justify-start whitespace-normal rounded-sm px-2 py-1 text-left aria-selected:bg-accent aria-current:bg-accent",
              )}
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
