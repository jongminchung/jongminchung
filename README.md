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
![AI Code Time](http://img.shields.io/badge/AI%20Code%20Time-822%20hrs%2030%20mins-blue?style=flat)

**I'm a Night 🦉** 

```text
🌞 Morning                984 commits         ███░░░░░░░░░░░░░░░░░░░░░░   11.10 % 
🌆 Daytime                2127 commits        ██████░░░░░░░░░░░░░░░░░░░   23.99 % 
🌃 Evening                3368 commits        █████████░░░░░░░░░░░░░░░░   37.99 % 
🌙 Night                  2386 commits        ███████░░░░░░░░░░░░░░░░░░   26.91 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
Markdown                 2 hrs 38 mins       ███████░░░░░░░░░░░░░░░░░░   28.06 % 
YAML                     1 hr 43 mins        █████░░░░░░░░░░░░░░░░░░░░   18.30 % 
PlantUML                 1 hr 1 min          ███░░░░░░░░░░░░░░░░░░░░░░   10.84 % 
Java                     1 hr 1 min          ███░░░░░░░░░░░░░░░░░░░░░░   10.78 % 
TypeScript               44 mins             ██░░░░░░░░░░░░░░░░░░░░░░░   07.84 % 
```

🤖 **AI Coding This Week** 

```text
⏱ AI Coding Time: 6 hrs 6 mins (64.73%)

✍️ 3,166 lines written by AI, 531 lines written by hand (85.64% AI-written)

🔤 6,094,744 Input Tokens, 585,724 Output Tokens

💵 $99.74 Estimated AI Cost This Week

🧠 19 AI Sessions, 69 AI Prompts

GPT                      3,262 lines         █████████████████████████   100.00 % 
Opencode-Cli             0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 
Codex-Cli                0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 

🔎 AI Coding Insights:
🤖 AI-Driven — 85.64% of written lines came from AI
📄 Detailed Prompter — average 1,078 characters per prompt
🔁 Iterative Prompter — average 4 prompts per session
🚀 High AI Trust — 31.21% of changed lines were hand-edited
```


<!--END_SECTION:waka-->

<!-- prettier-ignore-end -->

- 설치와 공통 `make fmt`·`make lint` 사용법은 [기여 가이드](docs/CONTRIBUTING.md)를 참고함
