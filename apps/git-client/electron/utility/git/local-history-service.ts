import { isAbsolute } from "node:path";
import { z } from "zod";
import {
    GitLocalHistoryActivitiesPageSchema,
    GitLocalHistoryActivityDetailSchema,
    GitLocalHistoryScopeSchema,
    GitRelativePathSchema,
    RepositoryIdSchema,
    type GitLocalHistoryActivitiesPage,
    type GitLocalHistoryActivity,
    type GitLocalHistoryActivityDetail,
    type GitLocalHistoryScope,
    type RepositoryId,
} from "../../../src/shared/contracts/git-utility";
import type { GitProcessRunnerLike } from "./git-process";
import { LocalHistoryCapture } from "./local-history-capture";
import {
    DEFAULT_LOCAL_HISTORY_PAGE_SIZE,
    createLocalHistoryChanges,
    publicLocalHistoryActivity,
    publicLocalHistoryChange,
} from "./local-history-model";
import { LocalHistoryStorage } from "./local-history-storage";
import { invalid, isErrno } from "./local-history-support";
import type { RepositoryRegistry } from "./repository-registry";

export class LocalHistoryService {
    readonly #storage: LocalHistoryStorage;
    readonly #capture: LocalHistoryCapture;
    readonly #mutations = new Map<RepositoryId, Promise<void>>();

