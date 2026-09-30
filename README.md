## Packages

This repository owns the shared `@jongminchung` packages used by downstream projects.

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
- [Maintenance guide](./docs/maintenance.md)
- [Contributing guide](./docs/CONTRIBUTING.md)

## Workspace scripts

Repository-wide scripts are owned by the workspace root and are run from that directory:

```bash
bun run fmt
bun run check
bun run links:check
bun run audit
```

Always include `run` for package scripts so commands are visibly distinguished from Bun subcommands.

`audit` queries the registry advisory database and fails on high-severity dependency findings. It
requires network access and is run manually during maintenance and before releases instead of being
part of the offline-reproducible `check` chain.

`links:check` uses Podman when available, otherwise Docker, to run the pinned Lychee container
with the repository mounted read-only. It checks
local links and anchors in Markdown and HTML without making network requests.

Each workspace owns its build, typecheck, and test commands. Select one with a filter instead of
adding a package-specific wrapper to the root manifest:

```bash
bun run --filter @jongminchung/web build
```

## Version Policy

The manually triggered package workflow replaces `@jongminchung/ui` at `1.0.0`.
This is a mutable snapshot channel: the same version can have different API, contents, and
integrity, so SemVer compatibility and lockfile reproducibility are not guaranteed. Consumers must
force a new resolution, such as `bun update --force <package>@1.0.0`, and commit the resulting
lockfile whenever they adopt a replacement.

The workflow installs the shared lockfile from the repository root, then lints, typechecks, and
runs coverage and Node consumer checks for UI on Node 24 and 26. It builds the
archive before deleting the fixed version, publishes that archive, and verifies registry integrity
and consumer imports. See the [release and recovery runbook](./docs/runbooks/release.md).
GitHub authentication is supplied only through the `GH_PAT` Actions secret.

```bash
bun install --frozen-lockfile --ignore-scripts
bun run --filter @jongminchung/ui typecheck
bun run --filter @jongminchung/ui test:coverage
bun run --filter @jongminchung/ui test:node
bun run --filter @jongminchung/ui publish:dry-run
```

<!-- prettier-ignore-start -->

<!--START_SECTION:waka-->
![AI Code Time](http://img.shields.io/badge/AI%20Code%20Time-837%20hrs%2052%20mins-blue?style=flat)

**I'm a Night 🦉** 

```text
🌞 Morning                985 commits         ███░░░░░░░░░░░░░░░░░░░░░░   11.10 % 
🌆 Daytime                2132 commits        ██████░░░░░░░░░░░░░░░░░░░   24.02 % 
🌃 Evening                3373 commits        ██████████░░░░░░░░░░░░░░░   38.00 % 
🌙 Night                  2386 commits        ███████░░░░░░░░░░░░░░░░░░   26.88 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
Java                     11 hrs 32 mins      ████████░░░░░░░░░░░░░░░░░   33.07 % 
YAML                     7 hrs 55 mins       ██████░░░░░░░░░░░░░░░░░░░   22.72 % 
Markdown                 6 hrs 52 mins       █████░░░░░░░░░░░░░░░░░░░░   19.71 % 
TypeScript               3 hrs 35 mins       ███░░░░░░░░░░░░░░░░░░░░░░   10.31 % 
JSON                     1 hr 32 mins        █░░░░░░░░░░░░░░░░░░░░░░░░   04.40 % 
```

🤖 **AI Coding This Week** 

```text
⏱ AI Coding Time: 19 hrs 33 mins (56.02%)

✍️ 9,766 lines written by AI, 1,703 lines written by hand (85.15% AI-written)

🔤 7,231,792 Input Tokens, 1,451,731 Output Tokens

💵 $83.10 Estimated AI Cost This Week

🧠 71 AI Sessions, 251 AI Prompts

GPT                      8,270 lines         ████████████████████░░░░░   80.79 % 
Spark                    1,792 lines         ████░░░░░░░░░░░░░░░░░░░░░   17.51 % 
Gemini                   174 lines           ░░░░░░░░░░░░░░░░░░░░░░░░░   01.70 % 
Opencode-Cli             0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 
Codex-Vscode             0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 

🔎 AI Coding Insights:
🤖 AI-Driven — 85.15% of written lines came from AI
📄 Detailed Prompter — average 1,262 characters per prompt
🔁 Iterative Prompter — average 4 prompts per session
🚀 High AI Trust — 28.43% of changed lines were hand-edited
```


<!--END_SECTION:waka-->

<!-- prettier-ignore-end -->

- 설치와 공통 `make fmt`·`make lint` 사용법은 [기여 가이드](docs/CONTRIBUTING.md)를 참고함
