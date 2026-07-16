import type {
  BlameLine,
  Commit,
  FileChange,
  Ref,
  StashEntry,
  StatusModel,
  TreeEntry,
} from "./types";

const STATUS_MAP: Readonly<Record<string, FileChange["status"]>> = {
  A: "added",
  C: "copied",
  D: "deleted",
  M: "modified",
  R: "renamed",
  T: "modified",
  U: "conflicted",
};

export function parseStatusV2(output: string): StatusModel {
  let branchOid: string | undefined;
  let branch: string | undefined;
  let upstream: string | undefined;
  let ahead = 0;
  let behind = 0;
  let stashCount = 0;
  const changes: FileChange[] = [];
  const records = output.replace(/\n(?=(?:# |[12u?!] ))/g, "\0").split("\0");

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) continue;
    if (record.startsWith("# branch.oid ")) branchOid = record.slice(13).trim();
    else if (record.startsWith("# branch.head ")) branch = record.slice(14).trim();
    else if (record.startsWith("# branch.upstream ")) upstream = record.slice(18).trim();
    else if (record.startsWith("# branch.ab ")) {
      const match = /\+(\d+) -(\d+)/.exec(record);
      ahead = Number(match?.[1] ?? 0);
      behind = Number(match?.[2] ?? 0);
    } else if (record.startsWith("# stash ")) stashCount = Number(record.slice(8)) || 0;
    else if (record.startsWith("? ")) {
      changes.push({ path: record.slice(2), status: "untracked", staged: false, worktree: true });
    } else if (record.startsWith("u ")) {
      const fields = record.split(" ");
      changes.push({
        path: fields.slice(10).join(" "),
        status: "conflicted",
        staged: true,
        worktree: true,
      });
    } else if (record.startsWith("1 ") || record.startsWith("2 ")) {
      const renamed = record.startsWith("2 ");
      const fields = record.split(" ");
      const xy = fields[1] ?? "..";
      const path = fields.slice(renamed ? 9 : 8).join(" ");
      const oldPath = renamed ? records[index + 1] : undefined;
      if (renamed) index += 1;
      changes.push({
        path,
        oldPath,
        status: STATUS_MAP[xy.charAt(0)] ?? STATUS_MAP[xy.charAt(1)] ?? "modified",
        staged: xy[0] !== ".",
        worktree: xy[1] !== ".",
        submodule: fields[2] !== "N...",
      });
    }
  }
  return { branchOid, branch, upstream, ahead, behind, stashCount, changes };
}

export function parseRefs(output: string): Ref[] {
  return output
    .split("\n")
    .map(trimNul)
    .filter(Boolean)
    .map((record) => {
      const [
        name = "",
        oid = "",
        ,
        head = "",
        upstream = "",
        tracking = "",
        subject = "",
        author = "",
        timestamp = "0",
      ] = record.split("\0");
      const kind = name.startsWith("refs/remotes/")
        ? "remote"
        : name.startsWith("refs/tags/")
          ? "tag"
          : "local";
      return {
        name,
        shortName: name.replace(/^refs\/(heads|remotes|tags)\//, ""),
        oid,
        kind,
        current: head.trim() === "*",
        upstream: upstream || undefined,
        tracking: tracking || undefined,
        subject,
        author,
        timestamp: Number(timestamp),
        favorite: head.trim() === "*" || name === "refs/heads/main" || name === "refs/heads/master",
      } satisfies Ref;
    });
}

function trimNul(value: string): string {
  let start = 0;
  let end = value.length;
  while (value.charCodeAt(start) === 0) start += 1;
  while (end > start && value.charCodeAt(end - 1) === 0) end -= 1;
  return value.slice(start, end);
}

export function parseLog(output: string): Commit[] {
  return output
    .split("\x1e")
    .map((record) => record.replace(/^\n+|\n+$/g, ""))
    .filter(Boolean)
    .map((record) => {
      const [
        oid = "",
        parents = "",
        author = "",
        email = "",
        authoredAt = "0",
        committedAt = "0",
        refs = "",
        subject = "",
        body = "",
      ] = record.split("\0");
      return {
        oid,
        parents: parents ? parents.split(" ") : [],
        author,
        email,
        authoredAt: Number(authoredAt),
        committedAt: Number(committedAt),
        refs: refs
          ? refs
              .split(", ")
              .map((ref) => ref.trim())
              .filter(Boolean)
          : [],
        subject,
        body,
      } satisfies Commit;
    });
}

export function parseCommitFiles(output: string): FileChange[] {
  let cursor = 0;
  for (let field = 0; field < 10; field += 1) {
    cursor = output.indexOf("\0", cursor);
    if (cursor < 0) return [];
    cursor += 1;
  }

  let tail = output.slice(cursor);
  if (tail.startsWith("\0")) tail = tail.slice(1);
  if (tail.startsWith("\n")) tail = tail.slice(1);
  const records = tail.split("\0");
  const changes: FileChange[] = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) continue;
    const [added = "-", deleted = "-", ...pathParts] = record.split("\t");
    let path = pathParts.join("\t");
    let oldPath: string | undefined;
    if (!path) {
      oldPath = records[index + 1] || undefined;
      path = records[index + 2] ?? "";
      index += 2;
    }
    if (!path) continue;
    const binary = added === "-" || deleted === "-";
    changes.push({
      path,
      oldPath,
      status: oldPath ? "renamed" : "modified",
      staged: false,
      worktree: false,
      additions: binary ? undefined : Number(added),
      deletions: binary ? undefined : Number(deleted),
      binary,
    });
  }
  return changes;
}

