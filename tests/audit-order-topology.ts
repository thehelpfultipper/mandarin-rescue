/**
 * Audit whether ordered-checkpoint boards force intermediate stops as cut-vertices
 * (home unreachable without meat/water), and whether competing decoys exist per stage.
 * Expectation after ensureOrderSkipBypasses: checkpointIsCutVertex === 0.
 */
import { DEFAULT_LEVELS } from '../src/lib/curatedLevels.ts';
import { generateMazeLevel } from '../src/lib/mazeGenerator.ts';
import { instantiateLevel } from '../src/lib/boardVariants.ts';
import type { Level } from '../src/types.ts';

type Cell = { row: number; col: number };
const key = (c: Cell) => `${c.row},${c.col}`;

function buildGraph(size: number, connections: string[]) {
  const graph = new Map<string, Cell[]>();
  const ensure = (c: Cell) => {
    const k = key(c);
    if (!graph.has(k)) graph.set(k, []);
    return graph.get(k)!;
  };
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) ensure({ row: r, col: c });
  for (const e of connections) {
    const [a, b] = e.split('|');
    const [r1, c1] = a.split(',').map(Number);
    const [r2, c2] = b.split(',').map(Number);
    const A = { row: r1, col: c1 };
    const B = { row: r2, col: c2 };
    ensure(A).push(B);
    ensure(B).push(A);
  }
  return graph;
}

function bfs(
  graph: Map<string, Cell[]>,
  start: string,
  goal: string,
  blocked = new Set<string>()
): number {
  if (start === goal) return 0;
  const q = [start];
  const dist = new Map([[start, 0]]);
  for (let i = 0; i < q.length; i++) {
    const cur = q[i];
    const d = dist.get(cur)!;
    for (const n of graph.get(cur) || []) {
      const nk = key(n);
      if (blocked.has(nk) || dist.has(nk)) continue;
      if (nk === goal) return d + 1;
      dist.set(nk, d + 1);
      q.push(nk);
    }
  }
  return Infinity;
}

function pathBetween(graph: Map<string, Cell[]>, start: string, goal: string): string[] | null {
  if (start === goal) return [start];
  const q = [start];
  const parent = new Map<string, string | null>([[start, null]]);
  for (let i = 0; i < q.length; i++) {
    const cur = q[i];
    for (const n of graph.get(cur) || []) {
      const nk = key(n);
      if (parent.has(nk)) continue;
      parent.set(nk, cur);
      if (nk === goal) {
        const path = [goal];
        let walk: string | null = cur;
        while (walk) {
          path.push(walk);
          walk = parent.get(walk) ?? null;
        }
        return path.reverse();
      }
      q.push(nk);
    }
  }
  return null;
}

function liesOnSimplePath(
  graph: Map<string, Cell[]>,
  from: string,
  to: string,
  cell: string
): boolean {
  if (cell === from || cell === to) return false;
  const head = pathBetween(graph, from, cell);
  const tail = pathBetween(graph, cell, to);
  if (!head || !tail || head.length < 2 || tail.length < 2) return false;
  const seen = new Set(head);
  for (const step of tail.slice(1)) {
    if (seen.has(step)) return false;
  }
  return true;
}

function cellOf(level: {
  nodes: { id: string; x: number; y: number }[];
  mazeMetadata: { size: number; connections: string[] };
}, id: string): string {
  const n = level.nodes.find(x => x.id === id)!;
  const size = level.mazeMetadata.size;
  const step = (94 - 6) / size;
  let best = '';
  let bestD = Infinity;
  for (const e of level.mazeMetadata.connections) {
    for (const part of e.split('|')) {
      const [r, c] = part.split(',').map(Number);
      const x = 6 + (c + 0.5) * step;
      const y = 6 + (r + 0.5) * step;
      const d = Math.hypot(x - n.x, y - n.y);
      if (d < bestD) {
        bestD = d;
        best = part;
      }
    }
  }
  return best;
}

