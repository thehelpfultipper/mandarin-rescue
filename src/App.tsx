import { useState, useEffect } from 'react';
import { 
  Compass, 
  Settings, 
  CheckCircle, 
  ChevronRight, 
  ArrowLeft, 
  Sparkles, 
  Play,
  PawPrint,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  DEFAULT_LEVELS,
  DEFAULT_PROGRESS,
  loadPlayerProgress,
  savePlayerProgress,
  shouldUseGuidedAssists,
  getDueReviewChars,
  loadDrawCoachDismissed,
  saveDrawCoachDismissed
} from './lib/persistence';
import { Level, PlayerProgress } from './types';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { GameCanvas } from './components/GameCanvas';
import { adaptEndpoint } from './lib/adaptClient';

const GRAMMAR_DICT: Record<string, { pinyin: string; english: string; emoji?: string }> = {
  '小': { pinyin: 'xiǎo', english: 'small / little' },
  '狗': { pinyin: 'gǒu', english: 'dog', emoji: '🐶' },
  '回': { pinyin: 'huí', english: 'return / go back' },
  '家': { pinyin: 'jiā', english: 'home', emoji: '🏠' },
  '先': { pinyin: 'xiān', english: 'first' },
  '喝': { pinyin: 'hē', english: 'drink' },
  '水': { pinyin: 'shuǐ', english: 'water', emoji: '💧' },
  '再': { pinyin: 'zài', english: 'then' },
  '吃': { pinyin: 'chī', english: 'eat' },
  '肉': { pinyin: 'ròu', english: 'meat', emoji: '🥩' },
  '草': { pinyin: 'cǎo', english: 'grass', emoji: '🌿' },
  '避': { pinyin: 'bì', english: 'avoid' },
  '开': { pinyin: 'kāi', english: 'open / avoid / switch', emoji: '🎛️' },
  '避开': { pinyin: 'bì kāi', english: 'avoid / dodge', emoji: '⚠️' },
  '走': { pinyin: 'zǒu', english: 'walk / take' },
  '安': { pinyin: 'ān', english: 'safe' },
  '全': { pinyin: 'quán', english: 'complete' },
  '路': { pinyin: 'lù', english: 'path / road', emoji: '🛣️' },
  '后': { pinyin: 'hòu', english: 'after / then' },
  '用': { pinyin: 'yòng', english: 'use' },
  '钥': { pinyin: 'yào', english: 'key', emoji: '🔑' },
  '匙': { pinyin: 'shi', english: 'key', emoji: '🔑' },
  '钥匙': { pinyin: 'yào shi', english: 'key', emoji: '🔑' },
  '门': { pinyin: 'mén', english: 'door / gate', emoji: '🚪' },
  '向': { pinyin: 'xiàng', english: 'towards' },
  '左': { pinyin: 'zuǒ', english: 'left', emoji: '⬅️' },
  '是': { pinyin: 'shì', english: 'is / are' },
  '源': { pinyin: 'yuán', english: 'source / resource' },
  '水源': { pinyin: 'shuǐ yuán', english: 'water source', emoji: '💧' },
  '右': { pinyin: 'yòu', english: 'right', emoji: '➡️' },
  '边': { pinyin: 'biān', english: 'side' },
  '右边': { pinyin: 'yòu biān', english: 'right side', emoji: '➡️' },
  '下': { pinyin: 'xià', english: 'down / downward', emoji: '⬇️' },
  '上': { pinyin: 'shàng', english: 'up / upward', emoji: '⬆️' },
  '通': { pinyin: 'tōng', english: 'pass' },
  '过': { pinyin: 'guò', english: 'through' },
  '通过': { pinyin: 'tōng guò', english: 'pass through' },
  '和': { pinyin: 'hé', english: 'and' },
  '捷': { pinyin: 'jié', english: 'quick' },
  '径': { pinyin: 'jìng', english: 'path' },
  '捷径': { pinyin: 'jié jìng', english: 'shortcut', emoji: '⚡' },
  '省': { pinyin: 'shěng', english: 'save' },
  '能': { pinyin: 'néng', english: 'energy / power' },
  '能源': { pinyin: 'néng yuán', english: 'energy', emoji: '🔋' },
  '机': { pinyin: 'jī', english: 'machine' },
  '关': { pinyin: 'guān', english: 'gate / switch' },
  '机关': { pinyin: 'jī guān', english: 'switch / mechanism', emoji: '🎛️' },
  '火': { pinyin: 'huǒ', english: 'fire', emoji: '🔥' },
  '去': { pinyin: 'qù', english: 'go to' },
  '拿': { pinyin: 'ná', english: 'take / grab' },
  '踩': { pinyin: 'cǎi', english: 'step on / flip' }
};

interface InteractiveClueProps {
  clue: string;
  scaffold?: { char: string; pinyin: string; english: string; emoji?: string; stage: string }[];
}

