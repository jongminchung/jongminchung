import { Button } from "@jongminchung/ui/components/button";
import { Checkbox } from "@jongminchung/ui/components/checkbox";
import { Input } from "@jongminchung/ui/components/input";
import {
  RadioGroup,
  RadioGroupItem,
} from "@jongminchung/ui/components/radio-group";
import { cn } from "@jongminchung/ui/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sanitizeGitError } from "../domain/gitActivity";
import {
  canForceWithLease,
  canNormalPush,
  createPushOperation,
  requiresPushConfirmation,
  type PushChoice,
} from "../domain/push";
import type {
  GitOperation,
  PushPreview,
  RemoteInfo,
} from "../shared/contracts/model/index";
import { useDismissLayer } from "./CommandProvider";
import { Icon } from "./Icon";
import { Notice } from "./Notice";
import { Spinner } from "./ProductCollections";
import {
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from "./ProductDialog";
import { Selector } from "./ProductFormControls";

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
  const [reviewExpired, setReviewExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const confirmationRef = useRef<HTMLInputElement>(null);
  const returnFocus = useRef<HTMLElement | null>(
    typeof document !== "undefined" &&
      document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const close = useCallback((): void => {
    const target = returnFocus.current;
    onClose();
    window.requestAnimationFrame(() => {
      if (target?.isConnected) target.focus();
    });
  }, [onClose]);

  const load = useCallback(
    async (
      selectedRemote: string | null,
      selectedRef: string | null,
    ): Promise<void> => {
      const current = generation.current + 1;
      generation.current = current;
      setLoading(true);
      setPreview(null);
      setReviewExpired(false);
      setError(null);
      setChoice("normal");
      setConfirmation("");
      try {
        const next = await onLoadPreview(
          selectedRemote,
          selectedRef,
          localRevision,
        );
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
    },
    [localRevision, onLoadPreview],
  );

  useEffect(() => {
    void load(null, null);
    return () => {
      generation.current += 1;
    };
  }, [localRevision, load]);

  useDismissLayer(
    useMemo(
      () => ({
        id: "push-dialog",
        priority: 135,
        active: true,
        dismiss: () => {
          if (!pushing) close();
        },
      }),
      [close, pushing],
    ),
  );

  const destinationBranch = branchName(preview?.remoteRef ?? remoteRef);
  const forceAvailable = preview ? canForceWithLease(preview) : false;
  const normalAvailable = preview ? canNormalPush(preview) : false;
  const requiresTypedConfirmation = preview
    ? requiresPushConfirmation(preview, choice, knownRewrite)
    : false;
  const confirmationValid =
    !requiresTypedConfirmation || confirmation === destinationBranch;
  const canSubmit = Boolean(
    preview &&
    !loading &&
    !pushing &&
    remote === preview.remote &&
    remoteRef === preview.remoteRef &&
    !reviewExpired &&
    confirmationValid &&
    (choice === "normal" ? normalAvailable : forceAvailable),
  );

  useEffect(() => {
    if (choice === "forceWithLease" && requiresTypedConfirmation) {
      confirmationRef.current?.focus();
    }
  }, [choice, requiresTypedConfirmation]);

  const submit = async (): Promise<void> => {
    if (!preview || !canSubmit) return;
    setPushing(true);
    setError(null);
    try {
      await onPush(createPushOperation(preview, choice, setUpstream));
      close();
    } catch (reason) {
      setReviewExpired(true);
      setConfirmation("");
      setError(
        `${sanitizeGitError(reason)} The reviewed remote state is no longer reusable. Review the destination again before retrying.`,
      );
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
        if (!isOpen && !pushing) close();
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
            if (!isOpen && !pushing) close();
          }}
          subtitle="Review the exact source, destination, and remote state before pushing."
          title="Push"
        />
        <DialogBody className="grid gap-4 p-4">
          <section className="grid grid-cols-2 gap-3 max-[600px]:grid-cols-1">
            <Selector
              className="bg-card text-foreground"
              hasAutoFocus
              label="Remote"
              onChange={setRemote}
              options={[
                ...remotes.map((item) => ({
                  label: item.name,
                  value: item.name,
                })),
                ...(remote && !remotes.some((item) => item.name === remote)
                  ? [{ label: remote, value: remote }]
                  : []),
              ]}
              value={remote}
            />
            <label className="grid gap-1 text-xs text-muted-foreground">
              Destination branch
              <Input
                className="min-h-8 rounded-md border border-border bg-card px-2 font-mono text-foreground"
                onChange={(event) => setRemoteRef(event.target.value)}
                value={remoteRef}
              />
            </label>
            <div className="col-span-2 flex items-center gap-2 max-[600px]:col-span-1">
              <Button
                onClick={() => void load(remote, remoteRef)}
                type="button"
                disabled={!remote || !remoteRef || loading}
                className={cn("h-7 px-2.5")}
                variant="outline"
                size="sm"
              >
                {loading ? "Checking remote…" : "Review destination"}
              </Button>
              {preview && (
                <small className="text-muted-foreground">
                  Checked {new Date(preview.checkedAtMs).toLocaleTimeString()}{" "}
                  against an exact remote snapshot
                </small>
              )}
            </div>
          </section>

          {loading ? (
            <Spinner
              className="min-h-24 w-full justify-center"
              label="Checking destination…"
            />
          ) : preview ? (
            <>
              <section className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg border border-border bg-muted p-3 text-xs">
                <span className="text-muted-foreground">Source</span>
                <strong>
                  {preview.sourceBranch ?? preview.sourceRevision} ·{" "}
                  {shortOid(preview.localOid)}
                </strong>
                <span className="text-muted-foreground">Destination</span>
                <strong>
                  {preview.remote}/{branchName(preview.remoteRef)} ·{" "}
                  {shortOid(preview.remoteOid)}
                </strong>
                <span className="text-muted-foreground">State</span>
                <strong>
                  {preview.newBranch
                    ? "New branch"
                    : preview.fastForward === true
                      ? "Fast-forward"
                      : preview.fastForward === false
                        ? "Diverged / rewritten"
                        : "Needs fetch"}
                </strong>
                <span className="text-muted-foreground">Relationship</span>
                <strong>
                  {preview.ahead} ahead · {preview.behind} behind
                </strong>
                <span className="text-muted-foreground">Expected lease</span>
                <strong className="font-mono">
                  {shortOid(preview.expectedLeaseOid)}
                </strong>
              </section>

              {reviewExpired && (
                <Notice
                  icon={<Icon name="warning" size={16} />}
                  role="alert"
                  tone="warning"
                >
                  <span>
                    Destination review expired. Review the destination again to
                    fetch a new exact lease before retrying.
                  </span>
                </Notice>
              )}

              {preview.remoteStateError && (
                <Notice
                  icon={<Icon name="warning" size={16} />}
                  role="status"
                  tone="warning"
                >
                  <span>
                    {preview.remoteStateError} Normal push remains available;
                    force push is disabled.
                  </span>
                </Notice>
              )}
              {preview.fastForward === false && (
                <Notice
                  icon={<Icon name="warning" size={16} />}
                  role="alert"
                  tone="destructive"
                >
                  <span>
                    <strong>
                      {knownRewrite
                        ? "Local history was rewritten."
                        : "Remote commits may be replaced."}
                    </strong>{" "}
                    Normal push cannot update this destination.
                  </span>
                </Notice>
              )}
              {preview.warnings.map((warning) => (
                <p className="m-0 text-xs text-muted-foreground" key={warning}>
                  • {warning}
                </p>
              ))}

              <fieldset className="grid gap-2 rounded-lg border border-border p-3">
                <legend className="px-1 text-xs font-semibold">
                  Push mode
                </legend>
                <RadioGroup
                  name="push-mode"
                  onValueChange={(value) => {
                    if (value !== "normal" && value !== "forceWithLease")
                      return;
                    setChoice(value);
                    if (value === "normal") setConfirmation("");
                  }}
                  value={choice}
                >
                  <label
                    aria-label="Normal push"
                    className="flex items-start gap-2"
                  >
                    <RadioGroupItem
                      disabled={!normalAvailable}
                      value="normal"
                    />
                    <span>
                      <strong>Normal push</strong>
                      <small className="block text-muted-foreground">
                        Updates only when the destination is a fast-forward.
                      </small>
                    </span>
                  </label>
                  {!preview.newBranch && (
                    <label
                      aria-label="Force push with lease"
                      className="flex items-start gap-2"
                    >
                      <RadioGroupItem
                        disabled={!forceAvailable}
                        value="forceWithLease"
                      />
                      <span>
                        <strong>Force push with lease</strong>
                        <small className="block text-muted-foreground">
                          Uses the exact reviewed remote OID. It is rejected if
                          the remote changes.
                        </small>
                      </span>
                    </label>
                  )}
                </RadioGroup>
              </fieldset>

              {choice === "forceWithLease" && (
                <Notice role="alert" tone="destructive">
                  <section className="grid gap-2">
                    <strong>Remote impact</strong>
                    <span>
                      {shortOid(preview.remoteOid)} →{" "}
                      {shortOid(preview.localOid)} on {preview.remoteRef}
                    </span>
                    <span>
                      {preview.remoteOnlyCommits.length} remote-only commit(s)
                      may no longer be reachable from this branch.
                    </span>
                    {preview.remoteOnlyCommits.slice(0, 8).map((commit) => (
                      <code key={commit.oid}>
                        {commit.oid.slice(0, 8)} {commit.subject}
                      </code>
                    ))}
                    {requiresTypedConfirmation && (
                      <label className="grid gap-1 text-xs">
                        Type <strong>{destinationBranch}</strong> to confirm
                        <Input
                          ref={confirmationRef}
                          aria-label={`Type ${destinationBranch} to confirm force push with lease`}
                          autoComplete="off"
                          className="min-h-8 rounded-md border border-destructive bg-card px-2 font-mono"
                          onChange={(event) =>
                            setConfirmation(event.target.value)
                          }
                          value={confirmation}
                        />
                      </label>
                    )}
                  </section>
                </Notice>
              )}

              <section className="grid gap-2">
                <div className="flex items-center gap-2">
                  <strong>{preview.commits.length} commit(s) to push</strong>
                  <span className="flex-1" />
                  <label className="text-xs">
                    <Checkbox
                      checked={setUpstream}
                      onCheckedChange={setSetUpstream}
                    />{" "}
                    Set upstream after push
                  </label>
                </div>
                <div className="grid max-h-36 gap-1 overflow-auto rounded-lg border border-border bg-muted p-2 font-mono text-xs">
                  {preview.commits.length === 0 ? (
                    <span className="text-muted-foreground">
                      No local-only commits.
                    </span>
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
            <Notice role="alert" tone="destructive">
              {error}
            </Notice>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            onClick={close}
            type="button"
            disabled={pushing}
            className={cn("h-7 px-2.5")}
            variant="ghost"
            size="sm"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!canSubmit}
            className={cn("h-7 px-2.5")}
            variant={choice === "forceWithLease" ? "destructive" : "default"}
            size="sm"
          >
            {pushing
              ? "Pushing…"
              : choice === "forceWithLease"
                ? "Force Push with Lease"
                : "Push"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
