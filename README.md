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
![AI Code Time](http://img.shields.io/badge/AI%20Code%20Time-797%20hrs%2025%20mins-blue?style=flat)

**I'm a Night 🦉** 

```text
🌞 Morning                925 commits         ███░░░░░░░░░░░░░░░░░░░░░░   10.77 % 
🌆 Daytime                2051 commits        ██████░░░░░░░░░░░░░░░░░░░   23.88 % 
🌃 Evening                3257 commits        █████████░░░░░░░░░░░░░░░░   37.93 % 
🌙 Night                  2355 commits        ███████░░░░░░░░░░░░░░░░░░   27.42 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
Java                     8 hrs 22 mins       ███████░░░░░░░░░░░░░░░░░░   28.63 % 
Markdown                 4 hrs 57 mins       ████░░░░░░░░░░░░░░░░░░░░░   16.95 % 
YAML                     4 hrs 14 mins       ████░░░░░░░░░░░░░░░░░░░░░   14.47 % 
TypeScript               2 hrs 41 mins       ██░░░░░░░░░░░░░░░░░░░░░░░   09.19 % 
Python                   1 hr 46 mins        ██░░░░░░░░░░░░░░░░░░░░░░░   06.05 % 
```

🤖 **AI Coding This Week** 

```text
⏱ AI Coding Time: 16 hrs 57 mins (57.93%)

✍️ 23,166 lines written by AI, 29,151 lines written by hand (44.28% AI-written)

🔤 20,476,375 Input Tokens, 3,610,694 Output Tokens

💵 $839.23 Estimated AI Cost This Week

🧠 73 AI Sessions, 239 AI Prompts

GPT                      23,688 lines        █████████████████████████   99.99 % 
Sonnet                   2 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.01 % 
Codex-Cli                0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 
Codex-Vscode             0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 

🔎 AI Coding Insights:
⚖️ Balanced with AI — 44.28% of written lines came from AI
📄 Detailed Prompter — average 534 characters per prompt
🔁 Iterative Prompter — average 3 prompts per session
🔍 Hands-On Reviewer — 59.3% of changed lines were hand-edited
```


<!--END_SECTION:waka-->

<!-- prettier-ignore-end -->

- 설치와 공통 `make fmt`·`make lint` 사용법은 [기여 가이드](docs/CONTRIBUTING.md)를 참고함
