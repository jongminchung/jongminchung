import { Button } from "@jongminchung/ui/components/button";
import { Checkbox } from "@jongminchung/ui/components/checkbox";
import { Textarea } from "@jongminchung/ui/components/textarea";
import { cn } from "@jongminchung/ui/lib/utils";
import { useState } from "react";
import type {
  HostingChangeRequest,
  HostingChangedFile,
  HostingMergeReadiness,
  HostingMergeReadinessReason,
  HostingReviewEvent,
  HostingTimelineEntry,
} from "../../shared/contracts/model/index";
import { openHostingUrl } from "../hosting-persistence";
import { Icon } from "../Icon";
import { EmptyState } from "../ProductCollections";

interface HostingRequestDetailsProps {
  readonly files: readonly HostingChangedFile[];
  readonly mergeReadiness?: HostingMergeReadiness;
  readonly onPostComment: (body: string) => Promise<boolean>;
  readonly onSubmitReview: (
    event: HostingReviewEvent,
    body: string,
  ) => Promise<boolean>;
  readonly onToggleViewed: (path: string) => void;
  readonly onUpdateBranch: () => void;
  readonly selected?: HostingChangeRequest;
  readonly timeline: readonly HostingTimelineEntry[];
  readonly viewed: ReadonlySet<string>;
}

