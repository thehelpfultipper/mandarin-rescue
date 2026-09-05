# Mandarin Rescue — Developer Agent Instructions

These instructions are permanent. They ensure that all edits and updates maintain the high-craft design and rigorous architecture of Mandarin Rescue.

---

## 1. Architectural Guardrails
* **Server-Side API Keys:** The Gemini API key must *never* be accessed in React files. All calls must go through the `/api/` endpoints.
* **Minimal Dependencies:** Do not add unrequested UI libraries, state manager libraries, or audio packages. Use native React hooks and LocalStorage.
* **Deterministic Gameplay:** Gameplay drawing, collision checks, and win/loss states are fully calculated client-side in pure TypeScript. Never delegate gameplay verification to an LLM.

---

## 2. Visual & Layout Quality (Anti-Slop)
* **Backgrounds:** Warm neutral soft colors. Avoid generic dark-mode blue/purple gradients. Soft alabaster (#FAF9F6) or light linen (#F4F1EA) are standard backgrounds.
* **Typography:** Playfair Display for primary headers; clean Inter/Plus Jakarta Sans for instructions and standard labels. Chinese characters should be large, clear, and perfectly spaced with high contrast.
* **Touch Targets:** Minimum 44x44px touch targets. Drawing canvas should support fluid touch tracking and automatically adjust to screen dimension resizes via a `ResizeObserver`.

---

## 3. Mandatory Gameplay Rules
* **Silent-First:** Level gameplay must work perfectly when muted. Do not force listening before drawing or require sound effects to understand the puzzle.
* **Contrast of Options:** Every puzzle level must have a correct option matching the Mandarin clue, plus at least one distractor option that is also physically accessible.
* **No Intrusive Retention Mechanics:** Do not implement hearts, lives, visual streaks, XP, coin stores, or notification modals.
