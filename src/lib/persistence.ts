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
    // Silent-first: audio is opt-in via Listen (never autoplay)
    soundEnabled: false,
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

const REVIEW_STALE_MS = 1000 * 60 * 30;
const DRAW_COACH_KEY = 'mandarin_rescue_draw_coach_dismissed_v1';

/**
 * Characters due for quiet review-in-play (failed recall or stale).
 * Used for mission chrome + adaptive preload — not a flashcard queue.
 */
export function getDueReviewChars(progress: PlayerProgress, limit = 6): string[] {
  const dueFromLogs = (progress.adaptiveModel?.retentionLogs || [])
    .filter((log) => !log.recalled || Date.now() - log.lastTestedTime > REVIEW_STALE_MS)
    .map((log) => log.charOrPhrase);

  const struggled = Object.entries(progress.vocabularyAttempts)
    .filter(([, stats]) => stats.failure > stats.success)
    .map(([char]) => char);

  return [...new Set([...dueFromLogs, ...struggled])].slice(0, limit);
}

/** First-run gesture coach — local only, not part of adaptive progress schema. */
export function loadDrawCoachDismissed(): boolean {
  try {
    return localStorage.getItem(DRAW_COACH_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveDrawCoachDismissed(): void {
  try {
    localStorage.setItem(DRAW_COACH_KEY, '1');
  } catch {
    /* ignore quota / private mode */
  }
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
