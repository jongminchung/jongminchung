import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { executeCommand } from "./process.mjs";
import {
    buildRelease,
    createReleaseArtifactNames,
    parseReleaseVersion,
    verifyReleaseSource,
} from "./release.mjs";

export const githubRepository = "jongminchung/jongminchung";
export const fixedReleaseVersion = "1.0.0";

const appRoot = fileURLToPath(new URL("../", import.meta.url));
const workspaceRoot = fileURLToPath(new URL("../../../", import.meta.url));

export function createReleaseTag(value) {
    return `git-client-${assertFixedReleaseVersion(value)}`;
}

export function createReleaseTitle(value) {
    return `Git Client ${assertFixedReleaseVersion(value)}`;
}

export function assertFixedReleaseVersion(value) {
    const version = parseReleaseVersion(value);
    if (version !== fixedReleaseVersion) {
        throw new Error(
            `Git Client releases must reuse version ${fixedReleaseVersion}`,
        );
    }
    return version;
}

export function createReleaseNotes() {
    return `# ${fixedReleaseVersion}\n\nManual Git Client release.\n`;
}

export function createGitHubEnvironment(environment) {
    const token = environment.GH_TOKEN ?? environment.GH_PAT;
    if (!token)
        throw new Error(
            "Set GH_TOKEN in CI or GH_PAT for a local GitHub release",
        );
    return { ...environment, GH_TOKEN: token };
}

export function createGhReleaseArguments({
    artifacts,
    notesFile,
    sha,
    version,
}) {
    return [
        "release",
        "create",
        createReleaseTag(version),
        artifacts.dmg,
        artifacts.checksum,
        artifacts.provenance,
        "--repo",
        githubRepository,
        "--target",
        sha,
        "--title",
        createReleaseTitle(version),
        "--notes-file",
        notesFile,
        "--draft",
    ];
}

export function createGhTagReferenceArguments(tag) {
    return [
        "api",
        `repos/${githubRepository}/git/ref/tags/${tag}`,
        "--jq",
        ".object.sha",
    ];
}

export function createGhDeleteTagArguments(tag) {
    return [
        "api",
        "--method",
        "DELETE",
        `repos/${githubRepository}/git/refs/tags/${tag}`,
    ];
}

export function parseReleaseMetadata(value) {
    const parsed = JSON.parse(value);
    if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
    ) {
        throw new Error("Expected GitHub release metadata to be an object");
    }
    if (
        typeof parsed.isDraft !== "boolean" ||
        typeof parsed.isPrerelease !== "boolean" ||
        typeof parsed.name !== "string" ||
        typeof parsed.tagName !== "string" ||
        !Array.isArray(parsed.assets)
    ) {
        throw new Error("GitHub release metadata is missing required fields");
    }
    const assets = parsed.assets.map((asset) => {
        if (
            typeof asset !== "object" ||
            asset === null ||
            typeof asset.name !== "string"
        ) {
            throw new Error(
                "GitHub release metadata contains an invalid asset",
            );
        }
        return asset.name;
    });
    return {
        assets,
        isDraft: parsed.isDraft,
        isPrerelease: parsed.isPrerelease,
        name: parsed.name,
        tagName: parsed.tagName,
    };
}

export function assertReleaseMetadata(metadata, version, expectedDraft) {
    const names = createReleaseArtifactNames(version);
    const expectedAssets = [names.checksum, names.dmg, names.provenance].sort(
        (left, right) => left.localeCompare(right),
    );
    const actualAssets = [...metadata.assets].sort((left, right) =>
        left.localeCompare(right),
    );
    if (metadata.tagName !== createReleaseTag(version)) {
        throw new Error(`Unexpected release tag: ${metadata.tagName}`);
    }
    if (metadata.name !== createReleaseTitle(version)) {
        throw new Error(`Unexpected release title: ${metadata.name}`);
    }
    if (metadata.isDraft !== expectedDraft || metadata.isPrerelease) {
        throw new Error("Unexpected GitHub release publication state");
    }
    if (JSON.stringify(actualAssets) !== JSON.stringify(expectedAssets)) {
        throw new Error(
            `Unexpected release assets: ${actualAssets.join(", ")}`,
        );
    }
}

