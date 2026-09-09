import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { z } from 'zod';
import {
  GeminiAdaptationResponseSchema,
  REVIEWED_MANDARIN_MISSIONS,
  REVIEWED_NODE_VOCABULARY,
} from './src/types.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Lazy-initialized Gemini Client to prevent server crash if API key is missing during boot
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is missing. Set it in .env');
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
    });
  }
  return aiClient;
}

// Canonical Vocabulary sets and punctuation for validation checks
const PUNCTUATION_AND_SYMBOLS = new Set([
  '，', '。', '！', '？', '、', '；', '：', ' ', '\t', '\n',
  ',', '.', '!', '?', ';', ':', '“', '”', '‘', '’', '"', "'", '—', '-', '…', '·', '《', '》', '（', '）', '(', ')'
]);

const APPROVED_VOCAB_CHARS = new Set([
  '小', '狗', '猫', '兔', '鸟', '回', '家', '先', '喝', '水', '再', '吃', '肉', '草', '避', '开', '避开', '走', '安', '全', '路', '后', '用', '钥', '匙', '钥匙', '门', '向', '左', '是', '源', '水源', '右', '边', '右边', '下', '上', '通', '过', '通过', '和', '捷', '径', '捷径', '省', '能', '能源', '机', '关', '机关', '火', '去', '拿', '踩', '犬', '虫', '鱼',
  '，', '。', '！', '？', '、', '；', '：', ' ', ',', '.', '!', '?', ';', ':'
]);

const APPROVED_NODE_CHARS = new Set([
  '狗', '家', '水', '火', '肉', '草', '钥匙', '开关', '左', '右', '上', '下', '路', '门'
]);

// -------------------------------------------------------------
// Mathematical Geometry Helpers (Mirrors GameCanvas engine)
// -------------------------------------------------------------
function getLineIntersection(
  p0_x: number, p0_y: number,
  p1_x: number, p1_y: number,
  p2_x: number, p2_y: number,
  p3_x: number, p3_y: number
): { x: number; y: number } | null {
  const s1_x = p1_x - p0_x;
  const s1_y = p1_y - p0_y;
  const s2_x = p3_x - p2_x;
  const s2_y = p3_y - p2_y;

  const denom = -s2_x * s1_y + s1_x * s2_y;
  if (Math.abs(denom) < 0.00001) return null;

  const s = (-s1_y * (p0_x - p2_x) + s1_x * (p0_y - p2_y)) / denom;
  const t = (s2_x * (p0_y - p2_y) - s2_y * (p0_x - p2_x)) / denom;

  if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
    return {
      x: p0_x + t * s1_x,
      y: p0_y + t * s1_y
    };
  }
  return null;
}

function pointToSegmentDistance(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    return Math.hypot(px - x1, py - y1);
  }
  let t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  const nearestX = x1 + t * dx;
  const nearestY = y1 + t * dy;
  return Math.hypot(px - nearestX, py - nearestY);
}

function solveLevelBFS(
  level: any,
  start: { x: number; y: number },
  end: { x: number; y: number },
  collectedKeys: string[],
  activatedSwitches: string[],
  forbiddenNodeIds: string[]
): { path: { x: number; y: number }[]; length: number } | null {
  const GRID_SIZE = 50;
  const cellSize = 100 / GRID_SIZE;

  const startGx = Math.floor(start.x / cellSize);
  const startGy = Math.floor(start.y / cellSize);
  const endGx = Math.floor(end.x / cellSize);
  const endGy = Math.floor(end.y / cellSize);

  const queue: { gx: number; gy: number; path: { x: number; y: number }[]; length: number }[] = [];
  queue.push({
    gx: startGx,
    gy: startGy,
    path: [{ x: start.x, y: start.y }],
    length: 0
  });

  const visited = new Set<string>();
  visited.add(`${startGx},${startGy}`);

  const walls = level.walls || [];
  const lockedDoors = level.lockedDoors || [];
  const oneWayGates = level.oneWayGates || [];
  const inactiveWalls = level.switches
    ?.filter((sw: any) => activatedSwitches.includes(sw.nodeId))
    .map((sw: any) => sw.targetWallId) || [];

  while (queue.length > 0) {
    const current = queue.shift()!;

    const lastPt = current.path[current.path.length - 1];
    const distToEnd = Math.hypot(lastPt.x - end.x, lastPt.y - end.y);
    if (distToEnd <= 10) {
      return {
        path: [...current.path, end],
        length: current.length + distToEnd
      };
    }

    const x = current.gx * cellSize + cellSize / 2;
    const y = current.gy * cellSize + cellSize / 2;

    const dirs = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 }
    ];

    for (const dir of dirs) {
      const ngx = current.gx + dir.dx;
      const ngy = current.gy + dir.dy;

      if (ngx < 0 || ngx >= GRID_SIZE || ngy < 0 || ngy >= GRID_SIZE) continue;

      const key = `${ngx},${ngy}`;
      if (visited.has(key)) continue;

      const nx = ngx * cellSize + cellSize / 2;
      const ny = ngy * cellSize + cellSize / 2;

      let segmentValid = true;

      // 1. Static Wall collisions
      for (const wall of walls) {
        if (inactiveWalls.includes(wall.id)) continue;
        const intersect = getLineIntersection(x, y, nx, ny, wall.x1, wall.y1, wall.x2, wall.y2);
        if (intersect) {
          segmentValid = false;
          break;
        }
      }
      if (!segmentValid) continue;

      // 2. Locked Door collisions
      for (const door of lockedDoors) {
        const isUnlocked = collectedKeys.includes(door.keyNodeId);
        if (!isUnlocked) {
          const intersect = getLineIntersection(x, y, nx, ny, door.x1, door.y1, door.x2, door.y2);
          if (intersect) {
            segmentValid = false;
            break;
          }
        }
      }
      if (!segmentValid) continue;

      // 3. One-Way Gate direction checks
      for (const gate of oneWayGates) {
        const intersect = getLineIntersection(x, y, nx, ny, gate.x1, gate.y1, gate.x2, gate.y2);
        if (intersect) {
          let illegal = false;
          const dx = nx - x;
          const dy = ny - y;
          if (gate.allowDirection === 'up' && dy > 0) illegal = true;
          if (gate.allowDirection === 'down' && dy < 0) illegal = true;
          if (gate.allowDirection === 'left' && dx > 0) illegal = true;
          if (gate.allowDirection === 'right' && dx < 0) illegal = true;
          if (illegal) {
            segmentValid = false;
            break;
          }
        }
      }
      if (!segmentValid) continue;

      // 4. Contact with Hazards or Forbidden nodes
      for (const node of level.nodes) {
        if (node.type === 'hazard' || forbiddenNodeIds.includes(node.id)) {
          const dist = pointToSegmentDistance(node.x, node.y, x, y, nx, ny);
          if (dist <= 6.5) {
            segmentValid = false;
            break;
          }
        }
      }
      if (!segmentValid) continue;

      visited.add(key);
      const stepLen = Math.hypot(nx - x, ny - y);
      queue.push({
        gx: ngx,
        gy: ngy,
        path: [...current.path, { x: nx, y: ny }],
        length: current.length + stepLen
      });
    }
  }

  return null;
}

