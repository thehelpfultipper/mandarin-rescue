import { z } from 'zod';

const PercentCoordinateSchema = z.number().finite().min(0).max(100);

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
  id: z.string().min(1),
  type: NodeTypeSchema,
  label: z.string().min(1),          // English identifier (e.g., 'fish')
  chineseChar: z.string().min(1),    // Mandarin Chinese representation (e.g., '鱼')
  x: PercentCoordinateSchema,        // Percentage coordinate X (0 - 100)
  y: PercentCoordinateSchema,        // Percentage coordinate Y (0 - 100)
  color: z.string().optional() // Custom Tailwind color override
});
export type GameNode = z.infer<typeof GameNodeSchema>;

// Wall physical barrier segment
export const WallSchema = z.object({
  id: z.string().min(1),
  x1: PercentCoordinateSchema,
  y1: PercentCoordinateSchema,
  x2: PercentCoordinateSchema,
  y2: PercentCoordinateSchema,
  color: z.string().optional()
});
export type Wall = z.infer<typeof WallSchema>;

// Locked Door barrier segment unlocked by a Key node
export const LockedDoorSchema = z.object({
  id: z.string().min(1),
  x1: PercentCoordinateSchema,
  y1: PercentCoordinateSchema,
  x2: PercentCoordinateSchema,
  y2: PercentCoordinateSchema,
  keyNodeId: z.string().min(1),
  color: z.string().optional()
});
export type LockedDoor = z.infer<typeof LockedDoorSchema>;

// One-way Gate barrier segment allowing crossing in one direction only
export const OneWayGateSchema = z.object({
  id: z.string().min(1),
  x1: PercentCoordinateSchema,
  y1: PercentCoordinateSchema,
  x2: PercentCoordinateSchema,
  y2: PercentCoordinateSchema,
  allowDirection: z.enum(['up', 'down', 'left', 'right']),
  color: z.string().optional()
});
export type OneWayGate = z.infer<typeof OneWayGateSchema>;

// Switch trigger mapping a switch node to toggling a physical wall
export const SwitchTriggerSchema = z.object({
  id: z.string().min(1),
  nodeId: z.string().min(1),
  targetWallId: z.string().min(1)
});
export type SwitchTrigger = z.infer<typeof SwitchTriggerSchema>;

/**
 * Moving hazard that patrols waypoints at constant speed (board units / sec).
 * Motion is visual tension; collision is geometric against the patrol corridor
 * (drawn route choice), not live catcher timing.
 */
