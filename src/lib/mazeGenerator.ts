import { GameNode, Level, LockedDoor, OneWayGate, Patrol, Wall } from '../types';
import { pathTouchesPolyline } from './pathGeometry';

type Cell = { row: number; col: number };

type MazeProfile = {
  size: number;
  newestBias: number;
  braidChance: number;
  attempts: number;
  minRouteSteps: number;
  minShortestRouteSteps?: number;
  maxShortestRouteSteps?: number;
  minTurns: number;
  minDecisions: number;
  minDecoyDepth: number;
  maxStraightRun: number;
};

export type MazeMetrics = {
  routeSteps: number;
  shortestRouteSteps: number;
  routeLength: number;
  directRatio: number;
  turns: number;
  decisions: number;
  decoyBranches: number;
  deepestDecoy: number;
  longestStraightRun: number;
  bfsExpanded: number;
  /** Patrols whose corridor stays clear of the true solution */
  patrolsClearOfSolution: number;
  /** Patrols seated on a competing decoy corridor (not a decorative stub) */
  patrolsOnCompetingPath: number;
};

export type DistractorPlacement = {
  id: string;
  cell: string;
  attachment: string;
  attachmentIndex: number;
  depth: number;
  stageIndex: number;
  falseRouteSteps: number;
  correctRouteSteps: number;
  appearsTowardTarget: boolean;
  firstBranchCell: string;
  /** Industry decoy-route rule: cell lies on a simple alternate path to the stage target. */
  onCompetingPath: boolean;
  corridorLength: number;
};

export type ShortcutPlacement = {
  fromCell: string;
  toCell: string;
  fromIndex: number;
  toIndex: number;
  skippedSteps: number;
  targetWallId: string;
};

export type GeneratedMazeMetadata = {
  seed: number;
  size: number;
  connections: string[];
  solutionCells: string[];
  distractors: DistractorPlacement[];
  shortcut?: ShortcutPlacement;
  metrics: MazeMetrics;
};

export type GeneratedMazeLevel = Level & {
  mazeMetadata: GeneratedMazeMetadata;
};

const BOARD_MIN = 6;
const BOARD_MAX = 94;

const PROFILES: Record<string, MazeProfile> = {
  lvl_1: { size: 7, newestBias: 0.68, braidChance: 0, attempts: 80, minRouteSteps: 18, minShortestRouteSteps: 10, maxShortestRouteSteps: 17, minTurns: 7, minDecisions: 3, minDecoyDepth: 2, maxStraightRun: 5 },
  lvl_2: { size: 7, newestBias: 0.58, braidChance: 0, attempts: 80, minRouteSteps: 19, minShortestRouteSteps: 18, minTurns: 8, minDecisions: 3, minDecoyDepth: 2, maxStraightRun: 5 },
  lvl_3: { size: 8, newestBias: 0.62, braidChance: 0.04, attempts: 90, minRouteSteps: 23, minTurns: 9, minDecisions: 4, minDecoyDepth: 2, maxStraightRun: 5 },
  lvl_4: { size: 8, newestBias: 0.54, braidChance: 0.05, attempts: 90, minRouteSteps: 24, minTurns: 10, minDecisions: 4, minDecoyDepth: 3, maxStraightRun: 5 },
  lvl_5: { size: 8, newestBias: 0.48, braidChance: 0.06, attempts: 100, minRouteSteps: 25, minTurns: 10, minDecisions: 4, minDecoyDepth: 3, maxStraightRun: 4 },
  lvl_6: { size: 8, newestBias: 0.52, braidChance: 0.05, attempts: 110, minRouteSteps: 27, minTurns: 11, minDecisions: 4, minDecoyDepth: 3, maxStraightRun: 5 },
  lvl_7: { size: 9, newestBias: 0.48, braidChance: 0.07, attempts: 120, minRouteSteps: 30, minTurns: 12, minDecisions: 5, minDecoyDepth: 3, maxStraightRun: 5 },
  lvl_8: { size: 9, newestBias: 0.48, braidChance: 0.07, attempts: 220, minRouteSteps: 30, minTurns: 12, minDecisions: 5, minDecoyDepth: 3, maxStraightRun: 5 },
  lvl_9: { size: 9, newestBias: 0.44, braidChance: 0.08, attempts: 130, minRouteSteps: 30, minTurns: 12, minDecisions: 5, minDecoyDepth: 3, maxStraightRun: 5 },
  lvl_10: { size: 9, newestBias: 0.42, braidChance: 0.09, attempts: 200, minRouteSteps: 34, minTurns: 14, minDecisions: 5, minDecoyDepth: 3, maxStraightRun: 4 },
  lvl_11: { size: 8, newestBias: 0.46, braidChance: 0.08, attempts: 160, minRouteSteps: 20, minTurns: 8, minDecisions: 3, minDecoyDepth: 3, maxStraightRun: 5 },
  lvl_12: { size: 9, newestBias: 0.40, braidChance: 0.1, attempts: 220, minRouteSteps: 35, minTurns: 14, minDecisions: 6, minDecoyDepth: 3, maxStraightRun: 4 }
};

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(seed: number, attempt: number): number {
  let x = (seed ^ Math.imul(attempt + 1, 0x9e3779b1)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}

function key(cell: Cell): string {
  return `${cell.row},${cell.col}`;
}

function parseKey(value: string): Cell {
  const [row, col] = value.split(',').map(Number);
  return { row, col };
}

function edgeKey(a: Cell, b: Cell): string {
  return key(a) < key(b) ? `${key(a)}|${key(b)}` : `${key(b)}|${key(a)}`;
}

function neighbors(cell: Cell, size: number): Cell[] {
  return [
    { row: cell.row - 1, col: cell.col },
    { row: cell.row + 1, col: cell.col },
    { row: cell.row, col: cell.col - 1 },
    { row: cell.row, col: cell.col + 1 }
  ].filter(next => next.row >= 0 && next.row < size && next.col >= 0 && next.col < size);
}

function shuffle<T>(values: T[], rng: () => number): T[] {
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}

function generateTree(size: number, newestBias: number, rng: () => number): Set<string> {
  const start = { row: Math.floor(rng() * size), col: Math.floor(rng() * size) };
  const visited = new Set([key(start)]);
  const active = [start];
  const edges = new Set<string>();

  while (active.length > 0) {
    const index = rng() < newestBias ? active.length - 1 : Math.floor(rng() * active.length);
    const current = active[index];
    const options = shuffle(neighbors(current, size), rng).filter(next => !visited.has(key(next)));
    if (options.length === 0) {
      active.splice(index, 1);
      continue;
    }
    const next = options[0];
    edges.add(edgeKey(current, next));
    visited.add(key(next));
    active.push(next);
  }
  return edges;
}

function adjacency(size: number, edges: Set<string>): Map<string, Cell[]> {
  const graph = new Map<string, Cell[]>();
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) graph.set(`${row},${col}`, []);
  }
  for (const value of edges) {
    const [a, b] = value.split('|').map(parseKey);
    graph.get(key(a))!.push(b);
    graph.get(key(b))!.push(a);
  }
  return graph;
}

function search(graph: Map<string, Cell[]>, start: Cell, goal?: Cell): {
  farthest: Cell;
  distance: Map<string, number>;
  parents: Map<string, string>;
  expanded: number;
} {
  const queue = [start];
  const distance = new Map([[key(start), 0]]);
  const parents = new Map<string, string>();
  let farthest = start;
  let expanded = 0;

  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor];
    expanded++;
    if (goal && key(current) === key(goal)) break;
    if ((distance.get(key(current)) || 0) > (distance.get(key(farthest)) || 0)) farthest = current;
    for (const next of graph.get(key(current)) || []) {
      if (distance.has(key(next))) continue;
      distance.set(key(next), (distance.get(key(current)) || 0) + 1);
      parents.set(key(next), key(current));
      queue.push(next);
    }
  }
  return { farthest, distance, parents, expanded };
}

function pathBetween(graph: Map<string, Cell[]>, start: Cell, goal: Cell): Cell[] {
  const result = search(graph, start, goal);
  if (!result.distance.has(key(goal))) return [];
  const path = [goal];
  let cursor = key(goal);
  while (cursor !== key(start)) {
    cursor = result.parents.get(cursor)!;
    path.push(parseKey(cursor));
  }
  return path.reverse();
}

