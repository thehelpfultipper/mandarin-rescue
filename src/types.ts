import { z } from 'zod';

// NodeType indicates the role of a puzzle node on the field
export const NodeTypeSchema = z.enum([
  'actor',
  'item',
  'obstacle',
  'goal',
  'checkpoint',
  'hazard',
  'key',
  'switch'
]);
export type NodeType = z.infer<typeof NodeTypeSchema>;

// Represents a node placed on the SVG or Canvas grid
export const GameNodeSchema = z.object({
  id: z.string(),
  type: NodeTypeSchema,
  label: z.string(),          // English identifier (e.g., 'fish')
  chineseChar: z.string(),    // Mandarin Chinese representation (e.g., '鱼')
  x: z.number(),              // Percentage coordinate X (0 - 100)
  y: z.number(),              // Percentage coordinate Y (0 - 100)
  color: z.string().optional() // Custom Tailwind color override
});
export type GameNode = z.infer<typeof GameNodeSchema>;

// Wall physical barrier segment
export const WallSchema = z.object({
  id: z.string(),
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
  color: z.string().optional()
});
export type Wall = z.infer<typeof WallSchema>;

// Locked Door barrier segment unlocked by a Key node
export const LockedDoorSchema = z.object({
  id: z.string(),
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
  keyNodeId: z.string(),
  color: z.string().optional()
});
export type LockedDoor = z.infer<typeof LockedDoorSchema>;

// One-way Gate barrier segment allowing crossing in one direction only
export const OneWayGateSchema = z.object({
  id: z.string(),
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
  allowDirection: z.enum(['up', 'down', 'left', 'right']),
  color: z.string().optional()
});
export type OneWayGate = z.infer<typeof OneWayGateSchema>;

// Switch trigger mapping a switch node to toggling a physical wall
export const SwitchTriggerSchema = z.object({
  id: z.string(),
  nodeId: z.string(),
  targetWallId: z.string()
});
export type SwitchTrigger = z.infer<typeof SwitchTriggerSchema>;

/**
 * Moving hazard that patrols waypoints at constant speed (board units / sec).
 * Motion is visual tension; collision is geometric against the patrol corridor
 * (drawn route choice), not live catcher timing.
 */
export const PatrolSchema = z.object({
  id: z.string(),
  label: z.string(),
  chineseChar: z.string(),
  emoji: z.string().optional(),
  waypoints: z.array(z.object({ x: z.number(), y: z.number() })).min(2),
  /** Board-units per second along the loop */
  speed: z.number().positive(),
  /** Collision radius in board space (0–100) */
  radius: z.number().positive().default(7),
  /** Phase offset in seconds so variants desync the beat */
  phase: z.number().default(0)
});
export type Patrol = z.infer<typeof PatrolSchema>;

// Vocabulary scaffolding item for granular learning milestones
export const VocabularyItemSchema = z.object({
  char: z.string(),
  pinyin: z.string(),
  english: z.string(),
  emoji: z.string(),
  stage: z.enum(['new', 'familiar', 'strong', 'later'])
});
export type VocabularyItem = z.infer<typeof VocabularyItemSchema>;

// Configuration for a level
export const LevelSchema = z.object({
  id: z.string(),
  title: z.string(),
  mandarinClue: z.string(),       // The main prompt, e.g., '猫吃鱼'
  pinyinClue: z.string(),         // Hanyu Pinyin with tones, e.g., 'māo chī yú'
  englishTranslation: z.string(), // English backup, hidden behind help drawer
  nodes: z.array(GameNodeSchema), // Nodes visible in the field
  requiredNodeIds: z.array(z.string()), // Path sequence required to solve (order matters)
  forbiddenNodeIds: z.array(z.string()), // Path items that must be avoided
  hint: z.string(),
  walls: z.array(WallSchema).optional(),
  lockedDoors: z.array(LockedDoorSchema).optional(),
  oneWayGates: z.array(OneWayGateSchema).optional(),
  switches: z.array(SwitchTriggerSchema).optional(),
  /** Moving catchers / technicians — L6+ decoy-corridor pressure (route choice) */
  patrols: z.array(PatrolSchema).optional(),
  routeLengthLimit: z.number().optional(),
  vocabularyScaffold: z.array(VocabularyItemSchema).optional(),
  isAudioRequired: z.boolean().optional(),
  /** Force pinyin + English assists for zero-Mandarin intro rooms */
  forceAssists: z.boolean().optional(),
  /** Short teach-in-play coach line (also used for adapted mission framing) */
  missionFraming: z.string().optional()
});
export type Level = z.infer<typeof LevelSchema>;

