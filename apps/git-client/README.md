# Git Client

A lightweight, macOS-first Git workbench that recreates the dense IntelliJ Git workflow without embedding IntelliJ or a Node sidecar.

## Stack

- Tauri 2.11, React 19, Vite 8, TypeScript 6, pnpm 11
- System Git 2.39+ through an allowlisted Rust command bridge
- TanStack Virtual for refs and 500-row log pages
- Canvas commit graph and lazily loaded CodeMirror 6 diff view
- `ts-rs` generated wire contracts in `src/generated`

## Development

```sh
pnpm install
pnpm --filter @jongminchung/git-client dev
pnpm --filter @jongminchung/git-client test
pnpm --filter @jongminchung/git-client rust:check
pnpm --filter @jongminchung/git-client tauri:dev
```

The browser build starts with a deterministic Git fixture for visual and Playwright testing. In the Tauri build, **Open Repository** uses the native directory picker and all requests go through `RepositoryId` plus a closed `GitRequest` union. The renderer never receives an arbitrary command API.

## Safety model

- Git is executed directly with argument arrays; `sh -c` is not used.
- Repository-relative paths, refs, revisions, remotes, and URLs are validated in Rust.
- Mutating operations are serialized per repository; queries remain parallel and cancellable.
- stdout/stderr is streamed in sequence through a Tauri channel and HTTP credentials are redacted.
- Drop and squash use the app binary as Git's sequence editor and reject non-contiguous squash plans.
- Repository content is rendered as text. CSP blocks remote scripts and opener permissions only allow HTTPS URLs.
- Files over 5 MiB/50,000 lines, binary files, and invalid UTF-8 should be opened externally rather than rendered in the text diff surface.

## Scope

The current vertical slice includes open/init/clone flows, repository inspection, debounced file watching, virtualized history, changelist index transactions, hunk/line staging, four-pane conflict resolution, native stash and checksummed Shelf persistence, branch/history controls, file history/blame/tree inspection, remote/worktree management, opt-in multi-root branch operations with explicit rollback plans, and a ref recovery ledger. The AI extension is an interface only and its actions stay hidden without a provider.

## Releases

Git Client is distributed as an unsigned macOS 13+ ARM64 DMG on [GitHub Releases](https://github.com/jongminchung/jongminchung/releases). Nx Release derives project-scoped versions and notes from Conventional Commits, using `git-client-<version>` tags and `Git Client <version>` release titles. Each release includes the DMG and its SHA-256 checksum; the app does not include an in-app updater.

See [`docs/releases.md`](docs/releases.md) for download verification, Gatekeeper steps, release conventions, and local build commands.

The code and original icon are MIT licensed. No IntelliJ/Rebased source code, icons, or product branding are included.
