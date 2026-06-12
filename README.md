# Thumb Studio Pro Max

This repo contains a single-page client-side image editor. The project was split into modular files for maintainability while remaining a zero-build, browser-only app.

Dev

Open `Index.html` in a browser or run a simple static server:

```bash
python -m http.server 8000
```

Structure

- `Index.html` — app entry (loads CSS and `js/app.js` module)
- `css/styles.css` — extracted styles
- `js/app.js` — top-level module
- `js/ui.js` — UI event wiring
- `js/processor.js` — canvas and draw logic
- `assets/` — images and icons

Deployment

- Commit and push to GitHub. Vercel will auto-deploy the `thumb-studio` folder as configured.
