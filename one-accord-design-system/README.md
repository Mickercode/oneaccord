# One Accord design system (code package)

One Accord by Upper Room: registration and check-in. Concept, not an official Upper Room asset.

## What's inside

| Path                        | What it is                                                                                                             |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `tokens/tokens.css`         | CSS variables (`--oa-*`). Day theme on `:root`; Night theme under `[data-theme="night"]`. Also loads the Google Fonts. |
| `tokens/tokens.ts`          | The same tokens as a typed object for React, React Native or JS.                                                       |
| `tokens/tailwind.preset.js` | Tailwind preset: `bg-oa-ground`, `text-oa-fire-ink`, `font-oa-display`, `rounded-oa-md`, `p-oa-3`...                   |
| `tokens/tokens.json`        | Source of truth, with a usage note on every token.                                                                     |
| `logos/svg/`                | Mark, lockups (horizontal and stacked, light and reversed), one-colour marks, small mark, app icon.                    |
| `logos/png/`                | 1024px mark and app icon, 192px app icon, 64 and 32px small mark, `favicon.ico`.                                       |
| `BRAND.md`                  | Naming, voice, logo rules, colour, type and patterns. Read before designing new screens.                               |
| `preview/cover.html`        | Visual overview of the system.                                                                                         |

## Quick start

```css
/* global.css */
@import './one-accord-design-system/tokens/tokens.css';
body {
  background: var(--oa-ground);
  color: var(--oa-ink);
  font-family: var(--oa-font-body);
}
.btn-primary {
  background: var(--oa-fire);
  color: var(--oa-on-fire);
  border-radius: var(--oa-radius-md);
  min-height: 56px;
}
```

```js
// tailwind.config.js
module.exports = {
  presets: [require('./one-accord-design-system/tokens/tailwind.preset.js')],
  content: ['./src/**/*.{ts,tsx}'],
};
```

```html
<!-- Night theme for usher and dashboard screens -->
<html data-theme="night">
  <link rel="icon" href="/logos/png/favicon.ico" />
  <link rel="apple-touch-icon" href="/logos/png/oneaccord-app-icon-192.png" />
</html>
```

## Notes

- Attendee screens use the Day theme (white). Ushers, delegates and the dashboard use Night.
- Fonts: Barlow Condensed (display) and Archivo (wide and body), both free on Google Fonts. To self-host, download them from Google Fonts and drop the `@import` line in `tokens.css`.
- The words in the SVG lockups are live text. Have a designer convert them to outlines before print.
- Colour values were sampled from Upper Room flyers; confirm with the Upper Room design team.
