# Article image prompts

This document is the reproducible art direction for article thumbnails. Every
article owns one semantic concept and one image that remains legible in both
light and dark themes. Existing thumbnails can be supplied only as a semantic
subject and broad composition reference.

## Base prompt

> Create a 3:2 landscape thumbnail for a thoughtful technology, investing, or
> systems essay. Use the supplied existing thumbnail only as a semantic subject
> and broad composition reference, then reinterpret it as an original polished
> editorial motion-design still: soft 3D and 2D hybrid, translucent layered
> materials, rounded geometry, tactile paper grain, balanced mid-tone surfaces,
> and restrained coral, lilac, blue, mint, and amber accents. Use enough tonal
> separation and color contrast for the same image to remain legible against
> both white and black page backgrounds. Keep the central visual element clear
> at small size, with generous breathing room and one strong visual metaphor.
> No text, letters, numbers, logos, watermarks, UI labels, or code glyphs. Avoid
> pure white or black edge backgrounds, neon-green hacker aesthetics, harsh
> cyberpunk, fear, and ominous imagery. Preserve the article's symbolic
> thumbnail concept.

## OpenAI Developer Blog reference policy

- Use `content/image-examples/openai-developer-blog/` only as an art-direction
  reference for composition, material, lighting, depth, and editorial tone.
- Do not reproduce any reference image's text, logos, branded marks, distinctive
  UI layout, object arrangement, or other uniquely identifying composition.
- Create an original visual metaphor from the article concept below rather than
  treating a reference image as a template.

## Technology article concepts

| Article ID                         | Subject prompt appended to the base prompt                                                                                                                |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ascii-3d-renderer`                | An ASCII character grid bends into a spatial landscape through a camera and depth pipeline, preserving the renderer metaphor                              |
| `beyond-beautiful-code`            | A pristine local code object connects to contracts, tests, and operators, showing that durable software extends beyond surface elegance                   |
| `building-3d-illusion-game`        | Layered cards and a moving camera create a playful 3D illusion from a flat scene while keeping the original game concept                                  |
| `building-calculator-engine`       | Expression tokens pass through a parser, evaluation gears, and a reliable result surface in one clear calculation pipeline                                |
| `building-coding-agent`            | Interlocking translucent reasoning loops orbit a small faceted seed, with tool paths connecting planning, action, and verification                        |
| `building-email-relay-system`      | A message envelope moves through secure relay gates, retries, and delivery confirmation without exposing literal addresses or text                        |
| `building-llm`                     | Small language fragments flow through layered attention-like membranes and emerge as one coherent luminous structure                                      |
| `building-nes-emulator`            | Retro console components, memory paths, and a pixel display synchronize through a compact emulation loop without brand marks                              |
| `do-we-really-know-pagination`     | Records move through offset and cursor paths while inserts disturb one route and a stable continuation marker protects the other                          |
| `encrypted-share-vault-system`     | A document is split into encrypted fragments that cross a guarded channel and safely reunite inside a transparent vault                                   |
| `feeling-claude-blue`              | A tangled blue system gradually resolves into calm connected loops, expressing productive uncertainty without a literal brain                             |
| `frontend-caching-strategies`      | Requests pass through browser, edge, and data caches with freshness signals, invalidation paths, and progressively faster returns                         |
| `hamssun-python-lisp`              | Two distinct language forms meet through shared symbolic structures, balancing practical Python flow with Lisp-like expression trees                      |
| `headless-react-component`         | One behavior core connects to three presentation shells while accessibility, keyboard, and screen-reader signals share the same interaction pulse         |
| `how-to-design-animation`          | A state-and-time landscape contains keyframe stones, easing arcs, ghosted object positions, and a motion graph                                            |
| `how-to-whittle-a-skill`           | A rough translucent block is refined by an evaluation chisel into a precise interlocking rule shape while rejected fragments become tests                 |
| `implementing-genetic-algorithm`   | Genome seeds explore a fitness landscape through selection, crossover, and mutation, converging toward a strong solution                                  |
| `it-is-the-boundary-stupid`        | Two systems are separated by translucent membranes; data, time, and trust cross through explicit gates while one implicit crossing scatters into failures |
| `modeling-series-view-model`       | Domain blocks pass through one view-model lens into multiple clean screen projections while screen-only needs stay isolated                               |
| `react-component-based-thinking`   | A state-and-data core connects modular component shells, with responsibility boundaries defined by flow rather than visual size                           |
| `reading-coding-test-constraints`  | Many algorithm paths approach input-scale gates; impossible branches fade while one feasible complexity-aware route remains                               |
| `server-monitoring-analysis-guide` | User-impact signals enter a hypothesis lens and many dashboard streams narrow into one evidence path toward a root cause                                  |
| `the-expensive-main-thread`        | A narrow main-thread conveyor is blocked by heavy tasks while scheduled lighter work moves into parallel side lanes                                       |
| `the-weight-of-trivial-code`       | A tiny local code cube sends long contract threads into callers, types, tests, and the wider system, revealing a large change radius                      |
| `throughput-and-latency`           | A queue flows through a processing tunnel; concurrency raises flow until saturation makes queue length and latency rise sharply                           |

## Investment article concepts

| Image ID                               | Subject prompt appended to the base prompt                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `13f-portfolio-reading`                | Three portfolio constellations are examined through lenses for concentrated compounding, tactical rotation, and diversified systems  |
| `direction-of-money-factor-ranking`    | Many candidates pass sequential percentile gates for market, sector, stock, and factors, narrowing into a small shortlist            |
| `direction-of-money-financial-health`  | Accounting signals balance on a scale, combine into financial health, then flow into a valuation range and sell boundary             |
| `direction-of-money-global-portfolio`  | A globe passes through currency, disclosure, liquidity, and concentration filters and emerges as balanced regional allocation orbits |
| `direction-of-money-liquidity-cycle`   | A braided capital river links AI capacity, East Asian exports, global liquidity, a yield-curve bridge, and market breadth            |
| `direction-of-money-market-leadership` | Many trajectories pass through market, sector, stock, and factor lenses, illuminating a small set of sustained leaders               |
| `efficiency-feedback-loop`             | Five unlabeled stations for sense, decide, act, verify, and learn form a circular system that improves on every pass                 |
| `gold-code-monetary-trust`             | A timeline ribbon transforms stone money into gold, paper, a digital token, and an agent-era network as trust migrates               |
| `risk-before-return`                   | Protected capital rests inside guardrails on a downside scale; measured upward paths appear only after the loss boundary is secured  |
| `latency-product-discipline`           | Signal pulses cross queue stages toward a product-choice dial and clock, making ownership and waiting visible                        |
| `unknown-failure-learning`             | A fractured system emits evidence that passes through a hypothesis lens and learning loop before rebuilding into a stronger system   |

## Output contract

- Technology images: `public/tech/articles/<article-id>.png`
- Investment images: `public/invest/<image-id>.png`
- Dimensions: `1536x1024` PNG, 3:2 landscape
- Social metadata and in-page presentation: the same canonical image through
  `EditorialImage`
