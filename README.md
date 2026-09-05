# Mandarin Rescue

A mobile-first Mandarin learning puzzle game where drawing routes solves rescue missions. Gameplay is deterministic client-side TypeScript; optional Gemini adaptation runs only on the server.

## Run locally

**Prerequisites:** Node.js 20+

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy [`.env.example`](.env.example) to `.env` and set `GEMINI_API_KEY` (needed for adaptive levels after the curated arc).
3. Start the app:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Express + Vite middleware (port 3000) |
| `npm run build` | Production client + bundled server |
| `npm start` | Run production server from `dist/` |
| `npm test` | Schema / gameplay validation tests |
| `npm run lint` | Typecheck (`tsc --noEmit`) |

## Docs

- [Gameplay](docs/GAMEPLAY.md)
- [Product](docs/PRODUCT.md)
- [AI adaptation](docs/AI.md)
