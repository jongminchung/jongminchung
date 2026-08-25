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
![AI Code Time](http://img.shields.io/badge/AI%20Code%20Time-684%20hrs%2035%20mins-blue?style=flat)

**I'm a Night 🦉** 

```text
🌞 Morning                961 commits         ███░░░░░░░░░░░░░░░░░░░░░░   10.80 % 
🌆 Daytime                1884 commits        █████░░░░░░░░░░░░░░░░░░░░   21.18 % 
🌃 Evening                3553 commits        ██████████░░░░░░░░░░░░░░░   39.93 % 
🌙 Night                  2499 commits        ███████░░░░░░░░░░░░░░░░░░   28.09 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
Markdown                 11 hrs 49 mins      ███████░░░░░░░░░░░░░░░░░░   29.36 % 
TypeScript               6 hrs 24 mins       ████░░░░░░░░░░░░░░░░░░░░░   15.89 % 
Other                    6 hrs 5 mins        ████░░░░░░░░░░░░░░░░░░░░░   15.15 % 
YAML                     4 hrs 51 mins       ███░░░░░░░░░░░░░░░░░░░░░░   12.06 % 
Bash                     2 hrs 50 mins       ██░░░░░░░░░░░░░░░░░░░░░░░   07.07 % 
```

🤖 **AI Coding This Week** 

```text
⏱ AI Coding Time: 35 hrs 16 mins (87.59%)

✍️ 38,005 lines written by AI, 977 lines written by hand (97.49% AI-written)

🔤 30,768,982 Input Tokens, 4,245,262 Output Tokens

💵 $554.30 Estimated AI Cost This Week

🧠 171 AI Sessions, 655 AI Prompts

GPT                      40,141 lines        █████████████████████████   99.85 % 
Codex-Cli                59 lines            ░░░░░░░░░░░░░░░░░░░░░░░░░   00.15 % 
Codex-Vscode             0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 
Opencode-Cli             0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 
Claude-Code              0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 

🔎 AI Coding Insights:
🤖 AI-Driven — 97.49% of written lines came from AI
📄 Detailed Prompter — average 629 characters per prompt
🔁 Iterative Prompter — average 4 prompts per session
🚀 High AI Trust — 7.25% of changed lines were hand-edited
```


<!--END_SECTION:waka-->

<!-- prettier-ignore-end -->
