## Packages

This repository owns the shared `@jongminchung` packages used by downstream projects.

- `@jongminchung/ui`: published UI primitives, a default neutral theme, shared Tailwind styles,
  and semantic tokens.

Public packages are published to GitHub Packages. Consumers need the `@jongminchung` scope mapped
to `https://npm.pkg.github.com` and a classic PAT with `read:packages`, including for public package
downloads. Keep the token in the environment rather than committing it to `.npmrc`.

```ini
@jongminchung:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}
```

The UI package provides safe default theme values. Apps may override semantic tokens and continue
to own product components and behavior. See [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) for the token
contract, component ownership rules, and runtime exception policy.

## Documentation

- [Repository documentation](./docs/README.md)
- [Maintenance guide](./docs/maintenance.md)
- [Contributing guide](./docs/CONTRIBUTING.md)

## Workspace scripts

Repository-wide scripts are owned by the workspace root and are run from that directory:

```bash
bun run fmt
bun run check
bun run links:check
bun run audit
```

Always include `run` for package scripts so commands are visibly distinguished from Bun subcommands.

`audit` queries the registry advisory database and fails on high-severity dependency findings. It
requires network access and is run manually during maintenance and before releases instead of being
part of the offline-reproducible `check` chain.

`links:check` uses Podman when available, otherwise Docker, to run the pinned Lychee container
with the repository mounted read-only. It checks
local links and anchors in Markdown and HTML without making network requests.

Each workspace owns its build, typecheck, and test commands. Select one with a filter instead of
adding a package-specific wrapper to the root manifest:

```bash
bun run --filter @jongminchung/web build
```

## Version Policy

The manually triggered package workflow replaces `@jongminchung/ui` at `1.0.0`.
This is a mutable snapshot channel: the same version can have different API, contents, and
integrity, so SemVer compatibility and lockfile reproducibility are not guaranteed. Consumers must
force a new resolution, such as `bun update --force <package>@1.0.0`, and commit the resulting
lockfile whenever they adopt a replacement.

The workflow installs the shared lockfile from the repository root, then lints, typechecks, and
runs coverage and Node consumer checks for UI on Node 24 and 26. It builds the
archive before deleting the fixed version, publishes that archive, and verifies registry integrity
and consumer imports. See the [release and recovery runbook](./docs/runbooks/release.md).
GitHub authentication is supplied only through the `GH_PAT` Actions secret.

```bash
bun install --frozen-lockfile --ignore-scripts
bun run --filter @jongminchung/ui typecheck
bun run --filter @jongminchung/ui test:coverage
bun run --filter @jongminchung/ui test:node
bun run --filter @jongminchung/ui publish:dry-run
```

<!-- prettier-ignore-start -->

<!--START_SECTION:waka-->
![AI Code Time](http://img.shields.io/badge/AI%20Code%20Time-780%20hrs%2034%20mins-blue?style=flat)

**I'm a Night 🦉** 

```text
🌞 Morning                979 commits         ███░░░░░░░░░░░░░░░░░░░░░░   11.08 % 
🌆 Daytime                2113 commits        ██████░░░░░░░░░░░░░░░░░░░   23.91 % 
🌃 Evening                3369 commits        ██████████░░░░░░░░░░░░░░░   38.12 % 
🌙 Night                  2377 commits        ███████░░░░░░░░░░░░░░░░░░   26.90 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
Markdown                 13 hrs 48 mins      █████░░░░░░░░░░░░░░░░░░░░   20.82 % 
Java                     10 hrs 33 mins      ████░░░░░░░░░░░░░░░░░░░░░   15.92 % 
TypeScript               7 hrs 59 mins       ███░░░░░░░░░░░░░░░░░░░░░░   12.05 % 
YAML                     7 hrs 23 mins       ███░░░░░░░░░░░░░░░░░░░░░░   11.14 % 
Python                   5 hrs 35 mins       ██░░░░░░░░░░░░░░░░░░░░░░░   08.42 % 
```

🤖 **AI Coding This Week** 

```text
⏱ AI Coding Time: 56 hrs 17 mins (84.86%)

✍️ 79,819 lines written by AI, 1,889 lines written by hand (97.69% AI-written)

🔤 52,528,690 Input Tokens, 7,905,493 Output Tokens

💵 $1418.55 Estimated AI Cost This Week

🧠 265 AI Sessions, 770 AI Prompts

GPT                      82,236 lines        █████████████████████████   98.96 % 
Codex-Cli                862 lines           ░░░░░░░░░░░░░░░░░░░░░░░░░   01.04 % 
Codex-Vscode             0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 

🔎 AI Coding Insights:
🤖 AI-Driven — 97.69% of written lines came from AI
📄 Detailed Prompter — average 715 characters per prompt
🔁 Iterative Prompter — average 3 prompts per session
🚀 High AI Trust — 15.47% of changed lines were hand-edited
```


<!--END_SECTION:waka-->

<!-- prettier-ignore-end -->

- 설치와 공통 `make fmt`·`make lint` 사용법은 [기여 가이드](docs/CONTRIBUTING.md)를 참고함
