import { LevelSchema, PlayerProgressSchema, GeminiAdaptationResponseSchema } from '../src/types';
import { DEFAULT_LEVELS, DEFAULT_PROGRESS } from '../src/lib/persistence';
import { boardGeometryKey, instantiateLevel } from '../src/lib/boardVariants';
import { GeneratedMazeLevel, getMazeProfile } from '../src/lib/mazeGenerator';
import { orderedContactsAlongPath, pathTouchesPoint } from '../src/lib/pathGeometry';

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
  forbiddenNodeIds: string[],
  /** Hazard/forbidden ids that may be approached (for distractor-reachability checks). */
  allowTouchIds: string[] = []
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
    if (current.gx === endGx && current.gy === endGy) {
      const distToEnd = Math.hypot(lastPt.x - end.x, lastPt.y - end.y);
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

      // 4. Contact with Hazards or Forbidden nodes (except allowlisted touch targets)
      for (const node of level.nodes) {
        if (allowTouchIds.includes(node.id)) continue;
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

/** Contrast of Options: every distractor must be drawable at some reachable puzzle stage. */
function verifyDistractorsAccessible(level: any): { ok: boolean; reason?: string } {
  const actorNode = level.nodes.find((n: any) => n.type === 'actor');
  if (!actorNode) return { ok: false, reason: 'Missing actor' };

  const distractorIds = new Set<string>([
    ...(level.forbiddenNodeIds || []),
    ...level.nodes.filter((n: any) => n.type === 'hazard').map((n: any) => n.id)
  ]);

  if (distractorIds.size === 0) {
    return { ok: false, reason: 'No distractor nodes to verify' };
  }

  for (const id of distractorIds) {
    const target = level.nodes.find((n: any) => n.id === id);
    if (!target) {
      return { ok: false, reason: `Distractor id "${id}" missing from nodes` };
    }
    const collectedKeys: string[] = [];
    const activatedSwitches: string[] = [];
    let current = actorNode;
    let reachable = false;
    const stageNodes = [
      actorNode,
      ...level.requiredNodeIds.slice(1).map((requiredId: string) => level.nodes.find((node: any) => node.id === requiredId)).filter(Boolean)
    ];

    for (const stageNode of stageNodes) {
      current = stageNode;
      if (stageNode.type === 'key' && !collectedKeys.includes(stageNode.id)) collectedKeys.push(stageNode.id);
      if (stageNode.type === 'switch' && !activatedSwitches.includes(stageNode.id)) activatedSwitches.push(stageNode.id);
      const res = solveLevelBFS(
        level,
        { x: current.x, y: current.y },
        { x: target.x, y: target.y },
        collectedKeys,
        activatedSwitches,
        level.forbiddenNodeIds || [],
        [id]
      );
      if (res) {
        reachable = true;
        break;
      }
    }
    if (!reachable) {
      return {
        ok: false,
        reason: `Distractor "${target.chineseChar}" (${target.label}, ${id}) is wall-caged at every puzzle stage`
      };
    }
  }

  return { ok: true };
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

function metadataCellPoint(cellKey: string, size: number): { x: number; y: number } {
  const [row, col] = cellKey.split(',').map(Number);
  const step = 88 / size;
  return { x: 6 + (col + 0.5) * step, y: 6 + (row + 0.5) * step };
}

function barrierMatchesCellEdge(
  barrier: { x1: number; y1: number; x2: number; y2: number },
  aKey: string,
  bKey: string,
  size: number
): boolean {
  const a = metadataCellPoint(aKey, size);
  const b = metadataCellPoint(bKey, size);
  const expected = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const actual = { x: (barrier.x1 + barrier.x2) / 2, y: (barrier.y1 + barrier.y2) / 2 };
  return Math.hypot(expected.x - actual.x, expected.y - actual.y) < 0.01;
}

function verifyGeneratedGraphConnected(board: GeneratedMazeLevel): boolean {
  const graph = new Map<string, string[]>();
  for (let row = 0; row < board.mazeMetadata.size; row++) {
    for (let col = 0; col < board.mazeMetadata.size; col++) graph.set(`${row},${col}`, []);
  }
  for (const edge of board.mazeMetadata.connections) {
    const [a, b] = edge.split('|');
    graph.get(a)?.push(b);
    graph.get(b)?.push(a);
  }
  const start = graph.keys().next().value as string | undefined;
  if (!start) return false;
  const queue = [start];
  const visited = new Set(queue);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    for (const next of graph.get(queue[cursor]) || []) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push(next);
    }
  }
  return visited.size === board.mazeMetadata.size ** 2;
}

function verifyDistractorPressure(board: GeneratedMazeLevel): { ok: boolean; reason?: string } {
  const expected = board.nodes.filter(node => !board.requiredNodeIds.includes(node.id));
  const placements = board.mazeMetadata.distractors;
  if (placements.length !== expected.length) {
    return { ok: false, reason: `expected ${expected.length} distractor placements, got ${placements.length}` };
  }
  const attachments = new Set<string>();
  const solution = board.mazeMetadata.solutionCells;
  const shortcut = board.mazeMetadata.shortcut;
  for (const node of expected) {
    const placement = placements.find(item => item.id === node.id);
    if (!placement) return { ok: false, reason: `missing placement metadata for "${node.id}"` };
    if (!placement.onCompetingPath) {
      return { ok: false, reason: `"${node.id}" is not on a competing decoy corridor (decorative dead-end)` };
    }
    if (placement.corridorLength < 3) {
      return { ok: false, reason: `"${node.id}" corridor is too short to read as a path solution` };
    }
    if (placement.depth < 1 || placement.depth > 5) {
      return { ok: false, reason: `"${node.id}" has invalid corridor depth ${placement.depth}` };
    }
    if (attachments.has(placement.attachment)) {
      return { ok: false, reason: `"${node.id}" reuses another distractor's decision point` };
    }
    attachments.add(placement.attachment);
    const intendedIndex = solution.indexOf(placement.attachment);
    if (intendedIndex >= 0) {
      const frac = intendedIndex / Math.max(1, solution.length - 1);
      if (frac > 0.58) {
        return { ok: false, reason: `"${node.id}" attaches too late on the journey (frac=${frac.toFixed(2)})` };
      }
    } else if (!shortcut || Math.abs(placement.attachmentIndex - shortcut.fromIndex) > 6) {
      return { ok: false, reason: `"${node.id}" is not on the intended route or shortcut fork` };
    }
    if (!placement.appearsTowardTarget) {
      return { ok: false, reason: `"${node.id}" does not look toward the next goal (insignificant trap)` };
    }
  }
  return { ok: true };
}

function verifyTrueRouteHazardClearance(board: GeneratedMazeLevel): { ok: boolean; reason?: string } {
  const points = board.mazeMetadata.solutionCells.map(cell => metadataCellPoint(cell, board.mazeMetadata.size));
  const hazards = board.nodes.filter(node => node.type === 'hazard' || board.forbiddenNodeIds.includes(node.id));
  for (const hazard of hazards) {
    for (let index = 1; index < points.length; index++) {
      if (pointToSegmentDistance(
        hazard.x, hazard.y,
        points[index - 1].x, points[index - 1].y,
        points[index].x, points[index].y
      ) <= 6.5) {
        return { ok: false, reason: `"${hazard.id}" blocks the intended solution corridor` };
      }
    }
  }
  return { ok: true };
}

// -------------------------------------------------------------
// Main Test Runs
// -------------------------------------------------------------

console.log('==================================================');
console.log('Mandarin Rescue — Automated Architecture Tests');
console.log('==================================================\n');

// Test 1: Curated data is the semantic contract; runtime geometry is generated below.
runTest('Validate Curated Curriculum Semantic Contracts', () => {
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

    const levelNumber = parseInt(level.id.replace('lvl_', ''));
    const hasDistractor =
      level.forbiddenNodeIds.length > 0 ||
      level.nodes.some(n => n.type === 'hazard' || (n.type === 'item' && level.forbiddenNodeIds.includes(n.id)));
    if (!hasDistractor) {
      throw new Error(`Level "${level.id}" lacks a distractor option (contrast of options rule)`);
    }

    if (levelNumber >= 6 && !(level.patrols && level.patrols.length > 0)) {
      throw new Error(`Level "${level.id}" (L6+) must include at least one moving patrol`);
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

// Test 6: generated boards must be solvable, deceptive, deterministic, and physically usable.
runTest('Validate Generated Maze Topology, Difficulty, and Replay Variety', () => {
  for (const template of DEFAULT_LEVELS) {
    const keys = new Set<string>();
    const profile = getMazeProfile(template.id);
    if (!profile) throw new Error(`Missing maze profile for "${template.id}"`);

    for (let seed = 0; seed < 64; seed++) {
      const board = instantiateLevel(template, seed) as GeneratedMazeLevel;
      if (seed === 0) {
        const replay = instantiateLevel(template, seed);
        if (boardGeometryKey(board) !== boardGeometryKey(replay)) {
          throw new Error(`Level "${template.id}" seed=${seed} is not deterministic`);
        }
      }
      const schemaResult = LevelSchema.safeParse(board);
      if (!schemaResult.success) {
        throw new Error(`Generated "${template.id}" seed=${seed} failed LevelSchema`);
      }
      if (!board.mazeMetadata) {
        throw new Error(`Generated "${template.id}" seed=${seed} lacks maze metadata`);
      }

      const solveRes = verifyLevelSolvable(board);
      if (!solveRes.solvable) {
        throw new Error(`Variant of "${template.id}" seed=${seed} UNSOLVABLE: ${solveRes.reason}`);
      }
      const access = verifyDistractorsAccessible(board);
      if (!access.ok) {
        throw new Error(`Variant of "${template.id}" seed=${seed}: ${access.reason}`);
      }
      const pressure = verifyDistractorPressure(board);
      if (!pressure.ok) {
        throw new Error(`Variant of "${template.id}" seed=${seed}: ${pressure.reason}`);
      }
      const clearance = verifyTrueRouteHazardClearance(board);
      if (!clearance.ok) {
        throw new Error(`Variant of "${template.id}" seed=${seed}: ${clearance.reason}`);
      }
      // Linguistic contract must not drift
      if (board.mandarinClue !== template.mandarinClue) {
        throw new Error(`Variant of "${template.id}" changed Mandarin clue`);
      }
      if (JSON.stringify(board.requiredNodeIds) !== JSON.stringify(template.requiredNodeIds)) {
        throw new Error(`Variant of "${template.id}" changed required sequence`);
      }

      const metrics = board.mazeMetadata.metrics;
      if (metrics.routeSteps < profile.minRouteSteps) {
        throw new Error(`${template.id} seed=${seed} route has ${metrics.routeSteps} steps; expected ${profile.minRouteSteps}`);
      }
      if (metrics.turns < profile.minTurns) {
        throw new Error(`${template.id} seed=${seed} route has ${metrics.turns} turns; expected ${profile.minTurns}`);
      }
      if (metrics.decisions < profile.minDecisions) {
        throw new Error(`${template.id} seed=${seed} has ${metrics.decisions} decisions; expected ${profile.minDecisions}`);
      }
      if (metrics.deepestDecoy < profile.minDecoyDepth || metrics.decoyBranches < 2) {
        throw new Error(`${template.id} seed=${seed} lacks substantial false branches`);
      }
      if (metrics.longestStraightRun > profile.maxStraightRun) {
        throw new Error(`${template.id} seed=${seed} has an over-obvious straight run of ${metrics.longestStraightRun} cells`);
      }
      if (metrics.directRatio < 1.6) {
        throw new Error(`${template.id} seed=${seed} route/direct ratio ${metrics.directRatio.toFixed(2)} is too obvious`);
      }
      if (metrics.bfsExpanded < Math.min(metrics.routeSteps, profile.size) * 0.4) {
        throw new Error(`${template.id} seed=${seed} solver explored too little of the board`);
      }
      if ((board.routeLengthLimit || Number.POSITIVE_INFINITY) > metrics.routeLength * 1.36 + 1) {
        throw new Error(`${template.id} seed=${seed} ink budget is too loose to constrain route choice`);
      }
      if (!verifyGeneratedGraphConnected(board)) {
        throw new Error(`${template.id} seed=${seed} generated a disconnected maze graph`);
      }
      if (isStraightLineValid(board)) {
        throw new Error(`${template.id} seed=${seed} can be solved by a direct line`);
      }

      for (const node of board.nodes) {
        for (const wall of board.walls || []) {
          const clearance = pointToSegmentDistance(node.x, node.y, wall.x1, wall.y1, wall.x2, wall.y2);
          if (clearance <= WALL_COLLISION_THICKNESS + 0.5) {
            throw new Error(`${template.id} seed=${seed} node "${node.id}" is too close to wall "${wall.id}"`);
          }
        }
      }

      if ((board.lockedDoors || []).map(door => door.id).join('|') !== (template.lockedDoors || []).map(door => door.id).join('|')) {
        throw new Error(`${template.id} seed=${seed} changed locked-door mechanics`);
      }
      if ((board.oneWayGates || []).map(gate => gate.id).join('|') !== (template.oneWayGates || []).map(gate => gate.id).join('|')) {
        throw new Error(`${template.id} seed=${seed} changed one-way mechanics`);
      }
      for (const trigger of board.switches || []) {
        if (!(board.walls || []).some(wall => wall.id === trigger.targetWallId)) {
          throw new Error(`${template.id} seed=${seed} switch target "${trigger.targetWallId}" is missing`);
        }
      }

      if (template.id === 'lvl_8') {
        const actor = board.nodes.find(node => node.id === 'n_actor')!;
        const left = board.nodes.find(node => node.id === 'n_left')!;
        const water = board.nodes.find(node => node.id === 'n_water')!;
        const right = board.nodes.find(node => node.id === 'n_right')!;
        const fire = board.nodes.find(node => node.id === 'n_fire')!;
        if (!(left.x < actor.x && water.x < actor.x && right.x > actor.x && fire.x > actor.x)) {
          throw new Error(`lvl_8 seed=${seed} contradicts its left/right Mandarin clue`);
        }
      }

      if (template.id === 'lvl_9') {
        const wrong = board.mazeMetadata.distractors.find(item => item.id === 'n_wrong_chk')!;
        const upGate = board.oneWayGates?.find(gate => gate.id === 'g_left');
        const downGate = board.oneWayGates?.find(gate => gate.id === 'g_right');
        if (!upGate || upGate.allowDirection !== 'up' ||
            !barrierMatchesCellEdge(upGate, wrong.attachment, wrong.firstBranchCell, board.mazeMetadata.size)) {
          throw new Error(`lvl_9 seed=${seed} Up gate is not on the forbidden Up branch`);
        }
        const route = board.mazeMetadata.solutionCells;
        const downOnSolution = Boolean(downGate && route.slice(1).some((cell, index) => {
          const [aRow] = route[index].split(',').map(Number);
          const [bRow] = cell.split(',').map(Number);
          return bRow > aRow && barrierMatchesCellEdge(downGate, route[index], cell, board.mazeMetadata.size);
        }));
        if (!downGate || downGate.allowDirection !== 'down' || !downOnSolution) {
          throw new Error(`lvl_9 seed=${seed} Down gate is not on the required route`);
        }
      }

      if (template.id === 'lvl_11') {
        const shortcut = board.mazeMetadata.shortcut;
        const targetId = board.switches?.[0]?.targetWallId;
        const shortcutWall = board.walls?.find(wall => wall.id === targetId);
        if (!shortcut || shortcut.skippedSteps < 4 || !shortcutWall ||
            !barrierMatchesCellEdge(shortcutWall, shortcut.fromCell, shortcut.toCell, board.mazeMetadata.size)) {
          throw new Error(`lvl_11 seed=${seed} lacks a real switch-controlled shortcut`);
        }
      }

      const levelNumber = parseInt(template.id.replace('lvl_', ''), 10);
      if (levelNumber >= 6) {
        if (metrics.safePatrolStarts < 3 || metrics.blockedPatrolStarts < 3) {
          throw new Error(
            `${template.id} seed=${seed} patrol is not meaningful and fair: ` +
            `${metrics.safePatrolStarts} safe / ${metrics.blockedPatrolStarts} blocked starts`
          );
        }
        const solutionPoints = board.mazeMetadata.solutionCells.map(cellKey => {
          const [row, col] = cellKey.split(',').map(Number);
          const step = 88 / board.mazeMetadata.size;
          return { x: 6 + (col + 0.5) * step, y: 6 + (row + 0.5) * step };
        });
        for (const patrol of board.patrols || []) {
          const crossesRoute = patrol.waypoints.some(waypoint =>
            solutionPoints.some(point => Math.hypot(point.x - waypoint.x, point.y - waypoint.y) < 0.1)
          );
          if (!crossesRoute) throw new Error(`${template.id} seed=${seed} patrol "${patrol.id}" never pressures the required route`);
        }
      }
      keys.add(boardGeometryKey(board));
    }
    if (keys.size < 56) {
      throw new Error(`Level "${template.id}" produced only ${keys.size} unique geometries across 64 seeds`);
    }
  }
});

// Test 7: Explicit regression — L5 fire remains a plausible, reachable wrong choice.
runTest('Validate L5 fire branch is drawable (caged-hazard regression)', () => {
  const template = DEFAULT_LEVELS.find(l => l.id === 'lvl_5');
  if (!template) throw new Error('lvl_5 missing');
  for (let seed = 0; seed < 64; seed++) {
    const board = instantiateLevel(template, seed) as GeneratedMazeLevel;
    const fire = board.nodes.find(n => n.id === 'n_fire');
    if (!fire) throw new Error('lvl_5 missing n_fire');
    const access = verifyDistractorsAccessible(board);
    if (!access.ok) {
      throw new Error(`L5 seed=${seed} caged fire: ${access.reason}`);
    }
    const pressure = verifyDistractorPressure(board);
    if (!pressure.ok) throw new Error(`L5 seed=${seed} irrelevant fire: ${pressure.reason}`);
  }
});

runTest('Validate Sparse Pointer Segments Cannot Skip Nodes or Hazards', () => {
  const path = [{ x: 10, y: 50 }, { x: 90, y: 50 }];
  const targets = [
    { id: 'late', x: 70, y: 50 },
    { id: 'early', x: 30, y: 50 },
    { id: 'away', x: 50, y: 70 }
  ];
  const contacts = orderedContactsAlongPath(path, targets, 5);
  if (contacts.map(target => target.id).join('|') !== 'early|late') {
    throw new Error(`Sparse segment contacts were not detected in traversal order`);
  }
  if (!pathTouchesPoint(path, { x: 50, y: 53 }, 5)) {
    throw new Error(`Sparse segment failed to detect a crossed hazard`);
  }
  if (pathTouchesPoint(path, { x: 50, y: 57 }, 5)) {
    throw new Error(`Sparse segment reported a hazard outside the contact radius`);
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
