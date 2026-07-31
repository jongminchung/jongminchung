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
![AI Code Time](http://img.shields.io/badge/AI%20Code%20Time-563%20hrs%2023%20mins-blue?style=flat)

**I'm a Night 🦉** 

```text
🌞 Morning                832 commits         ██░░░░░░░░░░░░░░░░░░░░░░░   09.59 % 
🌆 Daytime                1814 commits        █████░░░░░░░░░░░░░░░░░░░░   20.90 % 
🌃 Evening                3546 commits        ██████████░░░░░░░░░░░░░░░   40.86 % 
🌙 Night                  2487 commits        ███████░░░░░░░░░░░░░░░░░░   28.66 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
Bash                     4 hrs 53 mins       ███████░░░░░░░░░░░░░░░░░░   29.89 % 
TypeScript               3 hrs 43 mins       ██████░░░░░░░░░░░░░░░░░░░   22.78 % 
Markdown                 2 hrs 7 mins        ███░░░░░░░░░░░░░░░░░░░░░░   13.02 % 
YAML                     2 hrs 3 mins        ███░░░░░░░░░░░░░░░░░░░░░░   12.64 % 
Other                    1 hr 21 mins        ██░░░░░░░░░░░░░░░░░░░░░░░   08.27 % 
```

🤖 **AI Coding This Week** 

```text
⏱ AI Coding Time: 16 hrs 10 mins (98.9%)

✍️ 13,949 lines written by AI, 13 lines written by hand (99.91% AI-written)

🔤 873,053,563 Input Tokens, 3,851,215 Output Tokens

💵 $2303.80 Estimated AI Cost This Week

🧠 57 AI Sessions, 237 AI Prompts

GPT                      15,667 lines        █████████████████████████   100.00 % 
Vscode-Wakatime          0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 
Codex-Cli                0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 
Opencode-Cli             0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 

🔎 AI Coding Insights:
🤖 AI-Driven — 99.91% of written lines came from AI
📄 Detailed Prompter — average 849 characters per prompt
🔁 Iterative Prompter — average 4 prompts per session
🚀 High AI Trust — 0.24% of changed lines were hand-edited
```


<!--END_SECTION:waka-->

<!-- prettier-ignore-end -->