export function HostingRequestDetails({
  files,
  mergeReadiness,
  onPostComment,
  onSubmitReview,
  onToggleViewed,
  onUpdateBranch,
  selected,
  timeline,
  viewed,
}: HostingRequestDetailsProps) {
  const [reviewBody, setReviewBody] = useState("");
  const [discussionBody, setDiscussionBody] = useState("");

  const submitReview = async (event: HostingReviewEvent): Promise<void> => {
    if (await onSubmitReview(event, reviewBody)) setReviewBody("");
  };
  const postComment = async (): Promise<void> => {
    if (await onPostComment(discussionBody.trim())) setDiscussionBody("");
  };

  return (
    <section
      className={`hostingDetail [&>_header]:[align-items:center] [&>_header]:[display:flex] [&>_header]:[gap:8px] [min-height:0] [overflow:auto] [&_small]:[color:var(--disabled-foreground)] [&>_header]:[border-bottom:1px_solid_var(--border)] [&>_header]:[padding:9px_11px] [&>_header_>_div]:[display:flex] [&>_header_>_div]:[flex:1] [&>_header_>_div]:[flex-direction:column] [&>_header_>_div]:[min-width:0] [&>_header_small]:[overflow:hidden] [&>_header_small]:[text-overflow:ellipsis] [&>_header_small]:[white-space:nowrap] [&_h3]:[color:var(--muted-foreground)] [&_h3]:[font-size:12px] [&_h3]:[margin:0] [&_h3]:[padding:10px_11px_6px] hostingDetail`}
      aria-label="Change request detail"
    >
      {!selected ? (
        <EmptyState title="Select a change request to inspect files and timeline." />
      ) : (
        <>
          <header>
            <div>
              <strong>
                #{selected.number} {selected.title}
              </strong>
              <small>{selected.webUrl}</small>
            </div>
            <Button
              onClick={() =>
                void navigator.clipboard.writeText(selected.webUrl)
              }
              type="button"
              className={cn("h-7 px-2.5")}
              variant="outline"
              size="sm"
            >
              <Icon name="copy" size={13} /> Copy link
            </Button>
            <a
              href={selected.webUrl}
              onClick={(event) => {
                event.preventDefault();
                void openHostingUrl(selected.webUrl);
              }}
              className={cn("h-7 px-2.5")}
            >
              <Icon name="external" size={13} /> Open
            </a>
            <Button
              onClick={onUpdateBranch}
              type="button"
              className={cn("h-7 px-2.5")}
              variant="outline"
              size="sm"
            >
              Update branch
            </Button>
          </header>
          <MergeReadinessSummary readiness={mergeReadiness} />
          <div
            className={`hostingReviewBar [align-items:center] [display:flex] [gap:8px] [border-bottom:1px_solid_var(--border)] [padding:8px_11px] [&_textarea]:[flex:1] [&_textarea]:[min-height:52px] [&_textarea]:[resize:vertical] hostingReviewBar`}
          >
            <Textarea
              aria-label="Review body"
              onChange={(event) => setReviewBody(event.target.value)}
              placeholder="Review or comment"
              value={reviewBody}
            />
            <Button
              onClick={() => void submitReview("comment")}
              type="button"
              className={cn("h-7 px-2.5")}
              variant="outline"
              size="sm"
            >
              Comment
            </Button>
            <Button
              onClick={() => void submitReview("approve")}
              type="button"
              className={cn("h-7 px-2.5")}
              variant="outline"
              size="sm"
            >
              Approve
            </Button>
            <Button
              disabled={!reviewBody.trim()}
              onClick={() => void submitReview("requestChanges")}
              type="button"
              className={cn("h-7 px-2.5")}
              variant="outline"
              size="sm"
            >
              Request changes
            </Button>
          </div>
          <h3>Changed files · {files.length}</h3>
          {files.map((file) => (
            <article
              className={`hostingFile [border-top:1px_solid_var(--border)] [padding:8px_11px] [&>_label]:[float:right] [&>_strong]:[display:block] [&>_small]:[display:block] [&_pre]:[background:var(--muted)] [&_pre]:[border:1px_solid_var(--border)] [&_pre]:rounded-lg [&_pre]:[font-size:12px] [&_pre]:[max-height:280px] [&_pre]:[overflow:auto] [&_pre]:[padding:9px] hostingFile [&_pre]:rounded-lg`}
              key={file.path}
            >
              <label>
                <Checkbox
                  checked={viewed.has(file.path)}
                  onCheckedChange={() => onToggleViewed(file.path)}
                />{" "}
                Viewed
              </label>
              <strong>{file.path}</strong>
              <small>
                +{file.additions} −{file.deletions} · {file.status}
              </small>
              {file.patch && (
                <pre
                  aria-label={`Diff for ${file.path}`}
                  // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Focus enables keyboard scrolling of long patches.
                  tabIndex={0}
                >
                  <code>{file.patch}</code>
                </pre>
              )}
            </article>
          ))}
          <h3>Timeline · {timeline.length}</h3>
          {timeline.map((entry) => (
            <article
              className={`hostingTimeline [border-top:1px_solid_var(--border)] [padding:8px_11px] [&_p]:[line-height:1.45] [&_p]:[margin:5px_0_0] [&_p]:[white-space:pre-wrap] [&_small]:[float:right] hostingTimeline`}
              key={entry.id}
            >
              <strong>{entry.author || entry.kind}</strong>
              <small>{entry.createdAt}</small>
              <p>{entry.body}</p>
            </article>
          ))}
          <div
            className={`hostingDiscussionComposer [align-items:flex-end] [border-top:1px_solid_var(--border)] [display:flex] [gap:8px] [padding:8px_11px] [&_textarea]:[flex:1] [&_textarea]:[min-height:54px] [&_textarea]:[resize:vertical] hostingDiscussionComposer`}
          >
            <Textarea
              aria-label="Add timeline comment"
              onChange={(event) => setDiscussionBody(event.target.value)}
              placeholder="Add a comment"
              value={discussionBody}
            />
            <Button
              disabled={!discussionBody.trim()}
              onClick={() => void postComment()}
              type="button"
              className={cn("h-7 px-2.5")}
              variant="outline"
              size="sm"
            >
              Comment
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

const READINESS_REASON_LABELS: Readonly<
  Record<HostingMergeReadinessReason, string>
> = Object.freeze({
  "checks-failing": "Required checks are failing",
  "checks-pending": "Required checks are still running",
  conflicts: "Conflicts must be resolved",
  draft: "Draft change request",
  "review-required": "Required review is missing",
  "branch-update-required": "Source branch must be updated",
  "permission-denied": "Token cannot read merge readiness",
  "rate-limited": "Provider rate limit reached",
  "provider-unsupported": "Provider does not expose this signal",
  "provider-unavailable": "Provider readiness is temporarily unavailable",
});

export function MergeReadinessSummary({
  readiness,
}: {
  readonly readiness?: HostingMergeReadiness;
}) {
  const state = readiness?.state ?? "pending";
  return (
    <section
      aria-label="Merge readiness"
      className="border-b border-border px-3 py-2"
    >
      <strong>Merge readiness · {state}</strong>
      {readiness ? (
        <>
          {readiness.reasons.length > 0 && (
            <ul>
              {readiness.reasons.map((reason) => (
                <li key={reason}>{READINESS_REASON_LABELS[reason]}</li>
              ))}
            </ul>
          )}
          <small>
            Signals: checks{" "}
            {readiness.capabilities.checks ? "available" : "unknown"}
            {" · reviews "}
            {readiness.capabilities.reviews ? "available" : "unknown"}
            {" · conflicts "}
            {readiness.capabilities.conflicts ? "available" : "unknown"}
            {" · branch update "}
            {readiness.capabilities.branchUpdate ? "available" : "unknown"}
          </small>
        </>
      ) : (
        <small>Loading provider signals…</small>
      )}
    </section>
  );
}
