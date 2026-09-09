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

---

## 4. Maze & Hazard Placement (Anti-Regression)
Any change to board geometry, maze generation, walls, nodes, or distractors must preserve **meaningful** hazards. Decorative blockers are a regression.

* **Competing decoy corridors (required):** Hazards and avoid-targets must sit on a *simple alternate path* between consecutive required nodes (or the L11 long-way vs shortcut corridor) — a route a player might actually draw toward the next goal. Industry path-maze practice: one correct route + decoy routes; landmarks/hazards go *on* those decoy routes ([Think Labyrinth enticements](https://www.astrolog.org/labyrnth/psych.htm); path-maze false paths).
* **Order-skip geometry (required for 先…再… rooms):** Intermediate required stops must not be cut-vertices on every actor→home path, and at least one skip route must avoid forbidden landmarks. Players must be able to draw a wrong-order route that reaches home while skipping a checkpoint (language fails as `wrong_order`); if meat/water is unavoidable — or only reachable home-first routes also hit 草/火 — order teaching collapses to item contrast only.
* **Forbidden:** Placing fire/grass/wrong targets only on short cul-de-sac stubs, sideways spurs, or late dead ends that never reconnect toward the next required stop. Those read as decoration and players ignore them.
* **Hard gates in `mazeGenerator.ts`:** Published boards must keep `onCompetingPath`, corridor length ≥ 3, hazards clear of the true solution corridor, drawable BFS solvability, order-checkpoint skippability, and no trivial actor→goal straight line. Do not weaken or remove these gates to “make generation easier.”
* **When editing mazes:** If you change `mazeGenerator.ts`, `boardVariants.ts`, `curatedLevels.ts`, or collision/draw logic in `GameCanvas.tsx`, re-run `node --import tsx tests/run-tests.ts` and prefer `node --import tsx tests/audit-hazards.ts` (and `tests/audit-order-topology.ts` for multi-stop rooms). Do not ship maze changes while distractor pressure / competing-path / order-skip checks fail.
* **Regression smell:** “Hazard is reachable” alone is **not** enough. Ask: *Would a player following a plausible path to the next Mandarin target hit this hazard?* If no → fix placement, don’t add more stubs.