function verifyLevelSolvableServer(level: any): { solvable: boolean; reason?: string } {
  const actorNode = level.nodes.find((n: any) => n.type === 'actor');
  const goalNode = level.nodes.find((n: any) => n.type === 'goal');
  if (!actorNode || !goalNode) return { solvable: false, reason: 'Missing actor or goal node' };

  const sequence = level.requiredNodeIds;
  let currentPos = { x: actorNode.x, y: actorNode.y };

  const collectedKeys: string[] = [];
  const activatedSwitches: string[] = [];
  let totalLength = 0;

  for (let i = 1; i < sequence.length; i++) {
    const targetNodeId = sequence[i];
    const targetNode = level.nodes.find((n: any) => n.id === targetNodeId);
    if (!targetNode) return { solvable: false, reason: `Required node "${targetNodeId}" not found` };

    const res = solveLevelBFS(
      level,
      currentPos,
      { x: targetNode.x, y: targetNode.y },
      collectedKeys,
      activatedSwitches,
      level.forbiddenNodeIds
    );

    if (!res) {
      return { solvable: false, reason: `Cannot reach required node "${targetNode.chineseChar}" (${targetNode.label}) from step ${i-1} to ${i}` };
    }

    totalLength += res.length;
    currentPos = { x: targetNode.x, y: targetNode.y };

    if (targetNode.type === 'key') {
      collectedKeys.push(targetNode.id);
    }
    if (targetNode.type === 'switch') {
      activatedSwitches.push(targetNode.id);
    }
  }

  const limit = level.routeLengthLimit || 400;
  if (totalLength > limit) {
    return { solvable: false, reason: `Path length (${Math.round(totalLength)}) exceeds limit (${limit})` };
  }

  return { solvable: true };
}

function isStraightLineValidServer(level: any): boolean {
  const actorNode = level.nodes.find((n: any) => n.type === 'actor');
  const goalNode = level.nodes.find((n: any) => n.type === 'goal');
  if (!actorNode || !goalNode) return false;

  const x1 = actorNode.x;
  const y1 = actorNode.y;
  const x2 = goalNode.x;
  const y2 = goalNode.y;

  // 1. Check walls
  for (const wall of (level.walls || [])) {
    if (getLineIntersection(x1, y1, x2, y2, wall.x1, wall.y1, wall.x2, wall.y2)) {
      return false;
    }
  }

  // 2. Check locked doors
  for (const door of (level.lockedDoors || [])) {
    if (getLineIntersection(x1, y1, x2, y2, door.x1, door.y1, door.x2, door.y2)) {
      return false;
    }
  }

  // 3. Check gates
  for (const gate of (level.oneWayGates || [])) {
    const intersect = getLineIntersection(x1, y1, x2, y2, gate.x1, gate.y1, gate.x2, gate.y2);
    if (intersect) {
      let illegal = false;
      const dx = x2 - x1;
      const dy = y2 - y1;
      if (gate.allowDirection === 'up' && dy > 0) illegal = true;
      if (gate.allowDirection === 'down' && dy < 0) illegal = true;
      if (gate.allowDirection === 'left' && dx > 0) illegal = true;
      if (gate.allowDirection === 'right' && dx < 0) illegal = true;
      if (illegal) return false;
    }
  }

  // 4. Check hazards & forbidden nodes
  for (const node of level.nodes) {
    if (node.type === 'hazard' || level.forbiddenNodeIds.includes(node.id)) {
      if (pointToSegmentDistance(node.x, node.y, x1, y1, x2, y2) <= 6.5) {
        return false;
      }
    }
  }

  // 5. Check route length limit
  const dist = Math.hypot(x2 - x1, y2 - y1);
  if (dist > (level.routeLengthLimit || 400)) {
    return false;
  }

  return true;
}

