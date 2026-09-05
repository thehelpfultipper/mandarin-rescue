# Mandarin Rescue — AI & Level Adaptation Architecture

## 1. Zero-Branding Server-Side AI
* **No AI Gimmicks:** No chatbot, no floating "ask AI" button, and no generic conversational prompts. The player should never be aware of an "AI" engine — UI copy says "Next rescue" / "Practice another rescue."
* **Full-Stack Privacy:** All calls to the `@google/genai` SDK happen exclusively on the server (`server.ts` via `/api/gemini/adapt`). The browser never imports `@google/genai` or receives the `GEMINI_API_KEY`.
* **Model Choice:** Prefer a fast Flash-tier Gemini model for level creation; the server may retry across available Flash aliases.

---

## 2. Invisible Adaptation Engine
* **Performance Logs:** The client tracks vocabulary successes/failures, ordered/spatial comprehension, retention logs, and (when audio was spoken) listening knowledge.
* **When it runs:** After missions, the client silently preloads `/api/gemini/adapt`. Advancing past the curated arc (or tapping "Next rescue") consumes that preload — no loading spinner branded as AI.
* **Server Adaptation:** Gemini returns a balanced mix of:
  1. *Review Words:* Characters the user recently struggled with or that are due for review-in-play.
  2. *Current Target:* Active lesson vocabulary.
  3. *Distractor Words:* Plausible items in the phonetic/semantic neighborhood of the target.
* **Pedagogy framing:** `levelPlan.learningGoal` / `whyMandarinMatters` may surface as a short coach line on the mission — never as "AI insight."
* **Deterministic Output:** Zod-parseable JSON describing the level; invalid plans fall back to curated hand-crafted levels.

---

## 3. Strict Boundary: Deterministic vs. Generative
1. **Generative (Gemini):** Suggests scenario text, vocabulary pairings, and item descriptions.
2. **Deterministic (Code):** Server sanitizes with Zod, vocabulary whitelist, grammar↔template rules, geometry, and solvability BFS. Failures → curated fallbacks.
3. **Gameplay Validation:** Win/loss is calculated *entirely by local TypeScript geometry and ordered node checks*, never by asking Gemini if the path was correct.