export const PatrolSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  chineseChar: z.string().min(1),
  emoji: z.string().optional(),
  waypoints: z.array(z.object({ x: PercentCoordinateSchema, y: PercentCoordinateSchema })).min(2),
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
  id: z.string().min(1),
  title: z.string().min(1),
  mandarinClue: z.string().min(1),       // The main prompt, e.g., '猫吃鱼'
  pinyinClue: z.string().min(1),         // Hanyu Pinyin with tones, e.g., 'māo chī yú'
  englishTranslation: z.string().min(1), // English backup, hidden behind help drawer
  nodes: z.array(GameNodeSchema).min(3), // Actor, goal, and at least one accessible distractor
  requiredNodeIds: z.array(z.string().min(1)).min(2), // Path sequence required to solve (order matters)
  forbiddenNodeIds: z.array(z.string().min(1)).min(1), // At least one meaningful avoid target
  hint: z.string().min(1),
  walls: z.array(WallSchema).optional(),
  lockedDoors: z.array(LockedDoorSchema).optional(),
  oneWayGates: z.array(OneWayGateSchema).optional(),
  switches: z.array(SwitchTriggerSchema).optional(),
  /** Moving catchers / technicians — L6+ decoy-corridor pressure (route choice) */
  patrols: z.array(PatrolSchema).optional(),
  routeLengthLimit: z.number().positive().optional(),
  vocabularyScaffold: z.array(VocabularyItemSchema).optional(),
  isAudioRequired: z.boolean().optional(),
  /** Force pinyin + English assists for zero-Mandarin intro rooms */
  forceAssists: z.boolean().optional(),
  /** Short teach-in-play coach line (also used for adapted mission framing) */
  missionFraming: z.string().optional()
}).superRefine((level, ctx) => {
  const nodeIds = level.nodes.map(node => node.id);
  const nodeIdSet = new Set(nodeIds);
  if (nodeIdSet.size !== nodeIds.length) {
    ctx.addIssue({ code: 'custom', path: ['nodes'], message: 'Node IDs must be unique' });
  }

  const actors = level.nodes.filter(node => node.type === 'actor');
  const goals = level.nodes.filter(node => node.type === 'goal');
  if (actors.length !== 1) {
    ctx.addIssue({ code: 'custom', path: ['nodes'], message: 'Level must contain exactly one actor' });
  }
  if (goals.length !== 1) {
    ctx.addIssue({ code: 'custom', path: ['nodes'], message: 'Level must contain exactly one goal' });
  }

  const requiredSet = new Set(level.requiredNodeIds);
  const forbiddenSet = new Set(level.forbiddenNodeIds);
  if (requiredSet.size !== level.requiredNodeIds.length) {
    ctx.addIssue({ code: 'custom', path: ['requiredNodeIds'], message: 'Required node IDs must be unique' });
  }
  level.requiredNodeIds.forEach((id, index) => {
    if (!nodeIdSet.has(id)) {
      ctx.addIssue({ code: 'custom', path: ['requiredNodeIds', index], message: 'Required node does not exist' });
    }
  });
  level.forbiddenNodeIds.forEach((id, index) => {
    if (!nodeIdSet.has(id)) {
      ctx.addIssue({ code: 'custom', path: ['forbiddenNodeIds', index], message: 'Forbidden node does not exist' });
    }
    if (requiredSet.has(id)) {
      ctx.addIssue({ code: 'custom', path: ['forbiddenNodeIds', index], message: 'A node cannot be required and forbidden' });
    }
  });
  if (new Set(level.forbiddenNodeIds).size !== level.forbiddenNodeIds.length) {
    ctx.addIssue({ code: 'custom', path: ['forbiddenNodeIds'], message: 'Forbidden node IDs must be unique' });
  }
  if (actors[0] && level.requiredNodeIds[0] !== actors[0].id) {
    ctx.addIssue({ code: 'custom', path: ['requiredNodeIds', 0], message: 'Required route must begin at the actor' });
  }
  if (goals[0] && level.requiredNodeIds[level.requiredNodeIds.length - 1] !== goals[0].id) {
    ctx.addIssue({ code: 'custom', path: ['requiredNodeIds'], message: 'Required route must end at the goal' });
  }
  for (const concept of ['水', '肉', '钥']) {
    if (!level.mandarinClue.includes(concept)) continue;
    const matchingNodes = level.nodes.filter(node => node.chineseChar === concept);
    if (matchingNodes.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['nodes'],
        message: `Clue-mentioned concept "${concept}" must have a node`,
      });
      continue;
    }
    const escapedConcept = concept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const isAvoided = new RegExp(`避开[^，。！？,.!?；;：:]{0,4}${escapedConcept}`).test(level.mandarinClue);
    const expectedIds = isAvoided ? forbiddenSet : requiredSet;
    if (!matchingNodes.some(node => expectedIds.has(node.id))) {
      ctx.addIssue({
        code: 'custom',
        path: [isAvoided ? 'forbiddenNodeIds' : 'requiredNodeIds'],
        message: `Clue-mentioned concept "${concept}" must be ${isAvoided ? 'forbidden' : 'required'}`,
      });
    }
  }
  level.nodes.forEach((node, index) => {
    const clueRequiredType =
      node.type === 'checkpoint' ||
      node.type === 'key' ||
      node.type === 'switch';
    if (
      clueRequiredType &&
      level.mandarinClue.includes(node.chineseChar) &&
      !requiredSet.has(node.id)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['nodes', index],
        message: 'A clue-mentioned checkpoint, key, or switch must be required',
      });
    }
  });

  const keyIds = new Set(level.nodes.filter(node => node.type === 'key').map(node => node.id));
  level.lockedDoors?.forEach((door, index) => {
    if (!keyIds.has(door.keyNodeId)) {
      ctx.addIssue({ code: 'custom', path: ['lockedDoors', index, 'keyNodeId'], message: 'Door key must reference a key node' });
    }
  });
  const switchNodeIds = new Set(level.nodes.filter(node => node.type === 'switch').map(node => node.id));
  const wallIds = new Set((level.walls || []).map(wall => wall.id));
  const barrierIds = [
    ...(level.walls || []).map(wall => wall.id),
    ...(level.lockedDoors || []).map(door => door.id),
    ...(level.oneWayGates || []).map(gate => gate.id),
  ];
  if (new Set(barrierIds).size !== barrierIds.length) {
    ctx.addIssue({ code: 'custom', path: ['walls'], message: 'Barrier IDs must be unique' });
  }
  level.switches?.forEach((trigger, index) => {
    if (!switchNodeIds.has(trigger.nodeId)) {
      ctx.addIssue({ code: 'custom', path: ['switches', index, 'nodeId'], message: 'Switch must reference a switch node' });
    }
    if (!wallIds.has(trigger.targetWallId)) {
      ctx.addIssue({ code: 'custom', path: ['switches', index, 'targetWallId'], message: 'Switch target wall does not exist' });
    }
  });
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