// -------------------------------------------------------------
// Robust Sanitizer and Normalizer for Gemini AI Output
// -------------------------------------------------------------
function sanitizeGeminiOutput(data: any): any {
  if (!data || typeof data !== 'object') return data;

  // Clone deeply to avoid modifying cached instances
  const clean = JSON.parse(JSON.stringify(data));

  if (!clean.levelPlan) clean.levelPlan = {};
  if (!clean.suggestedLevel) clean.suggestedLevel = {};

  const plan = clean.levelPlan;
  const lvl = clean.suggestedLevel;

  // 1. Sanitize levelPlan enums
  if (typeof plan.puzzleDifficulty !== 'string' || !['easy', 'medium', 'hard'].includes(plan.puzzleDifficulty)) {
    plan.puzzleDifficulty = 'medium';
  }

  const validStages = ['new', 'familiar', 'strong', 'later'];
  
  const sanitizeScaffold = (arr: any) => {
    if (!Array.isArray(arr)) return [];
    return arr.map((item: any) => {
      if (!item || typeof item !== 'object') return item;
      const cleanItem = { ...item };
      if (typeof cleanItem.char !== 'string') cleanItem.char = '水';
      if (typeof cleanItem.pinyin !== 'string') cleanItem.pinyin = 'shuǐ';
      if (typeof cleanItem.english !== 'string') cleanItem.english = 'water';
      if (typeof cleanItem.emoji !== 'string') cleanItem.emoji = '💧';
      if (typeof cleanItem.stage !== 'string' || !validStages.includes(cleanItem.stage)) {
        cleanItem.stage = 'new';
      }
      return cleanItem;
    });
  };

  plan.scaffolding = sanitizeScaffold(plan.scaffolding);
  lvl.vocabularyScaffold = sanitizeScaffold(lvl.vocabularyScaffold);

  if (!plan.learningGoal) plan.learningGoal = "Strengthen language patterns through route-drawing challenges.";
  if (!plan.grammarTarget) plan.grammarTarget = "Retrieval";
  if (!plan.puzzleTemplate) plan.puzzleTemplate = "hazard-avoidance";
  if (!Array.isArray(plan.constraints)) plan.constraints = [];
  if (typeof plan.plausibleRouteCount !== 'number') plan.plausibleRouteCount = 1;
  if (!plan.whyMandarinMatters) plan.whyMandarinMatters = "Reinforcing critical vocabulary links.";

  // 2. Sanitize suggestedLevel fields
  if (!lvl.id) lvl.id = 'lvl_gemini_' + Date.now();
  if (!lvl.title) lvl.title = 'Adaptive Mission';
  if (!lvl.mandarinClue) lvl.mandarinClue = '小狗回家';
  if (!lvl.pinyinClue) lvl.pinyinClue = 'xiǎogǒu huíjiā';
  if (!lvl.englishTranslation) lvl.englishTranslation = 'The puppy goes home';
  if (!lvl.hint) lvl.hint = 'Draw a line connecting the Chinese characters.';

  // Never rewrite one member of the Mandarin/pinyin/English triple.
  // Unreviewed language is rejected atomically by LevelSchema below.

  // Keep scaffolding inside the same closed set (single-char entries only).
  const keepApprovedScaffold = (arr: any[]) =>
    arr.filter(
      (item: any) =>
        item &&
        typeof item.char === 'string' &&
        (item.char.length > 1
          ? [...item.char].every((c: string) => APPROVED_VOCAB_CHARS.has(c) || PUNCTUATION_AND_SYMBOLS.has(c))
          : APPROVED_VOCAB_CHARS.has(item.char) || PUNCTUATION_AND_SYMBOLS.has(item.char))
    );
  plan.scaffolding = keepApprovedScaffold(plan.scaffolding);
  lvl.vocabularyScaffold = keepApprovedScaffold(lvl.vocabularyScaffold);

  // 3. Sanitize nodes and their types
  if (Array.isArray(lvl.nodes)) {
    lvl.nodes = lvl.nodes.map((node: any) => {
      if (!node || typeof node !== 'object') return node;
      const cleanNode = { ...node };
      
      // Normalize type
      let type = String(cleanNode.type || 'item').toLowerCase();
      if (type.includes('actor') || type.includes('player') || type.includes('character') || type.includes('dog') || type.includes('cat')) {
        cleanNode.type = 'actor';
      } else if (type.includes('goal') || type.includes('home') || type.includes('destination')) {
        cleanNode.type = 'goal';
      } else if (type.includes('hazard') || type.includes('fire') || type.includes('trap') || type.includes('spider')) {
        cleanNode.type = 'hazard';
      } else if (type.includes('key')) {
        cleanNode.type = 'key';
      } else if (type.includes('switch') || type.includes('trigger')) {
        cleanNode.type = 'switch';
      } else if (type.includes('checkpoint')) {
        cleanNode.type = 'checkpoint';
      } else if (type.includes('obstacle') || type.includes('wall')) {
        cleanNode.type = 'obstacle';
      } else {
        cleanNode.type = 'item';
      }

      if (typeof cleanNode.id !== 'string') cleanNode.id = 'n_' + Math.random().toString(36).substr(2, 5);
      if (typeof cleanNode.label !== 'string') cleanNode.label = 'Node';
      if (typeof cleanNode.chineseChar !== 'string') cleanNode.chineseChar = '水';
      if (typeof cleanNode.x !== 'number') cleanNode.x = 50;
      if (typeof cleanNode.y !== 'number') cleanNode.y = 50;

      return cleanNode;
    });
  } else {
    lvl.nodes = [];
  }

  // 4. Required and forbidden node arrays
  if (!Array.isArray(lvl.requiredNodeIds)) {
    lvl.requiredNodeIds = lvl.nodes.filter((n: any) => n.type === 'actor' || n.type === 'goal').map((n: any) => n.id);
  }
  if (!Array.isArray(lvl.forbiddenNodeIds)) {
    lvl.forbiddenNodeIds = lvl.nodes.filter((n: any) => n.type === 'hazard').map((n: any) => n.id);
  }

  // Ensure silent play compliance (Mandarin Rescue Silent-First rule)
  lvl.isAudioRequired = false;

  // Ensure canonical actor and goal nodes exist
  let actorNode = lvl.nodes.find((n: any) => n.type === 'actor');
  if (!actorNode) {
    actorNode = { id: 'n_actor', type: 'actor', label: 'Dog', chineseChar: '狗', x: 20, y: 50 };
    lvl.nodes.unshift(actorNode);
  } else {
    actorNode.chineseChar = '狗';
  }

  let goalNode = lvl.nodes.find((n: any) => n.type === 'goal');
  if (!goalNode) {
    goalNode = { id: 'n_home', type: 'goal', label: 'Home', chineseChar: '家', x: 80, y: 50 };
    lvl.nodes.push(goalNode);
  } else {
    goalNode.chineseChar = '家';
  }

  // Ensure requiredNodeIds starts with actorNode and ends with goalNode
  const intermediateRequired = lvl.requiredNodeIds.filter((id: string) => id !== actorNode.id && id !== goalNode.id);
  lvl.requiredNodeIds = [actorNode.id, ...intermediateRequired, goalNode.id];

  // 5. Enforce optional sub-arrays
  if (!Array.isArray(lvl.walls)) lvl.walls = [];
  if (!Array.isArray(lvl.lockedDoors)) lvl.lockedDoors = [];
  if (!Array.isArray(lvl.oneWayGates)) {
    lvl.oneWayGates = [];
  } else {
    lvl.oneWayGates = lvl.oneWayGates.map((g: any) => {
      if (!g || typeof g !== 'object') return g;
      const cleanG = { ...g };
      const dir = String(cleanG.allowDirection || 'right').toLowerCase();
      if (dir.includes('up') || dir.includes('north')) cleanG.allowDirection = 'up';
      else if (dir.includes('down') || dir.includes('south')) cleanG.allowDirection = 'down';
      else if (dir.includes('left') || dir.includes('west')) cleanG.allowDirection = 'left';
      else cleanG.allowDirection = 'right';
      return cleanG;
    });
  }
  if (!Array.isArray(lvl.switches)) lvl.switches = [];

  // Align template-specific mechanics and vocabulary rules
  const template = plan.puzzleTemplate;
  if (template === 'key-door') {
    let keyNode = lvl.nodes.find((n: any) => n.type === 'key');
    if (!keyNode) {
      keyNode = { id: 'n_key', type: 'key', label: 'Key', chineseChar: '钥匙', x: 35, y: 80 };
      lvl.nodes.push(keyNode);
    }
    keyNode.chineseChar = '钥匙';
    if (!lvl.requiredNodeIds.includes(keyNode.id)) {
      lvl.requiredNodeIds.splice(1, 0, keyNode.id);
    }
    if (lvl.lockedDoors.length === 0) {
      lvl.lockedDoors.push({
        id: 'd_lock_main',
        x1: 50,
        y1: 20,
        x2: 50,
        y2: 80,
        keyNodeId: keyNode.id
      });
    } else {
      lvl.lockedDoors[0].keyNodeId = keyNode.id;
    }
  } else if (template === 'switch-wall') {
    let switchNode = lvl.nodes.find((n: any) => n.type === 'switch');
    if (!switchNode) {
      switchNode = { id: 'n_switch', type: 'switch', label: 'Switch', chineseChar: '开关', x: 35, y: 80 };
      lvl.nodes.push(switchNode);
    }
    switchNode.chineseChar = '开关';
    if (!lvl.requiredNodeIds.includes(switchNode.id)) {
      lvl.requiredNodeIds.splice(1, 0, switchNode.id);
    }
    if (lvl.switches.length === 0) {
      const swWallId = 'w_switchable_barrier';
      lvl.walls.push({ id: swWallId, x1: 50, y1: 25, x2: 50, y2: 75 });
      lvl.switches.push({ id: 'sw_1', nodeId: switchNode.id, targetWallId: swWallId });
    }
  } else if (template === 'hazard-avoidance') {
    let fireNode = lvl.nodes.find((n: any) => n.chineseChar === '火' || n.type === 'hazard');
    if (!fireNode) {
      fireNode = { id: 'n_hazard_fire', type: 'hazard', label: 'Fire', chineseChar: '火', x: 50, y: 50 };
      lvl.nodes.push(fireNode);
    }
    if (!lvl.forbiddenNodeIds.includes(fireNode.id)) {
      lvl.forbiddenNodeIds.push(fireNode.id);
    }
  }

  // Language-relevance synchronization
  if (lvl.mandarinClue.includes('水')) {
    let waterNode = lvl.nodes.find((n: any) => n.chineseChar === '水');
    if (!waterNode) {
      waterNode = { id: 'n_water_' + Date.now().toString(36), type: 'checkpoint', label: 'Water', chineseChar: '水', x: 50, y: 80 };
      lvl.nodes.push(waterNode);
    }
    if (!lvl.requiredNodeIds.includes(waterNode.id)) {
      lvl.requiredNodeIds.splice(1, 0, waterNode.id);
    }
  }
  if (lvl.mandarinClue.includes('肉')) {
    let meatNode = lvl.nodes.find((n: any) => n.chineseChar === '肉');
    if (!meatNode) {
      meatNode = { id: 'n_meat_' + Date.now().toString(36), type: 'checkpoint', label: 'Meat', chineseChar: '肉', x: 50, y: 80 };
      lvl.nodes.push(meatNode);
    }
    if (!lvl.requiredNodeIds.includes(meatNode.id)) {
      lvl.requiredNodeIds.splice(1, 0, meatNode.id);
    }
  }
  if (lvl.mandarinClue.includes('火')) {
    let fireNode = lvl.nodes.find((n: any) => n.chineseChar === '火');
    if (!fireNode) {
      fireNode = { id: 'n_fire_' + Date.now().toString(36), type: 'hazard', label: 'Fire', chineseChar: '火', x: 50, y: 50 };
      lvl.nodes.push(fireNode);
    }
    if (!lvl.forbiddenNodeIds.includes(fireNode.id)) {
      lvl.forbiddenNodeIds.push(fireNode.id);
    }
  }

  // Auto-prevent trivial straight line solutions across all non-trivial puzzle templates
  if (['key-door', 'switch-wall', 'required-checkpoints'].includes(template)) {
    if (isStraightLineValidServer(lvl)) {
      const ax = actorNode.x;
      const ay = actorNode.y;
      const gx = goalNode.x;
      const gy = goalNode.y;
      const mx = Math.round((ax + gx) / 2);
      const my = Math.round((ay + gy) / 2);
      const dx = gx - ax;
      const dy = gy - ay;
      const len = Math.hypot(dx, dy) || 1;
      const perpX = -dy / len;
      const perpY = dx / len;
      const halfLen = 14;

      const bx1 = Math.max(5, Math.min(95, Math.round(mx + perpX * halfLen)));
      const by1 = Math.max(5, Math.min(95, Math.round(my + perpY * halfLen)));
      const bx2 = Math.max(5, Math.min(95, Math.round(mx - perpX * halfLen)));
      const by2 = Math.max(5, Math.min(95, Math.round(my - perpY * halfLen)));

      if (template === 'key-door' && lvl.lockedDoors.length > 0) {
        lvl.lockedDoors[0].x1 = bx1;
        lvl.lockedDoors[0].y1 = by1;
        lvl.lockedDoors[0].x2 = bx2;
        lvl.lockedDoors[0].y2 = by2;
      } else if (template === 'switch-wall' && lvl.switches.length > 0) {
        const swTarget = lvl.switches[0].targetWallId;
        const targetW = lvl.walls.find((w: any) => w.id === swTarget);
        if (targetW) {
          targetW.x1 = bx1;
          targetW.y1 = by1;
          targetW.x2 = bx2;
          targetW.y2 = by2;
        } else {
          lvl.walls.push({ id: swTarget, x1: bx1, y1: by1, x2: bx2, y2: by2 });
        }
      } else {
        lvl.walls.push({ id: 'w_bypass_blocker_' + Math.random().toString(36).substr(2, 4), x1: bx1, y1: by1, x2: bx2, y2: by2 });
      }
    }
  }

  if (typeof clean.rationale !== 'string') clean.rationale = "Custom adjusted language training level.";

  return clean;
}

