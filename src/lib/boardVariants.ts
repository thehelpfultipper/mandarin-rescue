import { Level } from '../types';
import { generateMazeLevel, hasMazeProfile } from './mazeGenerator';

/**
 * Every curated room is instantiated as a fresh, solver-scored maze.
 * Adaptive / fallback rooms try mid-arc courtyard craft, then keep supplied geometry.
 */
export function freshBoardSeed(): number {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return buffer[0] || (Date.now() >>> 0);
  }
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

/** Map non-curated boards onto an existing profile without changing linguistic content. */
function adaptiveProfileProxyId(template: Level): string | null {
  if (hasMazeProfile(template.id)) return template.id;
  if (/^lvl_\d+$/.test(template.id)) return null;
  const hasActor = template.nodes.some((n) => n.type === 'actor');
  const hasGoal = template.nodes.some((n) => n.type === 'goal');
  if (!hasActor || !hasGoal) return null;
  const weight =
    template.nodes.length +
    (template.patrols?.length || 0) +
    (template.lockedDoors?.length || 0) +
    (template.oneWayGates?.length || 0);
  if (weight <= 4) return 'lvl_3';
  if (weight <= 6) return 'lvl_6';
  return 'lvl_7';
}

export function instantiateLevel(template: Level, seed: number = freshBoardSeed()): Level {
  const profileId = adaptiveProfileProxyId(template);
  if (!profileId) return structuredClone(template);

  try {
    const forGen =
      profileId === template.id
        ? template
        : { ...structuredClone(template), id: profileId };
    const board = generateMazeLevel(forGen, seed >>> 0);
    return {
      ...board,
      id: template.id,
      title: template.title,
      mandarinClue: template.mandarinClue,
      pinyinClue: template.pinyinClue,
      englishTranslation: template.englishTranslation,
      hint: template.hint,
      missionFraming: template.missionFraming,
      forceAssists: template.forceAssists,
      vocabularyScaffold: template.vocabularyScaffold,
      isAudioRequired: template.isAudioRequired
    };
  } catch {
    return structuredClone(template);
  }
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
