import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import type { CodeIssue } from "../domain/codeAnalysis";
import { Icon } from "./Icon";
import { EmptyState } from "./ProductCollections";
import { List, ListItem } from "./ProductCollections";
import { Dialog, DialogHeader } from "./ProductDialog";

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
      <section
        className={`inspectionResultsDialog [display:grid] [grid-template-rows:auto_32px_minmax(300px,_1fr)_auto] [height:min(680px,_calc(100vh_-_80px))] [&>_header]:[align-items:center] [&>_header]:[border-bottom:1px_solid_var(--border)] [&>_header]:[display:flex] [&>_header]:[gap:7px] [&>_header]:[padding:0_10px] [&>_header_span]:[color:var(--muted-foreground)] [&>_div[role=listbox]]:[min-height:0] [&>_div[role=listbox]]:[overflow:auto] [&>_div[role=listbox]]:[padding:5px_7px] [&>_footer]:[border-top:1px_solid_var(--border)] [&>_footer]:[display:flex] [&>_footer]:[justify-content:flex-end] [&>_footer]:[padding:8px_10px] inspectionResultsDialog`}
      >
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
            onClick={onClose}
            type="button"
            className={cn("h-8 px-3")}
            variant="default"
            size="default"
          >
            Close
          </Button>
        </footer>
      </section>
    </Dialog>
  );
}
