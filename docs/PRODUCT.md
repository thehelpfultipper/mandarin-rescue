# Mandarin Rescue — Product Rules & Vision

## 1. Product Vision
Mandarin Rescue is a high-craft, mobile-first puzzle game where players solve physical path-drawing rescue missions by comprehending Mandarin Chinese clues. 
Unlike typical educational software, Mandarin Rescue is a *game first*. It rejects the "flashcard/quiz + game" split. Vocabulary and character comprehension are direct gameplay mechanics, not obstacles or chores.

---

## 2. Core Game Loop
1. **The Clue (WHAT):** A written Mandarin sentence (with optional toggleable Pinyin/audio) describes a critical scenario and indicates **WHAT** must happen (e.g., "The puppy goes home", "Drink water first, then go home", "Avoid the fire").
2. **The Path (HOW):** The screen shows multiple path nodes, hazards, and items. The player solves **HOW** to fulfill the Mandarin instructions by drawing a continuous path connecting actors, items, and objectives.
3. **Execution:** On release, the game simulates the path. If the drawn route correctly satisfies the Mandarin semantics (including visit **order**) while dodging hazards, the rescue succeeds.

---

## 3. Pedagogical Journey
* **Intro ramp:** Early rooms force assists (pinyin + English) and teach drawing + first characters (狗 / 家) with a physically accessible distractor.
* **Teach-in-play:** Tap a word/unit in the clue for pinyin/meaning (compounds like 回家, 钥匙 stay grouped). Hints are on-demand, not always on screen.
* **Review in play:** Struggle and retention logs quietly shape the *next* rescue — no streak/XP dark patterns, no fake spaced-repetition scoreboard.
* **Silent-first:** Every curated level works muted. Listening mastery only updates when audio was actually spoken.

---

## 4. Product Principles

### A. Non-Intrusive & Respectful Architecture
* **No "Gamification" Slop:** No streaks, XP, daily logins, visual lives, hearts, pop-up notifications, or chatbot companions.
* **Respectful Retention:** Engagement is driven by satisfying puzzle design and intellectual growth, not synthetic urgency or psychological manipulation.
* **Invisible Adaptation:** Server-side generation customizes the next mission from learner stats. The player never sees "AI" or "Gemini" branding — only "Next rescue."
* **Silent-First:** Every level can be completed fully muted. Listening is never mandatory to win, but high-quality audio is available as an optional helper.

### B. Mobile-First PWA Layout
* Designed specifically for safe vertical touch-targets on screens (minimum 44×44px).
* Standalone layout that fits comfortably in a mobile frame with no nested visual noise.
* Full-bleed layout, safe margins, and responsive touch zones. Drawing board uses `ResizeObserver`.

### C. Aesthetic Direction
* App chrome uses warm neutrals (soft alabaster / linen accents on dark inkstone playfield).
* Playfair Display for headers; clean sans for UI; large, high-contrast Hanzi.
* The inkstone labyrinth board is intentional craft — not generic dark-mode purple gradients.
