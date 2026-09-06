# Mandarin Rescue

A mobile-first Mandarin learning puzzle game where drawing routes solves rescue missions. Gameplay is deterministic client-side TypeScript; optional Gemini adaptation runs only on a server API (never in the browser).

## Run locally

**Prerequisites:** Node.js 20+

1. `npm install`
2. Copy [`.env.example`](.env.example) to `.env` and set `GEMINI_API_KEY` (only needed for adaptive rescues after the curated arc).
3. `npm run dev` → [http://localhost:3000](http://localhost:3000)

## Deploy (GitHub Pages)

GitHub Pages hosts the **static PWA** only. It cannot run `server.ts` or keep `GEMINI_API_KEY` secret at runtime.

- Curated rooms L1–12 + offline fallbacks work on Pages as-is.
- Adaptive “Practice another rescue” needs a separate API host; set repo variable `VITE_API_BASE` (e.g. `https://your-api.example.com`) if you add one. **Do not** put the Gemini key in Actions secrets for a client build.

Workflow: [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)  
Enable **Settings → Pages → Source: GitHub Actions**, push to `main`, then use the Pages URL in the Nerdy form.

Local static smoke:

```bash
VITE_BASE=/ npm run build:pages
npx --yes serve dist
```

Full Node server (local / non-Pages hosts):

```bash
npm run build && NODE_ENV=production npm start
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Express + Vite middleware (port 3000) |
| `npm run build` | Client + bundled server |
| `npm run build:pages` | Client-only (GitHub Pages) |
| `npm start` | Production Node server |
| `npm test` | Schema / gameplay tests |
| `npm run lint` | Typecheck |

## Docs

- [Gameplay](docs/GAMEPLAY.md)
- [Product](docs/PRODUCT.md)
- [AI adaptation](docs/AI.md)
- [Nerdy hackathon](docs/NERDY_HACKATHON.md)
