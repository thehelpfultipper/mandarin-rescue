import { LevelSchema, PlayerProgressSchema, GeminiAdaptationResponseSchema } from '../src/types';
import { DEFAULT_LEVELS, DEFAULT_PROGRESS } from '../src/lib/persistence';
import { boardGeometryKey, instantiateLevel } from '../src/lib/boardVariants';

let passed = 0;
let failed = 0;

function runTest(name: string, fn: () => void) {
  console.log(`Running test: ${name}...`);
  try {
    fn();
    console.log(`✅ Passed: ${name}\n`);
    passed++;
  } catch (err: any) {
    console.error(`❌ Failed: ${name}`);
    console.error(err.message || err);
    console.error('\n');
    failed++;
  }
}

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

/** Matches GameCanvas WALL_COLLISION_THICKNESS — thin zero-width tests hide impossible boards. */
const WALL_COLLISION_THICKNESS = 2.6;

function pathHitsThickBarrier(
  ax: number, ay: number, bx: number, by: number,
  x1: number, y1: number, x2: number, y2: number,
  thickness = WALL_COLLISION_THICKNESS
): boolean {
  if (getLineIntersection(ax, ay, bx, by, x1, y1, x2, y2)) return true;
  if (pointToSegmentDistance(ax, ay, x1, y1, x2, y2) < thickness) return true;
  if (pointToSegmentDistance(bx, by, x1, y1, x2, y2) < thickness) return true;
  if (pointToSegmentDistance(x1, y1, ax, ay, bx, by) < thickness) return true;
  if (pointToSegmentDistance(x2, y2, ax, ay, bx, by) < thickness) return true;
  return false;
}