// -------------------------------------------------------------
// Core 6-Stage Validation Engine for Pedagogical Game Director
// -------------------------------------------------------------
function validateLevelPlan(data: any): boolean {
  // STAGE 1: Zod Schema Check
  const result = GeminiAdaptationResponseSchema.safeParse(data);
  if (!result.success) {
    console.warn('LevelPlan failed schema validation:', result.error.issues);
    return false;
  }

  const response = result.data;
  const suggestedLevel = response.suggestedLevel;
  const plan = response.levelPlan;
  const reviewedMission = REVIEWED_MANDARIN_MISSIONS[
    suggestedLevel.mandarinClue as keyof typeof REVIEWED_MANDARIN_MISSIONS
  ];
  if (!reviewedMission?.adaptiveEligible) {
    console.warn('LevelPlan selected a curated-only spatial mission');
    return false;
  }

  // STAGE 2: Vocabulary Check
  const clueChars = Array.from(suggestedLevel.mandarinClue);
  const scaffoldChars = new Set(plan.scaffolding.map((s: any) => s.char));
  
  for (const char of clueChars) {
    if (PUNCTUATION_AND_SYMBOLS.has(char) || /\s/.test(char)) {
      continue;
    }
    if (!APPROVED_VOCAB_CHARS.has(char) && !scaffoldChars.has(char)) {
      console.warn(`LevelPlan failed vocabulary check: Character "${char}" in clue is not approved or mapped.`);
      return false;
    }
  }

  for (const node of suggestedLevel.nodes) {
    if (!APPROVED_NODE_CHARS.has(node.chineseChar)) {
      console.warn(`LevelPlan failed vocabulary check: Node character "${node.chineseChar}" is not approved.`);
      return false;
    }
  }

  // STAGE 3: Grammar Rules Check
  const clue = suggestedLevel.mandarinClue;
  const template = plan.puzzleTemplate;

  if (template === 'key-door') {
    if (!clue.includes('钥') && !clue.includes('钥匙')) {
      console.warn('LevelPlan failed grammar rule for key-door template: Clue does not contain "key"');
      return false;
    }
    if (!clue.includes('门')) {
      console.warn('LevelPlan failed grammar rule for key-door template: Clue does not contain "door"');
      return false;
    }
  } else if (template === 'switch-wall') {
    if (!clue.includes('开') && !clue.includes('开关') && !clue.includes('机关')) {
      console.warn('LevelPlan failed grammar rule for switch-wall template: Clue does not contain "switch"');
      return false;
    }
  } else if (template === 'hazard-avoidance') {
    if (!clue.includes('避') && !clue.includes('避开') && !clue.includes('安全')) {
      console.warn('LevelPlan failed grammar rule for hazard-avoidance template: Clue does not contain avoid instructions');
      return false;
    }
  } else if (template === 'required-checkpoints') {
    if (!clue.includes('先') && !clue.includes('后') && !clue.includes('再')) {
      console.warn('LevelPlan failed grammar rule for required-checkpoints template: Clue does not contain sequential ordering');
      return false;
    }
  } else if (template === 'one-way-gate') {
    if (!clue.includes('向') && !clue.includes('左') && !clue.includes('右') && !clue.includes('上') && !clue.includes('下') && !clue.includes('通过')) {
      console.warn('LevelPlan failed grammar rule for one-way-gate template: Clue does not contain directions');
      return false;
    }
  }

  // STAGE 4: Puzzle Constraints Check
  const nodes = suggestedLevel.nodes;
  const actorNode = nodes.find((n: any) => n.type === 'actor');
  const goalNode = nodes.find((n: any) => n.type === 'goal');

  if (!actorNode) {
    console.warn('LevelPlan failed puzzle constraints: Missing actor node.');
    return false;
  }
  if (!goalNode) {
    console.warn('LevelPlan failed puzzle constraints: Missing goal node.');
    return false;
  }

  // Verify coordinates inside safe bounds
  for (const node of nodes) {
    if (node.x < 10 || node.x > 90 || node.y < 10 || node.y > 90) {
      console.warn(`LevelPlan failed puzzle constraints: Node ${node.id} coordinate (${node.x}, ${node.y}) is out of bounds.`);
      return false;
    }
  }

  // Coordinate density check (minimum distance 15% between any two nodes to prevent overlapping)
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dist = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
      if (dist < 15) {
        console.warn(`LevelPlan failed puzzle constraints: Nodes ${nodes[i].id} and ${nodes[j].id} are too close (${dist.toFixed(1)}%).`);
        return false;
      }
    }
  }

  // Validate required path elements
  if (suggestedLevel.requiredNodeIds.length < 2) {
    console.warn('LevelPlan failed puzzle constraints: requiredNodeIds has fewer than 2 elements.');
    return false;
  }
  if (suggestedLevel.requiredNodeIds[0] !== actorNode.id) {
    console.warn('LevelPlan failed puzzle constraints: requiredNodeIds does not start with the actor node.');
    return false;
  }

  const nodeIds = new Set(nodes.map((n: any) => n.id));
  for (const id of suggestedLevel.requiredNodeIds) {
    if (!nodeIds.has(id)) {
      console.warn(`LevelPlan failed puzzle constraints: requiredNodeId "${id}" does not exist.`);
      return false;
    }
  }
  for (const id of suggestedLevel.forbiddenNodeIds) {
    if (!nodeIds.has(id)) {
      console.warn(`LevelPlan failed puzzle constraints: forbiddenNodeId "${id}" does not exist.`);
      return false;
    }
  }

  // Template mechanical structural verification
  if (template === 'key-door') {
    const hasKey = nodes.some((n: any) => n.type === 'key');
    const hasDoor = suggestedLevel.lockedDoors && suggestedLevel.lockedDoors.length > 0;
    if (!hasKey || !hasDoor) {
      console.warn('LevelPlan failed key-door constraints: Key node or Locked door segment is missing.');
      return false;
    }
  } else if (template === 'switch-wall') {
    const hasSwitch = nodes.some((n: any) => n.type === 'switch');
    const hasSwitchConfig = suggestedLevel.switches && suggestedLevel.switches.length > 0;
    if (!hasSwitch || !hasSwitchConfig) {
      console.warn('LevelPlan failed switch-wall constraints: Switch node or Switch configurations are missing.');
      return false;
    }
  } else if (template === 'one-way-gate') {
    const hasGate = suggestedLevel.oneWayGates && suggestedLevel.oneWayGates.length > 0;
    if (!hasGate) {
      console.warn('LevelPlan failed one-way-gate constraints: One-way gate segment is missing.');
      return false;
    }
  } else if (template === 'hazard-avoidance') {
    const hasHazard = nodes.some((n: any) => n.type === 'hazard') || suggestedLevel.forbiddenNodeIds.length > 0;
    if (!hasHazard) {
      console.warn('LevelPlan failed hazard-avoidance constraints: No hazard or forbidden nodes defined.');
      return false;
    }
  }

  // STAGE 5: Deterministic Pass Over (Solvability checker)
  const solveRes = verifyLevelSolvableServer(suggestedLevel);
  if (!solveRes.solvable) {
    console.warn(`LevelPlan failed deterministic pass over: Level is UNSOLVABLE (${solveRes.reason})`);
    return false;
  }

  // Verify non-triviality (prevent straight line paths bypass)
  if (['key-door', 'switch-wall', 'required-checkpoints'].includes(template)) {
    if (isStraightLineValidServer(suggestedLevel)) {
      console.warn('LevelPlan failed deterministic pass over: Level is trivial (straight-line solution exists)');
      return false;
    }
  }

  // STAGE 6: Language-Relevance Check
  if (clue.includes('水')) {
    const waterNode = nodes.find((n: any) => n.chineseChar === '水');
    if (!waterNode || !suggestedLevel.requiredNodeIds.includes(waterNode.id)) {
      console.warn('LevelPlan failed language-relevance check: Water node not mapped or required.');
      return false;
    }
  }
  if (clue.includes('肉')) {
    const meatNode = nodes.find((n: any) => n.chineseChar === '肉');
    if (!meatNode || !suggestedLevel.requiredNodeIds.includes(meatNode.id)) {
      console.warn('LevelPlan failed language-relevance check: Meat node not mapped or required.');
      return false;
    }
  }
  if (clue.includes('钥') || clue.includes('钥匙')) {
    const keyNode = nodes.find((n: any) => n.chineseChar === '钥');
    if (!keyNode || !suggestedLevel.requiredNodeIds.includes(keyNode.id)) {
      console.warn('LevelPlan failed language-relevance check: Key node not mapped or required.');
      return false;
    }
  }
  if (clue.includes('火')) {
    const fireNode = nodes.find((n: any) => n.chineseChar === '火');
    if (!fireNode || !suggestedLevel.forbiddenNodeIds.includes(fireNode.id)) {
      console.warn('LevelPlan failed language-relevance check: Fire node not mapped or forbidden.');
      return false;
    }
  }

  return true;
}

