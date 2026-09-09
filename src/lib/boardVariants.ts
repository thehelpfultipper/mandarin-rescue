import { Level } from '../types';
import { generateMazeLevel, hasMazeProfile } from './mazeGenerator';
import { DEFAULT_LEVELS } from './curatedLevels';

export type InstantiatedLevel = Level & {
  /** Internal runtime marker; never accepted from model JSON. */
  usedSafeBoardFallback?: boolean;
};

/**
 * Every curated room is instantiated as a fresh, solver-scored maze.
 * Adaptive rooms try mid-arc courtyard craft and fail closed to validated curated geometry.
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

function validatedFallback(
  runtimeId: string,
  preferredProfileId: string,
  seed: number,
  allowAlternateProfiles: boolean
): InstantiatedLevel {
  const preferred = DEFAULT_LEVELS.find(level => level.id === preferredProfileId);
  const candidates = preferred && allowAlternateProfiles
    ? [preferred, ...DEFAULT_LEVELS.filter(level => level.id !== preferred.id)]
    : preferred
      ? [preferred]
      : DEFAULT_LEVELS;

  for (let round = 0; round < 4; round++) {
    for (let index = 0; index < candidates.length; index++) {
      try {
        const fallbackSeed = (
          seed ^
          0x9e3779b9 ^
          Math.imul(index + 1, 0x85ebca6b) ^
          Math.imul(round + 1, 0xc2b2ae35)
        ) >>> 0;
        return {
          ...generateMazeLevel(candidates[index], fallbackSeed),
          id: runtimeId,
          usedSafeBoardFallback: true,
        };
      } catch {
        // Try another seed, then another validated profile when adaptive semantics are already unavailable.
      }
    }
  }
  throw new Error(`Unable to construct any validated fallback board for "${runtimeId}"`);
}

export function instantiateLevel(template: Level, seed: number = freshBoardSeed()): InstantiatedLevel {
  const profileId = adaptiveProfileProxyId(template);
  if (!profileId) {
    console.warn(`Level "${template.id}" has no playable actor/goal contract; using curated geometry.`);
    return validatedFallback(template.id, 'lvl_1', seed, true);
  }

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
  } catch (error) {
    const safeTemplate = DEFAULT_LEVELS.find(level => level.id === profileId) || DEFAULT_LEVELS[0];
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(
      `Maze generation failed for "${template.id}"; using validated ${safeTemplate.id} geometry: ${reason}`
    );
    return validatedFallback(template.id, safeTemplate.id, seed, profileId !== template.id);
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
