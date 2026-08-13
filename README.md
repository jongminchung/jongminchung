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
- [Technology stack and official references](./docs/technology-stack.md)
- [Maintenance guide](./docs/maintenance.md)
- [Contributing guide](./CONTRIBUTING.md)

## Workspace scripts

Repository-wide scripts are owned by the workspace root. Use `-w` so they resolve to the root even
when the current directory is inside an app or package:

```bash
pnpm -w run fmt
pnpm -w run check
pnpm -w run audit:prod
```

Always include `run` for package scripts. The shorter `pnpm fmt` form can fall through to an
unrelated system command when the current package does not define `fmt`.

`audit:prod` queries the registry advisory database and fails on high-severity production
dependency findings. It requires network access and is run manually during maintenance and before
releases instead of being part of the offline-reproducible `check` chain.

Each workspace owns its build, typecheck, and test commands. Select one with a filter instead of
adding a package-specific wrapper to the root manifest:

```bash
pnpm --filter @jongminchung/engineering-docs run build
```

## Version Policy

The manually triggered package workflow always republishes the personal packages as `1.0.0`.
This is a mutable snapshot channel: the same version can have different API, contents, and
integrity, so SemVer compatibility and lockfile reproducibility are not guaranteed. Consumers must
force a new resolution, such as `pnpm update --force <package>@1.0.0`, and commit the resulting
lockfile whenever they adopt a replacement.

The workflow validates and records all tarball integrities before deletion, then replaces each
snapshot with uniform 404 handling and publish retries. It verifies registry integrity and a clean
consumer installation afterward. GitHub authentication is supplied only through the `GH_PAT`
Actions secret.

```bash
pnpm install
pnpm run check
pnpm run publish:dry-run
```

<!-- prettier-ignore-start -->

<!--START_SECTION:waka-->
![AI Code Time](http://img.shields.io/badge/AI%20Code%20Time-627%20hrs%2050%20mins-blue?style=flat)

**I'm a Night 🦉** 

```text
🌞 Morning                883 commits         ███░░░░░░░░░░░░░░░░░░░░░░   10.21 % 
🌆 Daytime                1787 commits        █████░░░░░░░░░░░░░░░░░░░░   20.67 % 
🌃 Evening                3498 commits        ██████████░░░░░░░░░░░░░░░   40.46 % 
🌙 Night                  2478 commits        ███████░░░░░░░░░░░░░░░░░░   28.66 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
TypeScript               12 hrs 42 mins      ██████░░░░░░░░░░░░░░░░░░░   24.71 % 
Markdown                 12 hrs 5 mins       ██████░░░░░░░░░░░░░░░░░░░   23.52 % 
YAML                     7 hrs 46 mins       ████░░░░░░░░░░░░░░░░░░░░░   15.11 % 
Other                    4 hrs 25 mins       ██░░░░░░░░░░░░░░░░░░░░░░░   08.59 % 
Java                     4 hrs 24 mins       ██░░░░░░░░░░░░░░░░░░░░░░░   08.56 % 
```

🤖 **AI Coding This Week** 

```text
⏱ AI Coding Time: 44 hrs 14 mins (85.98%)

✍️ 68,441 lines written by AI, 4,365 lines written by hand (94.0% AI-written)

🔤 278,314,358 Input Tokens, 13,027,716 Output Tokens

💵 $1944.98 Estimated AI Cost This Week

🧠 186 AI Sessions, 664 AI Prompts

GPT                      75,888 lines        █████████████████████████   99.96 % 
Codex-Vscode             31 lines            ░░░░░░░░░░░░░░░░░░░░░░░░░   00.04 % 
Vscode-Wakatime          0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 
Sonnet                   0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 
Codex-Cli                0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 

🔎 AI Coding Insights:
🤖 AI-Driven — 94.0% of written lines came from AI
📄 Detailed Prompter — average 862 characters per prompt
🔁 Iterative Prompter — average 4 prompts per session
🚀 High AI Trust — 11.64% of changed lines were hand-edited
```


<!--END_SECTION:waka-->

<!-- prettier-ignore-end -->
