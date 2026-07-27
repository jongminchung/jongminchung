## Packages

This repository owns the shared `@jongminchung` packages used by downstream projects.

- `@jongminchung/tooling`: shared `oxfmt`, `oxlint`, and package-map configuration.
- `@jongminchung/remark-plantuml`: shared PlantUML rendering for Markdown and Astro docs.

Packages are published to GitHub Packages. Consumers need the `@jongminchung` scope mapped to
`https://npm.pkg.github.com`.

## Workspace scripts

Repository-wide scripts are owned by the workspace root. Use `-w` so they resolve to the root even
when the current directory is inside an app or package:

```bash
pnpm -w run fmt
pnpm -w run check
```

Always include `run` for package scripts. The shorter `pnpm fmt` form can fall through to an
unrelated system command when the current package does not define `fmt`.

Each workspace owns its build, typecheck, and test commands. Select one with a filter instead of
adding a package-specific wrapper to the root manifest:

```bash
pnpm --filter @jongminchung/docs run build
```

## Version Policy

`@jongminchung/tooling` and `@jongminchung/remark-plantuml` intentionally stay on `1.0.0`. Reuse
and republish `1.0.0` when correcting package contents. Do not publish `1.0.1`, `1.0.2`, or other
replacement versions for these packages.

```bash
pnpm install
pnpm run check
pnpm run publish:dry-run
```

<!-- prettier-ignore-start -->

<!--START_SECTION:waka-->
![AI Code Time](http://img.shields.io/badge/AI%20Code%20Time-547%20hrs%2045%20mins-blue?style=flat)

**I'm a Night 🦉** 

```text
🌞 Morning                777 commits         ██░░░░░░░░░░░░░░░░░░░░░░░   09.22 % 
🌆 Daytime                1741 commits        █████░░░░░░░░░░░░░░░░░░░░   20.65 % 
🌃 Evening                3443 commits        ██████████░░░░░░░░░░░░░░░   40.85 % 
🌙 Night                  2468 commits        ███████░░░░░░░░░░░░░░░░░░   29.28 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
YAML                     6 hrs 45 mins       ██████░░░░░░░░░░░░░░░░░░░   22.44 % 
TypeScript               4 hrs 57 mins       ████░░░░░░░░░░░░░░░░░░░░░   16.48 % 
Java                     4 hrs 54 mins       ████░░░░░░░░░░░░░░░░░░░░░   16.33 % 
Other                    2 hrs 30 mins       ██░░░░░░░░░░░░░░░░░░░░░░░   08.32 % 
Markdown                 2 hrs 9 mins        ██░░░░░░░░░░░░░░░░░░░░░░░   07.20 % 
```

🤖 **AI Coding This Week** 

```text
⏱ AI Coding Time: 26 hrs 19 mins (87.5%)

✍️ 25,117 lines written by AI, 810 lines written by hand (96.88% AI-written)

🔤 619,575,604 Input Tokens, 2,672,785 Output Tokens

💵 $5407.67 Estimated AI Cost This Week

🧠 94 AI Sessions, 483 AI Prompts

GPT                      27,464 lines        █████████████████████████   99.73 % 
Deepseek                 73 lines            ░░░░░░░░░░░░░░░░░░░░░░░░░   00.27 % 
Vscode-Wakatime          0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 
Codex-Cli                0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 
Opencode-Cli             0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 

🔎 AI Coding Insights:
🤖 AI-Driven — 96.88% of written lines came from AI
📄 Detailed Prompter — average 1,230 characters per prompt
🔁 Iterative Prompter — average 5 prompts per session
🚀 High AI Trust — 9.22% of changed lines were hand-edited
```


<!--END_SECTION:waka-->

<!-- prettier-ignore-end -->
