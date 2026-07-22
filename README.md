# NakoCorp Website

Static landing page for [NakoCorp](https://www.nakocorp.com), hosted on GitHub Pages.

## Stack

Plain HTML/CSS/JS, no build step. The whole site is a single [index.html](index.html) with a bilingual EN/FR switcher (English by default, choice persisted in `localStorage`).

## Structure

```
index.html      the page
assets/         logo and product screenshots
CNAME           custom domain (www.nakocorp.com) for GitHub Pages
```

## Local preview

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Deployment

Served by GitHub Pages from the `main` branch root. Pushing to `main` updates the live site automatically.

## License

MIT — see [LICENSE](LICENSE).
