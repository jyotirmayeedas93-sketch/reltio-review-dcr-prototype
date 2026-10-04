# Build Design System: tokens

All the design tokens from the **Build Design System** Figma file (`9gbh6BJ4Kcxp2CeMVhSJPE`), exported on 4 Oct 2026. Every Figma variable and text style is here. The component tokens were derived from the variables bound on each Figma component.

| File | What it is |
|---|---|
| `tokens.json` | The source of truth, in [W3C Design Tokens](https://design-tokens.github.io/community-group/format/) format. Each token keeps its original Figma name in `$extensions.figma`. |
| `tokens.css` | CSS custom properties, **generated** from `tokens.json`. References stay as `var()` chains. Don't edit this file by hand. |
| `build-css.mjs` | Rebuilds the CSS with `node design-system/build-css.mjs`. It has no dependencies. The build fails on an unresolved reference or a name clash. |

## Tiers

```
primitive  →  alias  →  semantic (light / dark)  →  component
                         responsive (desktop / mobile) → typography
                         accessibility (AA-safe colours)
```

| Tier | Figma source | Tokens | Example |
|---|---|---|---|
| `primitive` | Brand collection | 78 | `color.purple.500` = `#a259fb` · `scale.300` = `12px` · `font.weight.semibold` = `600` |
| `alias` | Alias collection | 68 | `color.primary.500` → `{primitive.color.purple.500}` · `radius.sm` → `{primitive.scale.50}` |
| `semantic` | Mapped collection (Light, Dark) | 42 | `surface.action` · `text.body` · `border.focus` |
| `responsive` | Responsive collection (Desktop, Mobile) | 31 | `type.h1.size` = 60px desktop / 48px mobile |
| `accessibility` | Accessibility collection | 4 | `brand` → `{alias.color.primary.700}` |
| `typography` | 18 text styles | 18 | `typography.body.md` = Inter 400 16/20 |
| `component` | Bindings on 22 component pages | 300 | `button.primary.bg` → `{semantic.surface.action}` |

All 223 variables and 18 text styles in the file are included. The tier counts match Figma exactly.

### Modes in CSS

- **Light** and **Desktop** are the defaults on `:root`.
- **Dark**: add `data-theme="dark"` to `<html>`. This switches 40 semantic tokens.
- **Mobile**: type sizes switch at `(max-width: 767px)`. Figma's device sizes are 1440 and 440, so the breakpoint is a judgment call.

### Naming: Figma → token

Most names carry over directly. A few Figma names were duplicates that Figma auto-suffixed, so they were renamed by what they actually contain:

| Figma variable | Token | Why |
|---|---|---|
| `Alias/Neutral/50 2` … `800 2` | `alias.color.primary.*` | Points to the Purple ramp |
| `Alias/Neutral/50 3` … `800 3` | `alias.color.error.*` | Points to the Red ramp |
| `Alias/Neutral/sm`, `md`, `lg`, `none` | `alias.border-width.*` | Scoped to stroke width |
| `Alias/Neutral/sm 2`, `md 2`, `lg 2`, `none 2`, `round` | `alias.radius.*` | Scoped to corner radius |
| `Mapped/Border/default 2` | `semantic.border.default` | |
| `Mapped/Border/default light` | `semantic.border.default-light` | |
| `Mapped/Surface/action-hover light` | `semantic.surface.action-hover-light` | |
| `Responsive/paragraph md/font size` | `responsive.type.body-md.size` | Matches the `Body/md` text style |

### Component tokens

These cover Button (primary / outline / transparent / disabled / focus), Field (Input and Text Area), Label, Menu, Checkbox, Radio, Switch, Tab, Button Group, Link, Avatar, Tag, Pill, Badge, Progress, Snack Bar, Carousel, Table and Loader.

Where a Figma component uses a **hard-coded** value that happens to equal a token, the component token references that token. It is marked `"hard-coded in Figma; matches this token by value"`. Values with no matching token, such as pill padding 9px and snack bar padding 18px, are kept as raw values and flagged.

## Audit: issues found in the Figma file

These came up while exporting. None blocked the export, but each is worth fixing at the source.

1. **Mapped tokens skip the alias tier.** `Surface/action`, `action-hover`, `action-hover light`, `success`, `disabled` and `Border/default light` / `default 2` point straight at Brand primitives instead of Alias tokens.
2. **Broken dark value.** `Text/headings` in Dark mode points to a variable outside this file. `neutral.50` is assumed here.
3. **Duplicates and strays.** `Surface/action-hover 2` (a duplicate), `Border/25` (a raw `#f5f5f5` with no scope), and `Alias/Neutral/Color` and `Alias/Color` (raw white, unused) are kept as `$deprecated` and left out of the CSS.
4. **Unnamed variants.** The Radio, Tag and Carousel `Status5`–`Status8` variants and Link `Status4` (which is the disabled state) are unnamed.
5. **Hard-coded values in components.** Button radius and padding, pill radius and padding, snack bar padding, several 10px / 6px / 15px gaps, and the `#d9d9d9` loader and progress dots aren't bound to tokens.
6. **Inconsistencies.** The table header uses a *border* token (`Border/default light`) as its fill. The switch focus ring uses `Border/action` instead of `Border/focus`.
7. **Contrast.** Several semantic pairings fall below WCAG AA:

| Pairing | Ratio | Needs |
|---|---|---|
| `text.on-action` on `surface.action` (primary button, selected menu item) | 3.92 | 4.5 |
| `text.action` on `surface.default` (purple text) | 3.92 | 4.5 |
| `text.success` on `surface.success` | 2.92 | 4.5 |
| `text.warning` on `surface.warning` | 2.56 | 4.5 |
| `text.error` on `surface.error` | 3.35 | 4.5 |
| `text.placeholder` on `surface.default` | 4.49 | 4.5 |
| `border.default-light` on `surface.default` (input outline) | 1.09 | 3.0 (WCAG 1.4.11) |

   The **Accessibility** collection already defines AA-safe brand (8.52:1), red (6.53:1), orange (5.35:1) and green (6.67:1) colours, but nothing in Mapped or the components uses them yet. Mapping `text.success`, `text.warning`, `text.error` and `text.action` to those colours would fix most of the table.
8. **Tight line height.** `Body/sm` is 14px/16px, a ratio of 1.14. It works for one line of text but is tight for paragraphs.

## How the prototype uses it

`styles.css` reads only tokens from this folder; it contains no hex values. It adds a small **app layer** at the top. That layer maps prototype roles onto DS tokens and applies the contrast fixes above, using colours the DS already provides:

| Prototype role | DS default | Used instead |
|---|---|---|
| Primary button / selected nav | `surface.action` (3.92) | `surface.action-hover` (purple 600, 5.69) and `a11y.brand` on hover |
| Purple text and links | `text.action` (3.92) | `a11y.brand` (8.52) |
| Success / warning / error text | `text.success` / `warning` / `error` | `a11y.green` / `orange` / `red` |
| Input outline | `border.default-light` (1.09) | `color.neutral.400` (4.49) |
| Secondary text | `text.placeholder` (4.49) | `color.neutral.500` |

The DS has no destructive button or modal, so those are composed from DS tokens (button metrics with error colours; surface, radius and type tokens).