// -------------------------------------------------------------
// Curated Hand-Crafted Safe Fallback Levels
// -------------------------------------------------------------
const FALLBACK_LEVELS = [
  {
    levelPlan: {
      learningGoal: "Guide the puppy home safely by avoiding the fire hazard",
      grammarTarget: "Direction and obstacle avoidance '小狗避开火，回家'",
      scaffolding: [
        { char: '狗', pinyin: 'gǒu', english: 'Dog', emoji: '🐶', stage: 'new' },
        { char: '避', pinyin: 'bì', english: 'Avoid', emoji: '🛡️', stage: 'new' },
        { char: '火', pinyin: 'huǒ', english: 'Fire', emoji: '🔥', stage: 'new' },
        { char: '家', pinyin: 'jiā', english: 'Home', emoji: '🏠', stage: 'new' }
      ],
      puzzleTemplate: "hazard-avoidance",
      constraints: ["Avoid the fire hazard, navigate safe path to home"],
      plausibleRouteCount: 2,
      puzzleDifficulty: "easy" as const,
      whyMandarinMatters: "Recognizing '避' (avoid) and '火' (fire) is essential to chart a safe detour."
    },
    suggestedLevel: {
      id: "lvl_fallback_1",
      title: "Fallback: Safe Journey Home",
      mandarinClue: "小狗避开火，回家",
      pinyinClue: "xiǎogǒu bìkāi huǒ, huíjiā",
      englishTranslation: "The puppy avoids the fire and goes home",
      hint: "Guide the dog (狗) around the Fire hazard (火) to reach Home (家).",
      nodes: [
        { id: "n_actor", type: "actor" as const, label: "Beagle", chineseChar: "狗", x: 20, y: 50 },
        { id: "n_fire", type: "hazard" as const, label: "Fire", chineseChar: "火", x: 50, y: 50 },
        { id: "n_home", type: "goal" as const, label: "Home", chineseChar: "家", x: 80, y: 50 }
      ],
      requiredNodeIds: ["n_actor", "n_home"],
      forbiddenNodeIds: ["n_fire"],
      walls: [
        { id: "w_top", x1: 50, y1: 15, x2: 50, y2: 42 },
        { id: "w_bot", x1: 50, y1: 58, x2: 50, y2: 85 }
      ],
      lockedDoors: [],
      oneWayGates: [],
      switches: [],
      routeLengthLimit: 300,
      vocabularyScaffold: [
        { char: '狗', pinyin: 'gǒu', english: 'Dog', emoji: '🐶', stage: 'new' as const },
        { char: '火', pinyin: 'huǒ', english: 'Fire', emoji: '🔥', stage: 'new' as const },
        { char: '家', pinyin: 'jiā', english: 'Home', emoji: '🏠', stage: 'new' as const }
      ]
    },
    rationale: "Graceful deterministic offline fallback level."
  },
  {
    levelPlan: {
      learningGoal: "Drink water first then go home, introducing check-points and basic hazards",
      grammarTarget: "Sequential coordination using '先...再...'",
      scaffolding: [
        { char: '水', pinyin: 'shuǐ', english: 'Water', emoji: '💧', stage: 'new' },
        { char: '火', pinyin: 'huǒ', english: 'Fire', emoji: '🔥', stage: 'new' },
        { char: '狗', pinyin: 'gǒu', english: 'Dog', emoji: '🐶', stage: 'familiar' },
        { char: '家', pinyin: 'jiā', english: 'Home', emoji: '🏠', stage: 'familiar' }
      ],
      puzzleTemplate: "required-checkpoints",
      constraints: ["Avoid the fire, must hit water first"],
      plausibleRouteCount: 1,
      puzzleDifficulty: "medium" as const,
      whyMandarinMatters: "Comprehending '水' (water) is required to route to the checkpoint first instead of going straight."
    },
    suggestedLevel: {
      id: "lvl_fallback_2",
      title: "Fallback: Thirsty Beagle",
      mandarinClue: "先喝水，再回家",
      pinyinClue: "xiān hē shuǐ, zài huíjiā",
      englishTranslation: "Drink water first, then go home",
      hint: "Guide the dog (狗) to drink water (水) first, then go Home (家). Dodge the Fire hazard (火)!",
      nodes: [
        { id: "n_actor", type: "actor" as const, label: "Beagle", chineseChar: "狗", x: 15, y: 20 },
        { id: "n_water", type: "checkpoint" as const, label: "Water", chineseChar: "水", x: 50, y: 80 },
        { id: "n_home", type: "goal" as const, label: "Home", chineseChar: "家", x: 85, y: 20 },
        { id: "n_fire", type: "hazard" as const, label: "Fire", chineseChar: "火", x: 50, y: 20 }
      ],
      requiredNodeIds: ["n_actor", "n_water", "n_home"],
      forbiddenNodeIds: ["n_fire"],
      walls: [
        { id: "w1", x1: 40, y1: 10, x2: 40, y2: 45 },
        { id: "w2", x1: 60, y1: 10, x2: 60, y2: 45 }
      ],
      lockedDoors: [],
      oneWayGates: [],
      switches: [],
      routeLengthLimit: 400,
      vocabularyScaffold: [
        { char: '水', pinyin: 'shuǐ', english: 'Water', emoji: '💧', stage: 'new' as const },
        { char: '火', pinyin: 'huǒ', english: 'Fire', emoji: '🔥', stage: 'new' as const },
        { char: '狗', pinyin: 'gǒu', english: 'Dog', emoji: '🐶', stage: 'familiar' as const },
        { char: '家', pinyin: 'jiā', english: 'Home', emoji: '🏠', stage: 'familiar' as const }
      ]
    },
    rationale: "Graceful deterministic offline fallback level."
  },
  {
    levelPlan: {
      learningGoal: "Acquire the key to open the door, introducing locks and triggers",
      grammarTarget: "Action and tool specification '用钥匙开门'",
      scaffolding: [
        { char: '钥匙', pinyin: 'yàoshi', english: 'Key', emoji: '🔑', stage: 'new' },
        { char: '火', pinyin: 'huǒ', english: 'Fire', emoji: '🔥', stage: 'strong' }
      ],
      puzzleTemplate: "key-door",
      constraints: ["Must collect Key node before door line"],
      plausibleRouteCount: 1,
      puzzleDifficulty: "hard" as const,
      whyMandarinMatters: "Recognizing the Key (钥匙) is required to open the path."
    },
    suggestedLevel: {
      id: "lvl_fallback_3",
      title: "Fallback: The Locked Gate",
      mandarinClue: "用钥匙开门，避开火，再回家",
      pinyinClue: "yòng yàoshi kāi mén, bìkāi huǒ, zài huíjiā",
      englishTranslation: "Use the key to open the door, avoid the fire, then go home",
      hint: "Use the Key (钥匙) to unlock the door. Avoid Fire (火), then return Home (家).",
      nodes: [
        { id: "n_actor", type: "actor" as const, label: "Beagle", chineseChar: "狗", x: 48, y: 85 },
        { id: "n_key", type: "key" as const, label: "Key", chineseChar: "钥匙", x: 20, y: 55 },
        { id: "n_fire", type: "hazard" as const, label: "Fire", chineseChar: "火", x: 80, y: 25 },
        { id: "n_home", type: "goal" as const, label: "Home", chineseChar: "家", x: 52, y: 15 }
      ],
      requiredNodeIds: ["n_actor", "n_key", "n_home"],
      forbiddenNodeIds: ["n_fire"],
      walls: [
        { id: "w_mid", x1: 50, y1: 30, x2: 50, y2: 75 }
      ],
      lockedDoors: [
        { id: "d_left", x1: 0, y1: 30, x2: 50, y2: 30, keyNodeId: "n_key" }
      ],
      oneWayGates: [],
      switches: [],
      routeLengthLimit: 300,
      vocabularyScaffold: [
        { char: '钥匙', pinyin: 'yàoshi', english: 'Key', emoji: '🔑', stage: 'new' as const },
        { char: '火', pinyin: 'huǒ', english: 'Fire', emoji: '🔥', stage: 'strong' as const }
      ]
    },
    rationale: "Graceful deterministic offline fallback level."
  }
];