    private constructor(
        registry: RepositoryRegistry,
        storageRoot: string,
        runner: GitProcessRunnerLike,
        now: () => number,
    ) {
        if (!isAbsolute(storageRoot))
            throw invalid("Local History storage root must be absolute");
        this.#storage = new LocalHistoryStorage(storageRoot, now);
        this.#capture = new LocalHistoryCapture(
            registry,
            runner,
            this.#storage,
        );
    }

    static of(
        registry: RepositoryRegistry,
        storageRoot: string,
        runner: GitProcessRunnerLike,
        now: () => number = Date.now,
    ): LocalHistoryService {
        return new LocalHistoryService(registry, storageRoot, runner, now);
    }

    async initialize(
        repositoryId: RepositoryId,
        signal?: AbortSignal,
    ): Promise<void> {
        const id = RepositoryIdSchema.parse(repositoryId);
        await this.#serialize(id, async () => {
            await this.#storage.archiveLegacy(id);
            try {
                const current = await this.#storage.readCurrent(id);
                if (current.size === 0)
                    await this.#storage.writeCurrent(
                        id,
                        await this.#capture.captureState(id, signal),
                    );
                await this.#storage.purge(id);
            } catch (error) {
                if (
                    !(error instanceof z.ZodError) &&
                    !(error instanceof SyntaxError) &&
                    !isErrno(error, "ENOENT")
                ) {
                    throw error;
                }
                await this.#storage.quarantineCorruptRepository(id);
                await this.#storage.writeCurrent(
                    id,
                    await this.#capture.captureState(id, signal),
                );
            }
        });
    }

    async record(
        repositoryId: RepositoryId,
        name: string,
        system = false,
        signal?: AbortSignal,
    ): Promise<GitLocalHistoryActivity | null> {
        const id = RepositoryIdSchema.parse(repositoryId);
        return this.#serialize(id, async () => {
            const previous = await this.#storage.readCurrent(id);
            const current = await this.#capture.captureState(id, signal);
            if (previous.size === 0) {
                await this.#storage.writeCurrent(id, current);
                return null;
            }
            const changes = createLocalHistoryChanges(previous, current);
            await this.#storage.writeCurrent(id, current);
            if (changes.length === 0) return null;
            return this.#storage.append(id, name, null, system, changes);
        });
    }

    async putLabel(
        repositoryId: RepositoryId,
        label: string,
    ): Promise<GitLocalHistoryActivity> {
        const id = RepositoryIdSchema.parse(repositoryId);
        const value = label.trim();
        if (value.length === 0)
            throw invalid("Local History label must not be empty");
        return this.#serialize(id, () =>
            this.#storage.append(id, value, value, false, []),
        );
    }

    async list(
        scope: GitLocalHistoryScope,
        cursor: string | null,
        limit = DEFAULT_LOCAL_HISTORY_PAGE_SIZE,
        query = "",
        showSystemEvents = true,
    ): Promise<GitLocalHistoryActivitiesPage> {
        const parsed = GitLocalHistoryScopeSchema.parse(scope);
        const manifest = await this.#storage.readManifest(parsed.repositoryId);
        const activities = await Promise.all(
            manifest.activityIds.map((id) =>
                this.#storage.readActivity(parsed.repositoryId, id),
            ),
        );
        const needle = query.trim().toLocaleLowerCase();
        const filtered = activities.filter((activity) => {
            if (!showSystemEvents && activity.system) return false;
            if (
                parsed.kind === "file" &&
                !activity.changes.some((change) => change.path === parsed.path)
            )
                return false;
            if (needle.length === 0) return true;
            return (
                activity.name.toLocaleLowerCase().includes(needle) ||
                activity.changes.some((change) =>
                    change.path.toLocaleLowerCase().includes(needle),
                )
            );
        });
        const start =
            cursor === null
                ? 0
                : Math.max(
                      0,
                      filtered.findIndex((item) => item.id === cursor) + 1,
                  );
        const page = filtered.slice(start, start + limit);
        return GitLocalHistoryActivitiesPageSchema.parse({
            activities: page.map(publicLocalHistoryActivity),
            nextCursor:
                start + limit < filtered.length
                    ? (page.at(-1)?.id ?? null)
                    : null,
        });
    }

    async detail(
        repositoryId: RepositoryId,
        activityId: string,
    ): Promise<GitLocalHistoryActivityDetail> {
        const activity = await this.#storage.readActivity(
            RepositoryIdSchema.parse(repositoryId),
            activityId,
        );
        return GitLocalHistoryActivityDetailSchema.parse({
            activity: publicLocalHistoryActivity(activity),
            changes: activity.changes.map(publicLocalHistoryChange),
        });
    }

    async diff(
        repositoryId: RepositoryId,
        activityId: string,
        path: string,
        signal?: AbortSignal,
    ): Promise<string> {
        const id = RepositoryIdSchema.parse(repositoryId);
        const safePath = GitRelativePathSchema.parse(path);
        const activity = await this.#storage.readActivity(id, activityId);
        const change = activity.changes.find(
            (candidate) =>
                candidate.path === safePath ||
                candidate.previousPath === safePath,
        );
        if (change === undefined) return "";
        const [before, after] = await Promise.all([
            this.#capture.readContent(id, change.before, signal),
            this.#capture.readContent(id, change.after, signal),
        ]);
        if (before === null || after === null)
            return `Binary or unavailable content changed: ${safePath}`;
        if (before.equals(after)) return "";
        const beforeLines = before.toString("utf8").split(/\r?\n/u);
        const afterLines = after.toString("utf8").split(/\r?\n/u);
        return [
            `--- Local History/${change.previousPath ?? safePath}`,
            `+++ Current/${safePath}`,
            `@@ -1,${beforeLines.length} +1,${afterLines.length} @@`,
            ...beforeLines.map((line) => `-${line}`),
            ...afterLines.map((line) => `+${line}`),
        ].join("\n");
    }

    async createPatch(
        repositoryId: RepositoryId,
        activityId: string,
        paths: readonly string[],
        signal?: AbortSignal,
    ): Promise<string> {
        const detail = await this.detail(repositoryId, activityId);
        const selected =
            paths.length === 0
                ? detail.activity.paths
                : paths.map((path) => GitRelativePathSchema.parse(path));
        const patches = await Promise.all(
            selected.map((path) =>
                this.diff(repositoryId, activityId, path, signal),
            ),
        );
        return patches.filter(Boolean).join("\n\n");
    }

    async revert(
        repositoryId: RepositoryId,
        activityId: string,
        paths: readonly string[],
        includeLater: boolean,
        signal?: AbortSignal,
    ): Promise<void> {
        const id = RepositoryIdSchema.parse(repositoryId);
        await this.#serialize(id, async () => {
            const beforeRevert = await this.#capture.captureState(id, signal);
            const manifest = await this.#storage.readManifest(id);
            const index = manifest.activityIds.indexOf(activityId);
            if (index < 0)
                throw invalid("Local History activity does not exist");
            const activities = await Promise.all(
                manifest.activityIds
                    .slice(0, includeLater ? index + 1 : 1)
                    .map((value) =>
                        this.#storage.readActivity(
                            id,
                            includeLater ? value : activityId,
                        ),
                    ),
            );
            const selected = new Set(
                paths.map((path) => GitRelativePathSchema.parse(path)),
            );
            for (const activity of activities) {
                for (const change of activity.changes) {
                    if (
                        selected.size > 0 &&
                        !selected.has(change.path) &&
                        (change.previousPath === null ||
                            !selected.has(change.previousPath))
                    )
                        continue;
                    await this.#capture.restoreState(
                        id,
                        change.previousPath ?? change.path,
                        change.before,
                        signal,
                    );
                    if (
                        change.previousPath !== null &&
                        change.previousPath !== change.path
                    ) {
                        await this.#capture.restoreState(
                            id,
                            change.path,
                            null,
                            signal,
                        );
                    }
                }
            }
            const afterRevert = await this.#capture.captureState(id, signal);
            await this.#storage.writeCurrent(id, afterRevert);
            const changes = createLocalHistoryChanges(
                beforeRevert,
                afterRevert,
            );
            if (changes.length > 0) {
                await this.#storage.append(
                    id,
                    "Revert Local History",
                    null,
                    true,
                    changes,
                );
            }
        });
    }

    async #serialize<T>(
        repositoryId: RepositoryId,
        operation: () => Promise<T>,
    ): Promise<T> {
        const previous = this.#mutations.get(repositoryId) ?? Promise.resolve();
        const current = previous.catch(() => undefined).then(operation);
        const settled = current.then(
            () => undefined,
            () => undefined,
        );
        this.#mutations.set(repositoryId, settled);
        try {
            return await current;
        } finally {
            if (this.#mutations.get(repositoryId) === settled)
                this.#mutations.delete(repositoryId);
        }
    }
}
