# Rebased 1.1.8 complete parity contract

Git Client targets all user-reachable UI, UX, behavior, and side effects in Rebased 1.1.8 build `262.8665.SNAPSHOT` at source tag `12fb12778a5ad8b7c52b64931a81c648629c9e23`. The authoritative macOS ARM64 reference artifact has SHA-256 `fd3bc8bd7f80be16294d424b25ca390ceb13960bba33422dfa8ac4632c3412c0`.

The reference is a dual oracle:

- The local Rebased tag is read with `git show` and defines the source obligations. The checkout is never reset or modified.
- A checksum-verified Rebased 1.1.8 app, isolated profile, and disposable repository define observable runtime behavior. The installed 1.1.7 app is discovery-only and cannot supply passing evidence.

The generated registry at `parity/rebased/1.1.8/source/action-registry.json` covers every one of the 7,260 source obligations. `parity/rebased/1.1.8/manifest/action-bindings.json` connects implemented Git Client commands to those stable source IDs. A candidate command without a source binding, or a source/runtime item without an allowed classification and evidence, is a release failure.

## Required scope

- Shell and welcome: native menus and recursive submenus, hidden-inset title bar, toolbar, tool stripes, status bar, popups, dialogs, notifications, tooltips, focus, shortcuts, and persistence.
- Project and editor: project tree, open/recent/clone/init, editor tabs, TextMate syntax, text and image viewers, search, file history, blame, and Local History.
- Log and VCS: graph, filters, commit and file details, diff, staging, partial changes, changelists, patches, shelf, and stash.
- Git operations: branch, tag, remote, worktree, fetch, pull, push, update, merge, rebase, cherry-pick, revert, reset, conflict resolution, and recovery.
- Platform: Terminal, Git Console, settings, keymap, appearance, compact mode, accessibility, and native input routing.
- Hosting: GitHub Pull Requests and GitLab Merge Requests, including lists, details, diffs, review, discussions, viewed state, authentication, offline behavior, and errors.
- All loading, empty, error, permission, authentication, network, cancellation, relaunch, and restoration states that are user-reachable in the reference.

Every flow follows `reference capture → scenario manifest → implementation → candidate capture → visual/AX/behavior/effects comparison`. A cancellation scenario must leave the Git repository and persisted state unchanged.

## Allowed differences

Only the following differences are allowed, and every instance must appear in `manifest/divergences.yaml` as `brand`, `external-service`, `framework-rendering`, or `reference-defect-fix`:

- Git Client name, icon, bundle identifier, and About surface; no Rebased or JetBrains trademark assets.
- JetBrains Marketplace and IntelliJ binary plugin compatibility are removed.
- JetBrains cloud sync, vendor update, and vendor error-reporting services are removed. Local settings and ZIP import/export remain.
- A demonstrated Rebased defect may be fixed when it concerns crashes, data loss, CPU leaks, or an incorrect destructive target.
- A reviewed Electron rasterization difference within the stated geometry and visual thresholds.

Editor, language-facing file presentation, and Local History are not excluded. The existing Tauri/Rust implementation remains until the Electron candidate passes the complete parity gates.

## Release gate

`pnpm parity:check` fails unless all of these conditions hold:

- Source→Runtime and Runtime→Source are both 100%, with no unresolved or unmapped item.
- GitBridge package and Rebased verification are 43/43, and the query/operation scenario matrices are complete.
- All state obligations, controls, shortcuts, focus flows, Git/network side effects, and cancellation invariants are verified.
- There is no `provisional`, `ambiguous`, `uncaptured`, or `unverified` evidence marker.
- Geometry is within ±1 CSS pixel, structural SSIM is at least 0.995, mismatch is at most 0.5%, and AX name/state/focus order matches.
- Candidate p95 performance is at most 1.25× the reference and the eight-hour soak has no leak or persistence loss.
- The macOS ARM64 artifact meets size limits, strict Developer ID signing, notarization, and stapling validation.

The production release pipeline invokes this gate. Local ad-hoc packages remain available for ongoing implementation and Computer Use validation, but are not release artifacts. Until every gate passes, reports must retain `complete:false` and the message “Rebased 패리티 미완료”.