function InteractiveClue({ clue, scaffold }: InteractiveClueProps) {
  const [activeCharIndex, setActiveCharIndex] = useState<number | null>(null);

  const chars = Array.from(clue);

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="flex flex-wrap justify-center gap-1.5 py-1">
        {chars.map((char, index) => {
          const helper = scaffold?.find(s => s.char === char) || GRAMMAR_DICT[char];
          const hasHelp = !!helper;

          return (
            <div key={index} className="relative">
              <button
                type="button"
                onClick={() => setActiveCharIndex(activeCharIndex === index ? null : index)}
                className={`text-4xl sm:text-5xl font-serif font-black px-3 py-1.5 rounded-xl transition duration-150 select-none ${
                  hasHelp 
                    ? 'bg-stone-850 text-amber-200 border border-stone-800 hover:bg-stone-800 hover:border-amber-500/40 cursor-pointer active:scale-95' 
                    : 'text-stone-100'
                }`}
              >
                {char}
              </button>

              <AnimatePresence>
                {activeCharIndex === index && hasHelp && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 5, scale: 0.95 }}
                    className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 bg-[#1C1A17] text-[#FAF9F6] border border-stone-800 rounded-xl p-3 shadow-2xl flex flex-col items-center gap-0.5 min-w-[130px] text-center"
                  >
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-[#1C1A17]" />
                    <span className="text-sm font-black text-amber-400 tracking-wide">{helper.pinyin}</span>
                    <span className="text-xs text-[#F4F1EA]/90 leading-tight">{helper.english}</span>
                    {helper.emoji && <span className="text-lg mt-1">{helper.emoji}</span>}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {activeCharIndex !== null && (
        <div 
          className="fixed inset-0 z-30 bg-transparent cursor-pointer" 
          onClick={() => setActiveCharIndex(null)}
        />
      )}
    </div>
  );
}

export default function App() {
  const isOnline = useOnlineStatus();
  
  // App states
  const [progress, setProgress] = useState<PlayerProgress>(DEFAULT_PROGRESS);
  const [selectedLevel, setSelectedLevel] = useState<Level | null>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'puzzle' | 'settings'>('dashboard');
  const [adaptationRationale, setAdaptationRationale] = useState<string | null>(null);
  const [missionFraming, setMissionFraming] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Background Preloading states (Never show AI loading to the player)
  const [preloadedLevel, setPreloadedLevel] = useState<Level | null>(null);
  const [preloadedRationale, setPreloadedRationale] = useState<string | null>(null);
  const [preloadedFraming, setPreloadedFraming] = useState<string | null>(null);
  const [isPreloading, setIsPreloading] = useState(false);
  const [showDrawCoach, setShowDrawCoach] = useState(false);
  const [kennelOpen, setKennelOpen] = useState(false);

  const dueReviewChars = getDueReviewChars(progress);
  const rescuesCompleted = progress.completedLevelIds.length;
  const nextCurated =
    DEFAULT_LEVELS.find((l) => !progress.completedLevelIds.includes(l.id)) || DEFAULT_LEVELS[0];

  const startTodaysRescue = () => {
    if (selectedLevel) {
      setCurrentView('puzzle');
      return;
    }
    setSelectedLevel(nextCurated);
    setAdaptationRationale(null);
    setMissionFraming(nextCurated.missionFraming || null);
    setCurrentView('puzzle');
  };

  // Preload next adaptive level silently in the background
  const preloadNextAdaptiveLevel = async (currentProgress: PlayerProgress) => {
    if (isPreloading) return;
    setIsPreloading(true);
    setErrorMsg(null);

    try {
      const recentlyStruggledChars = Object.entries(currentProgress.vocabularyAttempts)
        .filter(([_, stats]) => stats.failure > stats.success)
        .map(([char]) => char);

      const dueReview = getDueReviewChars(currentProgress, 8);
      const reviewChars = [...new Set([...dueReview, ...recentlyStruggledChars])].slice(0, 8);

      const recentlyMasteredChars = Object.entries(currentProgress.vocabularyAttempts)
        .filter(([_, stats]) => stats.success >= stats.failure && stats.success > 0)
        .map(([char]) => char);

      const res = await fetch(adaptEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completedLevelCount: currentProgress.completedLevelIds.length,
          recentlyStruggledChars: reviewChars,
          recentlyMasteredChars,
          silentPlay: !currentProgress.settings.soundEnabled,
          adaptiveModel: currentProgress.adaptiveModel
        })
      });

      const data = await res.json();
      if (res.ok && data.suggestedLevel) {
        if (data.suggestedLevel.isAudioRequired && !currentProgress.settings.soundEnabled) {
          throw new Error('AI generated an audio level during silent play');
        }
        setPreloadedLevel(data.suggestedLevel);
        setPreloadedRationale(data.rationale || null);
        const framing =
          data.levelPlan?.whyMandarinMatters ||
          data.levelPlan?.learningGoal ||
          data.suggestedLevel.missionFraming ||
          null;
        setPreloadedFraming(framing);
      } else {
        throw new Error(data.error || 'Invalid API response');
      }
    } catch (err: any) {
      console.warn('Silent preloading failed or bypassed. Backing up to next uncompleted curated level:', err);
      const isSound = currentProgress.settings.soundEnabled;
      const fallbackLevel = DEFAULT_LEVELS.find(l => (!l.isAudioRequired || isSound) && !currentProgress.completedLevelIds.includes(l.id))
        || DEFAULT_LEVELS.find(l => !l.isAudioRequired || isSound)
        || DEFAULT_LEVELS[0];
      setPreloadedLevel(fallbackLevel);
      setPreloadedRationale(null);
      setPreloadedFraming(fallbackLevel.missionFraming || 'Practice another rescue with the words you have been learning.');
    } finally {
      setIsPreloading(false);
    }
  };

  // Load persistence progress on mount
  useEffect(() => {
    const loaded = loadPlayerProgress();
    // First-run guided assists: keep pinyin/translation on until learner has traction
    let next = loaded;
    if (shouldUseGuidedAssists(loaded) && loaded.completedLevelIds.length === 0) {
      next = {
        ...loaded,
        settings: {
          ...loaded.settings,
          pinyinToggle: true,
          translationToggle: true
        },
        listenedChars: loaded.listenedChars || []
      };
      savePlayerProgress(next);
    }
    setProgress(next);
    const latestUncompleted = DEFAULT_LEVELS.find(l => !next.completedLevelIds.includes(l.id)) || DEFAULT_LEVELS[0];
    setSelectedLevel(latestUncompleted);
    setMissionFraming(latestUncompleted.missionFraming || null);
    setCurrentView('puzzle');
    setShowDrawCoach(!loadDrawCoachDismissed());
    preloadNextAdaptiveLevel(next);
  }, []);

  // Save progress helper
  const updateProgress = (newProgress: PlayerProgress) => {
    setProgress(newProgress);
    savePlayerProgress(newProgress);
  };

  // Toggle settings
  const toggleSetting = (key: 'soundEnabled' | 'pinyinToggle' | 'translationToggle') => {
    const updated: PlayerProgress = {
      ...progress,
      settings: {
        ...progress.settings,
        [key]: !progress.settings[key]
      }
    };
    updateProgress(updated);
    
    if (key === 'soundEnabled') {
      setPreloadedLevel(null);
      preloadNextAdaptiveLevel(updated);
    }
  };

  const handleClueSpoken = (clue: string) => {
    const chars = Array.from(clue).filter(c => /[\u4e00-\u9fff]/.test(c));
    const merged = [...new Set([...(progress.listenedChars || []), ...chars])];
    updateProgress({ ...progress, listenedChars: merged });
  };

  // Consume preloaded level instantly (invisible adaptation — no AI branding)
  const consumeNextRescue = () => {
    const isSound = progress.settings.soundEnabled;
    const isValidPreloaded = preloadedLevel && (!preloadedLevel.isAudioRequired || isSound);

    if (isValidPreloaded && preloadedLevel) {
      setSelectedLevel(preloadedLevel);
      setAdaptationRationale(preloadedRationale);
      setMissionFraming(preloadedFraming || preloadedLevel.missionFraming || null);
      setCurrentView('puzzle');
      
      setPreloadedLevel(null);
      setPreloadedRationale(null);
      setPreloadedFraming(null);
      preloadNextAdaptiveLevel(progress);
    } else {
      const fallbackLevel = DEFAULT_LEVELS.find(l => (!l.isAudioRequired || isSound) && !progress.completedLevelIds.includes(l.id))
        || DEFAULT_LEVELS.find(l => !l.isAudioRequired || isSound)
        || DEFAULT_LEVELS[0];
      
      setSelectedLevel(fallbackLevel);
      setAdaptationRationale(null);
      setMissionFraming(fallbackLevel.missionFraming || 'Another rescue — practice what you know.');
      setCurrentView('puzzle');
      preloadNextAdaptiveLevel(progress);
    }
  };

  // Trigger real completion and update stats/history
  const handleLevelCompletion = (attempts: Record<string, { success: number; failure: number }>) => {
    if (!selectedLevel) return;

    // Record success
    const currentCompleted = [...progress.completedLevelIds];
    if (!currentCompleted.includes(selectedLevel.id)) {
      currentCompleted.push(selectedLevel.id);
    }

    const currentAttempts = { ...progress.vocabularyAttempts };
    // Track vocabulary stats based on level's correct/failed nodes
    Object.entries(attempts).forEach(([char, stats]) => {
      const current = currentAttempts[char] || { success: 0, failure: 0 };
      currentAttempts[char] = {
        success: current.success + stats.success,
        failure: current.failure + stats.failure
      };
    });

    // Initialize/clone adaptive model
    const adaptiveModel = {
      hanziToMeaning: { ...(progress.adaptiveModel?.hanziToMeaning || {}) },
      pinyinToMeaning: { ...(progress.adaptiveModel?.pinyinToMeaning || {}) },
      phraseToAction: { ...(progress.adaptiveModel?.phraseToAction || {}) },
      spatialComprehension: { ...(progress.adaptiveModel?.spatialComprehension || { success: 0, failure: 0 }) },
      orderedComprehension: { ...(progress.adaptiveModel?.orderedComprehension || { success: 0, failure: 0 }) },
      retentionLogs: [...(progress.adaptiveModel?.retentionLogs || [])],
      listeningKnowledge: { ...(progress.adaptiveModel?.listeningKnowledge || {}) }
    };

    // 1. Hanzi -> Meaning success tracking
    Object.entries(attempts).forEach(([char, stats]) => {
      const currentHanzi = adaptiveModel.hanziToMeaning[char] || { success: 0, failure: 0 };
      adaptiveModel.hanziToMeaning[char] = {
        success: currentHanzi.success + stats.success,
        failure: currentHanzi.failure + stats.failure
      };

      // 2. Pinyin -> Meaning success tracking
      if (progress.settings.pinyinToggle) {
        const currentPinyin = adaptiveModel.pinyinToMeaning[char] || { success: 0, failure: 0 };
        adaptiveModel.pinyinToMeaning[char] = {
          success: currentPinyin.success + stats.success,
          failure: currentPinyin.failure + stats.failure
        };
      }

      // 7. Listening knowledge — only for chars the learner actually heard
      const listened = new Set(progress.listenedChars || []);
      if (listened.has(char)) {
        const currentListening = adaptiveModel.listeningKnowledge[char] || { success: 0, failure: 0 };
        adaptiveModel.listeningKnowledge[char] = {
          success: currentListening.success + stats.success,
          failure: currentListening.failure + stats.failure
        };
      }
    });

    // 3. Phrase -> Action success tracking
    const currentPhrase = adaptiveModel.phraseToAction[selectedLevel.mandarinClue] || { success: 0, failure: 0 };
    adaptiveModel.phraseToAction[selectedLevel.mandarinClue] = {
      success: currentPhrase.success + 1,
      failure: currentPhrase.failure
    };

    // 4. Spatial-language comprehension success tracking ('左', '右', '上', '下')
    const hasSpatial = ['左', '右', '上', '下'].some(char => selectedLevel.mandarinClue.includes(char));
    if (hasSpatial) {
      adaptiveModel.spatialComprehension = {
        success: adaptiveModel.spatialComprehension.success + 1,
        failure: adaptiveModel.spatialComprehension.failure
      };
    }

    // 5. Ordered-instruction comprehension success tracking ('先', '再', '后')
    const hasOrdered = ['先', '再', '后'].some(char => selectedLevel.mandarinClue.includes(char));
    if (hasOrdered) {
      adaptiveModel.orderedComprehension = {
        success: adaptiveModel.orderedComprehension.success + 1,
        failure: adaptiveModel.orderedComprehension.failure
      };
    }

    // 6. Delayed retention logs
    selectedLevel.nodes.forEach(node => {
      if (node.type === 'checkpoint' || node.type === 'key') {
        const lastTestedTime = Date.now();
        const sessionIndex = currentCompleted.length;
        
        adaptiveModel.retentionLogs = adaptiveModel.retentionLogs.filter(
          log => log.charOrPhrase !== node.chineseChar
        );

        adaptiveModel.retentionLogs.push({
          charOrPhrase: node.chineseChar,
          lastTestedTime,
          sessionIndex,
          recalled: true
        });
      }
    });

    const stillGuided = shouldUseGuidedAssists({ ...progress, adaptiveModel });
    const wasGuided = shouldUseGuidedAssists(progress);
    const updated: PlayerProgress = {
      ...progress,
      completedLevelIds: currentCompleted,
      vocabularyAttempts: currentAttempts,
      adaptiveModel,
      // One-time fade when learner crosses guided → independent threshold
      settings: wasGuided && !stillGuided
        ? { ...progress.settings, pinyinToggle: false, translationToggle: false }
        : progress.settings
    };

    updateProgress(updated);
    // Quietly refresh next rescue using latest struggle stats
    preloadNextAdaptiveLevel(updated);
  };

  // Advance: curated sequence first, then invisible adapted rescues
  const handleAdvanceLevel = () => {
    if (!selectedLevel) return;
    const currentIndex = DEFAULT_LEVELS.findIndex(l => l.id === selectedLevel.id);
    if (currentIndex !== -1 && currentIndex + 1 < DEFAULT_LEVELS.length) {
      const next = DEFAULT_LEVELS[currentIndex + 1];
      setSelectedLevel(next);
      setAdaptationRationale(null);
      setMissionFraming(next.missionFraming || null);
      preloadNextAdaptiveLevel(progress);
    } else {
      // End of curated arc or already on adapted level → next rescue from preload
      consumeNextRescue();
    }
  };

  // Handle detailed failure events with separate error stats
  const handleLevelFailure = (errorType: 'language' | 'drawing', failedChars: string[]) => {
    if (!selectedLevel) return;

    const currentAttempts = { ...progress.vocabularyAttempts };
    
    // Increment fails for vocabulary they struggled on
    failedChars.forEach(char => {
      const current = currentAttempts[char] || { success: 0, failure: 0 };
      currentAttempts[char] = {
        success: current.success,
        failure: current.failure + 1
      };
    });

    // Initialize/clone adaptive model
    const adaptiveModel = {
      hanziToMeaning: { ...(progress.adaptiveModel?.hanziToMeaning || {}) },
      pinyinToMeaning: { ...(progress.adaptiveModel?.pinyinToMeaning || {}) },
      phraseToAction: { ...(progress.adaptiveModel?.phraseToAction || {}) },
      spatialComprehension: { ...(progress.adaptiveModel?.spatialComprehension || { success: 0, failure: 0 }) },
      orderedComprehension: { ...(progress.adaptiveModel?.orderedComprehension || { success: 0, failure: 0 }) },
      retentionLogs: [...(progress.adaptiveModel?.retentionLogs || [])],
      listeningKnowledge: { ...(progress.adaptiveModel?.listeningKnowledge || {}) }
    };

    if (errorType === 'language') {
      failedChars.forEach(char => {
        // 1. Hanzi -> Meaning failure
        const currentHanzi = adaptiveModel.hanziToMeaning[char] || { success: 0, failure: 0 };
        adaptiveModel.hanziToMeaning[char] = {
          success: currentHanzi.success,
          failure: currentHanzi.failure + 1
        };

        // 2. Pinyin -> Meaning failure
        if (progress.settings.pinyinToggle) {
          const currentPinyin = adaptiveModel.pinyinToMeaning[char] || { success: 0, failure: 0 };
          adaptiveModel.pinyinToMeaning[char] = {
            success: currentPinyin.success,
            failure: currentPinyin.failure + 1
          };
        }

        // 7. Listening failure only if they actually heard this char
        const listened = new Set(progress.listenedChars || []);
        if (listened.has(char)) {
          const currentListening = adaptiveModel.listeningKnowledge[char] || { success: 0, failure: 0 };
          adaptiveModel.listeningKnowledge[char] = {
            success: currentListening.success,
            failure: currentListening.failure + 1
          };
        }
      });

      // 3. Phrase -> Action failure
      const currentPhrase = adaptiveModel.phraseToAction[selectedLevel.mandarinClue] || { success: 0, failure: 0 };
      adaptiveModel.phraseToAction[selectedLevel.mandarinClue] = {
        success: currentPhrase.success,
        failure: currentPhrase.failure + 1
      };

      // 4. Spatial-language comprehension failure
      const hasSpatial = ['左', '右', '上', '下'].some(char => selectedLevel.mandarinClue.includes(char));
      if (hasSpatial) {
        adaptiveModel.spatialComprehension = {
          success: adaptiveModel.spatialComprehension.success,
          failure: adaptiveModel.spatialComprehension.failure + 1
        };
      }

      // 5. Ordered-instruction comprehension failure
      const hasOrdered = ['先', '再', '后'].some(char => selectedLevel.mandarinClue.includes(char));
      if (hasOrdered) {
        adaptiveModel.orderedComprehension = {
          success: adaptiveModel.orderedComprehension.success,
          failure: adaptiveModel.orderedComprehension.failure + 1
        };
      }

      // 6. Retention failure tracking
      failedChars.forEach(char => {
        adaptiveModel.retentionLogs = adaptiveModel.retentionLogs.filter(
          log => log.charOrPhrase !== char
        );
        adaptiveModel.retentionLogs.push({
          charOrPhrase: char,
          lastTestedTime: Date.now(),
          sessionIndex: progress.completedLevelIds.length,
          recalled: false
        });
      });
    }

    const updated: PlayerProgress = {
      ...progress,
      vocabularyAttempts: currentAttempts,
      languageErrors: (progress.languageErrors || 0) + (errorType === 'language' ? 1 : 0),
      drawingErrors: (progress.drawingErrors || 0) + (errorType === 'drawing' ? 1 : 0),
      adaptiveModel
    };

    updateProgress(updated);
    // After a fail, refresh the next rescue so review words stay current
    preloadNextAdaptiveLevel(updated);
  };

  return (
    <div className={`bg-[#141211] text-[#FAF9F6] font-sans flex flex-col items-center selection:bg-amber-950/40 ${currentView === 'puzzle' ? 'app-shell-puzzle' : 'min-h-screen app-shell-default'}`}>
      
      {/* App chrome — hidden on puzzle so GameCanvas owns the compact mission header */}
      {currentView !== 'puzzle' && (
      <header className="w-full bg-[#141211]/90 border-b border-stone-850/60 px-4 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md shrink-0 max-w-md py-3.5">
        <div className="flex items-center gap-2">
          {currentView !== 'dashboard' ? (
            <button 
              type="button"
              onClick={() => {
                if (currentView === 'settings' && selectedLevel) {
                  setCurrentView('puzzle');
                  return;
                }
                setCurrentView('dashboard');
                setSelectedLevel(null);
              }}
              className="p-1.5 rounded-full hover:bg-stone-850 text-stone-300 transition cursor-pointer min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
              id="back-to-dashboard-btn"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <div className="p-1.5 bg-stone-850 text-amber-400 rounded-xl">
              <Compass className="w-5 h-5" />
            </div>
          )}
          <span className="font-display font-black text-lg tracking-tight text-[#FAF9F6]">Mandarin Rescue</span>
        </div>

        <div className="flex items-center gap-2">
          {isOnline ? (
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" title="Online — next rescues ready" />
          ) : (
            <span className="flex h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" title="Offline — curated missions available" />
          )}
          <button
            type="button"
            onClick={() => setCurrentView(currentView === 'settings' ? 'dashboard' : 'settings')}
            className={`p-2 rounded-xl transition cursor-pointer min-h-[44px] min-w-[44px] inline-flex items-center justify-center ${currentView === 'settings' ? 'bg-stone-800 text-[#FAF9F6]' : 'text-stone-400 hover:bg-stone-850/60'}`}
            id="settings-toggle-btn"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>
      )}

      {/* Landscape rotate gate — portrait-only play on phones */}
      {currentView === 'puzzle' && (
        <div
          className="rotate-portrait-gate flex-col items-center justify-center gap-3 text-center px-8 w-full h-full max-w-md"
          role="status"
          aria-live="polite"
        >
          <Compass className="w-10 h-10 text-amber-400" />
          <p className="font-display font-bold text-xl text-[#FAF9F6]">Rotate to portrait</p>
          <p className="text-sm text-stone-400 leading-relaxed max-w-xs">
            Mandarin Rescue is built for portrait play — rotate your phone to continue drawing the rescue path.
          </p>
        </div>
      )}

      {/* Main — puzzle is edge-tight so the board can claim leftover height */}
      <main className={`w-full flex-1 flex flex-col min-h-0 ${
        currentView === 'puzzle'
          ? 'puzzle-play-root max-w-md px-2 pt-2 pb-2'
          : 'max-w-md p-4 pb-24'
      }`}>
        
        {/* VIEW 1: DASHBOARD */}
        {currentView === 'dashboard' && (
          <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-3 duration-200" id="view-dashboard">

            {/* Primary session ritual — game-first, not a lab dashboard */}
            <div className="bg-[#1C1A17] border border-amber-900/30 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90">Rescue kennel</p>
                  <h2 className="font-display font-black text-2xl text-[#FAF9F6] mt-0.5 tracking-tight">
                    Mandarin Rescue
                  </h2>
                  <p className="text-xs text-stone-400 mt-1.5 leading-relaxed max-w-xs">
                    Read the clue. Draw the path. Get the beagle home.
                  </p>
                </div>
                <div className="shrink-0 text-right rounded-xl bg-[#141211] border border-stone-850 px-3 py-2">
                  <div className="flex items-center justify-end gap-1 text-amber-300">
                    <PawPrint className="w-3.5 h-3.5" />
                    <span className="text-lg font-black tabular-nums">{rescuesCompleted}</span>
                  </div>
                  <p className="text-[9px] text-stone-500 font-semibold uppercase tracking-wide mt-0.5">
                    Rescues done
                  </p>
                </div>
              </div>

              {dueReviewChars.length > 0 && (
                <p className="text-[11px] text-amber-200/85 bg-amber-950/25 border border-amber-900/25 rounded-xl px-3 py-2 leading-snug">
                  Today’s path revisits {dueReviewChars.slice(0, 4).join(' · ')}
                </p>
              )}

              <button
                type="button"
                onClick={startTodaysRescue}
                className="w-full bg-amber-500 hover:bg-amber-400 text-[#141211] rounded-xl py-3.5 text-sm font-black transition active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 shadow-lg min-h-[48px]"
                id="continue-rescue-btn"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{rescuesCompleted === 0 ? "Today’s rescue" : 'Continue rescue'}</span>
              </button>

              <button
                type="button"
                onClick={consumeNextRescue}
                className="w-full bg-stone-100/5 hover:bg-stone-100/10 text-stone-200 border border-stone-800 rounded-xl py-2.5 text-xs font-bold transition active:scale-[0.98] cursor-pointer flex flex-col items-center justify-center gap-0.5 min-h-[44px] px-3"
                id="next-rescue-btn"
              >
                <span className="flex items-center gap-2">
                  <span>Practice another rescue</span>
                  <ChevronRight className="w-4 h-4 text-stone-500" />
                </span>
                <span className="text-[10px] font-medium text-stone-500 normal-case tracking-normal">
                  Next mission follows how you play — offline rooms if the network’s out
                </span>
              </button>
            </div>

            {/* Room list */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold tracking-wider text-stone-500 uppercase">Courtyard rooms</h2>
                <span className="text-xs font-semibold text-amber-300 bg-amber-950/20 border border-amber-900/20 px-2 py-1 rounded-full">
                  {progress.completedLevelIds.filter((id) => DEFAULT_LEVELS.some((l) => l.id === id)).length} / {DEFAULT_LEVELS.length}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {DEFAULT_LEVELS.map((lvl) => {
                  const isCompleted = progress.completedLevelIds.includes(lvl.id);
                  return (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => {
                        setSelectedLevel(lvl);
                        setAdaptationRationale(null);
                        setMissionFraming(lvl.missionFraming || null);
                        setCurrentView('puzzle');
                      }}
                      className="text-left bg-[#1C1A17] border border-stone-850/60 hover:border-stone-800 rounded-2xl p-4 shadow-sm transition duration-200 flex items-center justify-between group cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${isCompleted ? 'bg-emerald-950/20 text-emerald-400' : 'bg-[#141211] text-stone-500'}`}>
                          <CheckCircle className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-stone-200 text-sm">{lvl.title}</h4>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-lg font-bold text-stone-100 font-serif">{lvl.mandarinClue}</span>
                            <span className="text-xs text-stone-500">({lvl.pinyinClue})</span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-stone-600 group-hover:text-stone-400 transition" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Collapsed kennel log — adaptive stats secondary */}
            <div className="bg-[#1C1A17] border border-stone-850/60 rounded-2xl shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setKennelOpen((v) => !v)}
                className="w-full flex items-center justify-between gap-3 p-4 text-left cursor-pointer hover:bg-stone-900/40 transition min-h-[44px]"
                aria-expanded={kennelOpen}
                id="kennel-log-toggle"
              >
                <span className="font-bold text-stone-200 text-xs uppercase tracking-wider flex items-center gap-2">
                  <Compass className="w-4 h-4 text-amber-400" />
                  Kennel log
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-[10px] text-stone-500 font-semibold">
                    {dueReviewChars.length} due · {Object.keys(progress.adaptiveModel?.hanziToMeaning || {}).length} words
                  </span>
                  <ChevronDown className={`w-4 h-4 text-stone-500 transition ${kennelOpen ? 'rotate-180' : ''}`} />
                </span>
              </button>

              <AnimatePresence initial={false}>
                {kennelOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 flex flex-col gap-3 border-t border-stone-850/50 pt-3">
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="border border-stone-850 rounded-xl p-3 bg-[#141211]/50">
                          <div className="text-stone-500 font-bold uppercase tracking-wide text-[9px]">Words strong</div>
                          <div className="text-base font-black text-stone-200 mt-1">
                            {Object.values(progress.adaptiveModel?.hanziToMeaning || {}).filter((h: { success: number }) => h.success >= 3).length}
                          </div>
                        </div>
                        <div className="border border-stone-850 rounded-xl p-3 bg-[#141211]/50">
                          <div className="text-stone-500 font-bold uppercase tracking-wide text-[9px]">Review due</div>
                          <div className="text-base font-black text-stone-200 mt-1">{dueReviewChars.length}</div>
                        </div>
                        <div className="border border-stone-850 rounded-xl p-3 bg-[#141211]/50">
                          <div className="text-stone-500 font-bold uppercase tracking-wide text-[9px]">Directions</div>
                          <div className="text-base font-black text-stone-200 mt-1">
                            {(() => {
                              const s = progress.adaptiveModel?.spatialComprehension || { success: 0, failure: 0 };
                              const total = s.success + s.failure;
                              if (total === 0) return '—';
                              return `${Math.round((s.success / total) * 100)}%`;
                            })()}
                          </div>
                        </div>
                        <div className="border border-stone-850 rounded-xl p-3 bg-[#141211]/50">
                          <div className="text-stone-500 font-bold uppercase tracking-wide text-[9px]">Order (先/再)</div>
                          <div className="text-base font-black text-stone-200 mt-1">
                            {(() => {
                              const o = progress.adaptiveModel?.orderedComprehension || { success: 0, failure: 0 };
                              const total = o.success + o.failure;
                              if (total === 0) return '—';
                              return `${Math.round((o.success / total) * 100)}%`;
                            })()}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-center text-[10px] pt-1">
                        <div className="text-rose-400 font-semibold">
                          Language misses: <span className="font-bold tabular-nums">{progress.languageErrors || 0}</span>
                        </div>
                        <div className="text-amber-300 font-semibold">
                          Path misses: <span className="font-bold tabular-nums">{progress.drawingErrors || 0}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Install — secondary */}
            <div className="bg-[#1C1A17] border border-stone-850/60 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-stone-850 text-amber-400 rounded-xl">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-stone-100 text-sm">Install for phone play</h3>
                  <p className="text-[11px] text-stone-400 mt-0.5 leading-relaxed">
                    Home-screen app on iOS or Android — same rescues, fuller screen.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <PWAInstallButton />
              </div>
            </div>

          </div>
        )}

        {/* VIEW 2: PUZZLE STAGE (INTERACTIVE GAMEPLAY) */}
        {currentView === 'puzzle' && selectedLevel && (
          <div className="flex flex-col animate-in fade-in slide-in-from-bottom-3 duration-200 flex-1 min-h-0 w-full" id="view-puzzle">
            {/* Direct, clean immersive layout with absolutely no redundant top lesson header */}
            <GameCanvas
              level={selectedLevel}
              onSuccess={handleLevelCompletion}
              onFailure={handleLevelFailure}
              onBackToDashboard={() => { setCurrentView('dashboard'); setSelectedLevel(null); }}
              onOpenSettings={() => setCurrentView('settings')}
              onNextLevel={handleAdvanceLevel}
              soundEnabled={progress.settings.soundEnabled}
              pinyinEnabled={progress.settings.pinyinToggle}
              translationEnabled={progress.settings.translationToggle}
              progress={progress}
              adaptationRationale={adaptationRationale}
              missionFraming={missionFraming}
              onClueSpoken={handleClueSpoken}
              onEnableSound={() => {
                if (!progress.settings.soundEnabled) {
                  updateProgress({
                    ...progress,
                    settings: { ...progress.settings, soundEnabled: true }
                  });
                }
              }}
              reviewChars={dueReviewChars}
              showDrawCoach={showDrawCoach}
              onDismissDrawCoach={() => {
                saveDrawCoachDismissed();
                setShowDrawCoach(false);
              }}
            />
          </div>
        )}

        {/* VIEW 3: SETTINGS PANEL */}
        {currentView === 'settings' && (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-3 duration-200" id="view-settings">
            <h2 className="text-xs font-bold tracking-wider text-stone-500 uppercase">Preferences & Options</h2>
            
            <div className="bg-[#1C1A17] border border-stone-850/60 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
              
              <div className="flex items-center justify-between pb-3 border-b border-stone-850/40">
                <div>
                  <h4 className="font-bold text-stone-200 text-sm">Sound</h4>
                  <p className="text-[11px] text-stone-400">Optional — use Listen on a mission, or toggle here</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleSetting('soundEnabled')}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${progress.settings.soundEnabled ? 'bg-amber-400 justify-end' : 'bg-stone-800 justify-start'}`}
                  id="toggle-sound-btn"
                >
                  <motion.div layout className="w-4 h-4 bg-white rounded-full shadow-md" />
                </button>
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-stone-850/40">
                <div>
                  <h4 className="font-bold text-stone-200 text-sm">Pinyin Pronunciation</h4>
                  <p className="text-[11px] text-stone-400">Display Romanized help (māo chī yú)</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleSetting('pinyinToggle')}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${progress.settings.pinyinToggle ? 'bg-amber-400 justify-end' : 'bg-stone-800 justify-start'}`}
                  id="toggle-pinyin-btn"
                >
                  <motion.div layout className="w-4 h-4 bg-white rounded-full shadow-md" />
                </button>
              </div>

              <div className="flex items-center justify-between pb-3">
                <div>
                  <h4 className="font-bold text-stone-200 text-sm">English Translations</h4>
                  <p className="text-[11px] text-stone-400">Display auxiliary english clues</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleSetting('translationToggle')}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${progress.settings.translationToggle ? 'bg-amber-400 justify-end' : 'bg-stone-800 justify-start'}`}
                  id="toggle-translation-btn"
                >
                  <motion.div layout className="w-4 h-4 bg-white rounded-full shadow-md" />
                </button>
              </div>

            </div>

            <div className="bg-[#1C1A17] border border-stone-850/60 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
              <h4 className="font-bold text-stone-200 text-sm">Vocabulary Progress Logs</h4>
              <p className="text-xs text-stone-400 leading-relaxed">Words learned programmatically through route drawings are logged here.</p>
              
              {Object.keys(progress.vocabularyAttempts).length === 0 ? (
                <p className="text-xs text-stone-500 italic text-center py-4">No vocabulary records yet. Complete a level to log achievements.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {Object.entries(progress.vocabularyAttempts).map(([word, stat]: [string, any]) => (
                    <div key={word} className="border border-stone-850 rounded-xl p-3 bg-[#141211]/50 flex items-center justify-between">
                      <span className="text-lg font-bold text-stone-100 font-serif">{word}</span>
                      <div className="text-right">
                        <span className="text-[10px] block font-bold text-emerald-400">{stat.success} Ok</span>
                        <span className="text-[10px] block font-bold text-rose-400">{stat.failure} Fail</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                if (window.confirm('Reset progress? This clears local puzzle histories.')) {
                  updateProgress(DEFAULT_PROGRESS);
                }
              }}
              className="mt-4 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:underline text-center cursor-pointer"
            >
              Reset Player Progress Data
            </button>
          </div>
        )}

      </main>

      {/* Persistent Offline Notification */}
      <OfflineIndicator />
    </div>
  );
}
