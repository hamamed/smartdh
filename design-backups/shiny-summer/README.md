# Saved design — "Shiny Summer"

A full snapshot of the app's original look, kept so you can go back to it any time.

## What this is
The **Shiny Summer** theme: coral-sunset / turquoise / sunny-yellow palette, confetti-dot
background, playful "jelly" hover animations, Open Sans, rounded cards.

Core tokens:
- **Coral** `#ff5f6d` (primary) · **Mango** `#ff9d4d` · **Sunny** `#ffd23f`
- **Mint** `#16c79a` · **Turquoise** `#24d3c4` · **Ocean** `#12b1d6` · **Lilac** `#8a63e0`
- Sunset gradient `linear-gradient(135deg,#ffb03a,#ff6a6a,#ff5f8f)`
- Font: **Open Sans**

## Files in this folder
- `style.css` — the entire theme (was `public/css/style.css`)
- `layout.ejs` — page shell + fonts + navbar/footer (was `views/layout.ejs`)

## How to restore it
From the project root:

```bash
cp design-backups/shiny-summer/style.css  public/css/style.css
cp design-backups/shiny-summer/layout.ejs views/layout.ejs
```

Then restart the app (or `sudo bash deploy/update.sh` on the server) and hard-refresh.

Or, with git, restore just these two files from the tagged commit:

```bash
git checkout design-shiny-summer -- public/css/style.css views/layout.ejs
```

(The `design-shiny-summer` git tag marks the commit where this design was live.)
