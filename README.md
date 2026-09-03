## Packages

This repository owns the shared `@jongminchung` packages used by downstream projects.

- `@jongminchung/tooling`: shared `oxfmt` and `oxlint` configuration.
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

`links:check` runs the pinned Lychee container with the repository mounted read-only. It checks
local links and anchors in Markdown and HTML without making network requests.

Each workspace owns its build, typecheck, and test commands. Select one with a filter instead of
adding a package-specific wrapper to the root manifest:

```bash
bun run --filter @jongminchung/web build
```

## Version Policy

The manually triggered package workflow always republishes the personal packages as `1.0.0`.
This is a mutable snapshot channel: the same version can have different API, contents, and
integrity, so SemVer compatibility and lockfile reproducibility are not guaranteed. Consumers must
force a new resolution, such as `bun update --force <package>@1.0.0`, and commit the resulting
lockfile whenever they adopt a replacement.

The workflow installs the shared lockfile from the repository root, then typechecks and tests only
the publish packages. It deletes the fixed version, then publishes the two packages in parallel.
GitHub authentication is supplied only through the `GH_PAT` Actions secret.

```bash
bun install --frozen-lockfile --ignore-scripts
bun run --filter @jongminchung/tooling --filter @jongminchung/ui typecheck
bun run --filter @jongminchung/tooling --filter @jongminchung/ui test
bun run --filter @jongminchung/tooling --filter @jongminchung/ui publish:dry-run
```

<!-- prettier-ignore-start -->

<!--START_SECTION:waka-->
![AI Code Time](http://img.shields.io/badge/AI%20Code%20Time-761%20hrs%2022%20mins-blue?style=flat)

**I'm a Night 🦉** 

```text
🌞 Morning                806 commits         ███░░░░░░░░░░░░░░░░░░░░░░   10.19 % 
🌆 Daytime                1763 commits        ██████░░░░░░░░░░░░░░░░░░░   22.28 % 
🌃 Evening                3038 commits        ██████████░░░░░░░░░░░░░░░   38.40 % 
🌙 Night                  2305 commits        ███████░░░░░░░░░░░░░░░░░░   29.13 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
Markdown                 16 hrs 20 mins      ██████░░░░░░░░░░░░░░░░░░░   22.70 % 
TypeScript               11 hrs 38 mins      ████░░░░░░░░░░░░░░░░░░░░░   16.18 % 
YAML                     8 hrs 55 mins       ███░░░░░░░░░░░░░░░░░░░░░░   12.39 % 
Java                     8 hrs 32 mins       ███░░░░░░░░░░░░░░░░░░░░░░   11.87 % 
Other                    6 hrs 36 mins       ██░░░░░░░░░░░░░░░░░░░░░░░   09.18 % 
```

🤖 **AI Coding This Week** 

```text
⏱ AI Coding Time: 64 hrs 37 mins (89.79%)

✍️ 103,364 lines written by AI, 1,518 lines written by hand (98.55% AI-written)

🔤 62,675,973 Input Tokens, 9,257,781 Output Tokens

💵 $1608.35 Estimated AI Cost This Week

🧠 304 AI Sessions, 933 AI Prompts

GPT                      105,074 lines       ████████████████████████░   96.43 % 
Codex-Cli                3,893 lines         █░░░░░░░░░░░░░░░░░░░░░░░░   03.57 % 
Codex-Vscode             0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 

🔎 AI Coding Insights:
🤖 AI-Driven — 98.55% of written lines came from AI
📄 Detailed Prompter — average 641 characters per prompt
🔁 Iterative Prompter — average 3 prompts per session
🚀 High AI Trust — 2.59% of changed lines were hand-edited
```


<!--END_SECTION:waka-->

<!-- prettier-ignore-end -->
