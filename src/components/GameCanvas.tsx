import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw, ArrowRight, Zap, CheckCircle2, AlertTriangle, HelpCircle, Volume2, ArrowLeft, Settings } from 'lucide-react';
import { Level, PlayerProgress } from '../types';
import { getVocabularyStage } from '../lib/persistence';
import { freshBoardSeed, instantiateLevel, type InstantiatedLevel } from '../lib/boardVariants';
import { patrolPositionAt } from '../lib/mazeKit';
import { orderedContactsAlongPath, nearestPointOnPolyline, pathTouchesPoint, pathTouchesPolyline, pointToPathSegmentDistance } from '../lib/pathGeometry';
import { getScreenSpaceBarrierContact } from '../lib/mazeInteractionGeometry';

/** Fixed screen-space radii keep portrait corridors equally forgiving in both directions. */
const WALL_CONTACT_RADIUS_PX = 4;
const GATE_CONTACT_RADIUS_PX = 3;
/** Beagle trot speed in board-units / sec (shared with patrol timing puzzle). */
const BEAGLE_SPEED = 55;
/** Keep maze/labels inset from the board frame so edge nodes never clip. */
const PLAY_INSET = 0.06;

interface GameCanvasProps {
  /** Curated template — geometry is re-instantiated per attempt so memory ≠ solution. */
  level: Level;
  onSuccess: (attempts: Record<string, { success: number; failure: number }>, playedLevel: Level) => void;
  onFailure?: (errorType: 'language' | 'drawing', failedChars: string[], playedLevel: Level) => void;
  onBackToDashboard: () => void;
  onOpenSettings?: () => void;
  onNextLevel?: () => void;
  soundEnabled: boolean;
  pinyinEnabled: boolean;
  translationEnabled: boolean;
  progress: PlayerProgress;
  adaptationRationale?: string | null;
  missionFraming?: string | null;
  /** Fired when TTS actually speaks (for listening attribution). */
  onClueSpoken?: (clue: string) => void;
  /** Opt-in: Listen can unmute for subsequent sessions. */
  onEnableSound?: () => void;
  /** Due review chars — shown when this mission revisits them. */
  reviewChars?: string[];
  /** First-run one-line draw coach. */
  showDrawCoach?: boolean;
  onDismissDrawCoach?: () => void;
}

const GRAMMAR_DICT: Record<string, { pinyin: string; english: string; emoji?: string }> = {
  '小': { pinyin: 'xiǎo', english: 'small / little' },
  '狗': { pinyin: 'gǒu', english: 'dog', emoji: '🐶' },
  '小狗': { pinyin: 'xiǎogǒu', english: 'puppy / little dog', emoji: '🐶' },
  '犬': { pinyin: 'quǎn', english: 'dog / hound', emoji: '🐕' },
  '回': { pinyin: 'huí', english: 'return / go back' },
  '家': { pinyin: 'jiā', english: 'home', emoji: '🏠' },
  '回家': { pinyin: 'huíjiā', english: 'go / return home', emoji: '🏠' },
  '先': { pinyin: 'xiān', english: 'first' },
  '喝': { pinyin: 'hē', english: 'drink' },
  '水': { pinyin: 'shuǐ', english: 'water', emoji: '💧' },
  '再': { pinyin: 'zài', english: 'then' },
  '吃': { pinyin: 'chī', english: 'eat' },
  '肉': { pinyin: 'ròu', english: 'meat', emoji: '🥩' },
  '草': { pinyin: 'cǎo', english: 'grass', emoji: '🌿' },
  '避': { pinyin: 'bì', english: 'avoid' },
  '开': { pinyin: 'kāi', english: 'open / turn on' },
  '避开': { pinyin: 'bìkāi', english: 'avoid / keep away from', emoji: '⚠️' },
  '走': { pinyin: 'zǒu', english: 'walk / take' },
  '安': { pinyin: 'ān', english: 'safe' },
  '全': { pinyin: 'quán', english: 'complete' },
  '安全': { pinyin: 'ānquán', english: 'safe / safety' },
  '路': { pinyin: 'lù', english: 'path / road', emoji: '🛣️' },
  '后': { pinyin: 'hòu', english: 'after / then' },
  '用': { pinyin: 'yòng', english: 'use' },
  '钥': { pinyin: 'yào', english: 'key component in 钥匙' },
  '匙': { pinyin: 'shi', english: 'second syllable of 钥匙' },
  '钥匙': { pinyin: 'yàoshi', english: 'key', emoji: '🔑' },
  '门': { pinyin: 'mén', english: 'door / gate', emoji: '🚪' },
  '安全门': { pinyin: 'ānquánmén', english: 'safety door / gate', emoji: '🚪' },
  '向': { pinyin: 'xiàng', english: 'towards' },
  '左': { pinyin: 'zuǒ', english: 'left', emoji: '⬅️' },
  '是': { pinyin: 'shì', english: 'is / are' },
  '源': { pinyin: 'yuán', english: 'source / resource' },
  '水源': { pinyin: 'shuǐyuán', english: 'water source', emoji: '💧' },
  '右': { pinyin: 'yòu', english: 'right', emoji: '➡️' },
  '边': { pinyin: 'biān', english: 'side' },
  '右边': { pinyin: 'yòubian', english: 'right side', emoji: '➡️' },
  '下': { pinyin: 'xià', english: 'down / downward', emoji: '⬇️' },
  '上': { pinyin: 'shàng', english: 'up / upward', emoji: '⬆️' },
  '通': { pinyin: 'tōng', english: 'pass' },
  '过': { pinyin: 'guò', english: 'through' },
  '通过': { pinyin: 'tōngguò', english: 'pass through' },
  '和': { pinyin: 'hé', english: 'and' },
  '捷': { pinyin: 'jié', english: 'quick' },
  '径': { pinyin: 'jìng', english: 'path' },
  '捷径': { pinyin: 'jiéjìng', english: 'shortcut', emoji: '⚡' },
  '省': { pinyin: 'shěng', english: 'save' },
  '能': { pinyin: 'néng', english: 'can / be able to' },
  '能源': { pinyin: 'néngyuán', english: 'energy / energy resources', emoji: '🔋' },
  '机': { pinyin: 'jī', english: 'machine' },
  '关': { pinyin: 'guān', english: 'close / turn off; barrier' },
  '开关': { pinyin: 'kāiguān', english: 'switch', emoji: '🎛️' },
  '机关': { pinyin: 'jīguān', english: 'mechanism / device; organization' },
  '火': { pinyin: 'huǒ', english: 'fire', emoji: '🔥' },
  '去': { pinyin: 'qù', english: 'go to' },
  '拿': { pinyin: 'ná', english: 'take / grab' },
  '踩': { pinyin: 'cǎi', english: 'step / tread on' },
  '捕': { pinyin: 'bǔ', english: 'catch / capture' },
  '员': { pinyin: 'yuán', english: 'member / personnel' },
  '追捕者': { pinyin: 'zhuībǔzhě', english: 'pursuer / catcher', emoji: '🚨' },
  '技术员': { pinyin: 'jìshùyuán', english: 'technician', emoji: '🧪' }
};

interface InteractiveClueProps {
  clue: string;
  scaffold?: { char: string; pinyin: string; english: string; emoji?: string; stage: string }[];
  /** When assists (pinyin/english) are already on screen, skip the redundant coach line. */
  showCoachHint?: boolean;
}

/** Punctuation / spacing in Mandarin clues — shown inline, not tappable. */
const CLUE_PUNCT = /[，。、；：！？,\s·…—–-]/;
/** Mission nouns get slight emphasis; grammar glue stays quieter. */
const MISSION_NOUNS = new Set([
  '狗', '犬', '家', '水', '肉', '草', '火', '路', '钥', '匙', '门',
  '左', '右', '下', '上', '源', '径', '关', '捕', '员',
]);

