## Packages

This repository owns the shared `@jongminchung` packages used by downstream projects.

- `@jongminchung/tooling`: shared `oxfmt`, `oxlint`, and package-map configuration.
- `@jongminchung/remark-plantuml`: shared PlantUML rendering for Markdown and Astro docs.
- `@jongminchung/theme-contract`: private CSS-only adapter for the apps' shared semantic vocabulary.

Public packages are published to GitHub Packages. Consumers need the `@jongminchung` scope mapped
to `https://npm.pkg.github.com`.

The apps own their theme values and components. See [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) for the
token contract, component ownership rules, and runtime exception policy.

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
dependency findings. It runs in the scheduled security workflow instead of the offline-reproducible
`check` chain.

Each workspace owns its build, typecheck, and test commands. Select one with a filter instead of
adding a package-specific wrapper to the root manifest:

```bash
pnpm --filter @jongminchung/engineering-docs run build
```

## Version Policy

Published package versions are immutable. Increment the stable SemVer version before publishing
changed contents: patch for compatible fixes, minor for compatible features, and major for breaking
contracts. Never delete and republish an existing version.

```bash
pnpm install
pnpm run check
pnpm run publish:dry-run
```

<!-- prettier-ignore-start -->

<!--START_SECTION:waka-->
![AI Code Time](http://img.shields.io/badge/AI%20Code%20Time-569%20hrs%208%20mins-blue?style=flat)

**I'm a Night 🦉** 

```text
🌞 Morning                795 commits         ██░░░░░░░░░░░░░░░░░░░░░░░   09.35 % 
🌆 Daytime                1762 commits        █████░░░░░░░░░░░░░░░░░░░░   20.73 % 
🌃 Evening                3461 commits        ██████████░░░░░░░░░░░░░░░   40.72 % 
🌙 Night                  2482 commits        ███████░░░░░░░░░░░░░░░░░░   29.20 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
Bash                     5 hrs 46 mins       ██████░░░░░░░░░░░░░░░░░░░   25.96 % 
TypeScript               5 hrs 26 mins       ██████░░░░░░░░░░░░░░░░░░░   24.48 % 
Markdown                 3 hrs 11 mins       ████░░░░░░░░░░░░░░░░░░░░░   14.37 % 
YAML                     2 hrs 17 mins       ███░░░░░░░░░░░░░░░░░░░░░░   10.30 % 
Other                    1 hr 27 mins        ██░░░░░░░░░░░░░░░░░░░░░░░   06.52 % 
```

🤖 **AI Coding This Week** 

```text
⏱ AI Coding Time: 21 hrs 55 mins (98.49%)

✍️ 25,085 lines written by AI, 20 lines written by hand (99.92% AI-written)

🔤 2,499,142,728 Input Tokens, 10,161,520 Output Tokens

💵 $3861.22 Estimated AI Cost This Week

🧠 102 AI Sessions, 327 AI Prompts

GPT                      27,815 lines        █████████████████████████   100.00 % 
Vscode-Wakatime          0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 
Codex-Cli                0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 
Opencode-Cli             0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 

🔎 AI Coding Insights:
🤖 AI-Driven — 99.92% of written lines came from AI
📄 Detailed Prompter — average 1,184 characters per prompt
🔁 Iterative Prompter — average 3 prompts per session
🚀 High AI Trust — 0.16% of changed lines were hand-edited
```


<!--END_SECTION:waka-->

<!-- prettier-ignore-end -->
