import { PlayerProgress, PlayerProgressSchema } from '../types';
import { DEFAULT_LEVELS } from './curatedLevels';

export { DEFAULT_LEVELS };

const LOCAL_STORAGE_KEY = 'mandarin_rescue_player_progress_v1';

export const DEFAULT_PROGRESS: PlayerProgress = {
  completedLevelIds: [],
  vocabularyAttempts: {},
  languageErrors: 0,
  drawingErrors: 0,
  listenedChars: [],
  settings: {
    soundEnabled: true,
    pinyinToggle: true,
    translationToggle: true
  },
  adaptiveModel: {
    hanziToMeaning: {},
    pinyinToMeaning: {},
    phraseToAction: {},
    spatialComprehension: { success: 0, failure: 0 },
    orderedComprehension: { success: 0, failure: 0 },
    retentionLogs: [],
    listeningKnowledge: {}
  }
};

/**
 * Deterministically computes the dynamic pedagogical vocabulary stage of a character
 * based on the learner's actual mastery data.
 */
export function getVocabularyStage(char: string, progress: PlayerProgress): 'new' | 'familiar' | 'strong' | 'later' {
  const attempts = progress.adaptiveModel?.hanziToMeaning?.[char] || progress.vocabularyAttempts?.[char];
  if (!attempts) return 'new';
  const { success, failure } = attempts;
  const score = success - failure;
  if (success >= 4 && score >= 3) return 'later';
  if (success >= 3 && score >= 2) return 'strong';
  if (success >= 1) return 'familiar';
  return 'new';
}

/**
 * After enough successful recalls, fade global assists for returning players.
 */
export function shouldUseGuidedAssists(progress: PlayerProgress): boolean {
  const mastered = Object.values(progress.adaptiveModel?.hanziToMeaning || {})
    .filter((h) => h.success >= 3).length;
  return mastered < 3;
}

/**
 * Loads the player's progress from localStorage and validates it using Zod.
 * Falls back to default values if empty or corrupted.
 */
export function loadPlayerProgress(): PlayerProgress {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return DEFAULT_PROGRESS;
    const parsed = JSON.parse(raw);
    const result = PlayerProgressSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
    console.error('Invalid player progress data structure:', result.error);
    return DEFAULT_PROGRESS;
  } catch (e) {
    console.error('Failed to parse player progress:', e);
    return DEFAULT_PROGRESS;
  }
}

/**
 * Saves player progress to localStorage.
 */
export function savePlayerProgress(progress: PlayerProgress): void {
  try {
    const validated = PlayerProgressSchema.parse(progress);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(validated));
  } catch (e) {
    console.error('Failed to validate or save player progress:', e);
  }
}
