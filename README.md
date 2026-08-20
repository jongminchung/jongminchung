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
![AI Code Time](http://img.shields.io/badge/AI%20Code%20Time-664%20hrs%2016%20mins-blue?style=flat)

**I'm a Night 🦉** 

```text
🌞 Morning                911 commits         ███░░░░░░░░░░░░░░░░░░░░░░   10.50 % 
🌆 Daytime                1797 commits        █████░░░░░░░░░░░░░░░░░░░░   20.71 % 
🌃 Evening                3503 commits        ██████████░░░░░░░░░░░░░░░   40.38 % 
🌙 Night                  2465 commits        ███████░░░░░░░░░░░░░░░░░░   28.41 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
TypeScript               12 hrs 8 mins       ███████░░░░░░░░░░░░░░░░░░   28.59 % 
Markdown                 8 hrs 11 mins       █████░░░░░░░░░░░░░░░░░░░░   19.27 % 
Other                    6 hrs 6 mins        ████░░░░░░░░░░░░░░░░░░░░░   14.39 % 
JSON                     3 hrs 4 mins        ██░░░░░░░░░░░░░░░░░░░░░░░   07.26 % 
YAML                     2 hrs 58 mins       ██░░░░░░░░░░░░░░░░░░░░░░░   06.99 % 
```

🤖 **AI Coding This Week** 

```text
⏱ AI Coding Time: 36 hrs 28 mins (85.88%)

✍️ 36,236 lines written by AI, 945 lines written by hand (97.46% AI-written)

🔤 64,137,018 Input Tokens, 6,759,598 Output Tokens

💵 $704.41 Estimated AI Cost This Week

🧠 157 AI Sessions, 586 AI Prompts

GPT                      41,184 lines        █████████████████████████   100.00 % 
Codex-Vscode             0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 
Codex-Cli                0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 

🔎 AI Coding Insights:
🤖 AI-Driven — 97.46% of written lines came from AI
📄 Detailed Prompter — average 828 characters per prompt
🔁 Iterative Prompter — average 4 prompts per session
🚀 High AI Trust — 4.52% of changed lines were hand-edited
```


<!--END_SECTION:waka-->

<!-- prettier-ignore-end -->