// -------------------------------------------------------------
// BFS Pathfinding Solver on 50x50 Discretized Grid
// -------------------------------------------------------------

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

      // Match GameCanvas pointer clamp (3–97) — edge-skimming paths are not drawable
      if (nx < 3 || nx > 97 || ny < 3 || ny > 97) continue;

      let segmentValid = true;

      // 1. Static Wall collisions (thick barriers like the live engine)
      for (const wall of walls) {
        if (inactiveWalls.includes(wall.id)) continue;
        if (pathHitsThickBarrier(x, y, nx, ny, wall.x1, wall.y1, wall.x2, wall.y2)) {
          segmentValid = false;
          break;
        }
      }
      if (!segmentValid) continue;

      // 2. Locked Door collisions
      for (const door of lockedDoors) {
        const isUnlocked = collectedKeys.includes(door.keyNodeId);
        if (!isUnlocked) {
          if (pathHitsThickBarrier(x, y, nx, ny, door.x1, door.y1, door.x2, door.y2)) {
            segmentValid = false;
            break;
          }
        }
      }
      if (!segmentValid) continue;

      // 3. One-Way Gate direction checks
      for (const gate of oneWayGates) {
        if (pathHitsThickBarrier(x, y, nx, ny, gate.x1, gate.y1, gate.x2, gate.y2, 1.5)) {
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

// -------------------------------------------------------------
// Sequence Reachability & Solvability Verifier
// -------------------------------------------------------------

function verifyLevelSolvable(level: any): { solvable: boolean; reason?: string; length?: number } {
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

  const limit = level.routeLengthLimit || 300;
  if (totalLength > limit) {
    return { solvable: false, reason: `Path length (${Math.round(totalLength)}) exceeds limit (${limit})` };
  }

  return { solvable: true, length: totalLength };
}

// -------------------------------------------------------------
// Non-Triviality Checker (Ensures straight line from start to end fails)
// -------------------------------------------------------------

function isStraightLineValid(level: any): boolean {
  const actorNode = level.nodes.find((n: any) => n.type === 'actor');
  const goalNode = level.nodes.find((n: any) => n.type === 'goal');
  if (!actorNode || !goalNode) return false;

  const x1 = actorNode.x;
  const y1 = actorNode.y;
  const x2 = goalNode.x;
  const y2 = goalNode.y;

  // 1. Check walls (thick — matches live engine)
  for (const wall of (level.walls || [])) {
    if (pathHitsThickBarrier(x1, y1, x2, y2, wall.x1, wall.y1, wall.x2, wall.y2)) {
      return false;
    }
  }

  // 2. Check locked doors (initially locked)
  for (const door of (level.lockedDoors || [])) {
    if (pathHitsThickBarrier(x1, y1, x2, y2, door.x1, door.y1, door.x2, door.y2)) {
      return false;
    }
  }

  // 3. Check gates
  for (const gate of (level.oneWayGates || [])) {
    if (pathHitsThickBarrier(x1, y1, x2, y2, gate.x1, gate.y1, gate.x2, gate.y2, 1.5)) {
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
  if (dist > (level.routeLengthLimit || 300)) {
    return false;
  }

  return true;
}

// -------------------------------------------------------------
// Main Test Runs
// -------------------------------------------------------------

console.log('==================================================');
console.log('Mandarin Rescue — Automated Architecture Tests');
console.log('==================================================\n');

// Test 1: Validate DEFAULT_LEVELS against Zod LevelSchema & ensure solvability and non-triviality
runTest('Validate Curated Curriculums against LevelSchema Zod Schema & Gameplay Rules', () => {
  for (const level of DEFAULT_LEVELS) {
    const result = LevelSchema.safeParse(level);
    if (!result.success) {
      throw new Error(`Level "${level.id}" failed Zod validation: ` + JSON.stringify(result.error.format()));
    }

    // Custom gameplay constraint checking
    if (level.requiredNodeIds.length < 2) {
      throw new Error(`Level "${level.id}" gameplay error: Needs at least 2 connected nodes (Actor + Goal)`);
    }

    const actorNode = level.nodes.find(n => n.id === level.requiredNodeIds[0]);
    if (!actorNode || actorNode.type !== 'actor') {
      throw new Error(`Level "${level.id}" gameplay error: The first node of the path sequence must be of type "actor"`);
    }

    // Deterministic Solvability check
    const solveRes = verifyLevelSolvable(level);
    if (!solveRes.solvable) {
      throw new Error(`Level "${level.id}" is UNSOLVABLE: ${solveRes.reason}`);
    }

    // Deterministic Non-Triviality check (for Levels 3-12)
    const levelNumber = parseInt(level.id.replace('lvl_', ''));
    if (levelNumber >= 3) {
      const isTrivial = isStraightLineValid(level) && level.requiredNodeIds.length === 2;
      if (isTrivial) {
        throw new Error(`Level "${level.id}" is TRIVIAL: Can be solved by a straight line with no checkpoints/obstacles!`);
      }
      
      // Also ensure straight line is physically blocked/prevented
      if (isStraightLineValid(level)) {
        throw new Error(`Level "${level.id}" has no physical obstacle/hazard blocking a straight-line from start to goal!`);
      }
    }

    // Contrast of options: every linguistic level needs a distractor (forbidden or hazard)
    const hasDistractor =
      level.forbiddenNodeIds.length > 0 ||
      level.nodes.some(n => n.type === 'hazard' || (n.type === 'item' && level.forbiddenNodeIds.includes(n.id)));
    if (!hasDistractor) {
      throw new Error(`Level "${level.id}" lacks a distractor option (contrast of options rule)`);
    }

    // Actor char must match clue vocabulary (狗, not 犬 mismatch)
    const actor = level.nodes.find(n => n.type === 'actor');
    if (actor && level.mandarinClue.includes('狗') && actor.chineseChar !== '狗') {
      throw new Error(`Level "${level.id}" clue uses 狗 but actor is ${actor.chineseChar}`);
    }
  }
});

// Test 2: Validate DEFAULT_PROGRESS structure
runTest('Validate Default Player Progress against PlayerProgressSchema Zod Schema', () => {
  const result = PlayerProgressSchema.safeParse(DEFAULT_PROGRESS);
  if (!result.success) {
    throw new Error('DEFAULT_PROGRESS failed Zod validation: ' + JSON.stringify(result.error.format()));
  }
});

// Test 3: Validate mock Gemini level adaptation output format
runTest('Validate Mock Gemini Level Adaptation Output Schema', () => {
  const mockGeminiResponse = {
    levelPlan: {
      learningGoal: "Guide the bird to the worm, avoiding the spider",
      grammarTarget: "Action sequence",
      scaffolding: [
        { char: '鸟', pinyin: 'niǎo', english: 'Bird', emoji: '🐦', stage: 'new' },
        { char: '虫', pinyin: 'chóng', english: 'Worm', emoji: '🐛', stage: 'new' }
      ],
      puzzleTemplate: "hazard-avoidance",
      constraints: ["Avoid spider hazard"],
      plausibleRouteCount: 2,
      puzzleDifficulty: "medium" as const,
      whyMandarinMatters: "Recognizing target versus hazard."
    },
    suggestedLevel: {
      id: 'lvl_gemini_test',
      title: 'Milestone 4: Adaptive Forest',
      mandarinClue: '鸟吃虫',
      pinyinClue: 'niǎo chī chóng',
      englishTranslation: 'The bird eats the worm',
      hint: 'Guide the bird to the worm, avoid the spider!',
      nodes: [
        { id: 'n_actor', type: 'actor', label: 'Bird', chineseChar: '鸟', x: 25, y: 30 },
        { id: 'n_worm', type: 'goal', label: 'Worm', chineseChar: '虫', x: 75, y: 65 },
        { id: 'n_spider', type: 'hazard', label: 'Spider', chineseChar: '蛛', x: 50, y: 50 }
      ],
      requiredNodeIds: ['n_actor', 'n_worm'],
      forbiddenNodeIds: ['n_spider'],
      vocabularyScaffold: [
        { char: '鸟', pinyin: 'niǎo', english: 'Bird', emoji: '🐦', stage: 'new' as const },
        { char: '虫', pinyin: 'chóng', english: 'Worm', emoji: '🐛', stage: 'new' as const }
      ]
    },
    rationale: 'Reviewing avian vocabulary after the player completed pet milestones.'
  };

  const result = GeminiAdaptationResponseSchema.safeParse(mockGeminiResponse);
  if (!result.success) {
    throw new Error('Mock Gemini adaptation failed validation: ' + JSON.stringify(result.error.format()));
  }
});

// Test 4: Validate punctuation in Mandarin clues (fixing Character "，" vocabulary check)
runTest('Validate Punctuation Acceptance in Mandarin Clues', () => {
  const PUNCTUATION_AND_SYMBOLS = new Set([
    '，', '。', '！', '？', '、', '；', '：', ' ', '\t', '\n',
    ',', '.', '!', '?', ';', ':', '“', '”', '‘', '’', '"', "'", '—', '-', '…', '·', '《', '》', '（', '）', '(', ')'
  ]);
  const APPROVED_VOCAB_CHARS = new Set(['小', '狗', '避', '开', '火', '回', '家']);
  const clueWithComma = "小狗避开火，回家";
  
  for (const char of clueWithComma) {
    if (PUNCTUATION_AND_SYMBOLS.has(char) || /\s/.test(char)) continue;
    if (!APPROVED_VOCAB_CHARS.has(char)) {
      throw new Error(`Punctuation test failed: character "${char}" was rejected.`);
    }
  }
});

// Test 5: Validate Non-Trivial Geometry Check (Reject straight-line bypasses)
runTest('Validate Non-Trivial Geometry Enforcement', () => {
  const trivialLevel = {
    nodes: [
      { id: 'n_actor', type: 'actor' as const, label: 'Beagle', chineseChar: '犬', x: 20, y: 50 },
      { id: 'n_home', type: 'goal' as const, label: 'Home', chineseChar: '家', x: 80, y: 50 }
    ],
    requiredNodeIds: ['n_actor', 'n_home'],
    forbiddenNodeIds: [],
    walls: [],
    lockedDoors: [],
    oneWayGates: [],
    switches: []
  };

  const isTrivial = isStraightLineValid(trivialLevel as any);
  if (!isTrivial) {
    throw new Error('Expected unobstructed level to be identified as trivial straight-line solution');
  }

  // Adding a barrier wall in the center prevents the trivial straight-line solution
  const nonTrivialLevel = {
    ...trivialLevel,
    walls: [
      { id: 'w_blocker', x1: 50, y1: 30, x2: 50, y2: 70 }
    ]
  };
  const isStillTrivial = isStraightLineValid(nonTrivialLevel as any);
  if (isStillTrivial) {
    throw new Error('Expected obstructed level to not be trivial');
  }
});

// Test 6: Seeded board variants stay solvable and change geometry across seeds
runTest('Validate Seeded Board Variants (solvability + non-identical geometry)', () => {
  for (const template of DEFAULT_LEVELS) {
    const keys = new Set<string>();
    for (let seed = 0; seed < 24; seed++) {
      const board = instantiateLevel(template, seed);
      const solveRes = verifyLevelSolvable(board);
      if (!solveRes.solvable) {
        throw new Error(`Variant of "${template.id}" seed=${seed} UNSOLVABLE: ${solveRes.reason}`);
      }
      // Linguistic contract must not drift
      if (board.mandarinClue !== template.mandarinClue) {
        throw new Error(`Variant of "${template.id}" changed Mandarin clue`);
      }
      if (JSON.stringify(board.requiredNodeIds) !== JSON.stringify(template.requiredNodeIds)) {
        throw new Error(`Variant of "${template.id}" changed required sequence`);
      }
      keys.add(boardGeometryKey(board));
    }
    if (keys.size < 2) {
      throw new Error(`Level "${template.id}" produced only ${keys.size} unique board geometries across 24 seeds — need replay variety`);
    }
  }
});

console.log('==================================================');
console.log(`Test Execution Finished! Passed: ${passed}, Failed: ${failed}`);
console.log('==================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
