import { useEffect, useMemo, useRef, useState } from "react";
import { sanitizeGitError } from "../domain/gitActivity";
import {
  canForceWithLease,
  canNormalPush,
  createPushOperation,
  requiresPushConfirmation,
  type PushChoice,
} from "../domain/push";
import type { GitOperation, PushPreview, RemoteInfo } from "../shared/contracts/model";
import { useDismissLayer } from "./CommandProvider";
import { Icon } from "./Icon";
import { Button } from "./ui";
import { Dialog, DialogHeader } from "./ui";

function branchName(remoteRef: string): string {
  return remoteRef.replace(/^refs\/heads\//, "");
}

function shortOid(oid: string | null): string {
  return oid?.slice(0, 10) ?? "Not present";
}

export function PushDialog({
  remotes,
  knownRewrite,
  localRevision = "HEAD",
  onClose,
  onLoadPreview,
  onPush,
}: {
  readonly remotes: readonly RemoteInfo[];
  readonly knownRewrite: boolean;
  readonly localRevision?: string;
  readonly onClose: () => void;
  readonly onLoadPreview: (
    remote: string | null,
    remoteRef: string | null,
    localRevision: string,
  ) => Promise<PushPreview>;
  readonly onPush: (operation: GitOperation) => Promise<void>;
}) {
  const [preview, setPreview] = useState<PushPreview | null>(null);
  const [remote, setRemote] = useState("");
  const [remoteRef, setRemoteRef] = useState("");
  const [setUpstream, setSetUpstream] = useState(false);
  const [choice, setChoice] = useState<PushChoice>("normal");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(true);
  const [pushing, setPushing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);

  const load = async (selectedRemote: string | null, selectedRef: string | null): Promise<void> => {
    const current = generation.current + 1;
    generation.current = current;
    setLoading(true);
    setError(null);
    setChoice("normal");
    setConfirmation("");
    try {
      const next = await onLoadPreview(selectedRemote, selectedRef, localRevision);
      if (generation.current !== current) return;
      setPreview(next);
      setRemote(next.remote);
      setRemoteRef(next.remoteRef);
      setSetUpstream(next.setUpstreamDefault);
    } catch (reason) {
      if (generation.current === current) setError(sanitizeGitError(reason));
    } finally {
      if (generation.current === current) setLoading(false);
    }
  };

  useEffect(() => {
    void load(null, null);
    return () => {
      generation.current += 1;
    };
  }, [localRevision]);

  useDismissLayer(
    useMemo(
      () => ({
        id: "push-dialog",
        priority: 135,
        active: true,
        dismiss: onClose,
      }),
      [onClose],
    ),
  );

  const destinationBranch = branchName(preview?.remoteRef ?? remoteRef);
  const forceAvailable = preview ? canForceWithLease(preview) : false;
  const normalAvailable = preview ? canNormalPush(preview) : false;
  const requiresTypedConfirmation = preview
    ? requiresPushConfirmation(preview, choice, knownRewrite)
    : false;
  const confirmationValid = !requiresTypedConfirmation || confirmation === destinationBranch;
  const canSubmit = Boolean(
    preview &&
    !loading &&
    !pushing &&
    remote === preview.remote &&
    remoteRef === preview.remoteRef &&
    confirmationValid &&
    (choice === "normal" ? normalAvailable : forceAvailable),
  );

  const submit = async (): Promise<void> => {
    if (!preview || !canSubmit) return;
    setPushing(true);
    setError(null);
    try {
      await onPush(createPushOperation(preview, choice, setUpstream));
      onClose();
    } catch (reason) {
      setError(sanitizeGitError(reason));
    } finally {
      setPushing(false);
    }
  };

  return (
    <Dialog
      aria-label="Push"
      isOpen
      maxHeight="calc(100vh - 48px)"
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      padding={0}
      purpose="form"
      width="min(720px, calc(100vw - 48px))"
    >
      <form
        className="flex min-h-0 flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <DialogHeader
          hasDivider
          onOpenChange={(isOpen) => {
            if (!isOpen) onClose();
          }}
          subtitle="Review the exact source, destination, and remote state before pushing."
          title="Push"
        />
        <div className="grid min-h-0 gap-4 overflow-auto p-4">
          <section className="grid grid-cols-2 gap-3 max-[600px]:grid-cols-1">
            <label className="grid gap-1 text-xs text-secondary">
              Remote
              <select
                className="min-h-8 rounded-md border border-border bg-card px-2 text-primary"
                onChange={(event) => setRemote(event.target.value)}
                value={remote}
              >
                {remotes.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.name}
                  </option>
                ))}
                {remote && !remotes.some((item) => item.name === remote) && (
                  <option value={remote}>{remote}</option>
                )}
              </select>
            </label>
            <label className="grid gap-1 text-xs text-secondary">
              Destination branch
              <input
                className="min-h-8 rounded-md border border-border bg-card px-2 font-mono text-primary"
                onChange={(event) => setRemoteRef(event.target.value)}
                value={remoteRef}
              />
            </label>
            <div className="col-span-2 flex items-center gap-2 max-[600px]:col-span-1">
              <Button
                isDisabled={!remote || !remoteRef || loading}
                label={loading ? "Checking remote…" : "Review destination"}
                onClick={() => void load(remote, remoteRef)}
                size="sm"
                variant="secondary"
              />
              {preview && (
                <small className="text-secondary">
                  Checked {new Date(preview.checkedAtMs).toLocaleTimeString()}
                </small>
              )}
            </div>
          </section>

          {loading ? (
            <div
              className="flex min-h-24 items-center justify-center gap-2 text-secondary"
              role="status"
            >
              <span className="activitySpinner" />
              Checking destination…
            </div>
          ) : preview ? (
            <>
              <section className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg border border-border bg-muted p-3 text-xs">
                <span className="text-secondary">Source</span>
                <strong>
                  {preview.sourceBranch ?? preview.sourceRevision} · {shortOid(preview.localOid)}
                </strong>
                <span className="text-secondary">Destination</span>
                <strong>
                  {preview.remote}/{branchName(preview.remoteRef)} · {shortOid(preview.remoteOid)}
                </strong>
                <span className="text-secondary">State</span>
                <strong>
                  {preview.newBranch
                    ? "New branch"
                    : preview.fastForward === true
                      ? "Fast-forward"
                      : preview.fastForward === false
                        ? "Diverged / rewritten"
                        : "Needs fetch"}
                </strong>
                <span className="text-secondary">Relationship</span>
                <strong>
                  {preview.ahead} ahead · {preview.behind} behind
                </strong>
              </section>

              {preview.remoteStateError && (
                <div
                  className="flex gap-2 rounded-lg border border-warning bg-warning/10 p-3 text-sm"
                  role="status"
                >
                  <Icon name="warning" size={16} />
                  <span>
                    {preview.remoteStateError} Normal push remains available; force push is
                    disabled.
                  </span>
                </div>
              )}
              {preview.fastForward === false && (
                <div
                  className="flex gap-2 rounded-lg border border-destructive bg-destructive-muted p-3 text-sm"
                  role="alert"
                >
                  <Icon name="warning" size={16} />
                  <span>
                    <strong>
                      {knownRewrite
                        ? "Local history was rewritten."
                        : "Remote commits may be replaced."}
                    </strong>{" "}
                    Normal push cannot update this destination.
                  </span>
                </div>
              )}
              {preview.warnings.map((warning) => (
                <p className="m-0 text-xs text-secondary" key={warning}>
                  • {warning}
                </p>
              ))}

              <fieldset className="grid gap-2 rounded-lg border border-border p-3">
                <legend className="px-1 text-xs font-semibold">Push mode</legend>
                <label className="flex items-start gap-2">
                  <input
                    checked={choice === "normal"}
                    disabled={!normalAvailable}
                    name="push-mode"
                    onChange={() => {
                      setChoice("normal");
                      setConfirmation("");
                    }}
                    type="radio"
                  />
                  <span>
                    <strong>Normal push</strong>
                    <small className="block text-secondary">
                      Updates only when the destination is a fast-forward.
                    </small>
                  </span>
                </label>
                {!preview.newBranch && (
                  <label className="flex items-start gap-2">
                    <input
                      checked={choice === "forceWithLease"}
                      disabled={!forceAvailable}
                      name="push-mode"
                      onChange={() => setChoice("forceWithLease")}
                      type="radio"
                    />
                    <span>
                      <strong>Force push with lease</strong>
                      <small className="block text-secondary">
                        Uses the exact reviewed remote OID. It is rejected if the remote changes.
                      </small>
                    </span>
                  </label>
                )}
              </fieldset>

              {choice === "forceWithLease" && (
                <section className="grid gap-2 rounded-lg border border-destructive bg-destructive-muted p-3 text-sm">
                  <strong>Remote impact</strong>
                  <span>
                    {shortOid(preview.remoteOid)} → {shortOid(preview.localOid)} on{" "}
                    {preview.remoteRef}
                  </span>
                  <span>
                    {preview.remoteOnlyCommits.length} remote-only commit(s) may no longer be
                    reachable from this branch.
                  </span>
                  {preview.remoteOnlyCommits.slice(0, 8).map((commit) => (
                    <code key={commit.oid}>
                      {commit.oid.slice(0, 8)} {commit.subject}
                    </code>
                  ))}
                  {requiresTypedConfirmation && (
                    <label className="grid gap-1 text-xs">
                      Type <strong>{destinationBranch}</strong> to confirm
                      <input
                        className="min-h-8 rounded-md border border-destructive bg-card px-2 font-mono"
                        onChange={(event) => setConfirmation(event.target.value)}
                        value={confirmation}
                      />
                    </label>
                  )}
                </section>
              )}

              <section className="grid gap-2">
                <div className="flex items-center gap-2">
                  <strong>{preview.commits.length} commit(s) to push</strong>
                  <span className="flex-1" />
                  <label className="text-xs">
                    <input
                      checked={setUpstream}
                      onChange={(event) => setSetUpstream(event.target.checked)}
                      type="checkbox"
                    />{" "}
                    Set upstream after push
                  </label>
                </div>
                <div className="grid max-h-36 gap-1 overflow-auto rounded-lg border border-border bg-muted p-2 font-mono text-xs">
                  {preview.commits.length === 0 ? (
                    <span className="text-secondary">No local-only commits.</span>
                  ) : (
                    preview.commits.map((commit) => (
                      <span key={commit.oid}>
                        {commit.oid.slice(0, 8)} {commit.subject}
                      </span>
                    ))
                  )}
                </div>
              </section>
            </>
          ) : null}
          {error && (
            <div
              className="rounded-lg border border-destructive bg-destructive-muted p-3 text-sm"
              role="alert"
            >
              {error}
            </div>
          )}
        </div>
        <footer className="flex justify-end gap-2 border-t border-border p-3">
          <Button label="Cancel" onClick={onClose} size="sm" variant="ghost" />
          <Button
            isDisabled={!canSubmit}
            label={
              pushing ? "Pushing…" : choice === "forceWithLease" ? "Force Push with Lease" : "Push"
            }
            size="sm"
            type="submit"
            variant={choice === "forceWithLease" ? "destructive" : "primary"}
          />
        </footer>
      </form>
    </Dialog>
  );
}