function shortestAllowedSteps(
  graph: Map<string, Cell[]>,
  start: Cell,
  goal: Cell,
  blocked: Set<string>
): number {
  const queue: Array<{ cell: Cell; steps: number }> = [{ cell: start, steps: 0 }];
  const seen = new Set([key(start)]);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor];
    if (key(current.cell) === key(goal)) return current.steps;
    for (const next of graph.get(key(current.cell)) || []) {
      const token = key(next);
      if (seen.has(token) || (blocked.has(token) && token !== key(goal))) continue;
      seen.add(token);
      queue.push({ cell: next, steps: current.steps + 1 });
    }
  }
  return Number.POSITIVE_INFINITY;
}

function diameter(graph: Map<string, Cell[]>): Cell[] {
  const first = search(graph, { row: 0, col: 0 }).farthest;
  const secondSearch = search(graph, first);
  return pathBetween(graph, first, secondSearch.farthest);
}

function cellPoint(cell: Cell, size: number): { x: number; y: number } {
  const step = (BOARD_MAX - BOARD_MIN) / size;
  return {
    x: BOARD_MIN + (cell.col + 0.5) * step,
    y: BOARD_MIN + (cell.row + 0.5) * step
  };
}

function routeTurns(route: Cell[]): { turns: number; longestStraightRun: number } {
  let turns = 0;
  let run = 1;
  let longestStraightRun = 1;
  for (let i = 2; i < route.length; i++) {
    const prevDirection = `${route[i - 1].row - route[i - 2].row},${route[i - 1].col - route[i - 2].col}`;
    const direction = `${route[i].row - route[i - 1].row},${route[i].col - route[i - 1].col}`;
    if (direction !== prevDirection) {
      turns++;
      run = 1;
    } else {
      run++;
      longestStraightRun = Math.max(longestStraightRun, run);
    }
  }
  return { turns, longestStraightRun };
}

function branchInfo(graph: Map<string, Cell[]>, route: Cell[]): {
  decisions: number;
  decoyBranches: number;
  deepestDecoy: number;
  offRoute: Array<{ cell: Cell; attachment: string; depth: number }>;
} {
  const routeSet = new Set(route.map(key));
  const offRoute: Array<{ cell: Cell; attachment: string; depth: number }> = [];
  let decisions = 0;
  let decoyBranches = 0;
  let deepestDecoy = 0;

  route.forEach((routeCell, index) => {
    if (index === 0 || index === route.length - 1) return;
    const roots = (graph.get(key(routeCell)) || []).filter(next => !routeSet.has(key(next)));
    if (roots.length > 0) decisions++;
    for (const root of roots) {
      decoyBranches++;
      const queue = [{ cell: root, depth: 1 }];
      const seen = new Set([...routeSet, key(root)]);
      for (let cursor = 0; cursor < queue.length; cursor++) {
        const current = queue[cursor];
        offRoute.push({ cell: current.cell, attachment: key(routeCell), depth: current.depth });
        deepestDecoy = Math.max(deepestDecoy, current.depth);
        for (const next of graph.get(key(current.cell)) || []) {
          if (seen.has(key(next))) continue;
          seen.add(key(next));
          queue.push({ cell: next, depth: current.depth + 1 });
        }
      }
    }
  });

  return { decisions, decoyBranches, deepestDecoy, offRoute };
}

function addOffRouteBraids(
  size: number,
  edges: Set<string>,
  route: Cell[],
  chance: number,
  rng: () => number
): void {
  if (chance <= 0) return;
  const routeSet = new Set(route.map(key));
  const graph = adjacency(size, edges);
  const component = new Map<string, string>();
  for (const routeCell of route) {
    for (const root of graph.get(key(routeCell)) || []) {
      if (routeSet.has(key(root)) || component.has(key(root))) continue;
      const queue = [root];
      component.set(key(root), key(routeCell));
      for (let cursor = 0; cursor < queue.length; cursor++) {
        for (const next of graph.get(key(queue[cursor])) || []) {
          if (routeSet.has(key(next)) || component.has(key(next))) continue;
          component.set(key(next), key(routeCell));
          queue.push(next);
        }
      }
    }
  }
  const closed: Array<[Cell, Cell]> = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const current = { row, col };
      for (const next of [{ row: row + 1, col }, { row, col: col + 1 }]) {
        if (next.row >= size || next.col >= size) continue;
        if (
          !edges.has(edgeKey(current, next)) &&
          !routeSet.has(key(current)) &&
          !routeSet.has(key(next)) &&
          component.get(key(current)) === component.get(key(next))
        ) {
          closed.push([current, next]);
        }
      }
    }
  }
  shuffle(closed, rng);
  const limit = Math.max(0, Math.round(closed.length * chance));
  for (let i = 0; i < limit; i++) edges.add(edgeKey(closed[i][0], closed[i][1]));
}

function chooseRequiredCells(route: Cell[], requiredIds: string[]): Map<string, Cell> {
  const placements = new Map<string, Cell>();
  const last = route.length - 1;
  requiredIds.forEach((id, index) => {
    const routeIndex = Math.round((index / (requiredIds.length - 1)) * last);
    placements.set(id, route[routeIndex]);
  });
  return placements;
}

function manhattan(a: Cell, b: Cell): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}


/**
 * True when `cell` lies on some *simple* path from→to (a real corridor), not a dead-end spur.
 * Concatenating from→cell and cell→to must not revisit vertices — the industry test that
 * separates decoy routes from decorative cul-de-sacs (Mejía; Think Labyrinth enticements).
 */
function liesOnSimplePath(graph: Map<string, Cell[]>, from: Cell, to: Cell, cell: Cell): boolean {
  if (key(cell) === key(from) || key(cell) === key(to)) return false;
  const head = pathBetween(graph, from, cell);
  const tail = pathBetween(graph, cell, to);
  if (head.length < 2 || tail.length < 2) return false;
  const seen = new Set(head.map(key));
  for (const step of tail.slice(1)) {
    if (seen.has(key(step))) return false;
  }
  return true;
}

/**
 * Carve competing decoy corridors (false solution paths) between consecutive required stops.
 * Path-maze best practice: one correct route + alternate routes that still reach the target;
 * hazards/landmarks sit ON those alternate routes, never on ignored short dead ends.
 */
function ensureCompetingCorridors(
  size: number,
  edges: Set<string>,
  route: Cell[],
  requiredCells: Cell[],
  count: number,
  rng: () => number,
  preferRightward = false
): number {
  if (requiredCells.length < 2 || count <= 0) return 0;
  const routeIndex = new Map(route.map((cell, index) => [key(cell), index]));
  const requiredIndices = requiredCells
    .map(cell => routeIndex.get(key(cell)) ?? -1)
    .filter(index => index >= 0)
    .sort((a, b) => a - b);
  if (requiredIndices.length < 2) return 0;

  let carved = 0;
  const stageLimit = Math.min(2, requiredIndices.length - 1);
  for (let stage = 0; stage < stageLimit && carved < count; stage++) {
    const fromIdx = requiredIndices[stage];
    const toIdx = requiredIndices[stage + 1];
    if (toIdx - fromIdx < 4) continue;
    const blocked = new Set(route.slice(fromIdx + 1, toIdx).map(key));

    for (let attempt = 0; attempt < 28 && carved < count; attempt++) {
      const span = toIdx - fromIdx;
      const diverge =
        fromIdx + 1 + Math.floor(rng() * Math.max(1, Math.floor(span * 0.35)));
      const rejoin =
        toIdx - 1 - Math.floor(rng() * Math.max(1, Math.floor(span * 0.35)));
      if (rejoin - diverge < 3) continue;

      const start = route[diverge];
      const end = route[rejoin];
      // Grid BFS through cells that are not the intended interior — open walls along path.
      const queue = [start];
      const parents = new Map<string, string | null>([[key(start), null]]);
      for (let cursor = 0; cursor < queue.length; cursor++) {
        const current = queue[cursor];
        if (key(current) === key(end)) break;
        let opts = shuffle(neighbors(current, size), rng);
        if (preferRightward) {
          opts = [...opts].sort((a, b) => b.col - a.col);
        }
        for (const next of opts) {
          const token = key(next);
          if (parents.has(token)) continue;
          if (blocked.has(token) && token !== key(end)) continue;
          parents.set(token, key(current));
          queue.push(next);
        }
      }
      if (!parents.has(key(end))) continue;

      const path: Cell[] = [];
      let walk: string | null = key(end);
      while (walk) {
        path.push(parseKey(walk));
        walk = parents.get(walk) ?? null;
      }
      path.reverse();
      const offRoute = path.filter(cell => !route.some(r => key(r) === key(cell)));
      // Need a real corridor (not a one-cell jog) and avoid ultra-short chords that trivialize.
      if (offRoute.length < 2) continue;
      if (path.length - 1 < Math.max(4, Math.floor((rejoin - diverge) * 0.75))) continue;

      for (let i = 1; i < path.length; i++) {
        edges.add(edgeKey(path[i - 1], path[i]));
      }
      carved++;
    }
  }
  return carved;
}

