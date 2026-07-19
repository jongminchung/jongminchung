import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { List, ListItem } from "@astryxdesign/core/List";
import type { CodeIssue } from "../domain/codeAnalysis";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";

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
    <Dialog aria-label={title} isOpen maxHeight="min(720px, calc(100vh - 70px))" onOpenChange={(open) => !open && onClose()} padding={0} purpose="info" width="min(860px, calc(100vw - 70px))">
      <section className={tw.inspectionResultsDialog}>
        <DialogHeader hasDivider onOpenChange={(open) => !open && onClose()} title={title} />
        <header>
          <Icon name="search" size={14} />
          <span>{issues.length.toLocaleString()} problems in {fileCount.toLocaleString()} files</span>
        </header>
        {issues.length === 0 ? (
          <EmptyState description="The selected scope contains no problems." title="No suspicious code found" />
        ) : (
          <List aria-label="Inspection results" density="compact" role="listbox">
            {issues.map((issue, index) => (
              <ListItem
                description={issue.message}
                endContent={<code>{issue.line}:{issue.column}</code>}
                key={`${issue.path}:${issue.line}:${issue.column}:${issue.inspectionId}:${index}`}
                label={issue.path}
                onClick={() => onOpenIssue(issue)}
                role="option"
                startContent={<Icon name={issue.severity === "error" ? "warning" : "search"} size={14} />}
              />
            ))}
          </List>
        )}
        <footer><Button label="Close" onClick={onClose} variant="primary" /></footer>
      </section>
    </Dialog>
  );
}
