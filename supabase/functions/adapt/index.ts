/**
 * Mandarin Rescue — Pedagogical Game Director (Supabase Edge Function)
 *
 * Intentional AI director for post-curated / "Practice another rescue" missions.
 * GEMINI_API_KEY lives only as a function secret. On any failure, returns a
 * handcrafted fallback level (same contract as server.ts). Never brands AI to clients.
 *
 * Deploy:
 *   supabase functions deploy adapt --no-verify-jwt
 *   supabase secrets set GEMINI_API_KEY=...
 *
 * Client:
 *   VITE_ADAPT_URL=https://<project>.supabase.co/functions/v1/adapt
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  isValidLevelResponse,
  MODEL_RESPONSE_JSON_SCHEMA,
  parseModelJson,
  REVIEWED_EDGE_MISSIONS,
  REVIEWED_EDGE_NODE_VOCABULARY,
} from "./modelJson.ts";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FALLBACK_LEVELS = [
  {
    levelPlan: {
      learningGoal: "Guide the puppy home safely by avoiding the fire hazard",
      grammarTarget: "Direction and obstacle avoidance",
      scaffolding: [
        { char: "狗", pinyin: "gǒu", english: "Dog", emoji: "🐶", stage: "new" },
        { char: "避", pinyin: "bì", english: "Avoid", emoji: "🛡️", stage: "new" },
        { char: "火", pinyin: "huǒ", english: "Fire", emoji: "🔥", stage: "new" },
        { char: "家", pinyin: "jiā", english: "Home", emoji: "🏠", stage: "new" },
      ],
      puzzleTemplate: "hazard-avoidance",
      constraints: ["Avoid the fire hazard, navigate safe path to home"],
      plausibleRouteCount: 2,
      puzzleDifficulty: "easy",
      whyMandarinMatters: "Recognizing 避 and 火 charts a safe detour.",
    },
    suggestedLevel: {
      id: "lvl_fallback_1",
      title: "Fallback: Safe Journey Home",
      mandarinClue: "小狗避开火，回家",
      pinyinClue: "xiǎogǒu bìkāi huǒ, huíjiā",
      englishTranslation: "The puppy avoids the fire and goes home",
      hint: "Guide the dog (狗) around Fire (火) to Home (家).",
      isAudioRequired: false,
      nodes: [
        { id: "n_actor", type: "actor", label: "Beagle", chineseChar: "狗", x: 20, y: 80 },
        { id: "n_fire", type: "hazard", label: "Fire", chineseChar: "火", x: 50, y: 50 },
        { id: "n_home", type: "goal", label: "Home", chineseChar: "家", x: 80, y: 20 },
        { id: "n_grass", type: "item", label: "Grass", chineseChar: "草", x: 80, y: 80 },
      ],
      requiredNodeIds: ["n_actor", "n_home"],
      forbiddenNodeIds: ["n_fire", "n_grass"],
      walls: [
        { id: "w_top", x1: 50, y1: 15, x2: 50, y2: 42 },
        { id: "w_bot", x1: 50, y1: 58, x2: 50, y2: 85 },
      ],
      lockedDoors: [],
      oneWayGates: [],
      switches: [],
      routeLengthLimit: 320,
      vocabularyScaffold: [
        { char: "狗", pinyin: "gǒu", english: "Dog", emoji: "🐶", stage: "new" },
        { char: "火", pinyin: "huǒ", english: "Fire", emoji: "🔥", stage: "new" },
        { char: "家", pinyin: "jiā", english: "Home", emoji: "🏠", stage: "new" },
        { char: "草", pinyin: "cǎo", english: "Grass", emoji: "🌿", stage: "new" },
      ],
      missionFraming: "Another rescue — keep clear of the wrong corridor.",
    },
    rationale: "Deterministic fallback when the director is unavailable.",
  },
  {
    levelPlan: {
      learningGoal: "Drink water first then go home",
      grammarTarget: "Sequential 先…再…",
      scaffolding: [
        { char: "水", pinyin: "shuǐ", english: "Water", emoji: "💧", stage: "new" },
        { char: "火", pinyin: "huǒ", english: "Fire", emoji: "🔥", stage: "familiar" },
        { char: "狗", pinyin: "gǒu", english: "Dog", emoji: "🐶", stage: "familiar" },
        { char: "家", pinyin: "jiā", english: "Home", emoji: "🏠", stage: "familiar" },
      ],
      puzzleTemplate: "required-checkpoints",
      constraints: ["Hit water before home", "Avoid fire"],
      plausibleRouteCount: 1,
      puzzleDifficulty: "medium",
      whyMandarinMatters: "先…再… forces visit order on the path.",
    },
    suggestedLevel: {
      id: "lvl_fallback_2",
      title: "Fallback: Thirsty Beagle",
      mandarinClue: "先喝水，再回家",
      pinyinClue: "xiān hē shuǐ, zài huíjiā",
      englishTranslation: "Drink water first, then go home",
      hint: "Reach Water (水) before Home (家). Dodge Fire (火).",
      isAudioRequired: false,
      nodes: [
        { id: "n_actor", type: "actor", label: "Beagle", chineseChar: "狗", x: 15, y: 85 },
        { id: "n_water", type: "checkpoint", label: "Water", chineseChar: "水", x: 20, y: 40 },
        { id: "n_home", type: "goal", label: "Home", chineseChar: "家", x: 85, y: 15 },
        { id: "n_fire", type: "hazard", label: "Fire", chineseChar: "火", x: 85, y: 55 },
      ],
      requiredNodeIds: ["n_actor", "n_water", "n_home"],
      forbiddenNodeIds: ["n_fire"],
      walls: [
        { id: "w1", x1: 40, y1: 10, x2: 40, y2: 55 },
        { id: "w2", x1: 60, y1: 40, x2: 60, y2: 90 },
      ],
      lockedDoors: [],
      oneWayGates: [],
      switches: [],
      routeLengthLimit: 400,
      vocabularyScaffold: [
        { char: "水", pinyin: "shuǐ", english: "Water", emoji: "💧", stage: "new" },
        { char: "火", pinyin: "huǒ", english: "Fire", emoji: "🔥", stage: "familiar" },
        { char: "狗", pinyin: "gǒu", english: "Dog", emoji: "🐶", stage: "familiar" },
        { char: "家", pinyin: "jiā", english: "Home", emoji: "🏠", stage: "familiar" },
      ],
      missionFraming: "Water first — the order in the clue is the order on the path.",
    },
    rationale: "Deterministic fallback when the director is unavailable.",
  },
  {
    levelPlan: {
      learningGoal: "Use the key, avoid fire",
      grammarTarget: "用钥匙开门",
      scaffolding: [
        { char: "钥匙", pinyin: "yàoshi", english: "Key", emoji: "🔑", stage: "new" },
        { char: "火", pinyin: "huǒ", english: "Fire", emoji: "🔥", stage: "strong" },
        { char: "家", pinyin: "jiā", english: "Home", emoji: "🏠", stage: "strong" },
      ],
      puzzleTemplate: "key-door",
      constraints: ["Collect key before locked door"],
      plausibleRouteCount: 1,
      puzzleDifficulty: "hard",
      whyMandarinMatters: "钥匙 unlocks the path; 火 is the decoy wing.",
    },
    suggestedLevel: {
      id: "lvl_fallback_3",
      title: "Fallback: The Locked Gate",
      mandarinClue: "用钥匙开门，避开火，再回家",
      pinyinClue: "yòng yàoshi kāi mén, bìkāi huǒ, zài huíjiā",
      englishTranslation: "Use the key to open the door, avoid the fire, then go home",
      hint: "Grab Key (钥匙) before the locked passage. Avoid Fire (火).",
      isAudioRequired: false,
      nodes: [
        { id: "n_actor", type: "actor", label: "Beagle", chineseChar: "狗", x: 50, y: 88 },
        { id: "n_key", type: "key", label: "Key", chineseChar: "钥匙", x: 18, y: 55 },
        { id: "n_fire", type: "hazard", label: "Fire", chineseChar: "火", x: 82, y: 55 },
        { id: "n_home", type: "goal", label: "Home", chineseChar: "家", x: 50, y: 14 },
      ],
      requiredNodeIds: ["n_actor", "n_key", "n_home"],
      forbiddenNodeIds: ["n_fire"],
      walls: [
        { id: "w_mid", x1: 50, y1: 35, x2: 50, y2: 75 },
      ],
      lockedDoors: [
        { id: "d_left", x1: 5, y1: 35, x2: 50, y2: 35, keyNodeId: "n_key" },
      ],
      oneWayGates: [],
      switches: [],
      routeLengthLimit: 360,
      vocabularyScaffold: [
        { char: "钥匙", pinyin: "yàoshi", english: "Key", emoji: "🔑", stage: "new" },
        { char: "火", pinyin: "huǒ", english: "Fire", emoji: "🔥", stage: "strong" },
        { char: "家", pinyin: "jiā", english: "Home", emoji: "🏠", stage: "strong" },
      ],
      missionFraming: "Key first — the east wing looks open but ends badly.",
    },
    rationale: "Deterministic fallback when the director is unavailable.",
  },
];

type AdaptBody = {
  completedLevelCount?: number;
  recentlyStruggledChars?: string[];
  recentlyMasteredChars?: string[];
  silentPlay?: boolean;
  adaptiveModel?: Record<string, unknown>;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function pickFallback(completedLevelCount = 0) {
  return FALLBACK_LEVELS[completedLevelCount % FALLBACK_LEVELS.length];
}

function buildFocus(body: AdaptBody): string {
  const struggled = body.recentlyStruggledChars || [];
  const mastered = body.recentlyMasteredChars || [];
  if (struggled.length > 0) {
    return `Focus on reinforcing these characters on the correct path or as review: "${struggled.join(", ")}".`;
  }
  if (mastered.length > 0) {
    return `Learner has traction with "${mastered.slice(0, 6).join(", ")}". Introduce a modest new challenge.`;
  }
  return "Generate a balanced intermediate rescue.";
}

async function callGemini(body: AdaptBody, apiKey: string): Promise<unknown | null> {
  // Free-tier (unbilled) order: Lite first, then mid Flash. Keep in sync with server.ts.
  const models = ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-3.5-flash"];
  const requestTimeoutMs = 35_000;
  const prompt = `You are the Pedagogical Game Director for Mandarin Rescue, a touch-drawing beagle-rescue puzzle.
Return ONLY JSON with keys: levelPlan, suggestedLevel, rationale.

Context:
- Completed levels: ${body.completedLevelCount || 0}
- Pedagogy: ${buildFocus(body)}
- SILENT PLAY: ${body.silentPlay ? "ACTIVE — isAudioRequired MUST be false; solvable from written clue alone" : "INACTIVE"}

Rules for suggestedLevel:
- Percentage coords [15,85]; nodes ≥18 apart; never a straight actor→home line (add walls/hazards).
- Actor id n_actor char 狗; goal id n_home char 家.
- requiredNodeIds starts with n_actor and ends with n_home.
- forbiddenNodeIds includes distractors/hazards that are physically reachable.
- Choose one reviewed mission below verbatim. Copy its Mandarin key, pinyin, and English exactly; never rewrite or recombine them:
${JSON.stringify(Object.fromEntries(
  Object.entries(REVIEWED_EDGE_MISSIONS).filter(([, mission]) => mission.adaptiveEligible)
))}
- Use full learner-facing words 钥匙 for key and 开关 for switch. Never label a node 钥 or 开 as the complete noun.
- vocabularyScaffold may contain only node words from this reviewed dictionary, copying pinyin and English exactly:
${JSON.stringify(REVIEWED_EDGE_NODE_VOCABULARY)}
- Include pinyinClue, englishTranslation, hint, vocabularyScaffold, walls, lockedDoors, oneWayGates, switches, routeLengthLimit.
- missionFraming: one short story-forward line (no AI mention).
- puzzleTemplate one of: required-checkpoints | key-door | switch-wall | hazard-avoidance | one-way-gate
- levelPlan needs learningGoal, grammarTarget, scaffolding, puzzleTemplate, constraints, plausibleRouteCount, puzzleDifficulty, whyMandarinMatters.`;

  for (const model of models) {
    try {
      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(requestTimeoutMs),
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: MODEL_RESPONSE_JSON_SCHEMA,
            maxOutputTokens: 8192,
            thinkingConfig: {
              thinkingLevel: "LOW",
            },
          },
        }),
      });
      if (!res.ok) {
        console.warn(`Gemini ${model} HTTP ${res.status}`);
        continue;
      }
      const payload = await res.json();
      const candidate = payload?.candidates?.[0];
      if (candidate?.finishReason && candidate.finishReason !== "STOP") {
        console.info(`Gemini ${model} returned finishReason=${candidate.finishReason}; trying next model`);
        continue;
      }
      const text = candidate?.content?.parts
        ?.filter((part: { thought?: boolean }) => !part.thought)
        .map((part: { text?: unknown }) => typeof part.text === "string" ? part.text : "")
        .join("");
      if (!text || typeof text !== "string") continue;
      let parsed: Record<string, any>;
      try {
        parsed = parseModelJson(text) as Record<string, any>;
      } catch {
        // A schema-constrained response should parse. If the provider still
        // returns malformed text, fail over without logging a noisy stack.
        console.info(`Gemini ${model} returned malformed structured JSON; trying next model`);
        continue;
      }
      if (!parsed?.suggestedLevel || typeof parsed.suggestedLevel !== "object") {
        continue;
      }
      if (body.silentPlay && parsed?.suggestedLevel) {
        parsed.suggestedLevel.isAudioRequired = false;
      }
      if (!parsed.suggestedLevel.walls) parsed.suggestedLevel.walls = [];
      if (!parsed.suggestedLevel.lockedDoors) parsed.suggestedLevel.lockedDoors = [];
      if (!parsed.suggestedLevel.oneWayGates) parsed.suggestedLevel.oneWayGates = [];
      if (!parsed.suggestedLevel.switches) parsed.suggestedLevel.switches = [];
      if (!parsed.suggestedLevel.missionFraming) {
        parsed.suggestedLevel.missionFraming =
          parsed.levelPlan?.whyMandarinMatters || "Another rescue — practice what you know.";
      }
      if (isValidLevelResponse(parsed)) return parsed;
    } catch (err) {
      if (err instanceof DOMException && err.name === "TimeoutError") {
        console.info(`Gemini ${model} exceeded ${requestTimeoutMs / 1000}s; trying next model`);
      } else {
        console.warn(`Gemini ${model} request failed:`, err);
      }
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let body: AdaptBody = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    console.warn("GEMINI_API_KEY missing — serving fallback");
    return json(pickFallback(body.completedLevelCount || 0));
  }

  try {
    const directed = await callGemini(body, apiKey);
    if (directed) return json(directed);
  } catch (err) {
    console.error("Director error:", err);
  }

  return json(pickFallback(body.completedLevelCount || 0));
});
