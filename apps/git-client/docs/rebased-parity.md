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

## Current difference snapshot

As of 2026-07-20, Git Client is not identical to Rebased 1.1.8. Checked-in reports are migration inputs only; the current-build test result is the source of truth and intentionally fails closed:

- Rebased is a JetBrains IDE product; Git Client is an Electron workbench. Rebased supplies the full IDE editor/language/platform surface, while Git Client currently owns a narrower Git, hosting, diff, terminal, and repository-management surface.
- The primary layout is structurally close: Rebased uses a dense Log center, Commit tool window, revision details, side tool stripes, status bar, and bottom Terminal. Git Client implements the same workbench vocabulary but does not yet prove every popup, focus transition, geometry, native menu, or platform state.
- The source oracle contains 7,260 obligations. `source-to-runtime.json` currently resolves 219 and leaves 7,041 unresolved. The reverse runtime inventory maps 14 of 22 captured scopes and has not completed actionable-node enumeration.
- Git Client has 243 unique candidate action bindings. These are implementation obligations, not evidence of source-wide parity.
- The Electron Git bridge implements and package-verifies all 43 public methods, but `electron-bridge-support.json` records 0 of 43 as verified against Rebased behavior.
- Visual, accessibility-tree, focus-order, Git/network side-effect, performance, soak, Developer ID, and notarization gates remain incomplete. `reports/completion.json` therefore remains `complete:false`.

The design-system implementation is intentionally different: Rebased renders JetBrains Islands controls, while Git Client uses Tailwind CSS 4 and locally owned shadcn/ui primitives. This is an allowed framework-rendering difference only when the observable geometry, semantics, focus behavior, and state transitions satisfy the parity thresholds.

## Verification cadence

Rebased 1.1.8 is a frozen oracle, so rebuilding or driving Rebased for every Git Client build adds cost without improving confidence. Verification is split by evidence lifetime:

1. **Capture once per oracle version.** Verify the Rebased artifact checksum, then record canonical scenario traces: inputs, visible/enabled/checked state, accessibility names and focus order, geometry, screenshots, Git/file/network effects, and cancellation invariants. Re-capture only when the pinned Rebased version, macOS baseline, locale, scale, or capture schema changes.
2. **Run contract replay on relevant pull requests.** Changes to commands, state models, Git/hosting bridges, or UI primitives replay only the affected deterministic scenarios against the checked-in oracle. This is a test target, not part of the ordinary renderer build. Structural/AX assertions are primary; screenshots cover a small set of stable workbench states.
3. **Run broad differential checks on a schedule.** A nightly or weekly macOS job exercises the full scenario corpus, visual thresholds, focus navigation, and disposable-repository side effects. Failures produce evidence artifacts for review but do not make unrelated builds slower.
4. **Run packaged checks at release.** `pnpm parity:full` runs renderer and packaged Electron checks before the complete inventory, bridge, performance, soak, signing, and notarization gate. `pnpm parity:check` recomputes completion from individual results for the exact candidate build and fails closed.

Local investigation uses `parity:test --scenario <id>`, `parity:next --limit 5`, and `parity:explain <id>`. Standard output is capped to a compact summary; full command logs and evidence stay in `test-results/parity/` and are opened only for the selected failure.

The key is differential contract testing, not pixel-only snapshots. A screenshot can match while a shortcut, disabled state, destructive target, or Git side effect differs. Each scenario therefore compares four channels together: semantic UI/AX, geometry/visuals, behavior/focus, and external effects. Allowed differences stay explicit in `manifest/divergences.yaml`; updating a golden requires review of the corresponding oracle evidence rather than a blanket snapshot refresh.

## Allowed differences

Only the following differences are allowed, and every instance must appear in `manifest/divergences.yaml` as `brand`, `external-service`, `framework-rendering`, or `reference-defect-fix`:

- Git Client name, icon, bundle identifier, and About surface; no Rebased or JetBrains trademark assets.
- JetBrains Marketplace and IntelliJ binary plugin compatibility are removed.
- JetBrains cloud sync, vendor update, and vendor error-reporting services are removed. Local settings and ZIP import/export remain.
- A demonstrated Rebased defect may be fixed when it concerns crashes, data loss, CPU leaks, or an incorrect destructive target.
- A reviewed Electron rasterization difference within the stated geometry and visual thresholds.

Editor, language-facing file presentation, and Local History are not excluded. Electron is the only supported desktop runtime and must pass the complete parity gates.

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