/**
 * True when actor can still reach home if `checkpoint` (and optional forbidden cells)
 * are removed from the graph. Order missions (先…再…) need a *clean* skip route so
 * "go home first" fails as wrong_order — not only via a path that also hits 草/火.
 */
function canReachWhileSkipping(
  graph: Map<string, Cell[]>,
  actor: Cell,
  home: Cell,
  checkpoint: Cell,
  alsoBlocked: Set<string> = new Set()
): boolean {
  const blocked = new Set(alsoBlocked);
  blocked.add(key(checkpoint));
  blocked.delete(key(actor));
  blocked.delete(key(home));
  return Number.isFinite(shortestAllowedSteps(graph, actor, home, blocked));
}

/**
 * Carve detours that bypass each intermediate required stop so home remains
 * reachable without visiting that stop. Competing stage corridors alone do not
 * guarantee this — they reconnect toward the next checkpoint, not around it.
 */
function ensureOrderSkipBypasses(
  size: number,
  edges: Set<string>,
  route: Cell[],
  requiredCells: Cell[],
  rng: () => number
): number {
  if (requiredCells.length < 3) return 0;
  const actor = requiredCells[0];
  const home = requiredCells[requiredCells.length - 1];
  const routeIndex = new Map(route.map((cell, index) => [key(cell), index]));
  let carved = 0;

  for (let i = 1; i < requiredCells.length - 1; i++) {
    const checkpoint = requiredCells[i];
    const cpIdx = routeIndex.get(key(checkpoint));
    if (cpIdx == null || cpIdx < 2 || cpIdx > route.length - 3) continue;

    let graph = adjacency(size, edges);
    if (canReachWhileSkipping(graph, actor, home, checkpoint)) continue;

    const blockedCheckpoint = key(checkpoint);
    for (let attempt = 0; attempt < 36; attempt++) {
      const beforeSpan = Math.max(1, Math.floor(cpIdx * 0.45));
      const afterSpan = Math.max(1, Math.floor((route.length - 1 - cpIdx) * 0.45));
      const diverge = Math.max(1, cpIdx - 1 - Math.floor(rng() * beforeSpan));
      const rejoin = Math.min(route.length - 2, cpIdx + 1 + Math.floor(rng() * afterSpan));
      if (rejoin - diverge < 3) continue;

      const start = route[diverge];
      const end = route[rejoin];
      const queue = [start];
      const parents = new Map<string, string | null>([[key(start), null]]);
      for (let cursor = 0; cursor < queue.length; cursor++) {
        const current = queue[cursor];
        if (key(current) === key(end)) break;
        for (const next of shuffle(neighbors(current, size), rng)) {
          const token = key(next);
          if (parents.has(token) || token === blockedCheckpoint) continue;
          parents.set(token, key(current));
          queue.push(next);
        }
      }
      if (!parents.has(key(end))) continue;

      const path: Cell[] = [];
      let walk: string | null = key(end);
      while (walk) {
        path.push(parseKey(walk));
        walk = parents.get(walk) ?? null;
      }
      path.reverse();
      if (path.some(cell => key(cell) === blockedCheckpoint)) continue;
      const offRoute = path.filter(cell => !route.some(r => key(r) === key(cell)));
      if (offRoute.length < 2) continue;
      if (path.length - 1 < 4) continue;

      for (let step = 1; step < path.length; step++) {
        edges.add(edgeKey(path[step - 1], path[step]));
      }
      carved++;
      graph = adjacency(size, edges);
      if (canReachWhileSkipping(graph, actor, home, checkpoint)) break;
    }
  }
  return carved;
}

/**
 * Every intermediate required stop must be skippable on some actor→home route.
 * Pass `alsoBlocked` (forbidden/distractor cells) after placement so the skip
 * route is drawable without also triggering wrong_target.
 */
function orderCheckpointsSkippable(
  graph: Map<string, Cell[]>,
  requiredCells: Cell[],
  alsoBlocked: Set<string> = new Set()
): boolean {
  if (requiredCells.length < 3) return true;
  const actor = requiredCells[0];
  const home = requiredCells[requiredCells.length - 1];
  for (let i = 1; i < requiredCells.length - 1; i++) {
    if (!canReachWhileSkipping(graph, actor, home, requiredCells[i], alsoBlocked)) {
      return false;
    }
  }
  return true;
}

type CorridorCandidate = {
  cell: Cell;
  attachment: Cell;
  attachmentIndex: number;
  depth: number;
  stageIndex: number;
  corridorLength: number;
  falseRouteSteps: number;
  correctRouteSteps: number;
  appearsTowardTarget: boolean;
  firstBranchCell: Cell;
};

/**
 * Place avoid-targets on competing decoy corridors — industry path-maze practice
 * (TeachAny path mazes, Think Labyrinth enticements, DoYouMaze false paths):
 * distractors sit on alternate routes that still reach the next required node.
 */
