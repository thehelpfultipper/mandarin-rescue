import { Level } from '../types';
import { generateMazeLevel, hasMazeProfile } from './mazeGenerator';

/**
 * Every curated room is instantiated as a fresh, solver-scored maze.
 * Unknown/adaptive rooms keep their supplied geometry.
 */
export function freshBoardSeed(): number {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return buffer[0] || (Date.now() >>> 0);
  }
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

export function instantiateLevel(template: Level, seed: number = freshBoardSeed()): Level {
  if (!hasMazeProfile(template.id)) return structuredClone(template);
  const board = generateMazeLevel(template, seed >>> 0);
  board.id = template.id;
  return board;
}

export function boardGeometryKey(level: Level): string {
  const nodes = level.nodes.map(node => `${node.id}:${node.x.toFixed(2)},${node.y.toFixed(2)}`).join('|');
  const walls = (level.walls || [])
    .map(wall => `${wall.id}:${wall.x1.toFixed(2)},${wall.y1.toFixed(2)}-${wall.x2.toFixed(2)},${wall.y2.toFixed(2)}`)
    .join('|');
  const patrols = (level.patrols || [])
    .map(patrol => `${patrol.id}:${patrol.waypoints.map(point => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(';')}`)
    .join('|');
  return `${nodes}#${walls}#${patrols}`;
}
