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
![AI Code Time](http://img.shields.io/badge/AI%20Code%20Time-672%20hrs%205%20mins-blue?style=flat)

**I'm a Night 🦉** 

```text
🌞 Morning                953 commits         ███░░░░░░░░░░░░░░░░░░░░░░   10.80 % 
🌆 Daytime                1874 commits        █████░░░░░░░░░░░░░░░░░░░░   21.23 % 
🌃 Evening                3525 commits        ██████████░░░░░░░░░░░░░░░   39.93 % 
🌙 Night                  2475 commits        ███████░░░░░░░░░░░░░░░░░░   28.04 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
Markdown                 9 hrs 9 mins        ██████░░░░░░░░░░░░░░░░░░░   24.07 % 
TypeScript               8 hrs 40 mins       ██████░░░░░░░░░░░░░░░░░░░   22.78 % 
Other                    4 hrs 29 mins       ███░░░░░░░░░░░░░░░░░░░░░░   11.82 % 
YAML                     4 hrs 11 mins       ███░░░░░░░░░░░░░░░░░░░░░░   11.01 % 
JSON                     3 hrs 31 mins       ██░░░░░░░░░░░░░░░░░░░░░░░   09.26 % 
```

🤖 **AI Coding This Week** 

```text
⏱ AI Coding Time: 33 hrs 38 mins (88.37%)

✍️ 36,887 lines written by AI, 848 lines written by hand (97.75% AI-written)

🔤 28,741,312 Input Tokens, 3,866,410 Output Tokens

💵 $600.52 Estimated AI Cost This Week

🧠 149 AI Sessions, 620 AI Prompts

GPT                      40,275 lines        █████████████████████████   99.85 % 
Codex-Cli                59 lines            ░░░░░░░░░░░░░░░░░░░░░░░░░   00.15 % 
Codex-Vscode             0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 

🔎 AI Coding Insights:
🤖 AI-Driven — 97.75% of written lines came from AI
📄 Detailed Prompter — average 639 characters per prompt
🔁 Iterative Prompter — average 4 prompts per session
🚀 High AI Trust — 5.65% of changed lines were hand-edited
```


<!--END_SECTION:waka-->

<!-- prettier-ignore-end -->
