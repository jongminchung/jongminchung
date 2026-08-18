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
pnpm --filter @jongminchung/web run build
```

## Version Policy

The manually triggered package workflow always republishes the personal packages as `1.0.0`.
This is a mutable snapshot channel: the same version can have different API, contents, and
integrity, so SemVer compatibility and lockfile reproducibility are not guaranteed. Consumers must
force a new resolution, such as `pnpm update --force <package>@1.0.0`, and commit the resulting
lockfile whenever they adopt a replacement.

The workflow installs, typechecks, and tests only the publish packages, so unrelated application
native dependencies do not participate in a package snapshot release. It deletes the fixed version,
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
![AI Code Time](http://img.shields.io/badge/AI%20Code%20Time-640%20hrs%208%20mins-blue?style=flat)

**I'm a Night 🦉** 

```text
🌞 Morning                878 commits         ███░░░░░░░░░░░░░░░░░░░░░░   10.29 % 
🌆 Daytime                1758 commits        █████░░░░░░░░░░░░░░░░░░░░   20.60 % 
🌃 Evening                3433 commits        ██████████░░░░░░░░░░░░░░░   40.22 % 
🌙 Night                  2467 commits        ███████░░░░░░░░░░░░░░░░░░   28.90 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
TypeScript               13 hrs 34 mins      ████████░░░░░░░░░░░░░░░░░   31.39 % 
Markdown                 10 hrs 52 mins      ██████░░░░░░░░░░░░░░░░░░░   25.12 % 
Other                    4 hrs 6 mins        ██░░░░░░░░░░░░░░░░░░░░░░░   09.50 % 
YAML                     3 hrs 51 mins       ██░░░░░░░░░░░░░░░░░░░░░░░   08.92 % 
JSON                     2 hrs 26 mins       █░░░░░░░░░░░░░░░░░░░░░░░░   05.66 % 
```

🤖 **AI Coding This Week** 

```text
⏱ AI Coding Time: 37 hrs 35 mins (86.91%)

✍️ 57,218 lines written by AI, 3,423 lines written by hand (94.36% AI-written)

🔤 86,045,380 Input Tokens, 8,984,241 Output Tokens

💵 $1047.13 Estimated AI Cost This Week

🧠 171 AI Sessions, 557 AI Prompts

GPT                      64,421 lines        █████████████████████████   99.95 % 
Codex-Vscode             31 lines            ░░░░░░░░░░░░░░░░░░░░░░░░░   00.05 % 

🔎 AI Coding Insights:
🤖 AI-Driven — 94.36% of written lines came from AI
📄 Detailed Prompter — average 1,011 characters per prompt
🔁 Iterative Prompter — average 3 prompts per session
🚀 High AI Trust — 11.75% of changed lines were hand-edited
```


<!--END_SECTION:waka-->

<!-- prettier-ignore-end -->