export function parseStashList(output: string): StashEntry[] {
  return output
    .split("\x1e")
    .map((record) => record.replace(/^\n+|\n+$/g, ""))
    .filter(Boolean)
    .map((record) => {
      const [selector = "", oid = "", subject = "", author = "", email = "", createdAt = "0"] =
        record.split("\0");
      return {
        selector,
        oid,
        subject,
        author,
        email,
        createdAt: Number(createdAt),
        files: [],
      } satisfies StashEntry;
    });
}

export function parseNameStatus(output: string): FileChange[] {
  const records = output.split("\0").filter(Boolean);
  const changes: FileChange[] = [];
  for (let index = 0; index < records.length; index += 1) {
    const status = records[index] ?? "";
    const code = status.charAt(0);
    const firstPath = records[index + 1] ?? "";
    if (!firstPath) break;
    index += 1;
    const renamed = code === "R" || code === "C";
    const path = renamed ? (records[index + 1] ?? "") : firstPath;
    if (renamed) index += 1;
    if (!path) continue;
    changes.push({
      path,
      oldPath: renamed ? firstPath : undefined,
      status: STATUS_MAP[code] ?? "modified",
      staged: false,
      worktree: false,
    });
  }
  return changes;
}

export function parseTree(output: string): TreeEntry[] {
  return output
    .split("\0")
    .filter(Boolean)
    .map((record) => {
      const separator = record.indexOf("\t");
      if (separator < 0) throw new Error("Invalid ls-tree record");
      const [mode = "", kind = "blob", oid = "", size = "-"] = record
        .slice(0, separator)
        .split(/\s+/);
      if (kind !== "blob" && kind !== "tree" && kind !== "commit") {
        throw new Error(`Unsupported tree entry kind: ${kind}`);
      }
      return {
        mode,
        kind,
        oid,
        size: size === "-" ? undefined : Number(size),
        path: record.slice(separator + 1),
      } satisfies TreeEntry;
    });
}

export function parseFileHistory(output: string): Commit[] {
  return output
    .split("\x1e")
    .map((record) => record.replace(/^\n+|\n+$/g, ""))
    .filter(Boolean)
    .map((record) => {
      const [
        oid = "",
        parents = "",
        author = "",
        email = "",
        authoredAt = "0",
        refs = "",
        subject = "",
      ] = record.split("\0");
      return {
        oid,
        parents: parents ? parents.split(" ") : [],
        author,
        email,
        authoredAt: Number(authoredAt),
        committedAt: Number(authoredAt),
        refs: refs
          ? refs
              .split(", ")
              .map((ref) => ref.trim())
              .filter(Boolean)
          : [],
        subject,
        body: "",
      } satisfies Commit;
    });
}

export function parseBlame(output: string): BlameLine[] {
  const lines: BlameLine[] = [];
  let current:
    | {
        oid: string;
        originalLine: number;
        finalLine: number;
        author: string;
        email: string;
        authoredAt: number;
        summary: string;
      }
    | undefined;
  for (const line of output.split("\n")) {
    const header = /^([0-9a-f]{40}) (\d+) (\d+)(?: \d+)?$/.exec(line);
    if (header) {
      current = {
        oid: header[1]!,
        originalLine: Number(header[2]),
        finalLine: Number(header[3]),
        author: "",
        email: "",
        authoredAt: 0,
        summary: "",
      };
    } else if (current && line.startsWith("author ")) current.author = line.slice(7);
    else if (current && line.startsWith("author-mail ")) {
      current.email = line.slice(12).replace(/^<|>$/g, "");
    } else if (current && line.startsWith("author-time ")) {
      current.authoredAt = Number(line.slice(12));
    } else if (current && line.startsWith("summary ")) current.summary = line.slice(8);
    else if (current && line.startsWith("\t")) {
      lines.push({ ...current, content: line.slice(1) });
      current = undefined;
    }
  }
  return lines;
}

