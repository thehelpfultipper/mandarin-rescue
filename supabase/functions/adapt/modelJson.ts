/** Parse a JSON object even when a model appends prose after the closing brace. */
export function parseModelJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (initialError) {
    const start = text.indexOf("{");
    if (start < 0) throw initialError;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < text.length; index++) {
      const char = text[index];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === "\"") {
          inString = false;
        }
        continue;
      }
      if (char === "\"") {
        inString = true;
      } else if (char === "{") {
        depth++;
      } else if (char === "}") {
        depth--;
        if (depth === 0) return JSON.parse(text.slice(start, index + 1));
      }
    }
    throw initialError;
  }
}

/**
 * Sent to Gemini as responseJsonSchema. JSON mode alone asks for JSON but does
 * not guarantee that a complex response is syntactically complete.
 */
export const MODEL_RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    levelPlan: {
      type: "object",
      additionalProperties: false,
      properties: {
        learningGoal: { type: "string" },
        grammarTarget: { type: "string" },
        scaffolding: {
          type: "array",
          minItems: 1,
          maxItems: 6,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              char: { type: "string" },
              pinyin: { type: "string" },
              english: { type: "string" },
              emoji: { type: "string" },
              stage: { type: "string", enum: ["new", "familiar", "strong", "later"] },
            },
            required: ["char", "pinyin", "english", "emoji", "stage"],
          },
        },
        puzzleTemplate: {
          type: "string",
          enum: ["required-checkpoints", "key-door", "switch-wall", "hazard-avoidance", "one-way-gate"],
        },
        constraints: {
          type: "array",
          minItems: 1,
          maxItems: 4,
          items: { type: "string" },
        },
        plausibleRouteCount: { type: "integer", minimum: 1, maximum: 3 },
        puzzleDifficulty: { type: "string", enum: ["easy", "medium", "hard"] },
        whyMandarinMatters: { type: "string" },
      },
      required: [
        "learningGoal",
        "grammarTarget",
        "scaffolding",
        "puzzleTemplate",
        "constraints",
        "plausibleRouteCount",
        "puzzleDifficulty",
        "whyMandarinMatters",
      ],
    },
    suggestedLevel: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        mandarinClue: { type: "string" },
        pinyinClue: { type: "string" },
        englishTranslation: { type: "string" },
        hint: { type: "string" },
        isAudioRequired: { type: "boolean" },
        nodes: {
          type: "array",
          minItems: 3,
          maxItems: 6,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string" },
              type: {
                type: "string",
                enum: ["actor", "item", "obstacle", "goal", "checkpoint", "hazard", "key", "switch"],
              },
              label: { type: "string" },
              chineseChar: { type: "string" },
              x: { type: "integer", minimum: 15, maximum: 85 },
              y: { type: "integer", minimum: 15, maximum: 85 },
            },
            required: ["id", "type", "label", "chineseChar", "x", "y"],
          },
        },
        requiredNodeIds: {
          type: "array",
          minItems: 2,
          maxItems: 5,
          items: { type: "string" },
        },
        forbiddenNodeIds: {
          type: "array",
          minItems: 1,
          maxItems: 4,
          items: { type: "string" },
        },
        walls: {
          type: "array",
          maxItems: 6,
          items: { $ref: "#/$defs/barrier" },
        },
        lockedDoors: {
          type: "array",
          maxItems: 2,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string" },
              x1: { type: "integer", minimum: 0, maximum: 100 },
              y1: { type: "integer", minimum: 0, maximum: 100 },
              x2: { type: "integer", minimum: 0, maximum: 100 },
              y2: { type: "integer", minimum: 0, maximum: 100 },
              keyNodeId: { type: "string" },
            },
            required: ["id", "x1", "y1", "x2", "y2", "keyNodeId"],
          },
        },
        oneWayGates: {
          type: "array",
          maxItems: 2,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string" },
              x1: { type: "integer", minimum: 0, maximum: 100 },
              y1: { type: "integer", minimum: 0, maximum: 100 },
              x2: { type: "integer", minimum: 0, maximum: 100 },
              y2: { type: "integer", minimum: 0, maximum: 100 },
              allowDirection: { type: "string", enum: ["up", "down", "left", "right"] },
            },
            required: ["id", "x1", "y1", "x2", "y2", "allowDirection"],
          },
        },
        switches: {
          type: "array",
          maxItems: 2,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string" },
              nodeId: { type: "string" },
              targetWallId: { type: "string" },
            },
            required: ["id", "nodeId", "targetWallId"],
          },
        },
        routeLengthLimit: { type: "integer", minimum: 1 },
        vocabularyScaffold: {
          type: "array",
          minItems: 1,
          maxItems: 6,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              char: { type: "string" },
              pinyin: { type: "string" },
              english: { type: "string" },
              emoji: { type: "string" },
              stage: { type: "string", enum: ["new", "familiar", "strong", "later"] },
            },
            required: ["char", "pinyin", "english", "emoji", "stage"],
          },
        },
        missionFraming: { type: "string" },
      },
      required: [
        "id",
        "title",
        "mandarinClue",
        "pinyinClue",
        "englishTranslation",
        "hint",
        "isAudioRequired",
        "nodes",
        "requiredNodeIds",
        "forbiddenNodeIds",
        "walls",
        "lockedDoors",
        "oneWayGates",
        "switches",
        "routeLengthLimit",
        "vocabularyScaffold",
        "missionFraming",
      ],
    },
    rationale: { type: "string" },
  },
  required: ["levelPlan", "suggestedLevel", "rationale"],
  $defs: {
    barrier: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: { type: "string" },
        x1: { type: "integer", minimum: 0, maximum: 100 },
        y1: { type: "integer", minimum: 0, maximum: 100 },
        x2: { type: "integer", minimum: 0, maximum: 100 },
        y2: { type: "integer", minimum: 0, maximum: 100 },
      },
      required: ["id", "x1", "y1", "x2", "y2"],
    },
  },
} as const;

