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

const ALLOWED_CLUE_HANZI = new Set(Array.from(
  "小狗猫兔鸟回家先喝水再吃肉草避开走安全路后用钥匙门向左右下上通过和捷径省能机关火去拿踩"
));
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
    level.forbiddenNodeIds.length < 1
  ) {
    return false;
  }

  for (const char of Array.from(level.mandarinClue)) {
    if (/[\u4e00-\u9fff]/u.test(char) && !ALLOWED_CLUE_HANZI.has(char)) return false;
  }

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
  for (const concept of ["水", "肉", "钥"]) {
    if (!(level.mandarinClue as string).includes(concept)) continue;
    const matchingNodes = nodeRecords.filter(node => node.chineseChar === concept);
    if (matchingNodes.length === 0) return false;
    const isAvoided = new RegExp(`避开[^，。！？,.!?；;：:]{0,4}${concept}`).test(level.mandarinClue as string);
    const expectedIds = isAvoided ? forbiddenIds : requiredIds;
    if (!matchingNodes.some(node => expectedIds.includes(node.id))) return false;
  }
  if (nodeRecords.some(node => {
    const clueRequiredType =
      node.type === "checkpoint" ||
      node.type === "key" ||
      node.type === "switch";
    return clueRequiredType &&
      typeof node.chineseChar === "string" &&
      (level.mandarinClue as string).includes(node.chineseChar) &&
      !requiredIds.includes(node.id);
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