export interface GraphRow {
  readonly lane: number;
  readonly parentLanes: readonly number[];
  readonly activeLanes: readonly string[];
}

export function placeGraphLanes(commits: readonly Commit[]): GraphRow[] {
  const lanes: string[] = [];
  return commits.map((commit) => {
    let lane = lanes.indexOf(commit.oid);
    if (lane < 0) {
      lane = lanes.findIndex((value) => !value);
      if (lane < 0) lane = lanes.length;
      lanes[lane] = commit.oid;
    }
    lanes[lane] = commit.parents[0] ?? "";
    const parentLanes = commit.parents.slice(1).map((parent) => {
      const existing = lanes.indexOf(parent);
      if (existing >= 0) return existing;
      const empty = lanes.findIndex((value) => !value);
      const target = empty >= 0 ? empty : lanes.length;
      lanes[target] = parent;
      return target;
    });
    while (lanes.at(-1) === "") lanes.pop();
    return { lane, parentLanes, activeLanes: [...lanes] };
  });
}

export interface DiffHunk {
  readonly header: string;
  readonly lines: readonly string[];
}

export interface DiffDocument {
  readonly fileHeader: string;
  readonly hunks: readonly DiffHunk[];
}

export function parseDiffDocument(patch: string): DiffDocument {
  const hunkOffset = patch.search(/^@@ /m);
  if (hunkOffset < 0) return { fileHeader: patch, hunks: [] };
  return {
    fileHeader: patch.slice(0, hunkOffset),
    hunks: parseDiffHunks(patch.slice(hunkOffset)),
  };
}

export function parseDiffHunks(patch: string): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let current: { header: string; lines: string[] } | undefined;
  for (const line of patch.split("\n")) {
    if (line.startsWith("@@ ")) {
      current = { header: line, lines: [] };
      hunks.push(current);
    } else if (current) current.lines.push(line);
  }
  return hunks;
}

export function assembleHunkPatch(fileHeader: string, hunks: readonly DiffHunk[]): string {
  const body = hunks.flatMap((hunk) => [hunk.header, ...hunk.lines]).join("\n");
  return `${fileHeader.trimEnd()}\n${body}\n`;
}

interface DiffLinePosition {
  readonly index: number;
  readonly prefix: "+" | "-";
  readonly text: string;
  readonly oldLine: number;
  readonly newLine: number;
  readonly noNewlineMarker?: string;
}

export function assembleSelectedLinePatch(
  fileHeader: string,
  hunk: DiffHunk,
  selectedIndexes: ReadonlySet<number>,
): string {
  const range = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(hunk.header);
  if (!range) throw new Error(`Invalid diff hunk header: ${hunk.header}`);
  let oldLine = Number(range[1]);
  let newLine = Number(range[3]);
  const selected: DiffLinePosition[] = [];

  for (let index = 0; index < hunk.lines.length; index += 1) {
    const line = hunk.lines[index] ?? "";
    const prefix = line[0];
    if ((prefix === "+" || prefix === "-") && selectedIndexes.has(index)) {
      const marker = hunk.lines[index + 1]?.startsWith("\\ No newline")
        ? hunk.lines[index + 1]
        : undefined;
      selected.push({ index, prefix, text: line, oldLine, newLine, noNewlineMarker: marker });
    }
    if (prefix !== "+" && prefix !== "\\") oldLine += 1;
    if (prefix !== "-" && prefix !== "\\") newLine += 1;
  }

  if (selected.length === 0) throw new Error("Select at least one changed line");
  const groups: DiffLinePosition[][] = [];
  for (const line of selected) {
    const current = groups.at(-1);
    if (current && line.index === (current.at(-1)?.index ?? -2) + 1) current.push(line);
    else groups.push([line]);
  }

  const hunks = groups.flatMap((group) => {
    const first = group[0];
    if (!first) return [];
    const deletions = group.filter((line) => line.prefix === "-");
    const additions = group.filter((line) => line.prefix === "+");
    const oldStart = deletions[0]?.oldLine ?? Math.max(0, first.oldLine - 1);
    const newStart = additions[0]?.newLine ?? Math.max(0, first.newLine - 1);
    const lines = group.flatMap((line) =>
      line.noNewlineMarker ? [line.text, line.noNewlineMarker] : [line.text],
    );
    return [
      {
        header: `@@ -${oldStart},${deletions.length} +${newStart},${additions.length} @@`,
        lines,
      },
    ];
  });
  return assembleHunkPatch(fileHeader, hunks);
}
