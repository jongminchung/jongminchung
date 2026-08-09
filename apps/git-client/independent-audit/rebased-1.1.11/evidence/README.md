# Rebased 1.1.11 independent UI evidence

## Reliable observations

- Installed application: Rebased 1.1.11 (`io.github.detachhead.rebased`) on macOS ARM64.
- The application used isolated config, system, log, and plugin directories through `REBASED_PROPERTIES`.
- Welcome opens at 800×650 in the fresh profile. `Projects` is selected; `Customize` and `Plugins` remain visible.
- `Open` presents the native `Open File or Project` panel. Its initial AX focus is the icon view; the dialog exposes `Cancel` and `Open`.
- A first project open presents `Don't Open`, `Preview in Safe Mode`, and `Trust Project`; initial focus is `Preview in Safe Mode`.
- The dirty repository opens to `Project`, not `Commit`. No commit is selected, so the review pane shows `Select commit to view changes` and `Commit details`.
- The dirty tree shows the modified `app.ts` and untracked `untracked.txt`. The log shows the three fixture commits and remote labels.
- The top-level actions expose project, update, push, and `main` branch controls. The log exposes Branch, User, Date, Paths, graph options, refresh, cherry-pick, view options, and go-to controls.

## Keyboard and popup observations

- Welcome starts with the `Projects` row selected.
- The trust sheet starts with `Preview in Safe Mode` focused; button order is recorded in `evidence.json`.
- After project load, a `Paths:` menu intermittently became the only AX root. Two Esc presses, an outside click, a title-bar click, and keyboard menu selection did not restore the Workbench AX tree.
- A process restart restored the Workbench long enough to capture the reliable dirty default state. This is an automation/accessibility obstruction, not proof that the product UI itself is broken.

## Original-app capture limits

- Commit selection and file diff after the `Paths:` AX menu obstruction.
- Branch create/rename/delete/merge dialogs.
- Push and force-with-lease confirmation.
- Stash create/apply/delete.
- Conflict, rebase, cherry-pick, continue, abort, Tab order, and dialog Esc behavior.

These states were not reachable in this original-app capture session. Git Client coverage for them is recorded separately by packaged UI-to-Git tests and the state oracle; this bundle does not infer Rebased behavior for those states.

## Fixture state

- `main`: `65512c0 Add fixture notes`, tracking `origin/main` with `+0/-0`.
- Remote `feature/topic`: `0538a78 Add topic flag`.
- Working tree: modified `app.ts`; untracked `untracked.txt`.
- The disposable fixture and isolated profile live outside the repository and are not part of this evidence bundle.

## Files

- `screenshots/`: unmodified PNGs copied directly from @oai/sky captures.
- `ax/`: raw accessibility trees for the corresponding reachable states.
- `evidence.json`: pixel geometry, labels, focus, application identity, and environment.
- `SHA256SUMS`: integrity manifest for every evidence file except the manifest itself.
