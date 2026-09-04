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
![AI Code Time](http://img.shields.io/badge/AI%20Code%20Time-768%20hrs%2029%20mins-blue?style=flat)

**I'm a Night 🦉** 

```text
🌞 Morning                806 commits         ███░░░░░░░░░░░░░░░░░░░░░░   10.13 % 
🌆 Daytime                1774 commits        ██████░░░░░░░░░░░░░░░░░░░   22.30 % 
🌃 Evening                3068 commits        ██████████░░░░░░░░░░░░░░░   38.57 % 
🌙 Night                  2307 commits        ███████░░░░░░░░░░░░░░░░░░   29.00 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
Markdown                 17 hrs 53 mins      ██████░░░░░░░░░░░░░░░░░░░   25.00 % 
TypeScript               11 hrs 59 mins      ████░░░░░░░░░░░░░░░░░░░░░   16.75 % 
Java                     9 hrs 38 mins       ███░░░░░░░░░░░░░░░░░░░░░░   13.48 % 
YAML                     5 hrs 56 mins       ██░░░░░░░░░░░░░░░░░░░░░░░   08.30 % 
Python                   5 hrs 39 mins       ██░░░░░░░░░░░░░░░░░░░░░░░   07.91 % 
```

🤖 **AI Coding This Week** 

```text
⏱ AI Coding Time: 62 hrs 55 mins (87.94%)

✍️ 101,328 lines written by AI, 1,574 lines written by hand (98.47% AI-written)

🔤 62,149,845 Input Tokens, 9,206,779 Output Tokens

💵 $1649.36 Estimated AI Cost This Week

🧠 299 AI Sessions, 872 AI Prompts

GPT                      102,146 lines       ████████████████████████░   96.17 % 
Codex-Cli                4,069 lines         █░░░░░░░░░░░░░░░░░░░░░░░░   03.83 % 
Codex-Vscode             0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 

🔎 AI Coding Insights:
🤖 AI-Driven — 98.47% of written lines came from AI
📄 Detailed Prompter — average 713 characters per prompt
🔁 Iterative Prompter — average 3 prompts per session
🚀 High AI Trust — 12.1% of changed lines were hand-edited
```


<!--END_SECTION:waka-->

<!-- prettier-ignore-end -->