function analyze(level: ReturnType<typeof generateMazeLevel>, label: string) {
  const md = level.mazeMetadata;
  const graph = buildGraph(md.size, md.connections);
  const req = level.requiredNodeIds;
  const cells = Object.fromEntries(req.map(id => [id, cellOf(level, id)]));
  const actor = cells[req[0]];
  const home = cells[req[req.length - 1]];
  let anyCut = false;
  const forbidden = new Set(level.forbiddenNodeIds.map(id => cellOf(level, id)));
  for (const id of req.slice(1, -1)) {
    const blocked = new Set(forbidden);
    blocked.add(cells[id]);
    if (!Number.isFinite(bfs(graph, actor, home, blocked))) anyCut = true;
  }

  const stages = [];
  for (let i = 0; i < req.length - 1; i++) {
    const from = cells[req[i]];
    const to = cells[req[i + 1]];
    let competingCells = 0;
    for (const ck of graph.keys()) {
      if (liesOnSimplePath(graph, from, to, ck)) competingCells++;
    }
    const stageDist = md.distractors.filter(d => d.stageIndex === i);
    stages.push({
      from: req[i],
      to: req[i + 1],
      competingCells,
      distractors: stageDist.length,
    });
  }

  return {
    label,
    seed: md.seed,
    decoyBranches: md.metrics.decoyBranches,
    deepestDecoy: md.metrics.deepestDecoy,
    decisions: md.metrics.decisions,
    checkpointIsCutVertex: anyCut,
    stages,
  };
}

function summarize(name: string, rows: ReturnType<typeof analyze>[]) {
  const cut = rows.filter(r => r.checkpointIsCutVertex).length;
  console.log(`\n=== ${name} (n=${rows.length}) ===`);
  console.log({
    checkpointIsCutVertex: cut,
    pctCutVertex: Math.round((100 * cut) / rows.length),
    boardsWithStage0Distractor: rows.filter(r => (r.stages[0]?.distractors || 0) > 0).length,
    boardsWithStage1Distractor: rows.filter(r => (r.stages[1]?.distractors || 0) > 0).length,
    minDecoyBranches: Math.min(...rows.map(r => r.decoyBranches)),
    avgDecoyBranches: +(rows.reduce((s, r) => s + r.decoyBranches, 0) / rows.length).toFixed(2),
  });
  if (cut > 0) {
    console.error(`FAIL: ${cut}/${rows.length} boards still force intermediate checkpoints`);
    process.exitCode = 1;
  }
}

const seeds = Array.from({ length: 32 }, (_, i) => (i + 1) * 9973);
const l4 = DEFAULT_LEVELS.find(l => l.id === 'lvl_4')!;
const l3 = DEFAULT_LEVELS.find(l => l.id === 'lvl_3')!;
const l6 = DEFAULT_LEVELS.find(l => l.id === 'lvl_6')!;

summarize(
  'L4 meat→home',
  seeds.map(seed => analyze(generateMazeLevel(l4, seed), 'lvl_4'))
);
summarize(
  'L3 water→home',
  seeds.map(seed => analyze(generateMazeLevel(l3, seed), 'lvl_3'))
);
summarize(
  'L6 water→meat→home',
  seeds.slice(0, 16).map(seed => analyze(generateMazeLevel(l6, seed), 'lvl_6'))
);

const adaptiveMeat: Level = { ...structuredClone(l4), id: 'adaptive_meat_demo' };
const adaptiveRows = seeds.slice(0, 16).map(seed =>
  analyze(instantiateLevel(adaptiveMeat, seed) as ReturnType<typeof generateMazeLevel>, 'adaptive')
);
summarize('Adaptive meat (proxy profile)', adaptiveRows);

if (process.exitCode) {
  console.error('\nOrder-topology audit failed.');
} else {
  console.log('\nOrder-topology audit passed (no cut-vertex checkpoints).');
}