function InteractiveClue({ clue, scaffold, showCoachHint = true }: InteractiveClueProps) {
  const [activeTokenIndex, setActiveTokenIndex] = useState<number | null>(null);
  const helperWords = [...new Set([
    ...Object.keys(GRAMMAR_DICT),
    ...(scaffold || []).map(item => item.char),
  ])].sort((a, b) => Array.from(b).length - Array.from(a).length);
  const tokens: string[] = [];
  for (let index = 0; index < clue.length;) {
    const match = helperWords.find(word => clue.startsWith(word, index));
    if (match) {
      tokens.push(match);
      index += match.length;
    } else {
      const [next] = Array.from(clue.slice(index));
      tokens.push(next);
      index += next.length;
    }
  }
  // Always show the full phrase: roomy on short clues, denser wrap on long ones
  const density = Array.from(clue).length <= 7 ? 'roomy' : 'compact';
  const sizeClass =
    density === 'roomy'
      ? 'text-4xl min-h-[48px] min-w-[44px] px-1'
      : 'text-3xl min-h-[44px] min-w-[40px] px-0.5';

  const activeHelper =
    activeTokenIndex !== null
      ? scaffold?.find(s => s.char === tokens[activeTokenIndex]) || GRAMMAR_DICT[tokens[activeTokenIndex]]
      : null;

  return (
    <div className="relative z-40 flex flex-col items-stretch gap-0.5 w-full min-w-0">
      <div
        className="flex flex-wrap justify-center items-center gap-x-0 gap-y-0.5 px-2 py-0.5 text-center"
        role="group"
        aria-label="Mandarin clue. Tap a word for pinyin and meaning."
      >
        {tokens.map((token, index) => {
          if (CLUE_PUNCT.test(token)) {
            return (
              <span
                key={index}
                className={`${density === 'roomy' ? 'text-3xl' : 'text-2xl'} text-stone-300 font-serif px-0.5 leading-none select-none`}
                aria-hidden
              >
                {token}
              </span>
            );
          }

          const helper = scaffold?.find(s => s.char === token) || GRAMMAR_DICT[token];
          const hasHelp = !!helper;
          const isMission =
            Array.from(token).some(char => MISSION_NOUNS.has(char)) ||
            !!helper?.emoji ||
            !!scaffold?.some(s => s.char === token);
          const isActive = activeTokenIndex === index && hasHelp;

          return (
            <button
              key={index}
              type="button"
              onClick={() => {
                if (!hasHelp) return;
                setActiveTokenIndex(activeTokenIndex === index ? null : index);
              }}
              aria-expanded={hasHelp ? activeTokenIndex === index : undefined}
              aria-label={hasHelp ? `${token}, show meaning` : token}
              tabIndex={hasHelp ? 0 : -1}
              className={`${sizeClass} font-serif inline-flex items-center justify-center rounded-md transition duration-150 select-none leading-none ${
                hasHelp
                  ? `cursor-pointer active:scale-95 ${
                      isMission
                        ? 'text-amber-100 font-black hover:bg-amber-400/10'
                        : 'text-stone-100 font-bold hover:bg-stone-800/50'
                    }`
                  : 'text-stone-300 font-semibold cursor-default'
              } ${isActive ? 'bg-amber-400/15 text-amber-50 ring-1 ring-amber-400/40' : ''}`}
            >
              {token}
            </button>
          );
        })}
      </div>

      {showCoachHint && (
        <p className="text-[11px] text-stone-300 text-center leading-snug px-2 pt-0.5 pb-0.5">
          Tap a word for meaning
        </p>
      )}

      {/* In-flow meaning card cannot clip into a phone notch or cover the clue. */}
      <AnimatePresence>
        {activeTokenIndex !== null && activeHelper && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            aria-label={`${tokens[activeTokenIndex]} meaning`}
            aria-live="polite"
            className="mx-auto mt-1 min-h-[44px] max-w-[calc(100vw-1rem)] rounded-xl border border-amber-700/60 bg-[#1C1A17] px-3 py-1.5 shadow-lg flex items-center justify-center gap-2 text-center"
          >
            <span className="text-sm font-black text-amber-300 tracking-wide">{activeHelper.pinyin}</span>
            <span className="h-4 w-px bg-stone-700" aria-hidden />
            <span className="text-xs font-medium text-[#FAF9F6] leading-tight">{activeHelper.english}</span>
            {activeHelper.emoji && <span className="text-lg" aria-hidden>{activeHelper.emoji}</span>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function GameCanvas({
  level: levelTemplate,
  onSuccess,
  onFailure,
  onBackToDashboard,
  onOpenSettings,
  onNextLevel,
  soundEnabled,
  pinyinEnabled,
  translationEnabled,
  progress,
  adaptationRationale,
  missionFraming,
  onClueSpoken,
  onEnableSound,
  reviewChars = [],
  showDrawCoach = false,
  onDismissDrawCoach
}: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const boardSlotRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const wallContactIdRef = useRef<string | null>(null);

  // Layout — board fills the slot; SVG tracks its box
  const [dimensions, setDimensions] = useState({ width: 320, height: 400 });

  // Playable board instance (reshuffled each enter / retry — never memorize one path)
  const [level, setLevel] = useState<InstantiatedLevel>(() => instantiateLevel(levelTemplate));
  const [playKey, setPlayKey] = useState(0);
  const levelTemplateIdRef = useRef(levelTemplate.id);
  // Game/Drawing States
  const [drawnPath, setDrawnPath] = useState<{ x: number; y: number }[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [beaglePos, setBeaglePos] = useState<{ x: number; y: number } | null>(null);
  const [rhythmState, setRhythmState] = useState<'quiet' | 'drawing' | 'anticipation' | 'execute' | 'rescue' | 'settlement' | 'settle'>('quiet');
  /** Arc-length progress along drawnPath during simulation (never chord-cuts corners). */
  const simDistanceRef = useRef(0);
  const simRafRef = useRef<number | null>(null);
  const simLastTsRef = useRef<number | null>(null);

  // Interactive Live Touch Feedback
  const [activeDrawCoord, setActiveDrawCoord] = useState<{ x: number; y: number } | null>(null);
  const [wallShockwave, setWallShockwave] = useState<{ x: number; y: number; wallId: string } | null>(null);
  const [hazardAlert, setHazardAlert] = useState<string | null>(null);
  const [reachGoalNotice, setReachGoalNotice] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [visibleLabelIds, setVisibleLabelIds] = useState<string[]>([]);

  // Dynamic Item/Primitive States
  const [collectedKeys, setCollectedKeys] = useState<string[]>([]);
  const [activatedSwitches, setActivatedSwitches] = useState<string[]>([]);
  const [visitedCheckpoints, setVisitedCheckpoints] = useState<string[]>([]);
  const [visitOrder, setVisitOrder] = useState<string[]>([]);
  const [inactiveWalls, setInactiveWalls] = useState<string[]>([]);

  // Win/Loss Outcomes
  const [status, setStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [feedbackMsg, setFeedbackMsg] = useState<string>('');
  const [feedbackKind, setFeedbackKind] = useState<'language' | 'drawing' | 'success' | 'info' | null>(null);
  const [failureMarker, setFailureMarker] = useState<{
    x: number;
    y: number;
    type: 'wall' | 'door' | 'hazard' | 'oneway' | 'limit' | 'missed_checkpoint' | 'wrong_target' | 'wrong_order';
  } | null>(null);
  const [payoffParticles, setPayoffParticles] = useState<{ id: number; x: number; y: number; delay: number; scale: number; emoji: string }[]>([]);
  /** Live patrol positions (idle preview + simulation collision). */
  const [patrolPos, setPatrolPos] = useState<Record<string, { x: number; y: number }>>({});

  const showPinyin = pinyinEnabled || !!level.forceAssists;
  const showTranslation = translationEnabled || !!level.forceAssists;
  const usedSafeBoardFallback = Boolean(level.usedSafeBoardFallback);
  const framingLine = usedSafeBoardFallback
    ? level.missionFraming || null
    : missionFraming || level.missionFraming || adaptationRationale || null;
  const revisitChars = reviewChars
    .filter(
      (c) =>
        level.mandarinClue.includes(c) ||
        level.nodes.some((n) => n.chineseChar === c || n.chineseChar.includes(c))
    )
    .slice(0, 3);

  // Optional Listen only — never autoplay (silent-first)
  const speakClue = () => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(level.mandarinClue);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.85;
    utterance.onstart = () => onClueSpoken?.(level.mandarinClue);
    window.speechSynthesis.speak(utterance);
  };

  const handleListen = () => {
    if (!soundEnabled) onEnableSound?.();
    speakClue();
  };

  useEffect(() => {
    setShowHint(false);
  }, [level.id]);

  // Board fills the slot; sync SVG math to its box
  useEffect(() => {
    const board = containerRef.current;
    const slot = boardSlotRef.current;
    if (!board && !slot) return;

    const update = () => {
      const target = board ?? slot;
      if (!target) return;
      const { width, height } = target.getBoundingClientRect();
      setDimensions({
        width: Math.max(120, Math.floor(width)),
        height: Math.max(120, Math.floor(height)),
      });
    };

    const observer = new ResizeObserver(update);
    if (slot) observer.observe(slot);
    if (board) observer.observe(board);
    update();
    return () => observer.disconnect();
  }, []);

  // Initialize Beagle position to start node
  const actorNode = level.nodes.find(n => n.type === 'actor');
  const goalNode = level.nodes.find(n => n.type === 'goal');

  const resetGameplayState = (board: Level = level) => {
    if (simRafRef.current != null) {
      cancelAnimationFrame(simRafRef.current);
      simRafRef.current = null;
    }
    simDistanceRef.current = 0;
    simLastTsRef.current = null;
    activePointerIdRef.current = null;
    wallContactIdRef.current = null;
    setDrawnPath([]);
    setIsDrawing(false);
    setIsSimulating(false);
    setRhythmState('quiet');
    const actor = board.nodes.find(n => n.type === 'actor');
    if (actor) {
      setBeaglePos({ x: actor.x, y: actor.y });
    }
    setCollectedKeys([]);
    setActivatedSwitches([]);
    setVisitedCheckpoints([]);
    setVisitOrder([]);
    setInactiveWalls([]);
    setStatus('idle');
    setFeedbackMsg('');
    setFeedbackKind(null);
    setFailureMarker(null);
    setPayoffParticles([]);
    setActiveDrawCoord(null);
    setWallShockwave(null);
    setHazardAlert(null);
    setReachGoalNotice(false);
    setVisibleLabelIds([]);
  };

  /** New geometry for this linguistic room — same challenge class, different solution path. */
  const beginFreshBoard = (template: Level) => {
    const board = instantiateLevel(template, freshBoardSeed());
    setLevel(board);
    setPlayKey(k => k + 1);
    resetGameplayState(board);
  };

  // New curated room → fresh board
  useEffect(() => {
    if (levelTemplateIdRef.current !== levelTemplate.id) {
      levelTemplateIdRef.current = levelTemplate.id;
      beginFreshBoard(levelTemplate);
    }
  }, [levelTemplate.id]);

  // Keep beagle synced when playKey advances (retry / enter)
  useEffect(() => {
    if (actorNode) {
      setBeaglePos({ x: actorNode.x, y: actorNode.y });
    }
  }, [playKey, actorNode?.x, actorNode?.y]);

  // Keep moving patrols alive (silent-first visual threat)
  useEffect(() => {
    const list = level.patrols || [];
    if (list.length === 0) {
      setPatrolPos({});
      return;
    }
    let raf = 0;
    const tick = () => {
      const t = performance.now() / 1000;
      const next: Record<string, { x: number; y: number }> = {};
      for (const p of list) {
        next[p.id] = patrolPositionAt(p.waypoints, p.speed, t, p.phase);
      }
      setPatrolPos(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [level, playKey]);

  // Cumulative route length of current path
  const getRouteLength = (path: { x: number; y: number }[]): number => {
    let length = 0;
    for (let i = 1; i < path.length; i++) {
      length += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    }
    return Math.round(length);
  };

  /** Exact point on the polyline at arc-length `distance` (stays on ink, no wall chords). */
  const pointAlongPath = (
    path: { x: number; y: number }[],
    distance: number
  ): { x: number; y: number; done: boolean } => {
    if (path.length === 0) return { x: 0, y: 0, done: true };
    if (path.length === 1) return { x: path[0].x, y: path[0].y, done: true };

    let remaining = Math.max(0, distance);
    for (let i = 1; i < path.length; i++) {
      const ax = path[i - 1].x;
      const ay = path[i - 1].y;
      const bx = path[i].x;
      const by = path[i].y;
      const segLen = Math.hypot(bx - ax, by - ay);
      if (segLen < 1e-6) continue;
      if (remaining <= segLen) {
        const t = remaining / segLen;
        return {
          x: ax + (bx - ax) * t,
          y: ay + (by - ay) * t,
          done: false
        };
      }
      remaining -= segLen;
    }
    const last = path[path.length - 1];
    return { x: last.x, y: last.y, done: true };
  };

  const routeLength = getRouteLength(drawnPath);
  const routeLimit = level.routeLengthLimit || 320;
  const isLengthWarning = routeLength > routeLimit * 0.8;
  const isLengthMaxed = routeLength >= routeLimit;

  /** Live compute interactions from a path (avoids React state lag mid-stroke). */
  const computeInteractionsAlongPath = (path: { x: number; y: number }[]) => {
    const keys: string[] = [];
    const switches: string[] = [];
    const checkpoints: string[] = [];
    const order: string[] = [];
    const disabledWalls: string[] = [];
    const trackable = new Set(
      level.requiredNodeIds.filter(id => {
        const n = level.nodes.find(node => node.id === id);
        return n && n.type !== 'actor' && n.type !== 'goal';
      })
    );

    const contacts = orderedContactsAlongPath(path, level.nodes, 6.5);
    for (const node of contacts) {
      if (node.type === 'key' && !keys.includes(node.id)) keys.push(node.id);
      if (node.type === 'switch' && !switches.includes(node.id)) {
        switches.push(node.id);
        const trigger = level.switches?.find(sw => sw.nodeId === node.id);
        if (trigger && !disabledWalls.includes(trigger.targetWallId)) {
          disabledWalls.push(trigger.targetWallId);
        }
      }
      if (node.type === 'checkpoint' && !checkpoints.includes(node.id)) {
        checkpoints.push(node.id);
      }
      if (trackable.has(node.id) && !order.includes(node.id)) {
        order.push(node.id);
      }
    }

    return { keys, switches, checkpoints, order, disabledWalls };
  };

  // Recalculate which items, switches, checkpoints, and keys are contacted along a given path
  const evaluateInteractionsAlongPath = (path: { x: number; y: number }[]) => {
    const { keys, switches, checkpoints, order, disabledWalls } = computeInteractionsAlongPath(path);

    setCollectedKeys(keys);
    setActivatedSwitches(switches);
    setVisitedCheckpoints(checkpoints);
    setVisitOrder(order);
    setInactiveWalls(disabledWalls);

    // Check goal readiness — only required checkpoints, not distractors typed as item
    if (goalNode && path.length > 0) {
      const lastPt = path[path.length - 1];
      const distToGoal = Math.hypot(lastPt.x - goalNode.x, lastPt.y - goalNode.y);
      const requiredCheckpoints = level.requiredNodeIds.filter(id => {
        const n = level.nodes.find(node => node.id === id);
        return n?.type === 'checkpoint';
      });
      const allRequiredVisited = requiredCheckpoints.every(id => checkpoints.includes(id));
      setReachGoalNotice(distToGoal <= 8.5 && allRequiredVisited);
    } else {
      setReachGoalNotice(false);
    }
  };

  // Map a browser pointer sample to 0-100 board space.
  const getPointerCoords = (clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const nx = (clientX - rect.left) / rect.width;
    const ny = (clientY - rect.top) / rect.height;
    const span = 1 - 2 * PLAY_INSET;
    const px = ((nx - PLAY_INSET) / span) * 100;
    const py = ((ny - PLAY_INSET) / span) * 100;
    return {
      x: Math.max(0, Math.min(100, px)),
      y: Math.max(0, Math.min(100, py))
    };
  };

  const barrierContact = (
    start: { x: number; y: number },
    end: { x: number; y: number },
    barrier: { x1: number; y1: number; x2: number; y2: number },
    radiusPx = WALL_CONTACT_RADIUS_PX
  ) => getScreenSpaceBarrierContact(
    start,
    end,
    barrier,
    ((1 - 2 * PLAY_INSET) * dimensions.width) / 100,
    ((1 - 2 * PLAY_INSET) * dimensions.height) / 100,
    radiusPx
  );

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (
      isSimulating ||
      status !== 'idle' ||
      !actorNode ||
      !e.isPrimary ||
      activePointerIdRef.current != null
    ) return;
    e.preventDefault();

    const coords = getPointerCoords(e.clientX, e.clientY);
    const distToActor = Math.hypot(coords.x - actorNode.x, coords.y - actorNode.y);

    if (distToActor <= 14) {
      activePointerIdRef.current = e.pointerId;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setIsDrawing(true);
      setRhythmState('drawing');
      const startPt = { x: actorNode.x, y: actorNode.y };
      setDrawnPath([startPt]);
      setActiveDrawCoord(coords);
      setFailureMarker(null);
      setFeedbackMsg('');
      setFeedbackKind(null);
      setWallShockwave(null);
      wallContactIdRef.current = null;
      setHazardAlert(null);
      evaluateInteractionsAlongPath([startPt]);
      onDismissDrawCoach?.();

      if (soundEnabled && 'vibrate' in navigator) {
        navigator.vibrate(12);
      }
    } else {
      setFeedbackMsg('Start at the dog (狗), then draw toward what the clue names.');
      setFeedbackKind('info');
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (
      !isDrawing ||
      drawnPath.length === 0 ||
      activePointerIdRef.current !== e.pointerId
    ) return;
    e.preventDefault();

    const coalesced = e.nativeEvent.getCoalescedEvents?.() || [];
    const samples = coalesced.length > 0 ? coalesced : [e.nativeEvent];
    let workingPath = drawnPath;
    let changed = false;

    for (const sample of samples) {
      const coords = getPointerCoords(sample.clientX, sample.clientY);
      const lastPoint = workingPath[workingPath.length - 1];
      if (!lastPoint) break;

      // Dragging back over the existing stroke unwinds it instead of forcing a restart.
      let unwound = false;
      if (workingPath.length > 4) {
        for (let i = workingPath.length - 3; i >= 0; i--) {
          const prevPt = workingPath[i];
          const dist = Math.hypot(coords.x - prevPt.x, coords.y - prevPt.y);
          if (dist < 4.5) {
            workingPath = workingPath.slice(0, i + 1);
            changed = true;
            unwound = true;
            wallContactIdRef.current = null;
            setWallShockwave(null);
            break;
          }
        }
      }
      if (unwound) continue;

      // Minimum movement threshold avoids noisy duplicate samples.
      const distToLast = Math.hypot(coords.x - lastPoint.x, coords.y - lastPoint.y);
      if (distToLast < 1.4) continue;

      const currentLen = getRouteLength(workingPath);
      if (currentLen + distToLast > routeLimit) {
        setFeedbackMsg('Ink ran out — shorten the route or backtrack before you commit.');
        setFeedbackKind('drawing');
        if (soundEnabled && 'vibrate' in navigator) {
          navigator.vibrate([20, 20]);
        }
        break;
      }

      // Live barrier state from the current working path avoids React lag after switches.
      const live = computeInteractionsAlongPath(workingPath);
      const liveInactive = live.disabledWalls;
      const liveKeys = live.keys;

      let blocked = false;
      for (const wall of level.walls || []) {
        if (liveInactive.includes(wall.id)) continue;
        const intersect = barrierContact(lastPoint, coords, wall);
        if (!intersect) continue;
        const interactionsAtWall = computeInteractionsAlongPath([...workingPath, intersect]);
        if (interactionsAtWall.disabledWalls.includes(wall.id)) continue;
        blocked = true;
        if (wallContactIdRef.current !== wall.id) {
          wallContactIdRef.current = wall.id;
          setWallShockwave({ x: intersect.x, y: intersect.y, wallId: wall.id });
          if (soundEnabled && 'vibrate' in navigator) navigator.vibrate(10);
        }
        break;
      }
      if (blocked) break;

      for (const door of level.lockedDoors || []) {
        if (liveKeys.includes(door.keyNodeId)) continue;
        const intersect = barrierContact(lastPoint, coords, door);
        if (!intersect) continue;
        const interactionsAtDoor = computeInteractionsAlongPath([...workingPath, intersect]);
        if (interactionsAtDoor.keys.includes(door.keyNodeId)) continue;
        const keyNode = level.nodes.find(n => n.id === door.keyNodeId);
        setWallShockwave({ x: intersect.x, y: intersect.y, wallId: door.id });
        setFeedbackMsg(`Locked — grab ${keyNode?.chineseChar || '钥匙'} first, then this gate opens.`);
        setFeedbackKind('language');
        if (soundEnabled && 'vibrate' in navigator) navigator.vibrate(15);
        blocked = true;
        break;
      }
      if (blocked) break;

      for (const gate of level.oneWayGates || []) {
        const intersect = barrierContact(lastPoint, coords, gate, GATE_CONTACT_RADIUS_PX);
        if (!intersect) continue;
        const dx = coords.x - lastPoint.x;
        const dy = coords.y - lastPoint.y;
        let illegal = false;
        if (gate.allowDirection === 'up' && dy > 0) illegal = true;
        if (gate.allowDirection === 'down' && dy < 0) illegal = true;
        if (gate.allowDirection === 'left' && dx > 0) illegal = true;
        if (gate.allowDirection === 'right' && dx < 0) illegal = true;

        if (illegal) {
          setWallShockwave({ x: intersect.x, y: intersect.y, wallId: gate.id });
          setFeedbackMsg(`One-way — only ${gate.allowDirection} works here. Re-read the clue.`);
          setFeedbackKind('language');
          if (soundEnabled && 'vibrate' in navigator) navigator.vibrate(15);
          blocked = true;
          break;
        }
      }
      if (blocked) break;

      const hazards = level.nodes.filter(
        n => n.type === 'hazard' || level.forbiddenNodeIds.includes(n.id)
      );
      const nearbyHazard = hazards.find(
        h => pointToPathSegmentDistance(h, lastPoint, coords) < 6.8
      );
      setHazardAlert(nearbyHazard?.chineseChar || null);

      workingPath = [...workingPath, coords];
      changed = true;
      wallContactIdRef.current = null;
      setWallShockwave(null);
    }

    if (changed) {
      setDrawnPath(workingPath);
      setActiveDrawCoord(workingPath[workingPath.length - 1]);
      evaluateInteractionsAlongPath(workingPath);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawing || activePointerIdRef.current !== e.pointerId) return;
    activePointerIdRef.current = null;
    wallContactIdRef.current = null;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    }
    setIsDrawing(false);
    setActiveDrawCoord(null);

    // If path is too short, reset
    if (drawnPath.length < 3) {
      setDrawnPath([]);
      setRhythmState('quiet');
      return;
    }

    // Check if path touched any hazards / forbidden nodes
    const touchedHazard = level.nodes.find(n =>
      (n.type === 'hazard' || level.forbiddenNodeIds.includes(n.id)) &&
      pathTouchesPoint(drawnPath, n, 5.0)
    );

    if (touchedHazard) {
      const isLexical =
        touchedHazard.type === 'item' ||
        level.mandarinClue.includes(touchedHazard.chineseChar) ||
        (/避|火|草|右|上/.test(level.mandarinClue) && level.forbiddenNodeIds.includes(touchedHazard.id));
      triggerSimulationFailure(
        touchedHazard.x,
        touchedHazard.y,
        'hazard',
        isLexical
          ? `「${touchedHazard.chineseChar}」 isn’t what the clue asked for — try the matching word.`
          : `Steer clear of ${touchedHazard.chineseChar} — that corridor is a trap.`,
        isLexical ? 'language' : 'drawing',
        isLexical ? [touchedHazard.chineseChar] : []
      );
      return;
    }

    // Patrol corridors are spatial traps (like fire) — live catcher timing does not decide.
    const touchedPatrol = (level.patrols || []).find(p =>
      pathTouchesPolyline(drawnPath, p.waypoints, p.radius, true)
    );
    if (touchedPatrol) {
      const hit = nearestPointOnPolyline(
        drawnPath[Math.floor(drawnPath.length / 2)] || drawnPath[0],
        touchedPatrol.waypoints,
        true
      );
      triggerSimulationFailure(
        hit.x,
        hit.y,
        'hazard',
        `${touchedPatrol.label} (${touchedPatrol.chineseChar}) guards that corridor — take a different route.`,
        'drawing'
      );
      return;
    }

    // Begin animated execution run
    setRhythmState('anticipation');
    setTimeout(() => {
      startPathSimulation();
    }, 450);
  };

  const handlePointerCancel = (e: React.PointerEvent<SVGSVGElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    activePointerIdRef.current = null;
    wallContactIdRef.current = null;
    setIsDrawing(false);
    setDrawnPath([]);
    setActiveDrawCoord(null);
    setWallShockwave(null);
    setHazardAlert(null);
    setRhythmState('quiet');
    evaluateInteractionsAlongPath([]);
  };

  // Start Beagle animated trot along drawn path (polyline arc-length — never chord-cuts walls)
  const startPathSimulation = () => {
    if (simRafRef.current != null) {
      cancelAnimationFrame(simRafRef.current);
      simRafRef.current = null;
    }
    simDistanceRef.current = 0;
    simLastTsRef.current = null;
    setIsSimulating(true);
    setRhythmState('execute');
    if (drawnPath[0]) {
      setBeaglePos({ x: drawnPath[0].x, y: drawnPath[0].y });
    }
    setStatus('idle');
  };

  // Beagle trot: advance along ink polyline by distance each frame
  useEffect(() => {
    if (!isSimulating || drawnPath.length < 2) return;

    const totalLen = (() => {
      let length = 0;
      for (let i = 1; i < drawnPath.length; i++) {
        length += Math.hypot(drawnPath[i].x - drawnPath[i - 1].x, drawnPath[i].y - drawnPath[i - 1].y);
      }
      return length;
    })();
    let cancelled = false;

    const tick = (ts: number) => {
      if (cancelled) return;
      const last = simLastTsRef.current;
      simLastTsRef.current = ts;
      const dt = last == null ? 0 : Math.min(0.05, (ts - last) / 1000);

      simDistanceRef.current = Math.min(totalLen, simDistanceRef.current + BEAGLE_SPEED * dt);
      const { x, y, done } = pointAlongPath(drawnPath, simDistanceRef.current);
      setBeaglePos({ x, y });

      if (done || simDistanceRef.current >= totalLen - 1e-4) {
        const end = drawnPath[drawnPath.length - 1];
        setBeaglePos({ x: end.x, y: end.y });
        evaluateFinalPathState();
        return;
      }
      simRafRef.current = requestAnimationFrame(tick);
    };

    simRafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (simRafRef.current != null) {
        cancelAnimationFrame(simRafRef.current);
        simRafRef.current = null;
      }
    };
  }, [isSimulating, drawnPath]);

  // Failure state handler
  const triggerSimulationFailure = (
    fx: number, fy: number,
    type: 'wall' | 'door' | 'hazard' | 'oneway',
    message: string,
    errorType: 'language' | 'drawing' = 'drawing',
    failedChars: string[] = []
  ) => {
    if (simRafRef.current != null) {
      cancelAnimationFrame(simRafRef.current);
      simRafRef.current = null;
    }
    setIsSimulating(false);
    setStatus('failed');
    setRhythmState('settlement');
    setFailureMarker({ x: fx, y: fy, type });
    setFeedbackMsg(message);
    setFeedbackKind(errorType);
    if (soundEnabled && 'vibrate' in navigator) {
      navigator.vibrate(200);
    }

    onFailure?.(errorType, failedChars, level);

    setTimeout(() => {
      setRhythmState('settle');
    }, 600);
  };

  // Evaluate final state upon reaching the end of the line
  const evaluateFinalPathState = () => {
    if (simRafRef.current != null) {
      cancelAnimationFrame(simRafRef.current);
      simRafRef.current = null;
    }
    setIsSimulating(false);

    if (!goalNode) return;
    const endPt = drawnPath[drawnPath.length - 1];
    if (!endPt) return;

    const live = computeInteractionsAlongPath(drawnPath);

    // Check distance to goal node at the end of the path
    const distanceToGoal = Math.hypot(endPt.x - goalNode.x, endPt.y - goalNode.y);
    if (distanceToGoal > 9.5) {
      setStatus('failed');
      setRhythmState('settlement');
      setFailureMarker({ x: endPt.x, y: endPt.y, type: 'limit' });
      setFeedbackMsg('Path stopped short of 家 — draw all the way to the home gate.');
      setFeedbackKind('drawing');
      onFailure?.('drawing', [], level);
      setTimeout(() => {
        setRhythmState('settle');
      }, 600);
      return;
    }

    // Required checkpoints / keys / switches from requiredNodeIds (order matters)
    const expectedOrder = level.requiredNodeIds.filter(id => {
      if (id === 'n_actor') return false;
      const node = level.nodes.find(n => n.id === id);
      if (!node || node.type === 'goal' || node.type === 'actor') return false;
      return node.type === 'checkpoint' || node.type === 'key' || node.type === 'switch';
    });

    // Visit-set check
    for (const id of expectedOrder) {
      const node = level.nodes.find(n => n.id === id);
      const visited =
        (node?.type === 'checkpoint' && live.checkpoints.includes(id)) ||
        (node?.type === 'key' && live.keys.includes(id)) ||
        (node?.type === 'switch' && live.switches.includes(id));
      if (!visited) {
        setStatus('failed');
        setRhythmState('settlement');
        setFailureMarker({ x: goalNode.x, y: goalNode.y, type: 'missed_checkpoint' });
        setFeedbackMsg(`Missed 「${node?.chineseChar || '…'}」 — the clue needs that stop before home.`);
        setFeedbackKind('language');
        onFailure?.('language', node ? [node.chineseChar] : [], level);
        setTimeout(() => {
          setRhythmState('settle');
        }, 600);
        return;
      }
    }

    // Order enforcement along the drawn path
    const actualOrder = live.order.filter(id => expectedOrder.includes(id));
    for (let i = 0; i < expectedOrder.length; i++) {
      if (actualOrder[i] !== expectedOrder[i]) {
        const expected = level.nodes.find(n => n.id === expectedOrder[i]);
        setStatus('failed');
        setRhythmState('settlement');
        setFailureMarker({ x: goalNode.x, y: goalNode.y, type: 'wrong_order' });
        setFeedbackMsg(`Wrong order — hit 「${expected?.chineseChar || '…'}」 earlier, like the clue says.`);
        setFeedbackKind('language');
        onFailure?.('language', expected ? [expected.chineseChar] : [], level);
        setTimeout(() => {
          setRhythmState('settle');
        }, 600);
        return;
      }
    }

    // Forbidden nodes already handled on release; double-check
    const touchedForbidden = level.nodes.find(n =>
      level.forbiddenNodeIds.includes(n.id) &&
      drawnPath.some(pt => Math.hypot(pt.x - n.x, pt.y - n.y) < 5.0)
    );
    if (touchedForbidden) {
      setStatus('failed');
      setRhythmState('settlement');
      setFailureMarker({ x: touchedForbidden.x, y: touchedForbidden.y, type: 'wrong_target' });
      setFeedbackMsg(`「${touchedForbidden.chineseChar}」 isn’t the requested choice — that route fails the rescue.`);
      setFeedbackKind('language');
      onFailure?.('language', [touchedForbidden.chineseChar], level);
      setTimeout(() => {
        setRhythmState('settle');
      }, 600);
      return;
    }

    // 100% Success!
    setStatus('success');
    setRhythmState('rescue');
    setFeedbackMsg(`「${level.mandarinClue}」 — the beagle is home.`);
    setFeedbackKind('success');
    
    // Create floating rescue payoff particles
    const newParticles = Array.from({ length: 14 }).map((_, i) => ({
      id: i,
      x: goalNode.x + (Math.random() * 22 - 11),
      y: goalNode.y - 4 - (Math.random() * 16),
      delay: i * 0.07,
      scale: 0.65 + Math.random() * 0.7,
      emoji: ['❤️', '✨', '🐾', '🐶', '💖', '⭐', '🎉', '🏠'][i % 8]
    }));
    setPayoffParticles(newParticles);

    const attempts: Record<string, { success: number; failure: number }> = {};
    level.nodes.forEach(n => {
      if (n.type === 'goal' || n.type === 'checkpoint' || n.type === 'key' || n.type === 'switch') {
        attempts[n.chineseChar] = { success: 1, failure: 0 };
      }
    });
    // Also credit actor char on success for intro vocab
    const actor = level.nodes.find(n => n.type === 'actor');
    if (actor) attempts[actor.chineseChar] = { success: 1, failure: 0 };

    onSuccess(attempts, level);

    setTimeout(() => {
      setRhythmState('settlement');
      setTimeout(() => {
        setRhythmState('settle');
      }, 500);
    }, 1400);
  };

  const handleRetry = () => {
    // Reshuffle: failed attempt must not reward memorizing one corridor
    beginFreshBoard(levelTemplate);
  };

  // Convert percentage coordinates to SVG pixel coordinates (inset so edge labels never clip)
  const toPxX = (pct: number) => (PLAY_INSET + (pct / 100) * (1 - 2 * PLAY_INSET)) * dimensions.width;
  const toPxY = (pct: number) => (PLAY_INSET + (pct / 100) * (1 - 2 * PLAY_INSET)) * dimensions.height;
  const toCssPct = (pct: number) => PLAY_INSET * 100 + pct * (1 - 2 * PLAY_INSET);
  const clampBoardX = (x: number, halfWidth: number) => {
    const minX = PLAY_INSET * dimensions.width + halfWidth + 2;
    const maxX = (1 - PLAY_INSET) * dimensions.width - halfWidth - 2;
    return Math.min(maxX, Math.max(minX, x));
  };
  const labelBelowY = (cy: number, offset = 30) => {
    const maxY = (1 - PLAY_INSET) * dimensions.height - 10;
    return cy + offset > maxY ? cy - 36 : cy + offset;
  };

  const nodeSubtitle = (node: Level['nodes'][number]): string | null => {
    const scaffoldItem = level.vocabularyScaffold?.find(s => s.char === node.chineseChar);
    let label = node.label;
    if (scaffoldItem) {
      const dynamicStage = getVocabularyStage(node.chineseChar, progress);
      if (dynamicStage === 'new') {
        label = `${scaffoldItem.pinyin} | ${scaffoldItem.english}`;
      } else if (dynamicStage === 'familiar') {
        label = scaffoldItem.pinyin;
      } else {
        return null;
      }
    }
    return label.length > 18 ? label.replace(/\s*\/\s*.+$/, '').trim() : label;
  };

  const toggleNodeLabel = (nodeId: string) => {
    setVisibleLabelIds(current =>
      current.includes(nodeId)
        ? current.filter(id => id !== nodeId)
        : [...current, nodeId]
    );
  };
  const roomBadge = level.id.startsWith('adaptive_')
    ? 'Practice'
    : `Room ${level.id.replace('lvl_', '').replace(/^0+/, '') || level.id}`;

  return (
    <div
      className="relative flex flex-col gap-2 w-full h-full max-w-md mx-auto min-h-0 overflow-hidden"
      id="game-stage-wrapper"
    >
      {/* Mission chrome — clue-first; assists stay secondary; board keeps the height */}
      <div className="relative flex flex-col gap-2 shrink-0 z-20 pt-0.5">
        <div className="flex items-center justify-between w-full gap-2">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-stone-300 hover:text-[#FAF9F6] hover:bg-stone-800/60 transition cursor-pointer"
            aria-label="Back to map"
            id="puzzle-back-btn"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <span className="max-w-[112px] truncate bg-stone-800 px-2.5 py-1 rounded-full text-stone-300 font-mono text-[10px] shrink">
            {roomBadge}
          </span>

          <div className="flex items-center shrink-0 gap-0.5">
            <button
              type="button"
              onClick={() => setShowHint(v => !v)}
              className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg transition cursor-pointer ${
                showHint ? 'text-amber-300 bg-stone-800' : 'text-stone-400 hover:text-amber-300 hover:bg-stone-800'
              }`}
              aria-expanded={showHint}
              aria-label="Show mission hint"
              title="Mission hint"
              id="hint-toggle-btn"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-stone-400 hover:text-[#FAF9F6] hover:bg-stone-800 transition cursor-pointer"
                aria-label="Settings"
                id="puzzle-settings-btn"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="w-full min-w-0 px-0.5">
          <InteractiveClue
            clue={level.mandarinClue}
            scaffold={level.vocabularyScaffold}
            showCoachHint={!showPinyin && !showTranslation}
          />
        </div>

        {/* At most one assist stack — wrap, never truncate mid-phrase */}
        {(showPinyin || showTranslation) && (
          <div className="w-full min-w-0 px-3 text-center space-y-1">
            {showPinyin && (
              <p className="text-sm text-stone-200 font-serif tracking-wide leading-relaxed">
                {level.pinyinClue}
              </p>
            )}
            {showTranslation && (
              <p className="text-xs text-stone-300 font-medium leading-relaxed">
                {level.englishTranslation}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Board — fills remaining viewport completely */}
      <div ref={boardSlotRef} className="relative flex-1 min-h-0 w-full">
      <div 
        ref={containerRef}
        className="absolute inset-0 bg-[#1A1715] border-2 border-[#2F2925] rounded-xl shadow-2xl overflow-hidden touch-none select-none"
        id="board-field"
        style={{
          boxShadow: 'inset 0 0 40px rgba(0,0,0,0.8), 0 12px 32px -4px rgba(0,0,0,0.4)'
        }}
      >
        {/* Ink gauge — board overlay HUD */}
        <div className="absolute top-0 inset-x-0 z-10 pointer-events-none px-2.5 pt-2.5 pb-2 bg-gradient-to-b from-[#141211]/90 via-[#141211]/50 to-transparent">
          <div className="flex items-center gap-2 text-[10px]">
            <span className="font-semibold text-stone-300 shrink-0 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-500" />
              Ink
            </span>
            <div className="w-full bg-stone-800/90 rounded-full h-1.5 overflow-hidden relative">
              <div
                className={`h-full rounded-full transition-all duration-100 ${
                  isLengthMaxed ? 'bg-rose-500' : isLengthWarning ? 'bg-amber-500 animate-pulse' : 'bg-amber-600'
                }`}
                style={{ width: `${Math.min(100, (routeLength / routeLimit) * 100)}%` }}
              />
            </div>
            <span className={`font-mono shrink-0 font-bold ${isLengthMaxed ? 'text-rose-300' : 'text-stone-300'}`}>
              {routeLength}/{routeLimit}
            </span>
          </div>
        </div>

        {/* Compact hint card — sized to content, not a full-board empty modal */}
        <AnimatePresence>
          {showHint && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="absolute top-8 inset-x-2 z-40 w-auto rounded-xl border border-amber-800/50 bg-[#1C1A17]/97 px-3 py-2 text-[11px] text-stone-300 leading-snug shadow-xl max-h-[38%] overflow-y-auto h-fit"
              role="dialog"
              aria-label="Mission hint"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 pt-0.5">
                  <span className="font-bold text-amber-300 text-[10px] uppercase tracking-wide block mb-1">
                    Hint
                  </span>
                  {revisitChars.length > 0 && (
                    <p className="text-amber-200 mb-1.5 leading-snug font-semibold">
                      This rescue revisits {revisitChars.join(' · ')}
                    </p>
                  )}
                  {framingLine && (
                    <p className="text-amber-100 mb-1 leading-snug">{framingLine}</p>
                  )}
                  <p className="text-stone-300">{level.hint}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHint(false)}
                  className="min-h-[44px] min-w-[44px] -mr-1.5 -mt-1.5 inline-flex items-center justify-center rounded-lg text-stone-400 hover:text-amber-200 shrink-0"
                  aria-label="Close hint"
                >
                  <span className="text-sm font-bold" aria-hidden>×</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scholar's Inkstone Brass Inlay Corners */}
        <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-amber-600/40 pointer-events-none" />
        <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-amber-600/40 pointer-events-none" />
        <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-amber-600/40 pointer-events-none" />
        <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-amber-600/40 pointer-events-none" />

        {/* Courtyard Flagstone Pavers Texture */}
        <div 
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(to right, #3C352E 1px, transparent 1px),
              linear-gradient(to bottom, #3C352E 1px, transparent 1px)
            `,
            backgroundSize: '28px 28px'
          }}
        />

        {/* Ambient garden courtyard vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(10,8,7,0.75)_100%)] pointer-events-none" />

        {status === 'success' && (
          <motion.div
            initial={{ opacity: 0.55 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            className="absolute inset-0 pointer-events-none z-[5] bg-[radial-gradient(circle_at_center,rgba(52,211,153,0.35),transparent_65%)]"
            aria-hidden
          />
        )}

        <svg 
          ref={svgRef}
          className="absolute inset-0 w-full h-full cursor-crosshair touch-none select-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onLostPointerCapture={handlePointerCancel}
        >
          <defs>
            {/* Ink Ribbon Gradient */}
            <linearGradient id="brushInkGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="50%" stopColor="#D97706" />
              <stop offset="100%" stopColor="#B45309" />
            </linearGradient>

            {/* Success Ribbon Gradient */}
            <linearGradient id="brushSuccessGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#34D399" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>

            {/* Failure Ribbon Gradient */}
            <linearGradient id="brushFailureGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F87171" />
              <stop offset="100%" stopColor="#DC2626" />
            </linearGradient>

            {/* Glow Filter for Ink Trail */}
            <filter id="inkGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* 1. SWITCH CONDUIT LINES: Connect switch node to the target wall it deactivates */}
          {level.switches?.map(sw => {
            const swNode = level.nodes.find(n => n.id === sw.nodeId);
            const targetWall = level.walls?.find(w => w.id === sw.targetWallId);
            if (!swNode || !targetWall) return null;
            const isSwActive = activatedSwitches.includes(sw.nodeId);
            const wallMidX = toPxX((targetWall.x1 + targetWall.x2) / 2);
            const wallMidY = toPxY((targetWall.y1 + targetWall.y2) / 2);
            const swX = toPxX(swNode.x);
            const swY = toPxY(swNode.y);

            return (
              <g key={`conduit_${sw.id}`} className="pointer-events-none">
                <line 
                  x1={swX} y1={swY}
                  x2={wallMidX} y2={wallMidY}
                  stroke={isSwActive ? '#34D399' : '#A78BFA'}
                  strokeWidth="1.5"
                  strokeDasharray="4,4"
                  opacity={isSwActive ? 0.85 : 0.7}
                />
              </g>
            );
          })}

          {/* 2. ONE-WAY GATES: Directional bamboo flow gates */}
          {level.oneWayGates?.map(gate => {
            const gx1 = toPxX(gate.x1);
            const gy1 = toPxY(gate.y1);
            const gx2 = toPxX(gate.x2);
            const gy2 = toPxY(gate.y2);
            const midX = (gx1 + gx2) / 2;
            const midY = (gy1 + gy2) / 2;

            return (
              <g key={gate.id}>
                {/* Gate Barrier Line */}
                <line 
                  x1={gx1} y1={gy1}
                  x2={gx2} y2={gy2}
                  stroke="#D97706"
                  strokeWidth="4"
                  strokeDasharray="5,4"
                  strokeLinecap="round"
                />
                {/* Center Directional Seal */}
                <circle 
                  cx={midX} 
                  cy={midY} 
                  r="10" 
                  fill="#29180E"
                  stroke="#F59E0B"
                  strokeWidth="1.5"
                />
                <text 
                  x={midX} 
                  y={midY + 3.5} 
                  textAnchor="middle" 
                  className="fill-amber-300 text-[10px] font-black select-none pointer-events-none"
                >
                  {gate.allowDirection === 'up' && '▲'}
                  {gate.allowDirection === 'down' && '▼'}
                  {gate.allowDirection === 'left' && '◀'}
                  {gate.allowDirection === 'right' && '▶'}
                </text>
              </g>
            );
          })}

          {/* 3. STATIC LABYRINTH WALLS: Authentic multi-layered 3D courtyard architectural barriers */}
          {level.walls?.map(wall => {
            const isWallInactive = inactiveWalls.includes(wall.id);
            const wx1 = toPxX(wall.x1);
            const wy1 = toPxY(wall.y1);
            const wx2 = toPxX(wall.x2);
            const wy2 = toPxY(wall.y2);
            const isShocked = wallShockwave?.wallId === wall.id;

            if (isWallInactive) {
              // Deactivated Switch Barrier: Sunken into the floor
              return (
                <g key={wall.id}>
                  <line 
                    x1={wx1} y1={wy1}
                    x2={wx2} y2={wy2}
                    stroke="#1C1816"
                    strokeWidth="4"
                    strokeDasharray="3,5"
                    strokeLinecap="round"
                    opacity="0.3"
                  />
                  <circle cx={(wx1 + wx2) / 2} cy={(wy1 + wy2) / 2} r="3" fill="#10B981" opacity="0.5" />
                </g>
              );
            }

            return (
              <g key={wall.id} className="transition-all duration-300">
                {/* 1. Deep Wall Cast Shadow */}
                <line 
                  x1={wx1} y1={wy1 + 4}
                  x2={wx2} y2={wy2 + 4}
                  stroke="rgba(0,0,0,0.7)"
                  strokeWidth="12"
                  strokeLinecap="round"
                />

                {/* 2. Wall Base Foundation (Dark granite stone) */}
                <line 
                  x1={wx1} y1={wy1}
                  x2={wx2} y2={wy2}
                  stroke="#161311"
                  strokeWidth="11"
                  strokeLinecap="round"
                />

                {/* 3. Slate Courtyard Brick Body */}
                <line 
                  x1={wx1} y1={wy1}
                  x2={wx2} y2={wy2}
                  stroke={isShocked ? '#EF4444' : '#655A50'}
                  strokeWidth="7"
                  strokeLinecap="round"
                  className="transition-colors duration-150"
                />

                {/* 4. Terracotta Ridge Coping (Wall Roof) */}
                <line 
                  x1={wx1} y1={wy1}
                  x2={wx2} y2={wy2}
                  stroke={isShocked ? '#F87171' : '#B9A38B'}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray="6,3"
                />

                {/* 5. Terminal Stone Pillar Buttresses at Wall Ends */}
                <g>
                  {/* Start Pillar */}
                  <circle cx={wx1} cy={wy1} r="6" fill="#241E1A" stroke="#6B5F55" strokeWidth="1.5" />
                  <circle cx={wx1} cy={wy1} r="2" fill="#D97706" />
                  {/* End Pillar */}
                  <circle cx={wx2} cy={wy2} r="6" fill="#241E1A" stroke="#6B5F55" strokeWidth="1.5" />
                  <circle cx={wx2} cy={wy2} r="2" fill="#D97706" />
                </g>
              </g>
            );
          })}

          {/* 4. LOCKED DOORS: Courtyard Moon Gates with Heavy Timber & Iron Latches */}
          {level.lockedDoors?.map(door => {
            const isUnlocked = collectedKeys.includes(door.keyNodeId);
            const dx1 = toPxX(door.x1);
            const dy1 = toPxY(door.y1);
            const dx2 = toPxX(door.x2);
            const dy2 = toPxY(door.y2);
            const midX = (dx1 + dx2) / 2;
            const midY = (dy1 + dy2) / 2;
            const isShocked = wallShockwave?.wallId === door.id;

            if (isUnlocked) {
              // Unlocked Moon Gate: Doors swing open, radiant passage
              return (
                <g key={door.id} className="transition-all duration-500">
                  <line 
                    x1={dx1} y1={dy1}
                    x2={dx2} y2={dy2}
                    stroke="#065F46"
                    strokeWidth="2"
                    strokeDasharray="2,4"
                    opacity="0.4"
                  />
                  {/* Open Gate Seal */}
                  <circle cx={midX} cy={midY} r="7" fill="#064E3B" stroke="#10B981" strokeWidth="1" />
                  <text x={midX} y={midY + 3} textAnchor="middle" className="fill-emerald-300 text-[8px] font-bold">✓</text>
                </g>
              );
            }

            return (
              <g key={door.id}>
                {/* Heavy Timber Gate Planks */}
                <line 
                  x1={dx1} y1={dy1}
                  x2={dx2} y2={dy2}
                  stroke={isShocked ? '#EF4444' : '#78350F'}
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                {/* Iron Bracing Straps */}
                <line 
                  x1={dx1} y1={dy1}
                  x2={dx2} y2={dy2}
                  stroke="#B45309"
                  strokeWidth="4"
                  strokeDasharray="4,6"
                  strokeLinecap="round"
                />
                {/* Heavy Bronze Padlock Seal */}
                <g transform={`translate(${midX - 10}, ${midY - 10})`}>
                  <rect width="20" height="20" rx="6" fill="#1C1816" stroke="#D97706" strokeWidth="1.2" />
                  <text x="10" y="14" textAnchor="middle" className="text-[10px] select-none pointer-events-none">🔒</text>
                </g>
              </g>
            );
          })}

          {/* 4b. MOVING PATROLS — catchers / technicians */}
          {(level.patrols || []).map(p => {
            const pos = patrolPos[p.id] || p.waypoints[0];
            if (!pos) return null;
            const route = [...p.waypoints, p.waypoints[0]];
            return (
              <g key={p.id} className="pointer-events-none">
                <path
                  d={`M ${route.map(w => `${toPxX(w.x)},${toPxY(w.y)}`).join(' L ')}`}
                  fill="none"
                  stroke="#9F1239"
                  strokeWidth="1.5"
                  strokeDasharray="3,4"
                  opacity="0.75"
                />
                <circle
                  cx={toPxX(pos.x)}
                  cy={toPxY(pos.y)}
                  r={Math.max(10, (p.radius / 100) * Math.min(dimensions.width, dimensions.height) * 0.45)}
                  fill="rgba(190, 18, 60, 0.15)"
                  stroke="#E11D48"
                  strokeWidth="1.5"
                />
                <text
                  x={toPxX(pos.x)}
                  y={toPxY(pos.y) + 4}
                  textAnchor="middle"
                  className="text-sm select-none"
                >
                  {p.emoji || '🚨'}
                </text>
                <text
                  x={toPxX(pos.x)}
                  y={toPxY(pos.y) - 14}
                  textAnchor="middle"
                  className="fill-rose-200 text-[9px] font-bold select-none"
                >
                  {p.chineseChar}
                </text>
              </g>
            );
          })}

          {/* 5. DRAWN CALLIGRAPHY INK PATH ROUTE */}
          {drawnPath.length > 0 && (
            <>
              {/* Luminous Outer Glow Trail */}
              <path 
                d={`M ${drawnPath.map(p => `${toPxX(p.x)},${toPxY(p.y)}`).join(' L ')}`}
                fill="none"
                stroke={status === 'success' ? '#34D399' : status === 'failed' ? '#F87171' : '#F59E0B'}
                strokeWidth="11"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.3"
                filter="url(#inkGlow)"
              />
              {/* Core Sharp Calligraphy Ribbon */}
              <path 
                d={`M ${drawnPath.map(p => `${toPxX(p.x)},${toPxY(p.y)}`).join(' L ')}`}
                fill="none"
                stroke={
                  status === 'success' ? 'url(#brushSuccessGradient)' : 
                  status === 'failed' ? 'url(#brushFailureGradient)' : 
                  'url(#brushInkGradient)'
                }
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {/* 6. GLOWING BRUSH CURSOR / LANTERN MARKER FOLLOWING PLAYER FINGER */}
          {activeDrawCoord && (
            <g transform={`translate(${toPxX(activeDrawCoord.x)}, ${toPxY(activeDrawCoord.y)})`}>
              <circle r="14" className="fill-amber-400/20 stroke-amber-400/40 stroke-[1]" />
              <circle r="5" fill="#FEF3C7" stroke="#D97706" strokeWidth="1.5" />
              {/* Paper Lantern Icon Tip */}
              <text x="7" y="-7" className="text-[12px] select-none pointer-events-none">🏮</text>
            </g>
          )}
          {activeDrawCoord && hazardAlert && (
            <g
              transform={`translate(${toPxX(activeDrawCoord.x)}, ${toPxY(activeDrawCoord.y)})`}
              className="pointer-events-none select-none"
            >
              <circle r="22" fill="none" stroke="#FB7185" strokeWidth="1.5" strokeDasharray="3,3" />
              <text y="-23" textAnchor="middle" className="fill-rose-200 text-[10px] font-black">
                {hazardAlert}
              </text>
            </g>
          )}

          {/* 7. WALL IMPACT SHOCKWAVE ALERT */}
          {wallShockwave && (
            <g transform={`translate(${toPxX(wallShockwave.x)}, ${toPxY(wallShockwave.y)})`}>
              <circle r="16" className="fill-rose-500/30 stroke-rose-500 stroke-[2]" />
              <circle r="5" fill="#EF4444" />
            </g>
          )}

          {/* 8. PUZZLE NODES: High-Craft Vector Chinese Courtyard Elements */}
          {level.nodes.map(node => {
            const isKeyCollected = node.type === 'key' && collectedKeys.includes(node.id);
            const isSwitchOn = node.type === 'switch' && activatedSwitches.includes(node.id);
            const isCheckpointVisited = node.type === 'checkpoint' && visitedCheckpoints.includes(node.id);
            const isGoalActive = node.type === 'goal' && (status === 'success' || reachGoalNotice);

            const cx = toPxX(node.x);
            const cy = toPxY(node.y);
            const subtitle = node.type === 'actor' ? null : nodeSubtitle(node);
            const isLabelVisible = subtitle != null && visibleLabelIds.includes(node.id);

            // Custom Node Vector Art
            let nodeArtwork: React.ReactNode = null;

            if (node.type === 'actor') {
              nodeArtwork = (
                <g>
                  {/* Courtyard Entrance Runic Pad */}
                  <ellipse cx="0" cy="4" rx="18" ry="8" fill="#241B15" stroke="#92400E" strokeWidth="1.5" />
                  <ellipse cx="0" cy="4" rx="12" ry="5" fill="none" stroke="#D97706" strokeWidth="1" strokeDasharray="3,2" />
                  <circle cx="0" cy="4" r="3" fill="#F59E0B" />
                </g>
              );
            } else if (node.chineseChar === '家') {
              nodeArtwork = (
                <g transform="translate(0, 4)">
                  {/* House base shadow */}
                  <ellipse cx="0" cy="14" rx="20" ry="7" fill="rgba(0,0,0,0.6)" />
                  {/* House stone body */}
                  <path d="M -16,13 L -16,2 L 16,2 L 16,13 Z" fill="#292320" stroke="#443A34" strokeWidth="1.2" />
                  {/* Courtyard Pavilion Door */}
                  <path d="M -5,13 L -5,4 C -5,2 5,2 5,4 L 5,13 Z" fill={isGoalActive ? '#F59E0B' : '#171412'} />
                  {/* Warm Glowing Windows */}
                  <rect x="-12" y="4" width="4.5" height="4.5" rx="1" fill={isGoalActive ? '#FCD34D' : '#3D352F'} />
                  <rect x="7.5" y="4" width="4.5" height="4.5" rx="1" fill={isGoalActive ? '#FCD34D' : '#3D352F'} />
                  {/* Traditional Terracotta Roof */}
                  <path d="M -20,2 L 0,-11 L 20,2 Z" fill="#88331E" stroke="#5C1F10" strokeWidth="1.2" />
                  {/* Chimney */}
                  <rect x="10" y="-8" width="4" height="8" fill="#2B2623" />
                  {isGoalActive && (
                    <motion.path 
                      d="M 12,-10 C 13,-14 11,-16 13,-18" 
                      fill="none" 
                      stroke="#F59E0B" 
                      strokeWidth="1.5" 
                      strokeLinecap="round"
                      animate={{ opacity: [0.2, 0.9, 0], y: [-2, -8] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  )}
                </g>
              );
            } else if (node.chineseChar === '水') {
              nodeArtwork = (
                <g transform="translate(0, 4)">
                  <ellipse cx="0" cy="10" rx={isCheckpointVisited ? "16" : "13"} ry="5" fill="none" stroke="#06B6D4" strokeWidth="1.2" opacity="0.4" />
                  <path 
                    d="M 0,-14 C 5,-7 8,2 0,9 C -8,2 -5,-7 0,-14 Z" 
                    fill={isCheckpointVisited ? 'rgba(6,182,212,0.3)' : '#06B6D4'}
                    stroke="#67E8F9"
                    strokeWidth="1.2"
                  />
                  {!isCheckpointVisited && <path d="M -2,-8 Q -4,-2 -2,2" fill="none" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" opacity="0.7" />}
                </g>
              );
            } else if (node.chineseChar === '肉') {
              nodeArtwork = (
                <g transform="translate(0, 4)">
                  <ellipse cx="0" cy="10" rx="16" ry="6" fill="#3D2923" stroke="#261A16" strokeWidth="1" />
                  <g className={`transition-all duration-300 ${isCheckpointVisited ? 'opacity-30 scale-90' : 'scale-100'}`} transform="rotate(-15)">
                    <path d="M -9,3 C -10,-4 3,-10 9,-2 C 12,3 0,11 -9,3" fill="#B91C1C" stroke="#7F1D1D" strokeWidth="1" />
                    <circle cx="3" cy="0" r="2.5" fill="#FAF9F6" stroke="#D6D3D1" strokeWidth="0.8" />
                    <path d="M 3,0 L 8,3 L 7,5 Z" fill="#FAF9F6" />
                  </g>
                </g>
              );
            } else if (node.chineseChar === '草') {
              nodeArtwork = (
                <g transform="translate(0, 6)">
                  <ellipse cx="0" cy="6" rx="13" ry="4" fill="rgba(0,0,0,0.5)" />
                  <g className={isCheckpointVisited ? 'opacity-35' : ''}>
                    <path d="M -4,6 Q -9,-4 -12,-6 Q -7,-2 -2,6" fill="#10B981" stroke="#047857" strokeWidth="0.8" />
                    <path d="M 4,6 Q 9,-4 12,-6 Q 7,-2 2,6" fill="#10B981" stroke="#047857" strokeWidth="0.8" />
                    <path d="M 0,6 Q 2,-7 1,-12 Q 5,-4 0,6" fill="#34D399" stroke="#047857" strokeWidth="0.8" />
                  </g>
                </g>
              );
            } else if (node.chineseChar === '钥' || node.chineseChar === '钥匙') {
              nodeArtwork = (
                <g transform="translate(0, 2)">
                  <circle r={isKeyCollected ? "0" : "15"} fill="none" stroke="#F59E0B" strokeWidth="1" strokeDasharray="3,3" className="animate-spin" style={{ animationDuration: '8s' }} />
                  <g className={`transition-all duration-300 ${isKeyCollected ? 'opacity-20 scale-75' : 'scale-100'}`} transform="rotate(-45)">
                    <circle cx="-5" cy="0" r="5" fill="none" stroke="#FBBF24" strokeWidth="2.2" />
                    <line x1="0" y1="0" x2="13" y2="0" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" />
                    <line x1="7" y1="0" x2="7" y2="4.5" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" />
                    <line x1="11" y1="0" x2="11" y2="4.5" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" />
                  </g>
                </g>
              );
            } else if (node.chineseChar === '开' || node.chineseChar === '开关') {
              nodeArtwork = (
                <g transform="translate(0, 4)">
                  {/* Floor pressure mechanism plate */}
                  <rect x="-14" y="-5" width="28" height="18" rx="5" fill="#241E2B" stroke={isSwitchOn ? '#10B981' : '#7C3AED'} strokeWidth="1.5" />
                  <circle cx="9" cy="-1.5" r="2.5" fill={isSwitchOn ? '#10B981' : '#EF4444'} />
                  {/* Gear Lever */}
                  <g transform={isSwitchOn ? "rotate(30)" : "rotate(-30)"}>
                    <line x1="0" y1="4" x2="0" y2="-9" stroke="#A78BFA" strokeWidth="2.5" strokeLinecap="round" />
                    <circle cx="0" cy="-9" r="3" fill="#C4B5FD" stroke="#6D28D9" strokeWidth="1" />
                  </g>
                </g>
              );
            } else if (node.chineseChar === '火') {
              nodeArtwork = (
                <g transform="translate(0, 6)">
                  <ellipse cx="0" cy="5" rx="13" ry="4" fill="#1C0D0D" />
                  <line x1="-9" y1="4" x2="9" y2="0" stroke="#5C2D16" strokeWidth="3" strokeLinecap="round" />
                  <line x1="-9" y1="0" x2="9" y2="4" stroke="#5C2D16" strokeWidth="3" strokeLinecap="round" />
                  <g className="animate-pulse">
                    <path d="M -7,1 Q -9,-8 0,-15 Q 9,-8 7,1 Z" fill="#EF4444" opacity="0.85" />
                    <path d="M -4,1 Q -6,-5 0,-11 Q 6,-5 4,1 Z" fill="#F59E0B" />
                    <path d="M -2,1 Q -3,-2 0,-6 Q 3,-2 2,1 Z" fill="#FCD34D" />
                  </g>
                </g>
              );
            }

            return (
              <g key={node.id} className="select-none pointer-events-none">
                {/* Soft static halo — no continuous ping rings at rest */}
                {node.type === 'actor' && status === 'idle' && !isSimulating && rhythmState === 'quiet' && (
                  <circle cx={cx} cy={cy} r="22" fill="none" stroke="#F59E0B" strokeWidth="1.5" opacity="0.35" />
                )}
                {node.type === 'goal' && isGoalActive && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r="24"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="1.5"
                    opacity="0.45"
                    className="motion-safe:animate-pulse"
                  />
                )}

                {/* Node Generic Circular Rim for standard non-architectural targets */}
                {node.chineseChar !== '家' && node.chineseChar !== '水' && node.chineseChar !== '肉' && node.chineseChar !== '草' && node.chineseChar !== '钥' && node.chineseChar !== '钥匙' && node.chineseChar !== '开' && node.chineseChar !== '开关' && node.chineseChar !== '火' && node.type !== 'actor' && (
                  <circle 
                    cx={cx} cy={cy} r="22" 
                    fill={node.type === 'hazard' ? '#291414' : node.type === 'checkpoint' ? (isCheckpointVisited ? '#064E3B' : '#0E2A38') : '#241E1A'}
                    stroke={node.type === 'hazard' ? '#991B1B' : node.type === 'checkpoint' ? (isCheckpointVisited ? '#10B981' : '#0284C7') : '#574C43'}
                    strokeWidth="2"
                  />
                )}

                {/* Artwork Graphic */}
                {nodeArtwork && (
                  <g transform={`translate(${cx}, ${cy})`}>
                    <g className={isKeyCollected ? 'opacity-20' : ''}>
                      {nodeArtwork}
                    </g>
                  </g>
                )}

                {/* High-Contrast Large crisp Chinese character label */}
                {node.chineseChar !== 'actor' && (
                  <text 
                    x={cx} 
                    y={
                      node.chineseChar === '家' ? cy - 14 :
                      node.chineseChar === '水' ? cy - 12 :
                      node.chineseChar === '肉' ? cy - 11 :
                      node.chineseChar === '草' ? cy - 11 :
                      (node.chineseChar === '钥' || node.chineseChar === '钥匙') ? cy - 14 :
                      (node.chineseChar === '开' || node.chineseChar === '开关') ? cy - 10 :
                      node.chineseChar === '火' ? cy - 12 :
                      cy + 6
                    } 
                    textAnchor="middle" 
                    className={`font-serif ${Array.from(node.chineseChar).length > 1 ? 'text-base' : 'text-2xl'} font-black select-none ${
                      node.chineseChar === '家' ? (isGoalActive ? 'fill-emerald-300 font-bold' : 'fill-stone-300') :
                      node.chineseChar === '水' ? 'fill-cyan-300' :
                      node.chineseChar === '肉' ? 'fill-amber-100' :
                      node.chineseChar === '草' ? 'fill-emerald-200' :
                      (node.chineseChar === '钥' || node.chineseChar === '钥匙') ? (isKeyCollected ? 'fill-stone-600 opacity-40' : 'fill-yellow-100') :
                      (node.chineseChar === '开' || node.chineseChar === '开关') ? (isSwitchOn ? 'fill-emerald-400' : 'fill-purple-200') :
                      node.chineseChar === '火' ? 'fill-rose-100 animate-pulse' :
                      'fill-stone-200'
                    }`}
                    style={{
                      filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.9))',
                    }}
                  >
                    {node.chineseChar}
                  </text>
                )}

                {/* Checkmark indicator for visited checkpoints */}
                {isCheckpointVisited && (
                  <g transform={`translate(${cx + 14}, ${cy - 14})`}>
                    <circle r="7" fill="#059669" stroke="#34D399" strokeWidth="1" />
                    <text textAnchor="middle" y="2.5" className="fill-white text-[8px] font-bold">✓</text>
                  </g>
                )}

                {isLabelVisible && subtitle && (() => {
                  const halfWidth = Math.min(48, Math.max(28, subtitle.length * 3.2));
                  const labelX = clampBoardX(cx, halfWidth);
                  const labelY = labelBelowY(cy, 30);
                  return (
                    <g
                      transform={`translate(${labelX}, ${labelY})`}
                      className="pointer-events-none"
                      aria-live="polite"
                    >
                      <rect
                        x={-halfWidth}
                        y="-7"
                        width={halfWidth * 2}
                        height="14"
                        rx="4"
                        fill="#1E1B18"
                        stroke="#3D352F"
                        strokeWidth="0.8"
                      />
                      <text
                        textAnchor="middle"
                        y="3"
                        className="fill-stone-300 text-[8px] font-semibold tracking-wide select-none"
                      >
                        {subtitle}
                      </text>
                    </g>
                  );
                })()}

                {subtitle && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r="24"
                    fill="transparent"
                    stroke="transparent"
                    strokeWidth="2"
                    className="pointer-events-auto cursor-pointer focus:stroke-amber-300 focus:outline-none"
                    role="button"
                    tabIndex={0}
                    aria-label={`${isLabelVisible ? 'Hide' : 'Show'} label for ${node.chineseChar}`}
                    aria-expanded={isLabelVisible}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleNodeLabel(node.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        toggleNodeLabel(node.id);
                      }
                    }}
                  />
                )}

              </g>
            );
          })}

          {/* 9. PAYOFF CELEBRATION PARTICLES ON SUCCESS */}
          <AnimatePresence>
            {status === 'success' && payoffParticles.map(p => (
              <motion.g
                key={p.id}
                initial={{ opacity: 0, scale: 0, x: `${p.x}%`, y: `${p.y}%` }}
                animate={{ 
                  opacity: [0, 1, 1, 0], 
                  scale: p.scale,
                  y: [`${p.y}%`, `${p.y - 18}%`],
                  x: [`${p.x}%`, `${p.x + (p.id % 2 === 0 ? 3 : -3)}%`]
                }}
                transition={{ 
                  duration: 1.6, 
                  delay: p.delay,
                  ease: "easeOut"
                }}
                className="pointer-events-none select-none"
              >
                <text textAnchor="middle" className="text-base">{p.emoji}</text>
              </motion.g>
            ))}
          </AnimatePresence>

          {/* 10. ALWAYS-ON ANIMATED BEAGLE (Trot, wiggle, perked ears) */}
          {beaglePos && (
            <g transform={`translate(${toPxX(beaglePos.x)}, ${toPxY(beaglePos.y)})`}>
              <g className={status === 'success' ? 'animate-bounce' : ''}>
                {/* Beagle Body - shown when in anticipation, executing or celebrating */}
                {(isSimulating || rhythmState === 'anticipation' || status === 'success') && (
                  <g>
                    {/* Tail wagging */}
                    <path 
                      d="M -10,6 C -15,12 -12,18 -8,22" 
                      fill="none" 
                      stroke="#92400E" 
                      strokeWidth="3.5" 
                      strokeLinecap="round"
                    >
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        values={rhythmState === 'anticipation' || status === 'success' ? "-16 0 6; 24 0 6; -16 0 6" : "-10 0 6; 16 0 6; -10 0 6"}
                        dur={rhythmState === 'anticipation' || status === 'success' ? '0.12s' : '0.24s'}
                        repeatCount="indefinite"
                      />
                    </path>
                    {/* Dog Body */}
                    <rect 
                      x="-14" y="2" width="22" height="12" rx="6" 
                      fill="#FAF8F5" 
                      stroke="#44403C" 
                      strokeWidth="1.2" 
                      transform="rotate(-15)" 
                    />
                    {/* Saddle patch */}
                    <ellipse cx="-4" cy="7" rx="6" ry="4" fill="#D97706" transform="rotate(-15)" />
                    {/* Trot Legs */}
                    <line x1="-10" y1="13" x2="-10" y2="17" stroke="#44403C" strokeWidth="2" strokeLinecap="round" />
                    <line x1="-4" y1="14" x2="-4" y2="18" stroke="#44403C" strokeWidth="2" strokeLinecap="round" />
                    <line x1="2" y1="13" x2="2" y2="17" stroke="#44403C" strokeWidth="2" strokeLinecap="round" />
                  </g>
                )}

                {/* Beagle Head & Collar */}
                <g transform={`translate(0, -2) ${rhythmState === 'anticipation' ? 'rotate(8)' : ''}`}>
                  {/* Left Ear */}
                  <path 
                    d={rhythmState === 'anticipation' ? "M -13,-4 C -16,-6 -15,4 -11,8 C -9,9 -7,7 -9,2 Z" : "M -13,-4 C -17,-1 -17,9 -13,12 C -11,13 -9,11 -10,4 Z"} 
                    fill="#92400E" stroke="#44403C" strokeWidth="1" 
                  />
                  {/* Right Ear */}
                  <path 
                    d={rhythmState === 'anticipation' ? "M 13,-4 C 16,-6 15,4 11,8 C 9,9 7,7 9,2 Z" : "M 13,-4 C 17,-1 17,9 13,12 C 11,13 9,11 10,4 Z"} 
                    fill="#92400E" stroke="#44403C" strokeWidth="1" 
                  />
                  {/* Head Oval */}
                  <circle cx="0" cy="2" r="11" fill="#FAF9F6" stroke="#44403C" strokeWidth="1.5" />
                  {/* Eye Patches */}
                  <ellipse cx="-4.5" cy="0.5" rx="3.5" ry="4.5" fill="#D97706" />
                  <ellipse cx="3.5" cy="6" rx="2.5" ry="2" fill="#D97706" />
                  {/* Snout */}
                  <ellipse cx="0" cy="5.5" rx="5" ry="3.5" fill="#FAF9F6" />
                  {/* Nose */}
                  <ellipse cx="0" cy="3.5" rx="2.5" ry="1.6" fill="#1C1917" />
                  {/* Eyes */}
                  <circle cx="-4" cy="0.5" r="1.6" fill="#1C1917" />
                  <circle cx="4" cy="0.5" r="1.6" fill="#1C1917" />
                  <circle cx="-4.4" cy="0.1" r="0.5" fill="#FFFFFF" />
                  <circle cx="3.6" cy="0.1" r="0.5" fill="#FFFFFF" />
                </g>
              </g>

              {status === 'failed' && (
                <g transform="translate(0, -22)">
                  <text textAnchor="middle" className="text-xs select-none">💫</text>
                </g>
              )}
            </g>
          )}

          {/* 11. FAILURE MARKER */}
          {failureMarker && (
            <g transform={`translate(${toPxX(failureMarker.x)}, ${toPxY(failureMarker.y)})`}>
              <circle r="16" className="fill-rose-500/30 stroke-rose-600 stroke-[2]" />
              <text textAnchor="middle" y="5" className="text-lg">💥</text>
            </g>
          )}
        </svg>

        {/* Start Drag Prompt Badge — stays fully on-board near the actor */}
        {!isSimulating && drawnPath.length === 0 && status === 'idle' && actorNode && rhythmState === 'quiet' && (() => {
          const ax = toCssPct(actorNode.x);
          const ay = toCssPct(actorNode.y);
          const nearRight = ax > 72;
          const nearLeft = ax < 28;
          const topPct = Math.min(82, Math.max(14, ay - (ay < 22 ? -8 : 11)));
          const leftPct = Math.min(74, Math.max(26, ax));
          return (
            <div
              className="absolute px-2.5 py-1.5 bg-[#FAF9F6] dark:bg-[#241E1A] border border-amber-500/50 rounded-xl text-[10px] font-black text-amber-900 dark:text-amber-300 shadow-xl pointer-events-none select-none motion-safe:animate-bounce max-w-[9.5rem] text-center"
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
                transform: nearRight ? 'translateX(-100%)' : nearLeft ? 'translateX(0)' : 'translateX(-50%)',
              }}
            >
              DRAW PATH · RELEASE
            </div>
          );
        })()}

        {/* Live Goal Ready Badge */}
        {reachGoalNotice && !isSimulating && status === 'idle' && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-xl animate-pulse pointer-events-none select-none flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            Route ready — release to guide home
          </div>
        )}
      </div>
      </div>

      {/* Bottom dock — thin action row; feedback overlays board so dock never grows */}
      <div className="shrink-0 z-20 pt-1 flex flex-col gap-0">
      {feedbackMsg && (
        <div className="absolute inset-x-2 bottom-[3.25rem] z-30 pointer-events-auto">
          <motion.div 
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`p-2.5 rounded-xl border text-xs font-semibold leading-snug shadow-xl max-h-[28vh] overflow-y-auto ${
              status === 'success' || feedbackKind === 'success' ? 'bg-emerald-950/95 border-emerald-900/40 text-emerald-300' :
              feedbackKind === 'language' ? 'bg-rose-950/95 border-rose-800/50 text-rose-200' :
              status === 'failed' || feedbackKind === 'drawing' ? 'bg-amber-950/95 border-amber-900/40 text-amber-200' :
              'bg-[#1C1A17]/95 border-stone-800 text-stone-300'
            }`}
            id="simulation-feedback"
          >
            <div className="flex items-start gap-2">
              {status === 'success' || feedbackKind === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : feedbackKind === 'language' ? (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              ) : status === 'failed' || feedbackKind === 'drawing' ? (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                <p className="font-bold text-[11px] text-stone-100">
                  {status === 'success' || feedbackKind === 'success'
                    ? 'Beagle home!'
                    : feedbackKind === 'language'
                      ? 'Wrong reading'
                      : status === 'failed' || feedbackKind === 'drawing'
                        ? 'Path blocked'
                        : 'Corridor guidance'}
                </p>
                <p className="text-stone-300 font-normal leading-snug text-[11px] mt-0.5">{feedbackMsg}</p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <div className="flex gap-1.5 w-full">
        <button
          type="button"
          onClick={onBackToDashboard}
          className="flex-1 bg-[#1A1816] hover:bg-stone-900 text-stone-300 rounded-xl py-2 text-xs font-bold transition active:scale-95 cursor-pointer border border-stone-800 flex items-center justify-center gap-1.5 min-h-[44px]"
        >
          Map
        </button>

        {status !== 'idle' ? (
          <button
            type="button"
            onClick={status === 'success' ? onNextLevel : handleRetry}
            className={`flex-1 rounded-xl py-2 text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 min-h-[44px] ${
              status === 'success'
                ? 'bg-emerald-500 hover:bg-emerald-400 text-emerald-950'
                : 'bg-amber-500 hover:bg-amber-400 text-[#141211]'
            }`}
            id="retry-button"
          >
            {status === 'success' ? (
              <>
                <ArrowRight className="w-4 h-4" />
                <span>Next</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4" />
                <span>Retry</span>
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleListen}
            className="flex-1 bg-[#241F1C] hover:bg-[#2F2925] text-amber-200 border border-amber-900/30 rounded-xl py-2 text-xs font-bold transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 min-h-[44px]"
            title={soundEnabled ? 'Pronounce clue' : 'Listen — optional audio (turns sound on)'}
            aria-label={soundEnabled ? 'Listen to clue' : 'Listen to clue and turn sound on'}
            id="listen-clue-btn"
          >
            <Volume2 className="w-4 h-4" />
            <span>Listen</span>
          </button>
        )}
      </div>
      </div>

    </div>
  );
}
