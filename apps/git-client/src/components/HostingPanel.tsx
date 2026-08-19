import { Button } from "@jongminchung/ui/components/button";
import { Input } from "@jongminchung/ui/components/input";
import { isElectronRuntime } from "../platform/electron";
import {
    HostingAccountConnection,
    HostingRequestComposer,
    HostingRequestDetails,
    HostingRequestList,
} from "./hosting/index";
import { useHostingPanelController } from "./hosting/useHostingPanelController";
import { Icon } from "./Icon";
import { Notice } from "./Notice";
import { Selector } from "./ProductFormControls";

export function HostingPanel({
    remoteUrl,
    currentBranch,
}: {
    readonly remoteUrl?: string;
    readonly currentBranch?: string;
}) {
    const {
        accountId,
        accounts,
        busy,
        connect,
        coordinates,
        create,
        error,
        files,
        inspect,
        items,
        loadList,
        nextPage,
        notice,
        postComment,
        project,
        removeAccount,
        selected,
        selectedAccount,
        setAccountId,
        setProject,
        setShowCreate,
        showCreate,
        submitReview,
        syncFork,
        timeline,
        toggleViewed,
        updateBranch,
        viewed,
    } = useHostingPanelController({ remoteUrl, currentBranch });

    if (!isElectronRuntime()) {
        return (
            <section className="collectionIntro">
                <Icon name="globe" size={18} />
                <div>
                    <strong>GitHub and GitLab require the native app</strong>
                    <p>
                        Browser preview does not expose account or credential
                        operations.
                    </p>
                </div>
            </section>
        );
    }

    return (
        <div className="hostingPanel" aria-busy={Boolean(busy)}>
            <section className="hostingAccountBar">
                <Selector
                    className="bg-secondary"
                    label="Account"
                    onChange={setAccountId}
                    options={[
                        { label: "No account", value: "" },
                        ...accounts.map((account) => ({
                            label: `${account.login} · ${account.provider === "gitHub" ? "GitHub" : "GitLab"}`,
                            value: account.id,
                        })),
                    ]}
                    placeholder="No account"
                    value={accountId}
                />
                <label>
                    Project
                    <Input
                        aria-label="Hosting project"
                        onChange={(event) => setProject(event.target.value)}
                        placeholder="owner/repository"
                        value={project}
                    />
                </label>
                <Button
                    disabled={!accountId || Boolean(busy)}
                    onClick={() => void loadList()}
                    type="button"
                    className="h-7 px-2.5"
                    variant="outline"
                    size="sm"
                >
                    <Icon name="refresh" size={13} /> Load
                </Button>
                <Button
                    aria-controls="hosting-create-request"
                    aria-expanded={showCreate}
                    disabled={!accountId || !project.trim()}
                    onClick={() => setShowCreate((value) => !value)}
                    type="button"
                    className="h-7 px-2.5"
                    variant="outline"
                    size="sm"
                >
                    <Icon name="plus" size={13} /> New PR / MR
                </Button>
                {selectedAccount?.provider === "gitHub" && currentBranch && (
                    <Button
                        disabled={Boolean(busy) || !project.trim()}
                        onClick={() => void syncFork()}
                        type="button"
                        className="h-7 px-2.5"
                        variant="outline"
                        size="sm"
                    >
                        <Icon name="refresh" size={13} /> Sync fork
                    </Button>
                )}
            </section>

            <HostingAccountConnection
                accountId={accountId}
                accounts={accounts}
                busy={busy}
                initialBaseUrl={coordinates?.baseUrl ?? "https://github.com"}
                initialProvider={coordinates?.provider ?? "gitHub"}
                onConnect={connect}
                onRemove={removeAccount}
            />

            {error && (
                <Notice role="alert" size="sm" tone="destructive">
                    {error}
                </Notice>
            )}
            {notice && (
                <Notice role="status" size="sm" tone="success">
                    {notice}
                </Notice>
            )}
            {busy && <div className="hostingProgress">{busy}…</div>}

            {showCreate && (
                <HostingRequestComposer
                    currentBranch={currentBranch}
                    onCancel={() => setShowCreate(false)}
                    onCreate={create}
                />
            )}

            <div className="hostingColumns">
                <HostingRequestList
                    items={items}
                    nextPage={nextPage}
                    onInspect={(item) => void inspect(item)}
                    onLoadMore={(page) => void loadList(page, true)}
                    selectedNumber={selected?.number ?? null}
                />
                <HostingRequestDetails
                    files={files}
                    onPostComment={postComment}
                    onSubmitReview={submitReview}
                    onToggleViewed={(path) => void toggleViewed(path)}
                    onUpdateBranch={() => void updateBranch()}
                    selected={selected}
                    timeline={timeline}
                    viewed={viewed}
                />
            </div>
        </div>
    );
}
