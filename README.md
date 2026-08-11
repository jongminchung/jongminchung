## Packages

This repository owns the shared `@jongminchung` packages used by downstream projects.

- `@jongminchung/tooling`: shared `oxfmt`, `oxlint`, and package-map configuration.
- `@jongminchung/remark-plantuml`: shared PlantUML rendering for Markdown and Astro docs.
- `@jongminchung/ui`: private shadcn primitives, shared Tailwind entrypoint, and value-free semantic tokens.

Public packages are published to GitHub Packages. Consumers need the `@jongminchung` scope mapped
to `https://npm.pkg.github.com`.

The apps own their theme values and components. See [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) for the
token contract, component ownership rules, and runtime exception policy.

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
It removes an existing `1.0.0` package version immediately before uploading the replacement.
GitHub authentication is supplied only through the `GH_PAT` Actions secret.

```bash
pnpm install
pnpm run check
pnpm run publish:dry-run
```

<!-- prettier-ignore-start -->

<!--START_SECTION:waka-->
![AI Code Time](http://img.shields.io/badge/AI%20Code%20Time-603%20hrs%2042%20mins-blue?style=flat)

**I'm a Night 🦉** 

```text
🌞 Morning                889 commits         ███░░░░░░░░░░░░░░░░░░░░░░   10.28 % 
🌆 Daytime                1785 commits        █████░░░░░░░░░░░░░░░░░░░░   20.65 % 
🌃 Evening                3493 commits        ██████████░░░░░░░░░░░░░░░   40.40 % 
🌙 Night                  2479 commits        ███████░░░░░░░░░░░░░░░░░░   28.67 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
Markdown                 8 hrs 8 mins        █████░░░░░░░░░░░░░░░░░░░░   20.43 % 
YAML                     7 hrs 51 mins       █████░░░░░░░░░░░░░░░░░░░░   19.72 % 
Other                    5 hrs 49 mins       ████░░░░░░░░░░░░░░░░░░░░░   14.62 % 
TypeScript               4 hrs 11 mins       ███░░░░░░░░░░░░░░░░░░░░░░   10.52 % 
Java                     3 hrs 22 mins       ██░░░░░░░░░░░░░░░░░░░░░░░   08.49 % 
```

🤖 **AI Coding This Week** 

```text
⏱ AI Coding Time: 34 hrs 36 mins (86.81%)

✍️ 39,246 lines written by AI, 888 lines written by hand (97.79% AI-written)

🔤 525,325,943 Input Tokens, 6,808,330 Output Tokens

💵 $2734.68 Estimated AI Cost This Week

🧠 112 AI Sessions, 486 AI Prompts

GPT                      40,658 lines        █████████████████████████   98.87 % 
Claude-Code              282 lines           ░░░░░░░░░░░░░░░░░░░░░░░░░   00.69 % 
Sonnet                   182 lines           ░░░░░░░░░░░░░░░░░░░░░░░░░   00.44 % 
Vscode-Wakatime          0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 
Codex-Cli                0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 

🔎 AI Coding Insights:
🤖 AI-Driven — 97.79% of written lines came from AI
📄 Detailed Prompter — average 711 characters per prompt
🔁 Iterative Prompter — average 4 prompts per session
🚀 High AI Trust — 4.56% of changed lines were hand-edited
```


<!--END_SECTION:waka-->

<!-- prettier-ignore-end -->
