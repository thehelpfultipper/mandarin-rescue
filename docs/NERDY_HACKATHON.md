# Nerdy AI Hackathon — Submission Reference

Source: [https://hackathon.nerdy.com/](https://hackathon.nerdy.com/)  
Retrieved: 2026-09-06  
Target prompt: **Prompt 02 — Language Learning App**

This doc is the living checklist for a judge-ready Mandarin Rescue submission. Fill the **Final submission readiness** section last, after mobile/PWA layout work lands.

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
| Mobile experience | Portrait-first PWA; board drawable on short phones; landscape is a rotate gate, not a broken play mode |
| Seamless journey | Clues fully readable (no cut-off); chrome doesn’t starve the board; install/standalone feels native |
| Pedagogical design | Hanzi + tap scaffold + optional Listen remain first-class; **silent-first** still works |
| Demo-ready | Live URL + short phone recording of one clear mission (draw path → rescue) without UI apologizing |

## Form fields draft

- **Which prompt?** Language Learning App
- **What did you build?** Mandarin Rescue — a mobile PWA where learners read a Mandarin clue, then draw a path through a courtyard maze to guide a beagle home. Correct language choices unlock the safe route; distractors and hazards make meaning matter.
- **How you built it:** Client-side deterministic maze gameplay (TypeScript); adaptive learner profile in LocalStorage; optional Gemini-backed generation via server `/api/` routes; Vite + React + PWA (standalone, portrait).
- **What you’d do next:**
  - Deeper spaced-repetition scheduling across failed/succeeded phrases
  - Richer listening attribution without breaking silent-first play
  - More curated mission arcs and accessibility polish for smaller phones

## Demo script outline (2–3 min)

1. **Learner problem** (15s) — Mandarin phrases feel abstract; learners need meaning tied to action.
2. **One mission** (60–90s) — Open on a phone (portrait / installed if possible). Show clue tap scaffold, draw the path, hit a distractor or succeed, retry/next.
3. **AI / adaptive angle** (30s) — Adaptive learner profile / assists; optional generation path.
4. **What’s next** (20s) — Spaced repetition depth, more missions, ship-quality PWA.

---

## Final submission readiness checklist

Complete this **after** portrait PWA layout work. Mark each item Pass / Fail with a short note.

### Prompt fit
- [x] Mobile language journey is obvious in ≤30s of play — **Pass** (tap Room → clue + draw board immediately)
- [x] Pedagogical design visible (Hanzi clue → action on board; tap scaffold; optional Listen) — **Pass**
- [x] Silent-first still true (muted play works without requiring audio) — **Pass** (Listen disabled when muted; drawing works)

### Portrait PWA
- [x] Manifest `orientation: portrait` — **Pass** (`dist/manifest.webmanifest`)
- [x] Landscape shows rotate-to-portrait gate (no broken gutter layout) — **Pass** (verified 700×390)
- [x] Installable / standalone meta present; safe areas correct (no double inset) — **Pass** (shell insets only)
- [x] Service worker registers in production build — **Pass** (`dist/sw.js` + `registerSW.js`)
- [x] PWA icons are properly sized (192 / 512 / maskable), not identical oversized copies — **Pass** (resized via sips)

### Clue + board UX
- [x] Longest curated phrases fully reachable / readable (horizontal scroll OK; no cut-off) — **Pass** (L12 clue scrollable; chars remain tappable)
- [x] Board uses remaining viewport height on ≤740px-tall viewports (not chrome-starved) — **Pass** (390×700: board ~374×467 ≈ **67%** of viewport height)
- [x] Offline toast does not cover Map / Listen — **Pass** (top banner)

### Packaging
- [ ] Live demo URL ready — **Pending human** (deploy / share link)
- [ ] Code repo ready — **Pending human** (push / ensure shareable)
- [ ] Demo video script rehearsed (2–3 min) — **Pending human** (outline drafted above)
- [x] Form copy drafted above still accurate — **Pass**

### Status

| Field | Value |
|-------|-------|
| Pass date | 2026-09-06 |
| Overall | Ready to film (product/PWA layout pass; packaging links + video are human) |
| Notes | Portrait-only play + compact chrome + flex-fill 4:5 board + SW build fix (`minify: false` / workbox development mode to avoid terser early-exit). Landscape is rotate gate only. |

---

*Filling this checklist is the last implementation step for mobile-first PWA work. Recording the demo video and clicking Submit on the Nerdy form remain human steps.*
