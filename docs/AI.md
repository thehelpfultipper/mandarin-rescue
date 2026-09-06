# Mandarin Rescue — AI & Level Adaptation Architecture

## 1. Intentional AI director (not an optional toggle)

There is **no in-app “enable Gemini / AI” switch**. The director is always part of the product loop:

1. After missions, the client **silently preloads** the next rescue from the adapt endpoint.
2. Past the curated arc (or “Practice another rescue”), that preload is consumed — UI says **Next rescue**, never “AI”.
3. If the director is reachable and `GEMINI_API_KEY` is configured on the **server/edge**, Gemini curates the next mission from struggle / retention stats.
4. If the key is missing, the network fails, or validation rejects the plan → **handcrafted fallback levels** (same JSON contract). Gameplay never blocks on AI.

Silent-first and offline curated rooms always work. Adaptation is **best-effort personalization**, not a feature flag.

---

## 2. Zero branding / key privacy

* No chatbot, no “ask AI” button, no Gemini logos in the player UI.
* The browser never imports `@google/genai` and never receives `GEMINI_API_KEY`.
* Local: Express [`server.ts`](../server.ts) → `POST /api/gemini/adapt`.
* Production (GitHub Pages): Supabase Edge Function [`supabase/functions/adapt`](../supabase/functions/adapt) → set `VITE_ADAPT_URL` at build time.

---

## 3. What the director returns

Balanced mix of review words (struggled / due), current targets, and distractors. `levelPlan.whyMandarinMatters` may become mission framing — never “AI insight.”

---

## 4. Deterministic vs generative boundary

1. **Generative:** Scenario text, vocab pairings, layout suggestion.
2. **Deterministic:** Sanitization / validation (local server) or structural checks (edge) + client maze craft + **win/loss only in TypeScript** — never asking an LLM if the path was correct.
3. **Fallback:** Always a playable level JSON when the director cannot deliver.

---

## 5. Deploy the Edge Function

```bash
# once: supabase login && supabase link --project-ref <ref>
supabase secrets set GEMINI_API_KEY=your_key
supabase functions deploy adapt --no-verify-jwt
```

Then set GitHub Actions variable/secret for Pages builds:

`VITE_ADAPT_URL=https://<project-ref>.supabase.co/functions/v1/adapt`
