"use client";

import { Button } from "@jongminchung/ui/components/button";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type CopyState = "idle" | "copied" | "failed";

/** 렌더링된 글의 제목·설명·본문을 일반 텍스트로 복사함 */
export function ArticleCopyButton({
  copyLabel,
  copiedLabel,
  failedLabel,
}: {
  readonly copyLabel: string;
  readonly copiedLabel: string;
  readonly failedLabel: string;
}) {
  const [state, setState] = useState<CopyState>("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current !== null) clearTimeout(resetTimer.current);
    };
  }, []);

  const label =
    state === "copied"
      ? copiedLabel
      : state === "failed"
        ? failedLabel
        : copyLabel;

  const copyArticle = async (): Promise<void> => {
    const content = [
      document.querySelector<HTMLElement>("[data-copy-title]"),
      document.querySelector<HTMLElement>("[data-copy-description]"),
      document.querySelector<HTMLElement>("[data-copy-article]"),
    ]
      .map((element) => element?.innerText.trim() ?? "")
      .filter(Boolean)
      .join("\n\n");

    try {
      if (content.length === 0) throw new Error("Article content is empty");
      await navigator.clipboard.writeText(content);
      setState("copied");
    } catch {
      setState("failed");
    }

    if (resetTimer.current !== null) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setState("idle"), 2_000);
  };

  return (
    <Button
      aria-label={label}
      className="-my-2 h-11 px-3 text-xs"
      data-article-copy="true"
      onClick={() => {
        void copyArticle();
      }}
      type="button"
      variant="outline"
    >
      {state === "copied" ? <CheckIcon /> : <CopyIcon />}
      <span aria-live="polite">{label}</span>
    </Button>
  );
}
