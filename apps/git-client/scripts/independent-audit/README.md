# Rebased 1.1.11 independent Git oracle

This directory provides a disposable, deterministic Git fixture for comparing installed Rebased
1.1.11 with Git Client. It is independent of stored parity declarations and does not launch either
application.

## Create equivalent repositories

```sh
AUDIT_PARENT="$(mktemp -d)"
node scripts/independent-audit/create-fixture.ts --root "$AUDIT_PARENT/fixture"
```

The command creates a local bare remote plus `rebased-case` and `git-client-case`. Both clones have
the same `main`, remote branch, tag, one stash, a staged/unstaged change in the same file, and an
untracked file. The fixture fixes commit identity and timestamps and disables global/system Git
configuration while running Git.

## Capture and compare state

```sh
node scripts/independent-audit/git-state-oracle.ts snapshot \
  "$AUDIT_PARENT/fixture/rebased-case" > /tmp/rebased-state.json

node scripts/independent-audit/git-state-oracle.ts compare \
  "$AUDIT_PARENT/fixture/rebased-case" \
  "$AUDIT_PARENT/fixture/git-client-case"
```

The snapshot contains `HEAD`, sorted local refs, raw NUL-delimited porcelain v2 status, cached and
working-tree binary diffs, stash entries, and sorted refs read from every remote. `compare` exits 0
when every section is equal, 2 for a state difference, and 1 for invalid input or a Git failure.

Run focused tests from `apps/git-client`:

```sh
node --test scripts/independent-audit/*.integration.node-test.ts
```

This also validates the checked-in Rebased 1.1.11 screenshot and accessibility evidence. The
validation fails closed for a missing, changed, unmanifested, or unsafe-path file and for incorrect
application/version/platform metadata.
