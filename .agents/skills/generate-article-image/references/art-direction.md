# Editorial art direction and approval gate

Use this reference only when selecting examples, composing a generation prompt,
or reviewing a generated candidate. The image files in
`image-examples/openai-developer-blog/` remain the visual source of truth.

## Record reference intent

Before prompting, write one observation for each selected role. Describe only
the trait to reuse and the trait that must remain original.

```text
composition: <filename> — reuse focal scale and negative-space ratio; use new geometry
palette: <filename> — reuse background value range and color transitions; use new color placement
material: <filename> — reuse line weight and shallow translucency; use new objects and symbols
contrast: <optional filename> — reuse focal-to-background contrast only
motion: <optional filename> — reuse one direction of visual movement only
```

Do not assign the same file to multiple roles. Do not copy text, logos,
proprietary UI, distinctive object placement, or a recognizable composition.

## Write the visual brief

Complete this brief before writing the image-model prompt.

```text
ARTICLE THESIS
<one sentence derived from both locale articles>

VISUAL THESIS
<one causal relationship that can be understood without text>

FOCAL SYSTEM
<one subject or relationship inside the central crop-safe area>

SUPPORTING ELEMENTS
<zero to two subordinate elements>

TRANSFORMATION
<one direction or before-to-after change, when relevant>

REFERENCE INTENT
<the role notes for the selected examples>

UNRELATED READING TO PREVENT
<the most likely wrong topic and the visual cues that would cause it>
```

## Compose the generation prompt

Use concrete image directions. Prefer bright chromatic mid-tones over ambiguous
terms such as `deep`, `electric`, `cinematic`, or `dramatic`.

```text
Create an original 1536x1024 (3:2) editorial hero image for a bilingual article.

VISUAL THESIS
<the single relationship, mechanism, or transformation>

SCENE AND COMPOSITION
<one medium-scale focal system, up to two supporting elements, one movement,
generous negative space, and the central crop-safe area>

ART DIRECTION
Bright full-bleed atmospheric color field; restrained flat 2D or shallow 2.5D
motion-design still; thin precise linework; translucent overlapping planes;
simple rounded geometry; sparse dots or hatching; soft masks; fine grain; one
controlled focal glow; crisp silhouette at thumbnail size

COLOR AND LIGHT
<one two-to-three-hue family>; airy mid-tone background across the complete
frame; softly varied asymmetric color fields; chromatic corners and edges;
low-to-medium contrast; no black, near-black, dark navy, or white voids

SEMANTIC CONSTRAINTS
<what must be understood, what remains secondary, and the wrong reading to prevent>

EXCLUDE
Text and letters unless requested; logos; watermarks; copied UI; arbitrary
numbers; white or beige studio backgrounds; black or near-black regions; clay,
toy-like, isometric, or photoreal 3D; dense infographics; cinematic darkness;
cyberpunk styling; neon spectacle; energy beams; particle explosions; sci-fi
portals or tunnels; radar or target imagery; harsh shadows; many tiny objects

REFERENCE USE
Use the inspected examples only for the recorded role traits. Create original
subject matter, geometry, layout, and color placement.
```

## Apply the approval gate

A candidate is approved only when every category passes.

### Reference grammar

- The frame remains chromatic and mid-tone through its corners and edges
- The subject reads as flat 2D or shallow 2.5D rather than a physical scene
- Linework, translucency, texture, and glow remain restrained
- One medium-scale focal system dominates with generous quiet space
- The image belongs beside the palette reference without copying it

### Article specificity

- The article-specific causal relationship is apparent without a caption
- The focal metaphor expresses the mechanism, not only the broad domain
- An unrelated topic is not equally or more plausible
- Supporting elements clarify the thesis instead of inventorying sections

### Production safety

- No accidental text, logo, watermark, malformed symbol, or copied detail exists
- Important content survives a small thumbnail and central card crop
- The automated `analyze` report returns `ok: true`

Reject a candidate when any item fails. On retry, name one failed category and
change only that dimension of the prompt.
