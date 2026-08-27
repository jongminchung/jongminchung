import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import { useMemo, useState } from "react";
import type { ScratchLanguage } from "../domain/scratchFiles";
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
        `${language.label} ${language.extension}`
          .toLocaleLowerCase()
          .includes(normalized),
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
      <section
        className={`scratchFileChooserDialog scratchFileChooserDialog [display:grid] [max-height:min(540px,_calc(100vh_-_90px))] [min-height:360px] [grid-template-rows:auto_auto_minmax(0,_1fr)] [&>_[data-slot=text-input]]:[margin:10px_12px_6px] [&>_div[role=listbox]]:[min-height:0] [&>_div[role=listbox]]:[overflow:auto] [&>_div[role=listbox]]:[padding:3px_7px_9px] [&>_div[role=listbox]_button]:[display:grid] [&>_div[role=listbox]_button]:[min-height:30px] [&>_div[role=listbox]_button]:[width:100%] [&>_div[role=listbox]_button]:[grid-template-columns:18px_minmax(0,_1fr)_auto] [&>_div[role=listbox]_button]:[align-items:center] [&>_div[role=listbox]_button]:[gap:8px] [&>_div[role=listbox]_button]:[padding:0_8px] [&>_div[role=listbox]_button]:[text-align:left] [&>_div[role=listbox]_button]:[background:transparent] [&>_div[role=listbox]_button_small]:[color:var(--disabled-foreground)] [&>_div[role=listbox]_button:focus]:[background:var(--accent)] [&>_div[role=listbox]_button:hover]:[background:var(--muted)]`}
      >
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
          {filtered.map((language) => (
            <Button
              aria-selected={false}
              key={language.id}
              onClick={() => onChoose(language)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onChoose(language);
              }}
              role="option"
              type="button"
              className={cn(
                "min-h-[29px] w-full justify-start gap-1.5 px-2 py-1 text-left text-xs whitespace-normal aria-current:bg-accent aria-selected:bg-accent",
              )}
              variant="ghost"
              size="default"
              tabIndex={-1}
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
