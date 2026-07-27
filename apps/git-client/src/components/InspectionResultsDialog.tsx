import { Button } from "@base-ui/react/button";
import type { CodeIssue } from "../domain/codeAnalysis";
import { cn } from "../lib/utils";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";
import { Dialog, DialogHeader } from "./ui";
import { EmptyState } from "./ui";
import { List, ListItem } from "./ui";

export function InspectionResultsDialog({
  issues,
  onClose,
  onOpenIssue,
  title,
}: {
  readonly issues: readonly CodeIssue[];
  readonly onClose: () => void;
  readonly onOpenIssue: (issue: CodeIssue) => void;
  readonly title: string;
}) {
  const fileCount = new Set(issues.map(({ path }) => path)).size;
  return (
    <Dialog
      aria-label={title}
      isOpen
      maxHeight="min(720px, calc(100vh - 70px))"
      onOpenChange={(open) => !open && onClose()}
      padding={0}
      purpose="info"
      width="min(860px, calc(100vw - 70px))"
    >
      <section className={tw.inspectionResultsDialog}>
        <DialogHeader hasDivider onOpenChange={(open) => !open && onClose()} title={title} />
        <header>
          <Icon name="search" size={14} />
          <span>
            {issues.length.toLocaleString()} problems in {fileCount.toLocaleString()} files
          </span>
        </header>
        {issues.length === 0 ? (
          <EmptyState
            description="The selected scope contains no problems."
            title="No suspicious code found"
          />
        ) : (
          <List aria-label="Inspection results" density="compact" role="listbox">
            {issues.map((issue, index) => (
              <ListItem
                description={issue.message}
                endContent={
                  <code>
                    {issue.line}:{issue.column}
                  </code>
                }
                key={`${issue.path}:${issue.line}:${issue.column}:${issue.inspectionId}:${index}`}
                label={issue.path}
                onClick={() => onOpenIssue(issue)}
                role="option"
                startContent={
                  <Icon name={issue.severity === "error" ? "warning" : "search"} size={14} />
                }
              />
            ))}
          </List>
        )}
        <footer>
          <Button
            data-slot="button"
            onClick={onClose}
            type="button"
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-8 px-3 border-primary bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/80",
            )}
          >
            Close
          </Button>
        </footer>
      </section>
    </Dialog>
  );
}
