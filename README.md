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
![AI Code Time](http://img.shields.io/badge/AI%20Code%20Time-558%20hrs%208%20mins-blue?style=flat)

**I'm a Night 🦉** 

```text
🌞 Morning                824 commits         ██░░░░░░░░░░░░░░░░░░░░░░░   09.53 % 
🌆 Daytime                1796 commits        █████░░░░░░░░░░░░░░░░░░░░   20.77 % 
🌃 Evening                3541 commits        ██████████░░░░░░░░░░░░░░░   40.95 % 
🌙 Night                  2487 commits        ███████░░░░░░░░░░░░░░░░░░   28.76 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
YAML                     4 hrs 23 mins       █████░░░░░░░░░░░░░░░░░░░░   19.54 % 
Bash                     4 hrs 1 min         ████░░░░░░░░░░░░░░░░░░░░░   17.93 % 
Java                     3 hrs 42 mins       ████░░░░░░░░░░░░░░░░░░░░░   16.52 % 
TypeScript               2 hrs 59 mins       ███░░░░░░░░░░░░░░░░░░░░░░   13.29 % 
Markdown                 2 hrs 11 mins       ██░░░░░░░░░░░░░░░░░░░░░░░   09.76 % 
```

🤖 **AI Coding This Week** 

```text
⏱ AI Coding Time: 20 hrs 45 mins (92.32%)

✍️ 12,798 lines written by AI, 233 lines written by hand (98.21% AI-written)

🔤 845,584,772 Input Tokens, 3,845,674 Output Tokens

💵 $4423.00 Estimated AI Cost This Week

🧠 65 AI Sessions, 304 AI Prompts

GPT                      14,715 lines        █████████████████████████   100.00 % 
Vscode-Wakatime          0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 

🔎 AI Coding Insights:
🤖 AI-Driven — 98.21% of written lines came from AI
📄 Detailed Prompter — average 777 characters per prompt
🔁 Iterative Prompter — average 5 prompts per session
🚀 High AI Trust — 3.91% of changed lines were hand-edited
```


<!--END_SECTION:waka-->

<!-- prettier-ignore-end -->