function chooseDistractorCells(
  nodes: GameNode[],
  requiredIds: Set<string>,
  placements: Map<string, Cell>,
  levelId: string,
  route: Cell[],
  graph: Map<string, Cell[]>,
  rng: () => number,
  preferredWindow?: { minIndex: number; maxIndex: number },
  shortcut?: ShortcutPlacement | null
): DistractorPlacement[] | null {
  const distractors = nodes.filter(node => !requiredIds.has(node.id));
  const routeIndex = new Map(route.map((cell, index) => [key(cell), index]));
  const requiredRouteIndices = [...requiredIds]
    .map(id => ({ id, index: routeIndex.get(key(placements.get(id)!)) ?? -1 }))
    .filter(item => item.index >= 0)
    .sort((a, b) => a.index - b.index);
  if (requiredRouteIndices.length < 2) return null;

  const intendedSet = new Set(route.map(key));
  const actor = placements.get(nodes.find(node => node.type === 'actor')?.id || '');
  const goal = placements.get(nodes.find(node => node.type === 'goal')?.id || '');
  const chosen: DistractorPlacement[] = [];
  const used = new Set<string>();
  const usedAttachments = new Set<string>();
  const routeLast = Math.max(1, route.length - 1);
  const windowMin = preferredWindow?.minIndex ?? Math.floor(routeLast * 0.08);
  const windowMax = preferredWindow?.maxIndex ?? Math.floor(routeLast * 0.55);

  const ordered = [
    ...distractors.filter(node => node.type === 'hazard'),
    ...distractors.filter(node => node.type !== 'hazard')
  ];

  const collectCorridorCandidates = (stageIndex: number): CorridorCandidate[] => {
    const stageStart = requiredRouteIndices[stageIndex].index;
    const stageEnd = requiredRouteIndices[stageIndex + 1].index;
    const from = route[stageStart];
    const to = route[stageEnd];
    const stageLength = Math.max(1, stageEnd - stageStart);
    const aim = preferredWindow
      ? (goal || to)
      : (goal && stageIndex === requiredRouteIndices.length - 2 ? goal : to);
    const out: CorridorCandidate[] = [];

    // L11: the long-way diameter between shortcut ends is itself a competing path solution.
    if (shortcut) {
      for (let i = shortcut.fromIndex + 1; i < shortcut.toIndex; i++) {
        const cell = route[i];
        if (used.has(key(cell))) continue;
        const attachIdx = shortcut.fromIndex;
        if (attachIdx < windowMin || attachIdx > windowMax) continue;
        const first = route[Math.min(shortcut.fromIndex + 1, route.length - 1)];
        out.push({
          cell,
          attachment: route[attachIdx],
          attachmentIndex: attachIdx,
          depth: Math.min(i - shortcut.fromIndex, shortcut.toIndex - i),
          stageIndex,
          corridorLength: shortcut.toIndex - shortcut.fromIndex,
          falseRouteSteps: Math.max(stageLength, shortcut.toIndex - shortcut.fromIndex),
          correctRouteSteps: stageLength,
          appearsTowardTarget: true,
          firstBranchCell: first
        });
      }
    }

    for (const token of graph.keys()) {
      if (intendedSet.has(token)) continue;
      const cell = parseKey(token);
      if (used.has(token)) continue;
      if (!liesOnSimplePath(graph, from, to, cell)) continue;

      const via = pathBetween(graph, from, cell);
      if (via.length < 2) continue;
      // Attachment = last intended-route cell before leaving onto the decoy corridor.
      let attachment = from;
      let attachmentIndex = stageStart;
      for (const step of via) {
        const idx = routeIndex.get(key(step));
        if (idx != null && idx >= stageStart && idx <= stageEnd) {
          attachment = step;
          attachmentIndex = idx;
        } else {
          break;
        }
      }
      if (attachmentIndex < windowMin || attachmentIndex > windowMax) continue;
      if (!preferredWindow && attachmentIndex / routeLast > 0.55) continue;
      if (!preferredWindow) {
        const progress = (attachmentIndex - stageStart) / stageLength;
        if (progress < 0.05 || progress > 0.85) continue;
      }

      const leavePath = pathBetween(graph, attachment, cell);
      if (leavePath.length < 2) continue;
      const firstBranchCell = leavePath[1];
      const depth = leavePath.length - 1;
      if (depth < 1 || depth > 5) continue;

      const tail = pathBetween(graph, cell, to);
      const corridorLength = via.length - 1 + Math.max(0, tail.length - 1);
      if (corridorLength < 3) continue;

      let appearsTowardTarget = manhattan(firstBranchCell, aim) < manhattan(
        route[Math.min(attachmentIndex + 1, route.length - 1)],
        aim
      );
      if (levelId === 'lvl_8' && actor) {
        appearsTowardTarget = firstBranchCell.col > attachment.col || cell.col > actor.col;
      }
      if (levelId === 'lvl_9') {
        appearsTowardTarget = firstBranchCell.row < attachment.row || cell.row < attachment.row;
      }
      if (!appearsTowardTarget) continue;

      out.push({
        cell,
        attachment,
        attachmentIndex,
        depth,
        stageIndex,
        corridorLength,
        falseRouteSteps: corridorLength,
        correctRouteSteps: stageLength,
        appearsTowardTarget,
        firstBranchCell
      });
    }
    return out;
  };

  for (let distractorOrdinal = 0; distractorOrdinal < ordered.length; distractorOrdinal++) {
    const node = ordered[distractorOrdinal];
    const scored: Array<{ candidate: CorridorCandidate; score: number; placement: DistractorPlacement }> = [];

    const stageOptions: number[] = [];
    if (preferredWindow) {
      for (let s = 0; s < requiredRouteIndices.length - 1; s++) stageOptions.push(s);
    } else {
      stageOptions.push(0);
      if (distractorOrdinal > 0 && requiredRouteIndices.length > 2) stageOptions.push(1);
    }

    for (const stageIndex of stageOptions) {
      for (const candidate of collectCorridorCandidates(stageIndex)) {
        if (used.has(key(candidate.cell)) || usedAttachments.has(key(candidate.attachment))) continue;
        if (
          levelId === 'lvl_8' &&
          actor &&
          (node.id === 'n_right' || node.id === 'n_fire') &&
          candidate.cell.col <= actor.col
        ) {
          continue;
        }
        if (levelId === 'lvl_9' && node.id === 'n_wrong_chk' && candidate.firstBranchCell.row >= candidate.attachment.row) {
          continue;
        }

        const competitive = candidate.falseRouteSteps <= candidate.correctRouteSteps * 1.15;
        const earlyBonus = (1 - candidate.attachmentIndex / routeLast) * 12;
        const corridorBonus = Math.min(18, candidate.corridorLength * 2);
        const midBonus = candidate.depth >= 2 && candidate.depth <= 4 ? 10 : 4;
        const competitiveBonus = competitive ? 8 : 0;
        const score = earlyBonus + corridorBonus + midBonus + competitiveBonus + 16 + rng();
        scored.push({
          candidate,
          score,
          placement: {
            id: node.id,
            cell: key(candidate.cell),
            attachment: key(candidate.attachment),
            attachmentIndex: candidate.attachmentIndex,
            depth: candidate.depth,
            stageIndex: candidate.stageIndex,
            falseRouteSteps: candidate.falseRouteSteps,
            correctRouteSteps: candidate.correctRouteSteps,
            appearsTowardTarget: candidate.appearsTowardTarget,
            firstBranchCell: key(candidate.firstBranchCell),
            onCompetingPath: true,
            corridorLength: candidate.corridorLength
          }
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const choice = scored[0];
    if (!choice) return null;
    placements.set(node.id, choice.candidate.cell);
    used.add(key(choice.candidate.cell));
    usedAttachments.add(key(choice.candidate.attachment));
    chosen.push(choice.placement);
  }

  return chosen;
}

function makeWalls(size: number, edges: Set<string>): Wall[] {
  const horizontal = Array.from({ length: size + 1 }, () => Array(size).fill(false));
  const vertical = Array.from({ length: size }, () => Array(size + 1).fill(false));
  for (let col = 0; col < size; col++) {
    horizontal[0][col] = true;
    horizontal[size][col] = true;
  }
  for (let row = 0; row < size; row++) {
    vertical[row][0] = true;
    vertical[row][size] = true;
  }
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const current = { row, col };
      if (row + 1 < size && !edges.has(edgeKey(current, { row: row + 1, col }))) horizontal[row + 1][col] = true;
      if (col + 1 < size && !edges.has(edgeKey(current, { row, col: col + 1 }))) vertical[row][col + 1] = true;
    }
  }

  const step = (BOARD_MAX - BOARD_MIN) / size;
  const walls: Wall[] = [];
  for (let row = 0; row <= size; row++) {
    let start = -1;
    for (let col = 0; col <= size; col++) {
      const closed = col < size && horizontal[row][col];
      if (closed && start < 0) start = col;
      if (!closed && start >= 0) {
        walls.push({
          id: `maze_h_${row}_${start}_${col}`,
          x1: BOARD_MIN + start * step,
          y1: BOARD_MIN + row * step,
          x2: BOARD_MIN + col * step,
          y2: BOARD_MIN + row * step
        });
        start = -1;
      }
    }
  }
  for (let col = 0; col <= size; col++) {
    let start = -1;
    for (let row = 0; row <= size; row++) {
      const closed = row < size && vertical[row][col];
      if (closed && start < 0) start = row;
      if (!closed && start >= 0) {
        walls.push({
          id: `maze_v_${col}_${start}_${row}`,
          x1: BOARD_MIN + col * step,
          y1: BOARD_MIN + start * step,
          x2: BOARD_MIN + col * step,
          y2: BOARD_MIN + row * step
        });
        start = -1;
      }
    }
  }
  return walls;
}

function edgeBarrier(a: Cell, b: Cell, size: number): Omit<Wall, 'id'> {
  const step = (BOARD_MAX - BOARD_MIN) / size;
  if (a.row !== b.row) {
    const row = Math.max(a.row, b.row);
    return {
      x1: BOARD_MIN + a.col * step,
      y1: BOARD_MIN + row * step,
      x2: BOARD_MIN + (a.col + 1) * step,
      y2: BOARD_MIN + row * step
    };
  }
  const col = Math.max(a.col, b.col);
  return {
    x1: BOARD_MIN + col * step,
    y1: BOARD_MIN + a.row * step,
    x2: BOARD_MIN + col * step,
    y2: BOARD_MIN + (a.row + 1) * step
  };
}

function routeEdgeAfter(route: Cell[], placements: Map<string, Cell>, nodeId: string, offset = 1): [Cell, Cell] | null {
  const cell = placements.get(nodeId);
  if (!cell) return null;
  const index = route.findIndex(candidate => key(candidate) === key(cell));
  const edgeIndex = Math.min(route.length - 2, index + offset);
  if (edgeIndex < 0 || edgeIndex >= route.length - 1) return null;
  return [route[edgeIndex], route[edgeIndex + 1]];
}

function addSwitchShortcut(
  template: Level,
  route: Cell[],
  placements: Map<string, Cell>,
  edges: Set<string>
): ShortcutPlacement | null {
  if (template.id !== 'lvl_11' || !template.switches?.length) return null;
  const trigger = template.switches[0];
  const switchCell = placements.get(trigger.nodeId);
  if (!switchCell) return null;
  const switchIndex = route.findIndex(cell => key(cell) === key(switchCell));
  const candidates: ShortcutPlacement[] = [];
  for (let fromIndex = switchIndex; fromIndex <= Math.min(route.length - 6, switchIndex + 4); fromIndex++) {
    for (let toIndex = fromIndex + 5; toIndex < route.length; toIndex++) {
      const from = route[fromIndex];
      const to = route[toIndex];
      const adjacent = Math.abs(from.row - to.row) + Math.abs(from.col - to.col) === 1;
      if (!adjacent || edges.has(edgeKey(from, to))) continue;
      candidates.push({
        fromCell: key(from),
        toCell: key(to),
        fromIndex,
        toIndex,
        skippedSteps: toIndex - fromIndex - 1,
        targetWallId: trigger.targetWallId
      });
    }
  }
  candidates.sort((a, b) => b.skippedSteps - a.skippedSteps);
  const shortcut = candidates[0];
  if (!shortcut) return null;
  edges.add(edgeKey(parseKey(shortcut.fromCell), parseKey(shortcut.toCell)));
  return shortcut;
}

function makeSpecialBarriers(
  template: Level,
  route: Cell[],
  placements: Map<string, Cell>,
  size: number,
  walls: Wall[],
  distractors: DistractorPlacement[],
  shortcut: ShortcutPlacement | null
): { lockedDoors: LockedDoor[]; oneWayGates: OneWayGate[]; valid: boolean } {
  const lockedDoors: LockedDoor[] = [];
  for (const door of template.lockedDoors || []) {
    const edge = routeEdgeAfter(route, placements, door.keyNodeId);
    if (!edge) return { lockedDoors, oneWayGates: [], valid: false };
    lockedDoors.push({ ...door, ...edgeBarrier(edge[0], edge[1], size) });
  }

  for (const trigger of template.switches || []) {
    const edge = shortcut && shortcut.targetWallId === trigger.targetWallId
      ? [parseKey(shortcut.fromCell), parseKey(shortcut.toCell)] as [Cell, Cell]
      : routeEdgeAfter(route, placements, trigger.nodeId);
    if (!edge) return { lockedDoors, oneWayGates: [], valid: false };
    walls.push({ id: trigger.targetWallId, ...edgeBarrier(edge[0], edge[1], size) });
  }

  const oneWayGates: OneWayGate[] = [];
  for (const gate of template.oneWayGates || []) {
    let selected: [Cell, Cell] | undefined;
    if (template.id === 'lvl_9' && gate.id === 'g_left') {
      const wrong = distractors.find(item => item.id === 'n_wrong_chk');
      if (wrong) selected = [parseKey(wrong.attachment), parseKey(wrong.firstBranchCell)];
    }
    const safeCell = template.id === 'lvl_9' ? placements.get('n_safe_chk') : undefined;
    const keyCell = template.id === 'lvl_12' ? placements.get('n_key') : undefined;
    const safeIndex = safeCell ? route.findIndex(cell => key(cell) === key(safeCell)) : route.length - 1;
    const keyIndex = keyCell ? route.findIndex(cell => key(cell) === key(keyCell)) : 0;
    for (let i = keyIndex; !selected && i < Math.min(route.length - 1, safeIndex); i++) {
      const a = route[i];
      const b = route[i + 1];
      const direction =
        b.row > a.row ? 'down' :
        b.row < a.row ? 'up' :
        b.col > a.col ? 'right' : 'left';
      if (direction === gate.allowDirection) {
        selected = [a, b];
      }
    }
    if (!selected) return { lockedDoors, oneWayGates, valid: false };
    oneWayGates.push({ ...gate, ...edgeBarrier(selected[0], selected[1], size) });
  }
  return { lockedDoors, oneWayGates, valid: true };
}

/**
 * Grow an off-route cell chain from a branch root (never re-entering the solution).
 */
function growOffRouteCorridor(
  graph: Map<string, Cell[]>,
  routeSet: Set<string>,
  start: Cell,
  maxLen: number,
  rng: () => number
): Cell[] {
  const path = [start];
  const used = new Set([key(start)]);
  while (path.length < maxLen) {
    const cur = path[path.length - 1];
    const nexts = shuffle(
      (graph.get(key(cur)) || []).filter(n => !routeSet.has(key(n)) && !used.has(key(n))),
      rng
    );
    if (nexts.length === 0) break;
    used.add(key(nexts[0]));
    path.push(nexts[0]);
  }
  return path;
}

type PatrolCorridorCandidate = {
  attachmentIndex: number;
  cells: Cell[];
};

/**
 * Collect competing decoy corridors (same rule as distractors): off-route chains
 * on a simple alternate path between consecutive required stops.
 */
function collectPatrolCorridors(
  graph: Map<string, Cell[]>,
  route: Cell[],
  requiredIds: string[],
  placements: Map<string, Cell>,
  rng: () => number
): PatrolCorridorCandidate[] {
  const routeIndex = new Map(route.map((cell, index) => [key(cell), index]));
  const requiredRouteIndices = requiredIds
    .map(id => ({ id, index: routeIndex.get(key(placements.get(id)!)) ?? -1 }))
    .filter(item => item.index >= 0)
    .sort((a, b) => a.index - b.index);
  if (requiredRouteIndices.length < 2) return [];

  const intendedSet = new Set(route.map(key));
  const out: PatrolCorridorCandidate[] = [];
  const routeLast = Math.max(1, route.length - 1);
  const stageLimit = requiredRouteIndices.length - 1;

  for (let stage = 0; stage < stageLimit; stage++) {
    const stageStart = requiredRouteIndices[stage].index;
    const stageEnd = requiredRouteIndices[stage + 1].index;
    const from = route[stageStart];
    const to = route[stageEnd];

    for (const token of graph.keys()) {
      if (intendedSet.has(token)) continue;
      const cell = parseKey(token);
      if (!liesOnSimplePath(graph, from, to, cell)) continue;

      const via = pathBetween(graph, from, cell);
      if (via.length < 2) continue;
      let attachment = from;
      let attachmentIndex = stageStart;
      for (const step of via) {
        const idx = routeIndex.get(key(step));
        if (idx != null && idx >= stageStart && idx <= stageEnd) {
          attachment = step;
          attachmentIndex = idx;
        } else {
          break;
        }
      }
      const frac = attachmentIndex / routeLast;
      if (frac < 0.08 || frac > 0.55) continue;

      const leavePath = pathBetween(graph, attachment, cell);
      // leavePath[0] is on-route; seat the patrol only on off-route cells.
      const cells = leavePath.slice(1);
      if (cells.length < 3) {
        // Extend along the alternate toward `to` while staying off the intended interior.
        const toward = pathBetween(graph, cell, to);
        for (const step of toward.slice(1)) {
          if (intendedSet.has(key(step))) break;
          if (cells.some(c => key(c) === key(step))) continue;
          cells.push(step);
          if (cells.length >= 4) break;
        }
      }
      if (cells.length < 3) continue;

      // Prefer a stable 3–5 cell corridor for readable tension.
      const trimmed = cells.slice(0, Math.min(5, cells.length));
      out.push({ attachmentIndex, cells: trimmed });
    }
  }

  shuffle(out, rng);
  // Deduplicate by attachment so two patrols don't stack on one junction.
  const seen = new Set<number>();
  const unique: PatrolCorridorCandidate[] = [];
  for (const candidate of out) {
    if (seen.has(candidate.attachmentIndex)) continue;
    seen.add(candidate.attachmentIndex);
    unique.push(candidate);
  }
  return unique;
}

function patrolClearOfSolution(patrol: Patrol, route: Cell[], size: number): boolean {
  const solution = route.map(cell => cellPoint(cell, size));
  return !pathTouchesPolyline(solution, patrol.waypoints, patrol.radius, true);
}

/**
 * Seat catchers on competing decoy corridors — never on the true solution.
 * Motion remains for visual tension; fail/success is route geometry only.
 */
function makePatrols(
  template: Level,
  graph: Map<string, Cell[]>,
  intendedRoute: Cell[],
  size: number,
  rng: () => number,
  placements: Map<string, Cell>,
  fullRoute: Cell[] = intendedRoute,
  shortcut: ShortcutPlacement | null = null
): Patrol[] | null {
  const templates = template.patrols || [];
  if (templates.length === 0) return [];

  let candidates = collectPatrolCorridors(
    graph,
    intendedRoute,
    template.requiredNodeIds,
    placements,
    rng
  );

  // Shortcut rooms: the long-way diameter is the competing corridor (same as L11 fire).
  if (shortcut) {
    const longLen = shortcut.toIndex - shortcut.fromIndex - 1;
    if (longLen >= 3) {
      const cells = fullRoute.slice(
        shortcut.fromIndex + 1,
        shortcut.fromIndex + 1 + Math.min(5, longLen)
      );
      if (cells.length >= 3) {
        candidates = [{ attachmentIndex: shortcut.fromIndex, cells }, ...candidates];
      }
    }
  }

  if (candidates.length < templates.length) {
    const more = collectPatrolCorridors(
      graph,
      fullRoute,
      template.requiredNodeIds,
      placements,
      rng
    );
    candidates = [...candidates, ...more];
  }

  // Deduplicate attachments again after merges.
  const deduped: PatrolCorridorCandidate[] = [];
  const seenAttach = new Set<number>();
  for (const candidate of candidates) {
    if (seenAttach.has(candidate.attachmentIndex)) continue;
    seenAttach.add(candidate.attachmentIndex);
    deduped.push(candidate);
  }
  candidates = deduped;

  // Dual-patrol rooms: split long decoy corridors into a second seat when needed.
  if (candidates.length < templates.length) {
    const extras: PatrolCorridorCandidate[] = [];
    for (const candidate of candidates) {
      if (candidate.cells.length >= 5) {
        extras.push({ attachmentIndex: candidate.attachmentIndex, cells: candidate.cells.slice(2) });
      } else if (candidate.cells.length >= 4) {
        extras.push({ attachmentIndex: candidate.attachmentIndex, cells: candidate.cells.slice(1) });
      }
    }
    for (const extra of extras) {
      if (candidates.length >= templates.length) break;
      candidates.push(extra);
    }
  }

  // Last resort: deep off-route spurs at early–mid junctions (readable wrong turns).
  if (candidates.length < templates.length) {
    const routeSet = new Set(intendedRoute.map(key));
    const routeLast = Math.max(1, intendedRoute.length - 1);
    const usedCells = new Set(candidates.flatMap(c => c.cells.map(key)));
    for (let i = 2; i < intendedRoute.length - 2 && candidates.length < templates.length + 4; i++) {
      const frac = i / routeLast;
      if (frac < 0.08 || frac > 0.58) continue;
      const roots = shuffle(
        (graph.get(key(intendedRoute[i])) || []).filter(n => !routeSet.has(key(n))),
        rng
      );
      for (const root of roots) {
        const cells = growOffRouteCorridor(graph, routeSet, root, 5, rng);
        if (cells.length < 3) continue;
        if (cells.every(c => usedCells.has(key(c)))) continue;
        for (const c of cells) usedCells.add(key(c));
        candidates.push({ attachmentIndex: i, cells });
        break;
      }
    }
  }

  if (candidates.length < templates.length) return null;

  const usedSeats = new Set<string>();
  const patrols: Patrol[] = [];

  for (const patrolTemplate of templates) {
    let placed: Patrol | null = null;
    for (const pick of candidates) {
      const seat = `${pick.attachmentIndex}:${pick.cells.map(key).join('|')}`;
      if (usedSeats.has(seat)) continue;

      const forward = pick.cells.map(cell => cellPoint(cell, size));
      const waypoints =
        forward.length >= 4
          ? forward
          : [...forward, ...[...forward].reverse().slice(1, -1)];
      if (waypoints.length < 2) continue;

      const radius = Math.min(patrolTemplate.radius, ((BOARD_MAX - BOARD_MIN) / size) * 0.42);
      const patrol: Patrol = {
        ...patrolTemplate,
        waypoints,
        radius,
        phase: rng() * 5
      };
      if (!patrolClearOfSolution(patrol, intendedRoute, size)) continue;
      usedSeats.add(seat);
      placed = patrol;
      break;
    }
    if (!placed) return null;
    patrols.push(placed);
  }

  return patrols;
}

const WALL_THICKNESS = 2.6;

function segmentsCrossOrNear(
  ax: number, ay: number, bx: number, by: number,
  x1: number, y1: number, x2: number, y2: number,
  thickness = WALL_THICKNESS
): boolean {
  const dist = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) => {
    const dx = rx - qx;
    const dy = ry - qy;
    if (dx === 0 && dy === 0) return Math.hypot(px - qx, py - qy);
    let u = ((px - qx) * dx + (py - qy) * dy) / (dx * dx + dy * dy);
    u = Math.max(0, Math.min(1, u));
    return Math.hypot(px - (qx + u * dx), py - (qy + u * dy));
  };
  const s1x = bx - ax;
  const s1y = by - ay;
  const s2x = x2 - x1;
  const s2y = y2 - y1;
  const den = -s2x * s1y + s1x * s2y;
  if (Math.abs(den) >= 1e-8) {
    const s = (-s1y * (ax - x1) + s1x * (ay - y1)) / den;
    const t = (s2x * (ay - y1) - s2y * (ax - x1)) / den;
    if (s >= 0 && s <= 1 && t >= 0 && t <= 1) return true;
  }
  return (
    dist(ax, ay, x1, y1, x2, y2) < thickness ||
    dist(bx, by, x1, y1, x2, y2) < thickness ||
    dist(x1, y1, ax, ay, bx, by) < thickness ||
    dist(x2, y2, ax, ay, bx, by) < thickness
  );
}

/** Thick-wall BFS matching GameCanvas — reject boards players cannot actually draw. */
function verifyDrawableSolvable(level: Level): { ok: boolean; length?: number; reason?: string } {
  const actor = level.nodes.find(n => n.type === 'actor');
  const goal = level.nodes.find(n => n.type === 'goal');
  if (!actor || !goal) return { ok: false, reason: 'missing actor/goal' };

  const GRID = 50;
  const cell = 100 / GRID;
  const walls = level.walls || [];
  const doors = level.lockedDoors || [];
  const gates = level.oneWayGates || [];
  const forbid = level.forbiddenNodeIds || [];

  const bfs = (
    start: { x: number; y: number },
    end: { x: number; y: number },
    keys: string[],
    switches: string[],
    allowTouch: string[] = []
  ): number | null => {
    const sgx = Math.floor(start.x / cell);
    const sgy = Math.floor(start.y / cell);
    const egx = Math.floor(end.x / cell);
    const egy = Math.floor(end.y / cell);
    const inactive = (level.switches || [])
      .filter(sw => switches.includes(sw.nodeId))
      .map(sw => sw.targetWallId);
    const queue = [{ gx: sgx, gy: sgy, length: 0 }];
    const visited = new Set([`${sgx},${sgy}`]);
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const cur = queue[cursor];
      if (cur.gx === egx && cur.gy === egy) return cur.length;
      const x = cur.gx * cell + cell / 2;
      const y = cur.gy * cell + cell / 2;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
        const ngx = cur.gx + dx;
        const ngy = cur.gy + dy;
        if (ngx < 0 || ngx >= GRID || ngy < 0 || ngy >= GRID) continue;
        const token = `${ngx},${ngy}`;
        if (visited.has(token)) continue;
        const nx = ngx * cell + cell / 2;
        const ny = ngy * cell + cell / 2;
        if (nx < 3 || nx > 97 || ny < 3 || ny > 97) continue;
        let ok = true;
        for (const wall of walls) {
          if (inactive.includes(wall.id)) continue;
          if (segmentsCrossOrNear(x, y, nx, ny, wall.x1, wall.y1, wall.x2, wall.y2)) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        for (const door of doors) {
          if (!keys.includes(door.keyNodeId) &&
              segmentsCrossOrNear(x, y, nx, ny, door.x1, door.y1, door.x2, door.y2)) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        for (const gate of gates) {
          if (segmentsCrossOrNear(x, y, nx, ny, gate.x1, gate.y1, gate.x2, gate.y2, 1.5)) {
            const ddx = nx - x;
            const ddy = ny - y;
            let illegal = false;
            if (gate.allowDirection === 'up' && ddy > 0) illegal = true;
            if (gate.allowDirection === 'down' && ddy < 0) illegal = true;
            if (gate.allowDirection === 'left' && ddx > 0) illegal = true;
            if (gate.allowDirection === 'right' && ddx < 0) illegal = true;
            if (illegal) {
              ok = false;
              break;
            }
          }
        }
        if (!ok) continue;
        for (const node of level.nodes) {
          if (allowTouch.includes(node.id)) continue;
          if (node.type === 'hazard' || forbid.includes(node.id)) {
            const dxn = nx - x, dyn = ny - y;
            const len2 = dxn * dxn + dyn * dyn;
            let t = len2 < 1e-8 ? 0 : ((node.x - x) * dxn + (node.y - y) * dyn) / len2;
            t = Math.max(0, Math.min(1, t));
            if (Math.hypot(node.x - (x + t * dxn), node.y - (y + t * dyn)) <= 6.5) {
              ok = false;
              break;
            }
          }
        }
        if (!ok) continue;
        visited.add(token);
        queue.push({ gx: ngx, gy: ngy, length: cur.length + Math.hypot(nx - x, ny - y) });
      }
    }
    return null;
  };

  let pos = { x: actor.x, y: actor.y };
  const keys: string[] = [];
  const switches: string[] = [];
  let total = 0;
  for (let i = 1; i < level.requiredNodeIds.length; i++) {
    const target = level.nodes.find(n => n.id === level.requiredNodeIds[i]);
    if (!target) return { ok: false, reason: `missing ${level.requiredNodeIds[i]}` };
    const len = bfs(pos, { x: target.x, y: target.y }, keys, switches);
    if (len == null) return { ok: false, reason: `cannot draw to ${target.id}` };
    total += len;
    pos = { x: target.x, y: target.y };
    if (target.type === 'key') keys.push(target.id);
    if (target.type === 'switch') switches.push(target.id);
  }
  if (total > (level.routeLengthLimit || 300)) {
    return { ok: false, reason: `drawable path ${Math.round(total)} exceeds ink ${level.routeLengthLimit}` };
  }
  return { ok: true, length: total };
}

function hazardsClearOfSolution(level: Level, solutionCells: string[], size: number): boolean {
  const pts = solutionCells.map(cellKey => {
    const [row, col] = cellKey.split(',').map(Number);
    return cellPoint({ row, col }, size);
  });
  for (const node of level.nodes) {
    if (node.type !== 'hazard' && !(level.forbiddenNodeIds || []).includes(node.id)) continue;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x;
      const dy = pts[i].y - pts[i - 1].y;
      const len2 = dx * dx + dy * dy;
      let t = len2 < 1e-8 ? 0 : ((node.x - pts[i - 1].x) * dx + (node.y - pts[i - 1].y) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      if (Math.hypot(node.x - (pts[i - 1].x + t * dx), node.y - (pts[i - 1].y + t * dy)) <= 6.5) {
        return false;
      }
    }
  }
  return true;
}

/** Reject boards where a single straight stroke actor→goal clears every barrier. */
function allowsTrivialStraightLine(level: Level): boolean {
  const actor = level.nodes.find(n => n.type === 'actor');
  const goal = level.nodes.find(n => n.type === 'goal');
  if (!actor || !goal) return true;
  const x1 = actor.x, y1 = actor.y, x2 = goal.x, y2 = goal.y;
  for (const wall of level.walls || []) {
    if (segmentsCrossOrNear(x1, y1, x2, y2, wall.x1, wall.y1, wall.x2, wall.y2)) return false;
  }
  for (const door of level.lockedDoors || []) {
    if (segmentsCrossOrNear(x1, y1, x2, y2, door.x1, door.y1, door.x2, door.y2)) return false;
  }
  for (const gate of level.oneWayGates || []) {
    if (segmentsCrossOrNear(x1, y1, x2, y2, gate.x1, gate.y1, gate.x2, gate.y2, 1.5)) {
      const dx = x2 - x1, dy = y2 - y1;
      let illegal = false;
      if (gate.allowDirection === 'up' && dy > 0) illegal = true;
      if (gate.allowDirection === 'down' && dy < 0) illegal = true;
      if (gate.allowDirection === 'left' && dx > 0) illegal = true;
      if (gate.allowDirection === 'right' && dx < 0) illegal = true;
      if (illegal) return false;
    }
  }
  for (const node of level.nodes) {
    if (node.type !== 'hazard' && !(level.forbiddenNodeIds || []).includes(node.id)) continue;
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    let t = len2 < 1e-8 ? 0 : ((node.x - x1) * dx + (node.y - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    if (Math.hypot(node.x - (x1 + t * dx), node.y - (y1 + t * dy)) <= 6.5) return false;
  }
  return Math.hypot(x2 - x1, y2 - y1) <= (level.routeLengthLimit || 300);
}

function makeCandidate(template: Level, profile: MazeProfile, seed: number): GeneratedMazeLevel | null {
  const rng = mulberry32(seed);
  const treeEdges = generateTree(profile.size, profile.newestBias, rng);
  let graph = adjacency(profile.size, treeEdges);
  let route = diameter(graph);
  if (rng() < 0.5) route = [...route].reverse();
  if (route.length < template.requiredNodeIds.length * 3) return null;

  // Directional language must agree with the generated board, not merely its labels.
  if (template.id === 'lvl_8') {
    const firstCheckpointIndex = Math.round((1 / (template.requiredNodeIds.length - 1)) * (route.length - 1));
    if (route[firstCheckpointIndex].col >= route[0].col) {
      route.reverse();
      const reversedIndex = Math.round((1 / (template.requiredNodeIds.length - 1)) * (route.length - 1));
      if (route[reversedIndex].col >= route[0].col) return null;
    }
  }
  if (template.id === 'lvl_9') {
    const checkpointIndex = Math.round((1 / (template.requiredNodeIds.length - 1)) * (route.length - 1));
    if (route[checkpointIndex].row <= route[0].row) {
      route.reverse();
      const reversedIndex = Math.round((1 / (template.requiredNodeIds.length - 1)) * (route.length - 1));
      if (route[reversedIndex].row <= route[0].row) return null;
    }
  }

  addOffRouteBraids(profile.size, treeEdges, route, Math.max(profile.braidChance, 0.08), rng);
  graph = adjacency(profile.size, treeEdges);
  // Braids are restricted off-route, so the intended route remains stable.
  const placements = chooseRequiredCells(route, template.requiredNodeIds);
  if (template.id === 'lvl_8') {
    const actor = placements.get('n_actor');
    const left = placements.get('n_left');
    const water = placements.get('n_water');
    if (!actor || !left || !water || left.col >= actor.col || water.col >= actor.col) return null;
  }

  // Shortcut first (L11) so Fire can pressure the long-way competing corridor.
  const shortcut = addSwitchShortcut(template, route, placements, treeEdges);
  if (template.id === 'lvl_11' && !shortcut) return null;
  if (shortcut) graph = adjacency(profile.size, treeEdges);
  const intendedRoute = shortcut
    ? [...route.slice(0, shortcut.fromIndex + 1), ...route.slice(shortcut.toIndex)]
    : route;

  const requiredCells = template.requiredNodeIds
    .map(id => placements.get(id))
    .filter((cell): cell is Cell => Boolean(cell));
  const corridorNeed = Math.max(
    2,
    template.nodes.length - template.requiredNodeIds.length + 1 + (template.patrols?.length || 0)
  );
  ensureCompetingCorridors(
    profile.size,
    treeEdges,
    route,
    requiredCells,
    corridorNeed,
    rng,
    template.id === 'lvl_8'
  );
  if (shortcut) {
    ensureCompetingCorridors(
      profile.size,
      treeEdges,
      route,
      [route[shortcut.fromIndex], route[shortcut.toIndex], route[route.length - 1]],
      2,
      rng,
      false
    );
  }
  // Order missions need actor→home routes that skip each intermediate stop;
  // otherwise 先…再… cannot fail as wrong_order (checkpoint is a cut-vertex).
  // Forbidden-cell clearance is re-checked after distractor placement below.
  ensureOrderSkipBypasses(profile.size, treeEdges, route, requiredCells, rng);
  graph = adjacency(profile.size, treeEdges);
  if (!orderCheckpointsSkippable(graph, requiredCells)) return null;

  const info = branchInfo(graph, route);
  const routeLast = Math.max(1, route.length - 1);
  let preferredWindow: { minIndex: number; maxIndex: number } | undefined;
  if (shortcut) {
    preferredWindow = {
      minIndex: Math.max(1, shortcut.fromIndex - 2),
      maxIndex: Math.min(routeLast - 1, shortcut.fromIndex + 6)
    };
  }
  const distractors = chooseDistractorCells(
    template.nodes,
    new Set(template.requiredNodeIds),
    placements,
    template.id,
    route,
    graph,
    rng,
    preferredWindow,
    shortcut
  );
  if (!distractors) return null;
  if (template.id === 'lvl_8') {
    const actor = placements.get('n_actor')!;
    const right = placements.get('n_right');
    const fire = placements.get('n_fire');
    if (!right || !fire || right.col <= actor.col || fire.col <= actor.col) return null;
  }

  const nodes = template.nodes.map(node => {
    const cell = placements.get(node.id);
    if (!cell) return node;
    return { ...node, ...cellPoint(cell, profile.size) };
  });
  const forbiddenCells = new Set(
    template.forbiddenNodeIds
      .map(id => placements.get(id))
      .filter((cell): cell is Cell => Boolean(cell))
      .map(key)
  );
  // Skip route must avoid forbidden landmarks — otherwise "home first" only
  // fails as wrong_target and order teaching collapses to item contrast.
  if (!orderCheckpointsSkippable(graph, requiredCells, forbiddenCells)) return null;
  let shortestRouteSteps = 0;
  for (let index = 1; index < requiredCells.length; index++) {
    const stageSteps = shortestAllowedSteps(
      graph,
      requiredCells[index - 1],
      requiredCells[index],
      forbiddenCells
    );
    if (!Number.isFinite(stageSteps)) return null;
    shortestRouteSteps += stageSteps;
  }
  const routeShape = routeTurns(intendedRoute);
  const startPoint = cellPoint(intendedRoute[0], profile.size);
  const goalPoint = cellPoint(intendedRoute[intendedRoute.length - 1], profile.size);
  const step = (BOARD_MAX - BOARD_MIN) / profile.size;
  const routeLength = (intendedRoute.length - 1) * step;
  const direct = Math.max(1, Math.hypot(goalPoint.x - startPoint.x, goalPoint.y - startPoint.y));
  const bfsExpanded = search(graph, intendedRoute[0], intendedRoute[intendedRoute.length - 1]).expanded;
  const topologyPass =
    intendedRoute.length - 1 >= profile.minRouteSteps &&
    routeShape.turns >= profile.minTurns &&
    info.decisions >= profile.minDecisions &&
    info.decoyBranches >= 2 &&
    info.deepestDecoy >= profile.minDecoyDepth &&
    routeShape.longestStraightRun <= profile.maxStraightRun &&
    routeLength / direct >= 1.6 &&
    shortestRouteSteps >= (profile.minShortestRouteSteps || 0) &&
    shortestRouteSteps <= (profile.maxShortestRouteSteps || Number.POSITIVE_INFINITY) &&
    routeLength <= (template.routeLengthLimit || Number.POSITIVE_INFINITY);
  if (!topologyPass) return null;

  const walls = makeWalls(profile.size, treeEdges);
  const special = makeSpecialBarriers(template, route, placements, profile.size, walls, distractors, shortcut);
  if (!special.valid) return null;
  const initialPatrols = makePatrols(
    template,
    graph,
    intendedRoute,
    profile.size,
    rng,
    placements,
    route,
    shortcut
  );
  if (!initialPatrols) return null;
  const patrols = initialPatrols;
  const clearCount = patrols.filter(p => patrolClearOfSolution(p, intendedRoute, profile.size)).length;
  const metrics: MazeMetrics = {
    routeSteps: intendedRoute.length - 1,
    shortestRouteSteps,
    routeLength,
    directRatio: routeLength / direct,
    turns: routeShape.turns,
    decisions: info.decisions,
    decoyBranches: info.decoyBranches,
    deepestDecoy: info.deepestDecoy,
    longestStraightRun: routeShape.longestStraightRun,
    bfsExpanded,
    // makePatrols only emits decoy-corridor seats that clear the true solution.
    patrolsClearOfSolution: clearCount,
    patrolsOnCompetingPath: clearCount === patrols.length ? patrols.length : 0
  };
  if (patrols.length > 0 && clearCount !== patrols.length) return null;
  const levelNumber = Number.parseInt(template.id.replace('lvl_', ''), 10);
  const inkAllowance = levelNumber <= 2 ? 1.35 : levelNumber <= 5 ? 1.28 : 1.22;
  const generatedRouteLimit = Math.ceil(routeLength * inkAllowance);

  const level: GeneratedMazeLevel = {
    ...structuredClone(template),
    nodes,
    walls,
    lockedDoors: special.lockedDoors,
    oneWayGates: special.oneWayGates,
    patrols,
    routeLengthLimit: Math.min(template.routeLengthLimit || generatedRouteLimit, generatedRouteLimit),
    mazeMetadata: {
      seed,
      size: profile.size,
      connections: [...treeEdges].sort(),
      solutionCells: intendedRoute.map(key),
      distractors,
      shortcut: shortcut || undefined,
      metrics
    }
  };

  // Hard gates: drawable solution + hazards on competing decoy corridors only.
  if (!hazardsClearOfSolution(level, level.mazeMetadata.solutionCells, profile.size)) return null;
  if (allowsTrivialStraightLine(level)) return null;
  const drawable = verifyDrawableSolvable(level);
  if (!drawable.ok) return null;
  for (const d of distractors) {
    if (!d.onCompetingPath || d.corridorLength < 3) return null;
    if (d.depth < 1 || d.depth > 5) return null;
    const intendedIndex = intendedRoute.findIndex(cell => key(cell) === d.attachment);
    if (intendedIndex >= 0) {
      const frac = intendedIndex / Math.max(1, intendedRoute.length - 1);
      if (frac > 0.58) return null;
    } else if (!shortcut || Math.abs(d.attachmentIndex - shortcut.fromIndex) > 6) {
      return null;
    }
    if (!d.appearsTowardTarget) return null;
  }

  return level;
}

export function hasMazeProfile(levelId: string): boolean {
  return Boolean(PROFILES[levelId]);
}

export function generateMazeLevel(template: Level, seed: number): GeneratedMazeLevel {
  const profile = PROFILES[template.id];
  if (!profile) {
    throw new Error(`No maze-generation profile exists for "${template.id}"`);
  }

  for (let attempt = 0; attempt < profile.attempts * 8; attempt++) {
    const candidate = makeCandidate(template, profile, hashSeed(seed, attempt));
    if (!candidate) continue;
    return {
      ...candidate,
      mazeMetadata: { ...candidate.mazeMetadata, seed: seed >>> 0 }
    };
  }
  throw new Error(`Unable to construct a validated maze candidate for "${template.id}"`);
}

export function getMazeProfile(levelId: string): Readonly<MazeProfile> | undefined {
  return PROFILES[levelId];
}
