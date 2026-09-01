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

Repository-wide scripts are owned by the workspace root. Use `-w` so they resolve to the root even
when the current directory is inside an app or package:

```bash
pnpm -w run fmt
pnpm -w run check
pnpm -w run links:check
pnpm -w run audit:prod
```

Always include `run` for package scripts. The shorter `pnpm fmt` form can fall through to an
unrelated system command when the current package does not define `fmt`.

`audit:prod` queries the registry advisory database and fails on high-severity production
dependency findings. It requires network access and is run manually during maintenance and before
releases instead of being part of the offline-reproducible `check` chain.

`links:check` runs the pinned Lychee container with the repository mounted read-only. It checks
local links and anchors in Markdown and HTML without making network requests.

Each workspace owns its build, typecheck, and test commands. Select one with a filter instead of
adding a package-specific wrapper to the root manifest:

```bash
pnpm --filter @jongminchung/web run build
```

## Version Policy

The manually triggered package workflow always republishes the personal packages as `1.0.0`.
This is a mutable snapshot channel: the same version can have different API, contents, and
integrity, so SemVer compatibility and lockfile reproducibility are not guaranteed. Consumers must
force a new resolution, such as `pnpm update --force <package>@1.0.0`, and commit the resulting
lockfile whenever they adopt a replacement.

The workflow installs, typechecks, and tests only the publish packages. It deletes the fixed version,
then publishes the two packages in parallel. GitHub authentication is supplied only through the
`GH_PAT` Actions secret.

```bash
pnpm --filter @jongminchung/tooling --filter @jongminchung/ui install --frozen-lockfile --ignore-scripts
pnpm --filter @jongminchung/tooling --filter @jongminchung/ui run typecheck
pnpm --filter @jongminchung/tooling --filter @jongminchung/ui run test
pnpm run publish:dry-run
```

<!-- prettier-ignore-start -->

<!--START_SECTION:waka-->
![AI Code Time](http://img.shields.io/badge/AI%20Code%20Time-739%20hrs%2029%20mins-blue?style=flat)

**I'm a Night 🦉** 

```text
🌞 Morning                984 commits         ███░░░░░░░░░░░░░░░░░░░░░░   10.86 % 
🌆 Daytime                1916 commits        █████░░░░░░░░░░░░░░░░░░░░   21.15 % 
🌃 Evening                3638 commits        ██████████░░░░░░░░░░░░░░░   40.16 % 
🌙 Night                  2520 commits        ███████░░░░░░░░░░░░░░░░░░   27.82 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
Markdown                 11 hrs 58 mins      █████░░░░░░░░░░░░░░░░░░░░   19.86 % 
YAML                     9 hrs 56 mins       ████░░░░░░░░░░░░░░░░░░░░░   16.51 % 
TypeScript               9 hrs 50 mins       ████░░░░░░░░░░░░░░░░░░░░░   16.33 % 
Other                    7 hrs 51 mins       ███░░░░░░░░░░░░░░░░░░░░░░   13.05 % 
Bash                     5 hrs 31 mins       ██░░░░░░░░░░░░░░░░░░░░░░░   09.17 % 
```

🤖 **AI Coding This Week** 

```text
⏱ AI Coding Time: 54 hrs 54 mins (91.12%)

✍️ 83,128 lines written by AI, 963 lines written by hand (98.85% AI-written)

🔤 52,089,516 Input Tokens, 7,846,640 Output Tokens

💵 $1365.35 Estimated AI Cost This Week

🧠 253 AI Sessions, 833 AI Prompts

GPT                      84,880 lines        ████████████████████████░   96.45 % 
Codex-Cli                3,123 lines         █░░░░░░░░░░░░░░░░░░░░░░░░   03.55 % 
Codex-Vscode             0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 

🔎 AI Coding Insights:
🤖 AI-Driven — 98.85% of written lines came from AI
📄 Detailed Prompter — average 658 characters per prompt
🔁 Iterative Prompter — average 3 prompts per session
🚀 High AI Trust — 1.98% of changed lines were hand-edited
```


<!--END_SECTION:waka-->

<!-- prettier-ignore-end -->
