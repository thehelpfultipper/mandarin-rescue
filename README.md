# Mandarin Rescue

A mobile-first Mandarin learning puzzle game where drawing routes solves rescue missions. Gameplay is deterministic client-side TypeScript. An intentional **AI director** (Gemini) curates later rescues on the server/edge; handcrafted fallbacks always keep play going — there is no player “enable AI” toggle.

## Run locally

**Prerequisites:** Node.js 20+

1. `npm install`
2. Copy [`.env.example`](.env.example) → `.env` and set `GEMINI_API_KEY` (director); without it, fallbacks still work.
3. `npm run dev` → [http://localhost:3000](http://localhost:3000)

## Deploy

### 1. Supabase Edge Function (adaptive director)

```bash
supabase login
supabase link --project-ref <your-ref>
supabase secrets set GEMINI_API_KEY=your_key
supabase functions deploy adapt --no-verify-jwt
```

Function source: [`supabase/functions/adapt`](supabase/functions/adapt). Details: [docs/AI.md](docs/AI.md).

### 2. GitHub Pages (static PWA)

1. Repo secret `VITE_ADAPT_URL` = `https://<project-ref>.supabase.co/functions/v1/adapt`
2. Enable **Settings → Pages → GitHub Actions**
3. Push to `main` — workflow [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Express + Vite (local director at `/api/gemini/adapt`) |
| `npm run build` | Client + bundled Node server |
| `npm run build:pages` | Client-only (Pages) |
| `npm start` | Production Node server |
| `npm test` | Gameplay / schema tests |
| `npm run lint` | Typecheck |

## Docs

- [Gameplay](docs/GAMEPLAY.md)
- [Product](docs/PRODUCT.md)
- [AI director](docs/AI.md)
- [Nerdy hackathon](docs/NERDY_HACKATHON.md)
