# Git Client

A macOS-first Electron Git workbench with Rebased-compatible Islands surfaces and compact three-pane workflows.

Appearance supports System Appearance, White, and Black. System mode follows macOS changes live, including active native Terminal sessions and their ANSI palette.

## Stack

- Electron 43.1.1, React 19, Vite 8, TypeScript 6, pnpm 11
- Sandboxed renderer and a typed preload API; no renderer Node.js access
- System Git 2.39+ through an allowlisted Electron utility-process bridge
- TanStack Virtual for refs and 500-row log pages
- Canvas commit graph and lazy-language CodeMirror 6 semantic split/unified diff
- Lazily loaded xterm.js UI backed by a repository-scoped native PTY
- `ts-rs` generated wire contracts in `src/generated`

## Development

```sh
pnpm install
pnpm --filter @jongminchung/git-client dev
pnpm --filter @jongminchung/git-client dev:web
pnpm --filter @jongminchung/git-client test
pnpm --filter @jongminchung/git-client build
```

`pnpm dev` launches Electron Forge. `pnpm dev:web` starts only the browser development server; its normal URL starts on an empty Manage screen because a browser has no native Git bridge. A deterministic fixture is available only at `http://localhost:1420/?fixture=qa` for visual and Playwright testing. In Electron, **Open Repository** uses the native directory picker and all requests cross the context-isolated preload as validated discriminated unions. The renderer never receives an arbitrary Git command, path, URL, or IPC channel API.

Open repositories are kept as independent workspace tabs next to the fixed Manage tab. Their order, active tab, recent paths, selected management section, and repository UI state are restored from the Electron settings store. The resizable bottom tool window contains Shelf, Stash, Recovery, and a real repository-scoped PTY Terminal. Git operations expose only temporary redacted progress, failure, and cancellation state; command output is not retained by the renderer.

Keyboard commands are defined once in `src/command-manifest.json` and shared by the renderer registry, command palette, tooltips, context menus, and the native macOS menu. `⌘P` searches commands plus loaded repositories, refs, commits, and changed files. `Esc` closes only the highest active UI layer; it never clears a commit draft or modifies repository data. Standard Edit menu items keep macOS Undo, Cut, Copy, Paste, and Select All behavior, while revision copying uses `⌥⇧⌘C`.

## Safety model

- Git is executed directly with argument arrays; `sh -c` is not used.
- Repository-relative paths, refs, revisions, remotes, and URLs are validated at typed Electron IPC and utility-process boundaries.
- Mutating operations are serialized per repository; queries remain parallel and cancellable.
- stdout/stderr is parsed while a request is active and then discarded; displayed failures are credential-redacted summaries.
- GitHub/GitLab PATs are encrypted with Electron `safeStorage` backed by macOS Keychain. Settings and subsequent renderer requests contain account metadata and account IDs, never tokens.
- Hosting requests use HTTPS origins, a 120-second timeout, no credential-carrying redirects, and response conversion at the Electron main-process boundary.
- Terminal input is intentionally outside the Git allowlist; its shell has the same permissions as the user and its commands are not retained by Git Client.
- Drop, squash, and reword use the app binary as Git's sequence/message editor; non-contiguous squash plans are rejected.
- Published commits remain locally rewriteable through the visual oldest-to-newest rebase plan. Recovery records the branch tip before execution; a later push is always a separate reviewed action.
- Every branch push opens one destination preview. Non-fast-forward pushes require an explicitly selected exact `--force-with-lease=<ref>:<oid>` mode; plain or automatic force push is not representable by the native contract.
- Repository content is rendered as text. CSP blocks remote scripts and opener permissions only allow HTTPS URLs.
- Files over 5 MiB/50,000 lines, binary files, and invalid UTF-8 should be opened externally rather than rendered in the text diff surface.

## Scope

The product targets complete UI, UX, behavior, and side-effect parity with checksum-verified Rebased 1.1.8. The contract in [`docs/rebased-parity.md`](docs/rebased-parity.md) is the production release gate: all source and runtime obligations, including editor and Local History, must be evidence-backed; native Git and hosting operations stay allowlisted, and deterministic fixtures remain development-only.

## Releases

Git Client is distributed as a Developer ID-signed and Apple-notarized macOS 26+ ARM64 DMG on [GitHub Releases](https://github.com/jongminchung/jongminchung/releases). Nx Release derives project-scoped versions and notes from Conventional Commits, using `git-client-<version>` tags and `Git Client <version>` release titles. Each release includes the DMG and its SHA-256 manifest; the app does not include an in-app updater. Production release fails closed when signing identity or notarization configuration is unavailable. A separate `release:validate-local` command creates visibly named `_adhoc` artifacts that must never be published.

See [`docs/releases.md`](docs/releases.md) for checksum verification, signing/notarization gates, release conventions, and local build commands.

The code and original icon are MIT licensed. No IntelliJ/Rebased source code, icons, or product branding are included.
