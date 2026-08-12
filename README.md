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
![AI Code Time](http://img.shields.io/badge/AI%20Code%20Time-618%20hrs%2057%20mins-blue?style=flat)

**I'm a Night 🦉** 

```text
🌞 Morning                879 commits         ███░░░░░░░░░░░░░░░░░░░░░░   10.17 % 
🌆 Daytime                1787 commits        █████░░░░░░░░░░░░░░░░░░░░   20.67 % 
🌃 Evening                3500 commits        ██████████░░░░░░░░░░░░░░░   40.49 % 
🌙 Night                  2478 commits        ███████░░░░░░░░░░░░░░░░░░   28.67 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
Markdown                 10 hrs 39 mins      ██████░░░░░░░░░░░░░░░░░░░   22.21 % 
TypeScript               9 hrs 52 mins       █████░░░░░░░░░░░░░░░░░░░░   20.61 % 
YAML                     7 hrs 40 mins       ████░░░░░░░░░░░░░░░░░░░░░   16.01 % 
Other                    5 hrs 32 mins       ███░░░░░░░░░░░░░░░░░░░░░░   11.55 % 
Java                     4 hrs 8 mins        ██░░░░░░░░░░░░░░░░░░░░░░░   08.62 % 
```

🤖 **AI Coding This Week** 

```text
⏱ AI Coding Time: 40 hrs 36 mins (84.69%)

✍️ 58,551 lines written by AI, 4,306 lines written by hand (93.15% AI-written)

🔤 362,301,960 Input Tokens, 11,023,419 Output Tokens

💵 $2159.23 Estimated AI Cost This Week

🧠 153 AI Sessions, 601 AI Prompts

GPT                      63,616 lines        █████████████████████████   100.00 % 
Vscode-Wakatime          0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 
Codex-Vscode             0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 
Sonnet                   0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 
Codex-Cli                0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 

🔎 AI Coding Insights:
🤖 AI-Driven — 93.15% of written lines came from AI
📄 Detailed Prompter — average 750 characters per prompt
🔁 Iterative Prompter — average 4 prompts per session
🚀 High AI Trust — 13.53% of changed lines were hand-edited
```


<!--END_SECTION:waka-->

<!-- prettier-ignore-end -->
