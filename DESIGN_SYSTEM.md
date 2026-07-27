# Design System

The workspace shares a semantic vocabulary, not a shared component library or a single visual
theme. Each app owns its theme values, Base UI composition, and shadcn components.

## Decision order

Choose the narrowest ownership boundary that solves the design need:

1. Choose the shadcn component whose semantics match the interaction.
2. Change an app's `theme.css` when the look can be expressed through a semantic token.
3. Use the component's built-in variant when shadcn already owns the appearance.
4. Compose primitives into an app-owned wrapper when a product pattern repeats.
5. Add an external class only for layout or a genuinely one-off rule.

Do not recreate `packages/ui`. A component belongs to the app whose interaction and product
language it implements.

## Core theme contract

`@jongminchung/theme-contract/tokens.css` is a CSS-only Tailwind adapter. It maps these shared
provider roles:

- background and foreground
- card and card-foreground
- popover and popover-foreground
- primary and primary-foreground
- secondary and secondary-foreground
- muted and muted-foreground
- accent and accent-foreground
- destructive and destructive-foreground
- border, input, and ring
- body and code fonts, the radius scale, and low, medium, and high elevation

Every app defines the provider values in its local `theme.css` using OKLCH. Every declared theme
scope must provide the complete core color set. An app with one theme needs only its root scope;
an app that declares light and dark scopes must make both scopes complete.

Charts, sidebars, feedback states, terminal colors, overlays, and other product roles remain local
to an app. Map a local role with a local `@theme inline` block only when Tailwind utilities need
it. Promote a role to the core contract only after at least two apps use it with the same semantic
meaning and consumer contract.

## Components

Use Base UI for headless behavior and preserve its state attributes, trigger rendering, keyboard
navigation, dismissal reasons, and focus restoration. Prefer shadcn's dedicated `Toggle`,
`ToggleGroup`, `Tabs`, `DropdownMenu`, `Item`, `Tooltip`, and `Spinner` components over recreating
their semantics with a button.

Buttons are the deliberate exception to the app-owned component rule. Import `Button` directly
from `@base-ui/react/button`; do not declare, wrap, alias, or re-export it. Apply the complete
semantic Tailwind recipe at the call site with `cn(...)`, including interaction, appearance, size,
and placement classes. Links remain anchors or router links and receive their own `cn(...)`
classes. Do not create `ButtonPrimitive`, `BaseUIButton`, `ButtonLink`, `buttonVariants`, or
button-derived wrappers such as `IconButton` and `ToolbarButton`.

Compose supplemental button help with the app-local shadcn `Tooltip`, `TooltipTrigger`, and
`TooltipContent`; a native `title` attribute is not a substitute. Keep an accessible name on the
trigger even when the tooltip text repeats it, and mount one `TooltipProvider` at the app root.

Repeated product compositions, such as status notices or metric cards, should wrap local
shadcn components behind a typed app-owned API. Product wrappers may contain a directly imported
Base UI Button, but they must not become a generic button abstraction. Do not promote a wrapper
merely because two screens have similar markup.

## Color and shape rules

- Use semantic variables and OKLCH values. Do not use Tailwind palette utilities or hex, RGB, or
  HSL literals in normal UI code.
- Use `color-mix(in oklch, ...)` for perceptual color mixing.
- Use the shared radius scale, plus `rounded-none` and `rounded-full` where those shapes are
  semantic. Do not use numeric or arbitrary border radii.
- Keep app-specific visual identity in local values. Sharing a token name does not require sharing
  a value.

## Runtime boundaries

sRGB literals are allowed only where the target renderer cannot consume CSS custom properties or
OKLCH, including generated image renderers, Electron native window options, standalone exported
HTML, and canonical image assets. Each exception must be an exact file-level allowlist entry in
the contract test and include a reason.

Even at those boundaries, centralize colors as role-based constants or injected custom properties.
Do not scatter literals through templates. Tests, fixtures, snapshots, generated outputs, and
vendor assets are outside the production source scan.

## Verification

The theme contract test verifies provider completeness, the CSS-only package boundary, semantic
color usage, perceptual mixing, and radius rules. Component tests cover shadcn variants, product
wrappers, and Base UI behavior. Visual snapshots are reviewed; they are never updated automatically
to hide an unintended design change.
