---
name: generate-article-image
description: Generate, regenerate, or review canonical editorial images for Jongmin Chung web articles from a user-provided MDX file path. Use for article artwork under apps/web/public/tech/articles or apps/web/public/invest, including requests for thumbnails, hero images, or OpenAI Developer Blog-like art direction. Prompt for the article path when it is missing. Do not use for Excalidraw diagrams, screenshots, or general site UI assets.
---

# Generate article images

Create one original editorial image from the live article content. Do not use an
article-to-prompt map. Run every command from the repository root with
`bunx --bun`.

## Resolve the article contract

- Require one concrete source path matching one of these forms
  - `apps/web/content/tech/blog/<locale>/<article-id>.mdx`
  - `apps/web/content/invest/<locale>/notes/<article-id>.mdx`
- If the path is missing, ask only for the source `MDX` path before proceeding
- Resolve the locale pair, canonical output, image contract, and bundled
  references with the CLI

```bash
bunx --bun generate-article-image prepare --article <mdx-path>
```

- Treat the returned JSON as the source of truth
  - Read every path in `article.sourcePaths`
  - Write only `output.absolutePath`
  - Inspect references only from `references.availablePaths`
- Treat the full articles and frontmatter as the semantic authority
  - Extract the thesis, causal mechanism, tension, and resulting state
  - Prefer the idea distinguishing this article from neighboring articles
- Inspect the current canonical image for semantic continuity only
  - Start new generations from a clean canvas unless the user asks for an edit
  - Never use the current image as a style reference

## Select references by role

- Read `references.readmePath`, then visually inspect three to five examples
- Read [references/art-direction.md](references/art-direction.md) before
  choosing references or writing the prompt
- Assign one distinct example to each required role
  - `composition`: spatial organization and focal scale
  - `palette`: background brightness and color-field behavior
  - `material`: line, translucency, texture, and depth treatment
- Optionally add one `contrast` and one `motion` reference
- Include at least one example with a different subject to avoid copying
- Record and validate the exact set by rerunning `prepare`

```bash
bunx --bun generate-article-image prepare \
  --article <mdx-path> \
  --reference composition=<filename> \
  --reference palette=<filename> \
  --reference material=<filename>
```

## Build and generate one visual thesis

- Write a private visual brief using the structure in
  [references/art-direction.md](references/art-direction.md)
- Represent one causal relationship rather than an inventory of article nouns
- Use one focal system, at most two supporting elements, and one transformation
- Keep important content inside the central 80% width and 70% height
- Use the built-in bitmap image generator in new-image mode
  - Do not pass `referenced_image_paths` or `num_last_images_to_include`
  - The inspected examples influence the written art direction only
  - Request the final `1536x1024` 3:2 composition directly

## Analyze before judging

- Run deterministic tone analysis against the selected reference set before
  deciding whether a result is acceptable

```bash
bunx --bun generate-article-image analyze \
  --article <mdx-path> \
  --input <generated-image-path> \
  --reference composition=<filename> \
  --reference palette=<filename> \
  --reference material=<filename>
```

- Treat any failed automated check as a blocking style defect
  - Do not override the report because the subject looks attractive
  - Regenerate by changing only the failed tone or chroma direction
- Then apply the visual and semantic approval gate from
  [references/art-direction.md](references/art-direction.md)
  - Inspect at full size and thumbnail scale
  - Compare the result directly with the composition and palette references
  - State the most plausible unrelated topic the image could represent
  - Reject it when that unrelated reading is as plausible as the article thesis
- Make at most two focused regeneration attempts
- If the second retry still fails, do not replace the canonical asset; report
  the remaining defects and the generated candidate paths

## Finalize only an approved result

- Pass the same role-labeled references to `finalize`; it reruns tone analysis
  before replacing the canonical image

```bash
bunx --bun generate-article-image finalize \
  --article <mdx-path> \
  --input <generated-image-path> \
  --reference composition=<filename> \
  --reference palette=<filename> \
  --reference material=<filename>
```

- `finalize` rejects non-3:2, transparent, or tone-incompatible inputs, then
  writes one three-channel sRGB PNG at exactly `1536x1024`
- Preserve the established filename and frontmatter path
- If an investment image meaning changes materially, update `imageAlt` in both
  locale files to describe the same visual
- Do not add per-theme variants or duplicate assets
- Verify the canonical asset and repository state

```bash
bunx --bun generate-article-image validate --article <mdx-path>
git diff --check
git status --short
```
