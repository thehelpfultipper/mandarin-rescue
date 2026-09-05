# Mandarin Rescue — Gameplay & Mechanics Specification

## 1. Route-Drawing Mechanic
* **Interaction:** Players touch and drag to draw a continuous path on an SVG overlay. Release starts simulation (no separate Go button).
* **Nodes & Items:** The field contains an **Actor** (狗), **Objectives** (e.g., 家, 水, 肉), and **Hazards / distractors** (e.g., 火, 草).
* **Multiple Options:** Every level presents *multiple* possible routes or items. All options are physically accessible by routing, but only *one* sequence matches the written Mandarin text.
* **Deterministic Execution:** The client engine checks node visit **order**, forbidden contacts, thick wall/door/gate collisions, and ink budget. Win/loss never asks an LLM.

---

## 2. The Mandarin Clue Integration
* **Commanding the Objective:** The Mandarin prompt is the exclusive indicator of the target item/destination.
  * *Example:* Clue says `先吃肉再回家`. The level contains both 肉 and 草. Routing to 草 fails; routing 肉 → 家 in order succeeds.
* **No "Translation Questions":** The player is never asked "What does 肉 mean?". Fulfilling the action in-game *is* the translation check.
* **Assists:** Pinyin and English can be toggled in Settings. Intro rooms force assists. Tap characters on the clue for a popover. Hint is available on demand via the help icon.

---

## 3. Physical Labyrinth Rules
* Walls, locked doors, one-way gates, and switches form corridor graphs (not sparse 2-line sketches).
* Collision uses thick barriers so visual wall thickness matches physics. Corridors must stay wide enough that a path remains drawable inside the 3–97 play clamp — solvability tests use the same rules.
* `requiredNodeIds` is an ordered sequence; visiting the right nodes in the wrong order fails.
* Forbidden nodes and hazards are always reachable so language — not geometry alone — decides success.

---

## 4. Audio & Accessibility
* **Toggleable Elements:**
  * **Pinyin:** Persistent toggle (and forced on intro rooms).
  * **Audio Speech:** Pronounce control; disabled while muted. Autoplay only when sound is on.
  * **Translation:** Settings toggle (and forced on intro rooms) — not a separate help drawer.
* Listening mastery updates only for characters the learner actually heard.
