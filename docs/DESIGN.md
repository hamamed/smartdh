# SmartDH design system — "Daylight"

The current look. Calm, light, premium money-app feel: emerald green for growth,
honey amber for the Moroccan sun / dirham, on warm daylight paper. Precise mono
numerals carry the "real money app" signal.

> Previous look ("Shiny Summer") is snapshotted in `design-backups/shiny-summer/`
> and tagged `design-shiny-summer` in git if you ever want it back.

## Where it lives
- **`public/css/style.css`** — all tokens + component styles (re-skins every page).
- **`views/layout.ejs`** — loads the fonts and sets the theme color.
- Class names are unchanged, so every EJS view inherits the system automatically.

## Color (CSS custom properties, light)
| Token | Hex | Use |
|---|---|---|
| `--ground` | `#f4f6f3` | page background (warm daylight paper) |
| `--surface` | `#ffffff` | cards |
| `--surface-2` | `#f2f5f1` | insets, inputs-on-tint |
| `--ink` | `#14261c` | text / headings (green-black) |
| `--muted` | `#5f6b62` | secondary text |
| `--line` | `#e5eae2` | borders / dividers |
| `--brand` | `#0e9f6e` | primary · money · growth (emerald) |
| `--brand-strong` | `#0b7d57` | hover / emphasis |
| `--brand-soft` | `#e3f5ec` | soft brand tint |
| `--accent` | `#f4a62a` | sun / dirham (honey amber) |
| `--accent-strong` | `#de900e` | amber emphasis |
| `--sunrise` | `linear-gradient(135deg,#f4a62a,#1bb07c,#0e9f6e)` | hero / announcement |

Semantic: success `#12a56b`, danger `#e5484d`, warning `#e0930e` (amber), info `#2e90fa`.
Dark theme redefines the same tokens (deep green-charcoal grounds, brighter brand `#34d399`).

## Type
- **Plus Jakarta Sans** — UI + display (weights 400–800; headings tracked `-.022em`).
- **JetBrains Mono** — money figures: balances, wallet numbers, stats (`.live-counter`,
  `.wallet .fw-bold`, `.num`, `.mono`). Tabular numerals.
- Arabic falls back to Noto Sans Arabic / system (Jakarta has no Arabic script).

## Shape & depth
- Cards `--radius` **1.15rem**, 1px `--line` border, soft one-direction shadow.
- Buttons `--radius-sm` **0.8rem** (not pills); badges/nav stay pill.
- Shadows are neutral grey-green (`--shadow-sm/md/lg`), never colored glows.

## Motion
Calm: 140–200ms `--ease` `cubic-bezier(.2,.7,.3,1)`; cards/tiles lift `-2/-3px` on
hover; buttons lift `-1px`. No shimmer, no confetti, no bounce. `prefers-reduced-motion`
disables it all.

## Signature
The **total-balance card** (`.card.bg-primary`): emerald gradient with a faint
concentric "rising-sun" arc (SVG rings from the bottom-right corner) + the balance in
mono. It's the one loud element; everything else stays quiet.

## Restore the previous design
```bash
cp design-backups/shiny-summer/style.css  public/css/style.css
cp design-backups/shiny-summer/layout.ejs views/layout.ejs
```
