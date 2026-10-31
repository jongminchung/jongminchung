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
pnpm run check
pnpm run links:check
pnpm run audit
```

Use `make check` to apply formatting fixes and run lint and type checks.

Always include `run` for package scripts so commands are visibly distinguished from pnpm subcommands.

`audit` queries the registry advisory database and fails on high-severity dependency findings. It
requires network access and is run manually during maintenance and before releases instead of being
part of the offline-reproducible `check` chain.

`links:check` uses Podman when available, otherwise Docker, to run the pinned Lychee container
with the repository mounted read-only. It checks
local links and anchors in Markdown and HTML without making network requests.

Each workspace owns its build, typecheck, and test commands. Select one with a filter instead of
adding a package-specific wrapper to the root manifest:

```bash
pnpm --filter @jongminchung/web run build
```

## Version Policy

The manually triggered package workflow replaces `@jongminchung/ui` at `1.0.0`.
This is a mutable snapshot channel: the same version can have different API, contents, and
integrity, so SemVer compatibility and lockfile reproducibility are not guaranteed. Consumers must
force a new resolution, such as `pnpm update --force <package>@1.0.0`, and commit the resulting
lockfile whenever they adopt a replacement.

The workflow installs the shared lockfile from the repository root, then lints, typechecks, and
runs coverage and Node consumer checks for UI on Node 24 and 26. It builds the
archive before deleting the fixed version, publishes that archive, and verifies registry integrity
and consumer imports. See the [release and recovery runbook](./docs/runbooks/release.md).
GitHub authentication is supplied only through the `GH_PAT` Actions secret.

```bash
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @jongminchung/ui run typecheck
pnpm --filter @jongminchung/ui run test:coverage
pnpm --filter @jongminchung/ui run test:node
pnpm --filter @jongminchung/ui run publish:dry-run
```

<!-- prettier-ignore-start -->

<!--START_SECTION:waka-->
![AI Code Time](http://img.shields.io/badge/AI%20Code%20Time-912%20hrs%2028%20mins-blue?style=flat)

**I'm a Night 🦉** 

```text
🌞 Morning                976 commits         ███░░░░░░░░░░░░░░░░░░░░░░   11.01 % 
🌆 Daytime                2180 commits        ██████░░░░░░░░░░░░░░░░░░░   24.59 % 
🌃 Evening                3334 commits        █████████░░░░░░░░░░░░░░░░   37.60 % 
🌙 Night                  2376 commits        ███████░░░░░░░░░░░░░░░░░░   26.80 % 
```


📊 **This Week I Spent My Time On** 

```text
💬 Programming Languages: 
Markdown                 7 hrs 58 mins       █████░░░░░░░░░░░░░░░░░░░░   19.94 % 
Python                   7 hrs 25 mins       █████░░░░░░░░░░░░░░░░░░░░   18.59 % 
YAML                     5 hrs 59 mins       ████░░░░░░░░░░░░░░░░░░░░░   14.99 % 
Java                     5 hrs 26 mins       ███░░░░░░░░░░░░░░░░░░░░░░   13.63 % 
Go                       2 hrs 35 mins       ██░░░░░░░░░░░░░░░░░░░░░░░   06.49 % 
```

🤖 **AI Coding This Week** 

```text
⏱ AI Coding Time: 25 hrs 54 mins (64.82%)

✍️ 14,581 lines written by AI, 2,326 lines written by hand (86.24% AI-written)

🔤 13,392,914 Input Tokens, 2,539,797 Output Tokens

💵 $230.71 Estimated AI Cost This Week

🧠 113 AI Sessions, 483 AI Prompts

GPT                      15,596 lines        ████████████████████████░   97.40 % 
DeepSeek                 416 lines           █░░░░░░░░░░░░░░░░░░░░░░░░   02.60 % 
Gemini                   0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 
Oss                      0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 
Sonnet                   0 lines             ░░░░░░░░░░░░░░░░░░░░░░░░░   00.00 % 

🔎 AI Coding Insights:
🤖 AI-Driven — 86.24% of written lines came from AI
📄 Detailed Prompter — average 542 characters per prompt
🔁 Iterative Prompter — average 4 prompts per session
🚀 High AI Trust — 21.48% of changed lines were hand-edited
```


<!--END_SECTION:waka-->

<!-- prettier-ignore-end -->

- 설치와 공통 `make check`·`pnpm run check` 사용법은 [기여 가이드](docs/CONTRIBUTING.md)를 참고함