// Detailed metrics for adaptive learning tracking
export const AdaptiveModelSchema = z.object({
  // Hanzi -> Meaning attempts (characters mapped directly to meaning/goal)
  hanziToMeaning: z.record(z.string(), z.object({ success: z.number(), failure: z.number() })).default({}),
  // Pinyin -> Meaning attempts
  pinyinToMeaning: z.record(z.string(), z.object({ success: z.number(), failure: z.number() })).default({}),
  // Phrase -> Action attempts (for full command phrases like '先喝水再回家')
  phraseToAction: z.record(z.string(), z.object({ success: z.number(), failure: z.number() })).default({}),
  // Spatial-language comprehension metrics (left, right, up, down)
  spatialComprehension: z.object({ success: z.number(), failure: z.number() }).default({ success: 0, failure: 0 }),
  // Ordered-instruction comprehension metrics (先, 后, 再 sequential ordering)
  orderedComprehension: z.object({ success: z.number(), failure: z.number() }).default({ success: 0, failure: 0 }),
  // Delayed retention tracking: spaced repetition completions
  retentionLogs: z.array(z.object({
    charOrPhrase: z.string(),
    lastTestedTime: z.number(),
    sessionIndex: z.number(),
    recalled: z.boolean()
  })).default([]),
  // Listening/audio-only matching knowledge (only incremented when sound is on)
  listeningKnowledge: z.record(z.string(), z.object({ success: z.number(), failure: z.number() })).default({})
});
export type AdaptiveModel = z.infer<typeof AdaptiveModelSchema>;

// Progress tracking for offline persistence
export const PlayerProgressSchema = z.object({
  completedLevelIds: z.array(z.string()),
  vocabularyAttempts: z.record(z.string(), z.object({
    success: z.number(),
    failure: z.number()
  })),
  languageErrors: z.number().default(0),
  drawingErrors: z.number().default(0),
  settings: z.object({
    soundEnabled: z.boolean(),
    pinyinToggle: z.boolean(),
    translationToggle: z.boolean()
  }),
  /** Characters whose audio was actually spoken this session (listening attribution) */
  listenedChars: z.array(z.string()).default([]),
  adaptiveModel: AdaptiveModelSchema.default({
    hanziToMeaning: {},
    pinyinToMeaning: {},
    phraseToAction: {},
    spatialComprehension: { success: 0, failure: 0 },
    orderedComprehension: { success: 0, failure: 0 },
    retentionLogs: [],
    listeningKnowledge: {}
  })
});
export type PlayerProgress = z.infer<typeof PlayerProgressSchema>;

// Level plan detailing pedagogical choices
export const LevelPlanSchema = z.object({
  learningGoal: z.string(),
  grammarTarget: z.string(),
  scaffolding: z.array(VocabularyItemSchema),
  puzzleTemplate: z.string(),
  constraints: z.array(z.string()),
  plausibleRouteCount: z.number(),
  puzzleDifficulty: z.enum(['easy', 'medium', 'hard']),
  whyMandarinMatters: z.string()
});
export type LevelPlan = z.infer<typeof LevelPlanSchema>;

// Server-side response from Gemini adaptation API
export const GeminiAdaptationResponseSchema = z.object({
  levelPlan: LevelPlanSchema,
  suggestedLevel: LevelSchema,
  rationale: z.string()
});
export type GeminiAdaptationResponse = z.infer<typeof GeminiAdaptationResponseSchema>;
