# Nerdy AI Hackathon — Submission Reference

Source: [https://hackathon.nerdy.com/](https://hackathon.nerdy.com/)  
Retrieved: 2026-09-06  
Target prompt: **Prompt 02 — Language Learning App**

This doc is the living checklist for a judge-ready Mandarin Rescue submission.

---

## Prompt 02 criteria (what judges say they want)

Create a structured, user-friendly **mobile** experience that simplifies acquisition of a new language through **spaced repetition** or **immersive daily practice**.

Looking for:
- Strong grasp of **pedagogical design**
- **Seamless and intuitive** user journey

## Open / “bring your own” bar (still applies)

- A tool that **genuinely helps someone learn**
- A **real learner**, a **real problem**, something you can **demo**

## Submission mechanics (hard gates)

| Item | Rule |
|------|------|
| Deadline | Friday, September 18, 2026, 11:59 PM CDT |
| Required | Name, email, “what did you build” (what it does / how built / what you’d do next), prompt selection, **demo video** |
| Demo video | YouTube / Loom / Drive / Vimeo (unlisted OK) or upload; process notes call for **2–3 minutes** + a project link |
| Recommended | Code repo, live demo, optional extras |
| Review | Early submissions may be reviewed as they arrive → finalists Sep 21–23 → Demo Day Sep 25 |

## How Mandarin Rescue maps to Prompt 02

| Judge signal | Product implication |
|--------------|---------------------|
| Mobile experience | Portrait-first PWA; board drawable on short phones; landscape is a rotate gate |
| Seamless journey | Lands on puzzle; Continue / Today’s rescue CTA; clue + draw loop |
| Pedagogical design | Hanzi clue → action; wrong-reading vs path-blocked feedback; review-in-play line |
| Spaced / daily practice | Due words surface as “This rescue revisits …”; Today’s rescue session ritual (no streaks) |
| Demo-ready | Film fail-then-learn on phone; explain invisible Gemini adaptation in voiceover |

## Form fields draft

- **Which prompt?** Language Learning App
- **What did you build?** Mandarin Rescue — a mobile PWA where learners read a Mandarin clue, then draw a path through a courtyard maze to guide a beagle home. Correct language choices unlock the safe route; distractors and hazards make meaning matter. Quiet review-in-play and optional Gemini adaptation personalize the next rescue without flashcards or streaks.
- **How you built it:** Client-side deterministic maze gameplay (TypeScript); silent pedagogical director (Gemini) on a Supabase Edge Function with handcrafted fallbacks when offline or invalid; adaptive learner profile in LocalStorage; Vite + React + GitHub Pages PWA (portrait).
- **What you’d do next:**
  - Kennel / multi-lab meta-progression (collectible rescues across facilities)
  - Deeper spaced-repetition scheduling across failed/succeeded phrases
  - Character-silhouette cosmetic themes (not stroke-order drills)
  - Richer listening attribution without breaking silent-first play

## Demo script (2–3 min) — play, not slides

Film on a **phone in portrait** (installed PWA optional). Speak casually; never say “Duolingo” or show a slide deck.

1. **Hook (10–15s)** — “Mandarin clues feel abstract until they become a path you draw.” Open the live URL; app lands on Room 1 with the draw coach.
2. **Fun (45–60s)** — Show clue 小狗回家, tap 家 for scaffold, draw a successful path, beagle trots home (“Beagle home!”). Optional: mute to prove silent-first.
3. **Teaches (45–60s)** — Intentionally route to a distractor (草 / 火) or wrong order on L3/L4. Call out the **Wrong reading** banner naming the character. Retry — board reshuffles.
4. **Adaptive (20–30s)** — Map → note rescues done + “revisits …” if due → Practice another rescue. Voiceover: “Gemini tunes the next mission from struggle logs when online; curated rooms work offline.”
5. **Close (15s)** — “Game first. Language is the win condition.” Live URL + repo.

### Filming checklist

- [ ] Portrait phone recording (no landscape gutter)
- [ ] One clear language fail beat
- [ ] One clear success juice beat
- [ ] Mention adaptive / offline without on-screen “AI” chrome
- [ ] Under 3 minutes

---

## Deploy (live demo)

### GitHub Pages + Supabase director (recommended)

1. **Edge Function (Gemini key stays server-side)** — see [docs/AI.md](AI.md):
   ```bash
   supabase secrets set GEMINI_API_KEY=your_key
   supabase functions deploy adapt --no-verify-jwt
   ```
2. Set GitHub Actions secret `VITE_ADAPT_URL` to  
   `https://<project-ref>.supabase.co/functions/v1/adapt`
3. Push repo; enable **Settings → Pages → GitHub Actions**.
4. Live demo: `https://<user>.github.io/<repo>/`

The AI director is **always on** in the product loop (silent preload → next rescue). If the function/key/network fails, **handcrafted fallbacks** still return — no player-facing toggle.

Local static check: `npm run build:pages` then serve `dist/`.  
Local full stack: `npm run dev` (Express `/api/gemini/adapt` + `.env` key).

Paste the public HTTPS URL into the packaging checklist below when live.

---

## Final submission readiness checklist

### Prompt fit
- [x] Mobile language journey is obvious in ≤30s of play — **Pass**
- [x] Pedagogical design visible (Hanzi → action; wrong-reading feedback; tap scaffold) — **Pass**
- [x] Silent-first still true — **Pass**
- [x] Daily / review signal without flashcards — **Pass** (Today’s rescue + revisits line)

### Portrait PWA
- [x] Manifest `orientation: portrait` — **Pass**
- [x] Landscape rotate gate — **Pass**
- [x] Installable / safe areas — **Pass**
- [x] Service worker in production build — **Pass**
- [x] PWA icons sized correctly — **Pass**

### Clue + board UX
- [x] Longest curated phrases readable — **Pass**
- [x] Board uses remaining viewport height — **Pass**
- [x] Offline toast does not cover Map / Listen — **Pass**
- [x] First-run draw coach + language-aware fail copy — **Pass**

### Packaging
- [ ] Live demo URL ready — **Pending** (GitHub Pages workflow ready; enable Pages + paste URL)
- [ ] Code repo ready — **Pending human** (push / ensure shareable)
- [ ] Demo video filmed (2–3 min, fail-then-learn) — **Pending human** (script above)
- [x] Form copy drafted above still accurate — **Pass**
- [x] Silent-first audio (muted by default; Listen opt-in; no autoplay) — **Pass**

### Status

| Field | Value |
|-------|-------|
| Pass date | 2026-09-06 |
| Overall | Product ready to film; packaging links + video are human |
| Notes | Judge loop polish landed (coach, fail kinds, kennel dashboard, review surface, win juice, adaptive maze proxy). |

---

*Recording the demo video and clicking Submit on the Nerdy form remain human steps.*