async function readReleaseMetadata(tag, environment, allowFailure = false) {
    const result = await executeCommand(
        "gh",
        [
            "release",
            "view",
            tag,
            "--repo",
            githubRepository,
            "--json",
            "assets,isDraft,isPrerelease,name,tagName",
        ],
        { allowFailure, capture: true, cwd: workspaceRoot, env: environment },
    );
    if (result.code !== 0) return null;
    return parseReleaseMetadata(result.stdout);
}

async function removeExistingRelease(tag, environment) {
    const metadata = await readReleaseMetadata(tag, environment, true);
    if (metadata === null) return;
    await executeCommand(
        "gh",
        [
            "release",
            "delete",
            tag,
            "--repo",
            githubRepository,
            "--cleanup-tag",
            "--yes",
        ],
        { cwd: workspaceRoot, env: environment },
    );
}

async function readRemoteTagSha(tag, environment) {
    const result = await executeCommand(
        "gh",
        createGhTagReferenceArguments(tag),
        {
            allowFailure: true,
            capture: true,
            cwd: workspaceRoot,
            env: environment,
        },
    );
    if (result.code !== 0) return null;
    const sha = result.stdout.trim();
    if (!/^[0-9a-f]{40}$/.test(sha)) {
        throw new Error(`Unexpected GitHub tag object SHA: ${sha}`);
    }
    return sha;
}

async function removeTagCreatedByCurrentRun(tag, sha, environment) {
    if ((await readRemoteTagSha(tag, environment)) !== sha) return;
    await executeCommand("gh", createGhDeleteTagArguments(tag), {
        cwd: workspaceRoot,
        env: environment,
    });
}

async function publishRelease(release) {
    const environment = createGitHubEnvironment(process.env);
    const tag = createReleaseTag(release.version);
    const artifacts = await buildRelease(release.version);
    const sha = artifacts.sourceSha;
    const notesFile = join(appRoot, "release-artifacts", "release-notes.md");
    await writeFile(notesFile, release.notes);

    await removeExistingRelease(tag, environment);
    if ((await readRemoteTagSha(tag, environment)) !== null) {
        await executeCommand("gh", createGhDeleteTagArguments(tag), {
            cwd: workspaceRoot,
            env: environment,
        });
    }

    let mayHaveCreatedDraft = false;
    try {
        mayHaveCreatedDraft = true;
        await executeCommand(
            "gh",
            createGhReleaseArguments({
                artifacts,
                notesFile,
                sha,
                version: release.version,
            }),
            { cwd: workspaceRoot, env: environment },
        );
        const draft = await readReleaseMetadata(tag, environment);
        if (!draft)
            throw new Error(`GitHub draft release was not created: ${tag}`);
        assertReleaseMetadata(draft, release.version, true);

        await executeCommand(
            "gh",
            [
                "release",
                "edit",
                tag,
                "--repo",
                githubRepository,
                "--draft=false",
            ],
            { cwd: workspaceRoot, env: environment },
        );
        mayHaveCreatedDraft = false;
        const published = await readReleaseMetadata(tag, environment);
        if (!published)
            throw new Error(`GitHub release was not published: ${tag}`);
        assertReleaseMetadata(published, release.version, false);
    } catch (error) {
        if (mayHaveCreatedDraft) {
            try {
                await removeExistingRelease(tag, environment);
                await removeTagCreatedByCurrentRun(tag, sha, environment);
            } catch (cleanupError) {
                throw new AggregateError(
                    [error, cleanupError],
                    `Release failed and cleanup was incomplete for ${tag}`,
                );
            }
        }
        throw error;
    }
}

export function parsePublishArguments(arguments_) {
    const unknown = arguments_.filter((argument) => argument !== "--dry-run");
    if (unknown.length > 0)
        throw new Error(`Unknown release argument: ${unknown[0]}`);
    return {
        dryRun: arguments_.includes("--dry-run"),
    };
}

async function main() {
    const options = parsePublishArguments(process.argv.slice(2));
    if (!options.dryRun) await verifyReleaseSource(workspaceRoot);
    const release = {
        notes: createReleaseNotes(),
        version: fixedReleaseVersion,
    };
    console.log(`Git Client release: ${release.version}`);
    if (options.dryRun) {
        console.log(release.notes);
        return;
    }
    await publishRelease(release);
}

const entryPoint = process.argv[1];
if (entryPoint && resolve(entryPoint) === fileURLToPath(import.meta.url)) {
    try {
        await main();
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
}