// -------------------------------------------------------------
// Server Endpoints
// -------------------------------------------------------------

// 1. API: Server-side API status check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    geminiKeyConfigured: !!process.env.GEMINI_API_KEY
  });
});

// 2. API: Server-side Gemini Adaptable Level Generation
app.post('/api/gemini/adapt', async (req, res) => {
  try {
    const { completedLevelCount, recentlyStruggledChars, recentlyMasteredChars, silentPlay, adaptiveModel } = req.body;

    let targetFocus = 'Generate a balanced intermediate level.';
    if (recentlyStruggledChars && recentlyStruggledChars.length > 0) {
      targetFocus = `Focus strictly on reinforcing these struggled Chinese characters: "${recentlyStruggledChars.join(', ')}". Choose to retrieve them or make them part of the correct path.`;
    } else if (recentlyMasteredChars && recentlyMasteredChars.length > 0) {
      targetFocus = `The learner has mastered "${recentlyMasteredChars.join(', ')}". Introduce new characters and target a more challenging puzzle.`;
    }

    // Adapt based on specific multi-vector adaptive model dimensions
    let modelContextPrompt = '';
    if (adaptiveModel) {
      const masteredHanzi = Object.entries(adaptiveModel.hanziToMeaning || {})
        .filter(([_, stats]: [any, any]) => stats.success >= 3)
        .map(([char]) => char);
      
      const weakHanzi = Object.entries(adaptiveModel.hanziToMeaning || {})
        .filter(([_, stats]: [any, any]) => stats.failure > stats.success)
        .map(([char]) => char);

      const spatialAcc = (() => {
        const s = adaptiveModel.spatialComprehension || { success: 0, failure: 0 };
        const total = s.success + s.failure;
        return total === 0 ? 'N/A' : `${Math.round((s.success / total) * 100)}%`;
      })();

      const seqAcc = (() => {
        const o = adaptiveModel.orderedComprehension || { success: 0, failure: 0 };
        const total = o.success + o.failure;
        return total === 0 ? 'N/A' : `${Math.round((o.success / total) * 100)}%`;
      })();

      const listeningAcc = (() => {
        const logs = Object.values(adaptiveModel.listeningKnowledge || {}) as any[];
        const successes = logs.reduce((sum: number, c: any) => sum + (c?.success || 0), 0);
        const failures = logs.reduce((sum: number, c: any) => sum + (c?.failure || 0), 0);
        const total = successes + failures;
        return total === 0 ? 'N/A' : `${Math.round((successes / total) * 100)}%`;
      })();

      modelContextPrompt = `
Adaptive Learner Profile Matrix:
- Mastered Characters (Hanzi -> Meaning): [${masteredHanzi.join(', ')}]
- Struggling Characters (Hanzi -> Meaning): [${weakHanzi.join(', ')}]
- Spatial Command Accuracy (左, 右, 上, 下): ${spatialAcc}
- Sequential Command Accuracy (先, 后, 再): ${seqAcc}
- Listening Accuracy (Optional Audio Matches): ${listeningAcc}
`;
    }

    const client = getGeminiClient();

    let response;
    let attempts = 0;
    const maxAttempts = 3;
    // Free-tier (unbilled) order: Lite models first (higher RPM/RPD), then mid Flash.
    // Avoid gemini-3.8-flash / gemini-flash-latest as early fallbacks — tight free quotas + 503 capacity spikes.
    const candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.5-flash'];

    while (attempts < maxAttempts) {
      try {
        attempts++;
        const modelToUse = candidateModels[(attempts - 1) % candidateModels.length];
        console.log(`[Pedagogical Game Director] Requesting level generation using model: ${modelToUse} (attempt ${attempts}/${maxAttempts})`);
        response = await client.models.generateContent({
          model: modelToUse,
          contents: `You are the server-side Gemini Pedagogical Game Director for a touch-drawing rescue game called Mandarin Rescue.
The game field is a percentage coordinate grid [0, 100] with nodes, walls, doors, switches, and gates.
The player reads a Mandarin clue (mandarinClue), then draws a path guiding the actor node through checkpoints/items to the home goal.

Linguistic and Student Context:
- Completed Levels: ${completedLevelCount || 0}
- Pedagogy target: ${targetFocus}
${modelContextPrompt}
- SILENT PLAY MODE STATUS: ${silentPlay ? 'ACTIVE' : 'INACTIVE'} (If ACTIVE, you are FORBIDDEN from requiring audio/sound to solve the level. The 'isAudioRequired' property in suggestedLevel MUST be set to false. The level must be fully solvable visually with written mandarinClue).

Your tasks:
1. Choose WHAT the learner should retrieve (e.g. Water '水', Meat '肉', Key '钥匙') and WHICH approved puzzle type (puzzleTemplate) makes that information necessary.
   Approved puzzle templates:
   - "required-checkpoints": visiting checkpoints in chronological sequence.
   - "key-door": collecting keys to pass through doors.
   - "switch-wall": stepping on switches to toggle walls.
   - "hazard-avoidance": navigating around forbidden fires/dangers.
   - "one-way-gate": passing through directional one-way gates.
2. Under "levelPlan", specify the learningGoal, grammarTarget, scaffolding (matching vocabularyScaffold structure), puzzleTemplate, constraints, plausibleRouteCount, puzzleDifficulty (easy, medium, hard), and whyMandarinMatters.
3. Design the full physical coordinate layout in "suggestedLevel".
   - COORDINATES: Node positions MUST be inside [15, 85] to leave space from edges.
   - COORDINATE DENSITY: Ensure any two nodes are at least 18 units apart.
   - NON-TRIVIALITY MANDATE: The level must NEVER allow a direct straight line from actor to home goal. You MUST position walls or hazards blocking the direct path between "n_actor" and "n_home" so the player is physically required to draw a winding route around obstacles or collect required keys/checkpoints.
   - Actor node ID must be "n_actor", Chinese character "狗" (dog).
   - Goal node ID must be "n_home", Chinese character "家".
   - Distractor nodes must have different Chinese characters (e.g. if target is Meat '肉', add grass '草' or water '水' elsewhere as a physical distractor).
   - "requiredNodeIds" must list the exact sequence to reach goal, starting with "n_actor", followed by intermediate checkpoints, and ending with "n_home".
   - "forbiddenNodeIds" must contain hazards or distractors.
4. Choose one reviewed mission below verbatim. Copy its Mandarin key, pinyin, and English exactly; never rewrite or recombine them:
${JSON.stringify(Object.fromEntries(
  Object.entries(REVIEWED_MANDARIN_MISSIONS).filter(([, mission]) => mission.adaptiveEligible)
))}
   - Use full learner-facing words 钥匙 for key and 开关 for switch. Never label a node 钥 or 开 as the complete noun.
   - Every required intermediate node must be a checkpoint, key, or switch explicitly listed by the selected mission.
   - vocabularyScaffold may contain only node words from this reviewed dictionary, copying pinyin and English exactly:
${JSON.stringify(REVIEWED_NODE_VOCABULARY)}
5. Provide a child-friendly visual hint in "hint" that teaches the Mandarin clue's semantics.

Return EXACTLY a Zod-parsable JSON object matching the requested schema. Do NOT invent new node types or physical mechanics.`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                levelPlan: {
                  type: Type.OBJECT,
                  properties: {
                    learningGoal: { type: Type.STRING },
                    grammarTarget: { type: Type.STRING },
                    scaffolding: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          char: { type: Type.STRING },
                          pinyin: { type: Type.STRING },
                          english: { type: Type.STRING },
                          emoji: { type: Type.STRING },
                          stage: { type: Type.STRING }
                        },
                        required: ['char', 'pinyin', 'english', 'emoji', 'stage']
                      }
                    },
                    puzzleTemplate: { type: Type.STRING },
                    constraints: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    },
                    plausibleRouteCount: { type: Type.INTEGER },
                    puzzleDifficulty: { type: Type.STRING },
                    whyMandarinMatters: { type: Type.STRING }
                  },
                  required: [
                    'learningGoal',
                    'grammarTarget',
                    'scaffolding',
                    'puzzleTemplate',
                    'constraints',
                    'plausibleRouteCount',
                    'puzzleDifficulty',
                    'whyMandarinMatters'
                  ]
                },
                suggestedLevel: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    title: { type: Type.STRING },
                    mandarinClue: { type: Type.STRING },
                    pinyinClue: { type: Type.STRING },
                    englishTranslation: { type: Type.STRING },
                    isAudioRequired: { type: Type.BOOLEAN },
                    nodes: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          id: { type: Type.STRING },
                          type: { type: Type.STRING },
                          label: { type: Type.STRING },
                          chineseChar: { type: Type.STRING },
                          x: { type: Type.INTEGER },
                          y: { type: Type.INTEGER }
                        },
                        required: ['id', 'type', 'label', 'chineseChar', 'x', 'y']
                      }
                    },
                    requiredNodeIds: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    },
                    forbiddenNodeIds: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    },
                    hint: { type: Type.STRING },
                    walls: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          id: { type: Type.STRING },
                          x1: { type: Type.INTEGER },
                          y1: { type: Type.INTEGER },
                          x2: { type: Type.INTEGER },
                          y2: { type: Type.INTEGER }
                        },
                        required: ['id', 'x1', 'y1', 'x2', 'y2']
                      }
                    },
                    lockedDoors: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          id: { type: Type.STRING },
                          x1: { type: Type.INTEGER },
                          y1: { type: Type.INTEGER },
                          x2: { type: Type.INTEGER },
                          y2: { type: Type.INTEGER },
                          keyNodeId: { type: Type.STRING }
                        },
                        required: ['id', 'x1', 'y1', 'x2', 'y2', 'keyNodeId']
                      }
                    },
                    oneWayGates: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          id: { type: Type.STRING },
                          x1: { type: Type.INTEGER },
                          y1: { type: Type.INTEGER },
                          x2: { type: Type.INTEGER },
                          y2: { type: Type.INTEGER },
                          allowDirection: { type: Type.STRING }
                        },
                        required: ['id', 'x1', 'y1', 'x2', 'y2', 'allowDirection']
                      }
                    },
                    switches: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          id: { type: Type.STRING },
                          nodeId: { type: Type.STRING },
                          targetWallId: { type: Type.STRING }
                        },
                        required: ['id', 'nodeId', 'targetWallId']
                      }
                    },
                    routeLengthLimit: { type: Type.INTEGER },
                    vocabularyScaffold: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          char: { type: Type.STRING },
                          pinyin: { type: Type.STRING },
                          english: { type: Type.STRING },
                          emoji: { type: Type.STRING },
                          stage: { type: Type.STRING }
                        },
                        required: ['char', 'pinyin', 'english', 'emoji', 'stage']
                      }
                    }
                  },
                  required: [
                    'id',
                    'title',
                    'mandarinClue',
                    'pinyinClue',
                    'englishTranslation',
                    'nodes',
                    'requiredNodeIds',
                    'forbiddenNodeIds',
                    'hint',
                    'vocabularyScaffold'
                  ]
                },
                rationale: { type: Type.STRING }
              },
              required: ['levelPlan', 'suggestedLevel', 'rationale']
            }
          }
        });
        break;
      } catch (err: any) {
        console.warn(`Gemini generation attempt ${attempts} failed:`, err.message || err);
        if (attempts >= maxAttempts) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, attempts * 800));
      }
    }

    let parsedData: any = null;
    if (response?.text) {
      try {
        parsedData = JSON.parse(response.text);
      } catch (parseErr) {
        console.warn('Failed to parse Gemini response text as JSON:', parseErr);
      }
    }

    if (parsedData) {
      parsedData = sanitizeGeminiOutput(parsedData);
      // Run the robust 6-Stage Validation Engine on Gemini's output
      if (validateLevelPlan(parsedData)) {
        console.log(
          `✅ Serving AI director level id=${parsedData.suggestedLevel.id} (Gemini passed validation)`
        );
        return res.json(parsedData);
      }
      console.warn(
        '❌ Gemini JSON failed validation — this request will serve a handcrafted fallback (not AI).'
      );
    } else if (!response?.text) {
      console.warn(
        '❌ Gemini returned no usable response after retries — this request will serve a handcrafted fallback (not AI).'
      );
    }

    // Fallback selection based on history
    const fallbackIdx = (completedLevelCount || 0) % FALLBACK_LEVELS.length;
    const fallbackPayload = FALLBACK_LEVELS[fallbackIdx];
    console.log(
      `📦 Serving director FALLBACK id=${fallbackPayload.suggestedLevel.id} (player still gets a playable rescue; not personalized Gemini output)`
    );
    res.json(fallbackPayload);

  } catch (error: any) {
    console.error('Gemini adaptation API error:', error);
    // Silent Fallback selection: Never show AI loading or errors to the player
    const fallbackIdx = Math.floor(Math.random() * FALLBACK_LEVELS.length);
    const fallbackPayload = FALLBACK_LEVELS[fallbackIdx];
    console.log(
      `📦 Serving director FALLBACK id=${fallbackPayload.suggestedLevel.id} (exception path; not AI)`
    );
    res.json(fallbackPayload);
  }
});

// Configure Vite middleware in development; Serve static dist assets in production
async function setupServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening at http://0.0.0.0:${PORT} [Mode: ${process.env.NODE_ENV || 'development'}]`);
  });
}

setupServer();
