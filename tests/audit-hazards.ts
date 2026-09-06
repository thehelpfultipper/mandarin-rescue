/**
 * Exhaustive audit: every curated level × SEEDS must generate with distractors on
 * competing decoy corridors (false path solutions), not decorative dead ends.
 */
import { DEFAULT_LEVELS } from '../src/lib/curatedLevels.ts';
import { instantiateLevel } from '../src/lib/boardVariants.ts';
import type { GeneratedMazeLevel } from '../src/lib/mazeGenerator.ts';

const SEEDS = 64;

function distPointSeg(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function verifyPressure(board: GeneratedMazeLevel): { ok: boolean; reason?: string } {
  const expected = board.nodes.filter(node => !board.requiredNodeIds.includes(node.id));
  const placements = board.mazeMetadata.distractors;
  if (placements.length !== expected.length) {
    return { ok: false, reason: `count ${placements.length}/${expected.length}` };
  }
  const attachments = new Set<string>();
  const solution = board.mazeMetadata.solutionCells;
  const shortcut = board.mazeMetadata.shortcut;
  for (const node of expected) {
    const p = placements.find(item => item.id === node.id);
    if (!p) return { ok: false, reason: `missing ${node.id}` };
    if (!p.onCompetingPath) return { ok: false, reason: `${node.id} not on competing path` };
    if (p.corridorLength < 3) return { ok: false, reason: `${node.id} corridor too short` };
    if (p.depth < 1 || p.depth > 5) return { ok: false, reason: `${node.id} depth ${p.depth}` };
    if (attachments.has(p.attachment)) return { ok: false, reason: `${node.id} shared mouth` };
    attachments.add(p.attachment);
    const idx = solution.indexOf(p.attachment);
    if (idx >= 0) {
      if (idx / Math.max(1, solution.length - 1) > 0.58) {
        return { ok: false, reason: `${node.id} late` };
      }
    } else if (!shortcut || Math.abs(p.attachmentIndex - shortcut.fromIndex) > 6) {
      return { ok: false, reason: `${node.id} off-route` };
    }
    if (!p.appearsTowardTarget) return { ok: false, reason: `${node.id} not toward goal` };
  }
  return { ok: true };
}

function verifyClearance(board: GeneratedMazeLevel): { ok: boolean; reason?: string } {
  const size = board.mazeMetadata.size;
  const step = 88 / size;
  const points = board.mazeMetadata.solutionCells.map(cell => {
    const [row, col] = cell.split(',').map(Number);
    return { x: 6 + (col + 0.5) * step, y: 6 + (row + 0.5) * step };
  });
  if (points.length < 2) return { ok: false, reason: 'empty solution' };
  const hazards = board.nodes.filter(n => n.type === 'hazard' || board.forbiddenNodeIds.includes(n.id));
  for (const hazard of hazards) {
    for (let i = 1; i < points.length; i++) {
      if (distPointSeg(hazard.x, hazard.y, points[i - 1].x, points[i - 1].y, points[i].x, points[i].y) <= 6.5) {
        return { ok: false, reason: `${hazard.id} on corridor` };
      }
    }
  }
  return { ok: true };
}

let genFail = 0;
let badHazard = 0;
let badClear = 0;
let missingRoute = 0;
const failures: string[] = [];
const perLevel: Record<string, {
  ok: number;
  fail: number;
  competingRate: number;
  avgCorridor: number | null;
  avgDepth: number | null;
}> = {};

for (const template of DEFAULT_LEVELS) {
  let ok = 0;
  let competing = 0;
  let corridorSum = 0;
  let depthSum = 0;
  let slots = 0;
  let fail = 0;

  for (let seed = 0; seed < SEEDS; seed++) {
    try {
      const board = instantiateLevel(template, seed) as GeneratedMazeLevel;
      if (!board.mazeMetadata?.solutionCells || board.mazeMetadata.solutionCells.length < 2) {
        missingRoute++;
        fail++;
        failures.push(`${template.id} seed=${seed} missing solutionCells`);
        continue;
      }
      const pressure = verifyPressure(board);
      if (!pressure.ok) {
        badHazard++;
        fail++;
        failures.push(`${template.id} seed=${seed} hazard: ${pressure.reason}`);
        continue;
      }
      const clear = verifyClearance(board);
      if (!clear.ok) {
        badClear++;
        fail++;
        failures.push(`${template.id} seed=${seed} clear: ${clear.reason}`);
        continue;
      }
      for (const d of board.mazeMetadata.distractors) {
        slots++;
        if (d.onCompetingPath) competing++;
        corridorSum += d.corridorLength;
        depthSum += d.depth;
      }
      ok++;
    } catch (e: any) {
      genFail++;
      fail++;
      failures.push(`${template.id} seed=${seed} gen: ${String(e.message || e).slice(0, 120)}`);
    }
  }

  perLevel[template.id] = {
    ok,
    fail,
    competingRate: Number((competing / Math.max(1, slots)).toFixed(3)),
    avgCorridor: slots ? Number((corridorSum / slots).toFixed(2)) : null,
    avgDepth: slots ? Number((depthSum / slots).toFixed(2)) : null
  };
}

const total = DEFAULT_LEVELS.length * SEEDS;
const allOk = genFail + missingRoute + badHazard + badClear === 0;
console.log(JSON.stringify({
  total,
  genFail,
  missingRoute,
  badHazard,
  badClear,
  allOk,
  perLevel,
  sampleFails: failures.slice(0, 40)
}, null, 2));

if (!allOk) process.exit(1);
