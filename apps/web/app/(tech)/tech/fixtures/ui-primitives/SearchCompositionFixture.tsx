"use client";

import { Button } from "@jongminchung/ui/components/button";
import { useRef, useState } from "react";
import { SearchDialog } from "#tech-components/SearchDialog";

/** 실제 검색 조합을 fixture에서도 동일하게 렌더링함. */
export function SearchCompositionFixture(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <section className="grid gap-3" aria-labelledby="search-composition-title">
      <h2 className="text-lg font-medium" id="search-composition-title">
        검색창 조합
      </h2>
      <Button ref={triggerRef} className="w-fit" onClick={() => setOpen(true)}>
        한국어 검색 열기
      </Button>
      <SearchDialog
        locale="ko"
        open={open}
        onOpenChange={setOpen}
        finalFocus={() => triggerRef.current}
      />
    </section>
  );
}