export const REVIEWED_EDGE_MISSIONS = {
  "小狗回家": {
    adaptiveEligible: true,
    pinyin: "xiǎogǒu huíjiā",
    english: "The puppy goes home",
    requiredConcepts: ["家"],
    forbiddenConcepts: [],
  },
  "小狗避开火，回家": {
    adaptiveEligible: true,
    pinyin: "xiǎogǒu bìkāi huǒ, huíjiā",
    english: "The puppy avoids the fire and goes home",
    requiredConcepts: ["家"],
    forbiddenConcepts: ["火"],
  },
  "先喝水，再回家": {
    adaptiveEligible: true,
    pinyin: "xiān hē shuǐ, zài huíjiā",
    english: "Drink water first, then go home",
    requiredConcepts: ["水", "家"],
    forbiddenConcepts: [],
  },
  "先吃肉，再回家": {
    adaptiveEligible: true,
    pinyin: "xiān chī ròu, zài huíjiā",
    english: "Eat meat first, then go home",
    requiredConcepts: ["肉", "家"],
    forbiddenConcepts: [],
  },
  "避开火，走安全路回家": {
    adaptiveEligible: true,
    pinyin: "bìkāi huǒ, zǒu ānquán lù huíjiā",
    english: "Avoid the fire and take the safe path home",
    requiredConcepts: ["路", "家"],
    forbiddenConcepts: ["火"],
  },
  "先喝水，再吃肉，再回家": {
    adaptiveEligible: true,
    pinyin: "xiān hē shuǐ, zài chī ròu, zài huíjiā",
    english: "Drink water first, then eat meat, then go home",
    requiredConcepts: ["水", "肉", "家"],
    forbiddenConcepts: [],
  },
  "用钥匙开门，避开火，再回家": {
    adaptiveEligible: true,
    pinyin: "yòng yàoshi kāi mén, bìkāi huǒ, zài huíjiā",
    english: "Use the key to open the door, avoid the fire, then go home",
    requiredConcepts: ["钥匙", "家"],
    forbiddenConcepts: ["火"],
  },
  "向左走，先喝水，再回家": {
    adaptiveEligible: false,
    pinyin: "xiàng zuǒ zǒu, xiān hē shuǐ, zài huíjiā",
    english: "Go left, drink water first, then go home",
    requiredConcepts: ["左", "水", "家"],
    forbiddenConcepts: [],
  },
  "向下走，通过安全门回家": {
    adaptiveEligible: false,
    pinyin: "xiàng xià zǒu, tōngguò ānquánmén huíjiā",
    english: "Go down and return home through the safety gate",
    requiredConcepts: ["下", "家"],
    forbiddenConcepts: [],
  },
  "先拿水和肉，再避开火，回家": {
    adaptiveEligible: true,
    pinyin: "xiān ná shuǐ hé ròu, zài bìkāi huǒ, huíjiā",
    english: "Get the water and meat first, then avoid the fire and go home",
    requiredConcepts: ["水", "肉", "家"],
    forbiddenConcepts: ["火"],
  },
  "踩开关，走捷径回家": {
    adaptiveEligible: true,
    pinyin: "cǎi kāiguān, zǒu jiéjìng huíjiā",
    english: "Step on the switch, then take the shortcut home",
    requiredConcepts: ["开关", "家"],
    forbiddenConcepts: [],
  },
  "先拿钥匙，再开门；避开火，踩开关后回家": {
    adaptiveEligible: true,
    pinyin: "xiān ná yàoshi, zài kāi mén; bìkāi huǒ, cǎi kāiguān hòu huíjiā",
    english: "Get the key first, then open the door; avoid the fire, step on the switch, and go home",
    requiredConcepts: ["钥匙", "开关", "家"],
    forbiddenConcepts: ["火"],
  },
} as const;
export const REVIEWED_EDGE_NODE_VOCABULARY: Record<string, { pinyin: string; english: string }> = {
  "狗": { pinyin: "gǒu", english: "Dog" },
  "家": { pinyin: "jiā", english: "Home" },
  "草": { pinyin: "cǎo", english: "Grass" },
  "火": { pinyin: "huǒ", english: "Fire" },
  "水": { pinyin: "shuǐ", english: "Water" },
  "肉": { pinyin: "ròu", english: "Meat" },
  "路": { pinyin: "lù", english: "Road / path" },
  "钥匙": { pinyin: "yàoshi", english: "Key" },
  "开关": { pinyin: "kāiguān", english: "Switch" },
  "左": { pinyin: "zuǒ", english: "Left" },
  "右": { pinyin: "yòu", english: "Right" },
  "下": { pinyin: "xià", english: "Down" },
  "上": { pinyin: "shàng", english: "Up" },
};
const NODE_TYPES = new Set(["actor", "item", "obstacle", "goal", "checkpoint", "hazard", "key", "switch"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPercent(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

function validBarrier(value: unknown): boolean {
  return isRecord(value) &&
    typeof value.id === "string" &&
    isPercent(value.x1) &&
    isPercent(value.y1) &&
    isPercent(value.x2) &&
    isPercent(value.y2);
}

/** Lightweight edge contract; the client runs the full Zod contract again. */
export function isValidLevelResponse(data: unknown): boolean {
  if (!isRecord(data) || !isRecord(data.suggestedLevel)) return false;
  const level = data.suggestedLevel;
  if (
    typeof level.id !== "string" ||
    typeof level.title !== "string" ||
    typeof level.mandarinClue !== "string" ||
    typeof level.pinyinClue !== "string" ||
    typeof level.englishTranslation !== "string" ||
    typeof level.hint !== "string" ||
    !Array.isArray(level.nodes) ||
    level.nodes.length < 3 ||
    !Array.isArray(level.requiredNodeIds) ||
    level.requiredNodeIds.length < 2 ||
    !Array.isArray(level.forbiddenNodeIds) ||
    level.forbiddenNodeIds.length < 1 ||
    !Array.isArray(level.vocabularyScaffold)
  ) {
    return false;
  }

  const mission = REVIEWED_EDGE_MISSIONS[
    level.mandarinClue as keyof typeof REVIEWED_EDGE_MISSIONS
  ];
  if (
    !mission ||
    !mission.adaptiveEligible ||
    level.pinyinClue !== mission.pinyin ||
    level.englishTranslation !== mission.english
  ) return false;

  const nodes = level.nodes;
  if (!nodes.every(node =>
    isRecord(node) &&
    typeof node.id === "string" &&
    typeof node.type === "string" &&
    NODE_TYPES.has(node.type) &&
    typeof node.label === "string" &&
    typeof node.chineseChar === "string" &&
    isPercent(node.x) &&
    isPercent(node.y)
  )) return false;

  const nodeRecords = nodes as Record<string, unknown>[];
  const nodeIds = nodeRecords.map(node => node.id as string);
  const nodeIdSet = new Set(nodeIds);
  if (nodeIdSet.size !== nodeIds.length) return false;
  const actors = nodeRecords.filter(node => node.type === "actor");
  const goals = nodeRecords.filter(node => node.type === "goal");
  if (actors.length !== 1 || goals.length !== 1) return false;

  const requiredIds = level.requiredNodeIds;
  const forbiddenIds = level.forbiddenNodeIds;
  if (
    !requiredIds.every(id => typeof id === "string" && nodeIdSet.has(id)) ||
    new Set(requiredIds).size !== requiredIds.length ||
    requiredIds[0] !== actors[0].id ||
    requiredIds[requiredIds.length - 1] !== goals[0].id ||
    !forbiddenIds.every(id => typeof id === "string" && nodeIdSet.has(id) && !requiredIds.includes(id)) ||
    new Set(forbiddenIds).size !== forbiddenIds.length
  ) return false;
  for (const concept of mission.requiredConcepts) {
    if (!nodeRecords.some(node => node.chineseChar === concept && requiredIds.includes(node.id))) {
      return false;
    }
  }
  for (const concept of mission.forbiddenConcepts) {
    if (!nodeRecords.some(node => node.chineseChar === concept && forbiddenIds.includes(node.id))) {
      return false;
    }
  }
  const enforcedIntermediateTypes = new Set(["checkpoint", "key", "switch"]);
  if (requiredIds.slice(1, -1).some(id => {
    const node = nodeRecords.find(candidate => candidate.id === id);
    return !node ||
      !enforcedIntermediateTypes.has(node.type as string) ||
      !(mission.requiredConcepts as readonly string[]).includes(node.chineseChar as string);
  })) return false;
  if (!level.vocabularyScaffold.every(item => {
    if (!isRecord(item) || typeof item.char !== "string") return false;
    const reviewed = REVIEWED_EDGE_NODE_VOCABULARY[item.char];
    return reviewed &&
      item.pinyin === reviewed.pinyin &&
      item.english === reviewed.english &&
      nodeRecords.some(node => node.chineseChar === item.char);
  })) return false;

  const walls = Array.isArray(level.walls) ? level.walls : [];
  const doors = Array.isArray(level.lockedDoors) ? level.lockedDoors : [];
  const gates = Array.isArray(level.oneWayGates) ? level.oneWayGates : [];
  if (!walls.every(validBarrier) || !doors.every(validBarrier) || !gates.every(validBarrier)) return false;
  const barrierIds = [...walls, ...doors, ...gates]
    .filter(isRecord)
    .map(barrier => barrier.id);
  if (new Set(barrierIds).size !== barrierIds.length) return false;

  const keyIds = new Set(nodeRecords.filter(node => node.type === "key").map(node => node.id));
  if (!doors.every(door => isRecord(door) && typeof door.keyNodeId === "string" && keyIds.has(door.keyNodeId))) {
    return false;
  }
  const switchNodeIds = new Set(nodeRecords.filter(node => node.type === "switch").map(node => node.id));
  const wallIds = new Set(walls.filter(isRecord).map(wall => wall.id));
  const switches = Array.isArray(level.switches) ? level.switches : [];
  if (!switches.every(trigger =>
    isRecord(trigger) &&
    typeof trigger.id === "string" &&
    typeof trigger.nodeId === "string" &&
    switchNodeIds.has(trigger.nodeId) &&
    typeof trigger.targetWallId === "string" &&
    wallIds.has(trigger.targetWallId)
  )) return false;

  return level.routeLengthLimit == null ||
    (typeof level.routeLengthLimit === "number" && Number.isFinite(level.routeLengthLimit) && level.routeLengthLimit > 0);
}
