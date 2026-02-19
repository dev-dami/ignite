# Interactive Docs Site

This folder contains a minimalist, grey, interactive documentation website for Ignite.

## Files

- `index.html`: page structure and semantic layout
- `styles.css`: visual system (slate palette, typography, responsive behavior)
- `app.js`: interactive behaviors (search, filters, section tracking, accordion, copy buttons)

## Open Locally

```bash
xdg-open docs/site/index.html
```

If `xdg-open` is unavailable, open the file directly in your browser.

## UX and Accessibility Notes

- Search-first layout with immediate filtering feedback
- Keyboard focus styles and skip link support
- Active section highlighting in sidebar navigation
- Responsive behavior for mobile and desktop
- `prefers-reduced-motion` respected
- Minimum contrast-aware light theme
