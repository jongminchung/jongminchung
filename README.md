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
pnpm run check
pnpm run links:check
pnpm run audit
```

Use `make fmt` when you want to apply formatting fixes.

Always include `run` for package scripts so commands are visibly distinguished from pnpm subcommands.

`audit` queries the registry advisory database and fails on high-severity dependency findings. It
requires network access and is run manually during maintenance and before releases instead of being
part of the offline-reproducible `check` chain.

`links:check` uses Podman when available, otherwise Docker, to run the pinned Lychee container
with the repository mounted read-only. It checks
local links and anchors in Markdown and HTML without making network requests.

Each workspace owns its build, typecheck, and test commands. Select one with a filter instead of
adding a package-specific wrapper to the root manifest:

```bash
pnpm --filter @jongminchung/web run build
```

## Version Policy

The manually triggered package workflow replaces `@jongminchung/ui` at `1.0.0`.
This is a mutable snapshot channel: the same version can have different API, contents, and
integrity, so SemVer compatibility and lockfile reproducibility are not guaranteed. Consumers must
force a new resolution, such as `pnpm update --force <package>@1.0.0`, and commit the resulting
lockfile whenever they adopt a replacement.

The workflow installs the shared lockfile from the repository root, then lints, typechecks, and
runs coverage and Node consumer checks for UI on Node 24 and 26. It builds the
archive before deleting the fixed version, publishes that archive, and verifies registry integrity
and consumer imports. See the [release and recovery runbook](./docs/runbooks/release.md).
GitHub authentication is supplied only through the `GH_PAT` Actions secret.

```bash
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @jongminchung/ui run typecheck
pnpm --filter @jongminchung/ui run test:coverage
pnpm --filter @jongminchung/ui run test:node
pnpm --filter @jongminchung/ui run publish:dry-run
```

<!-- prettier-ignore-start -->

<!--START_SECTION:waka-->
![AI Code Time](http://img.shields.io/badge/AI%20Code%20Time-899%20hrs%2023%20mins-blue?style=flat)

**I'm a Night 🦉** 

```text
🌞 Morning                973 commits         ███░░░░░░░░░░░░░░░░░░░░░░   10.99 % 
🌆 Daytime                2173 commits        ██████░░░░░░░░░░░░░░░░░░░   24.54 % 
🌃 Evening                3335 commits        █████████░░░░░░░░░░░░░░░░   37.66 % 
🌙 Night                  2375 commits        ███████░░░░░░░░░░░░░░░░░░   26.82 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
YAML                     5 hrs 41 mins       ████░░░░░░░░░░░░░░░░░░░░░   17.74 % 
Python                   5 hrs 36 mins       ████░░░░░░░░░░░░░░░░░░░░░   17.53 % 
Markdown                 4 hrs 43 mins       ████░░░░░░░░░░░░░░░░░░░░░   14.74 % 
Other                    3 hrs 50 mins       ███░░░░░░░░░░░░░░░░░░░░░░   12.02 % 
Java                     3 hrs 47 mins       ███░░░░░░░░░░░░░░░░░░░░░░   11.81 % 
```

🤖 **AI Coding This Week** 

```text
⏱ AI Coding Time: 25 hrs 39 mins (80.06%)

✍️ 14,848 lines written by AI, 1,353 lines written by hand (91.65% AI-written)

🔤 16,990,202 Input Tokens, 3,917,486 Output Tokens

💵 $185.59 Estimated AI Cost This Week

🧠 77 AI Sessions, 394 AI Prompts

GPT                      16,272 lines        ████████████████████████░   97.51 % 
DeepSeek                 416 lines           █░░░░░░░░░░░░░░░░░░░░░░░░   02.49 % 

🔎 AI Coding Insights:
🤖 AI-Driven — 91.65% of written lines came from AI
📄 Detailed Prompter — average 511 characters per prompt
🔁 Iterative Prompter — average 5 prompts per session
🚀 High AI Trust — 14.29% of changed lines were hand-edited
```


<!--END_SECTION:waka-->

<!-- prettier-ignore-end -->

- 설치와 공통 `make fmt`·`pnpm run check` 사용법은 [기여 가이드](docs/CONTRIBUTING.md)를 참고함
