import { Level } from '../types';
import { H, V, patrol } from './mazeKit';

/**
 * Curated no-AI curriculum — every room is a real drawing puzzle:
 * narrow corridors, forced bends, dead-end traps, and (L6+) moving patrols
 * that guard competing decoy corridors (route choice — not live timing).
 * Linguistic distractors remain; path geometry must also challenge.
 */
export const DEFAULT_LEVELS: Level[] = [
  // ─── L1: teach fork + multi-bend correct wing ───────────────────────────
  {
    id: 'lvl_1',
    title: 'Level 1: First Path',
    mandarinClue: '小狗回家',
    pinyinClue: 'xiǎo gǒu huí jiā',
    englishTranslation: 'The puppy goes home',
    hint: 'Read the destination character, then inspect each junction before drawing to Home (家).',
    forceAssists: true,
    missionFraming: 'Guide the beagle home — read 家, then draw the safe corridor.',
    nodes: [
      { id: 'n_actor', type: 'actor', label: 'Dog', chineseChar: '狗', x: 50, y: 92, color: 'bg-amber-500' },
      { id: 'n_home', type: 'goal', label: 'Home', chineseChar: '家', x: 14, y: 10, color: 'bg-emerald-500' },
      { id: 'n_grass', type: 'item', label: 'Grass', chineseChar: '草', x: 86, y: 10, color: 'bg-green-500' }
    ],
    requiredNodeIds: ['n_actor', 'n_home'],
    forbiddenNodeIds: ['n_grass'],
    walls: [
      H('w_lobby_l', 4, 38, 80),
      H('w_lobby_r', 62, 96, 80),
      V('w_spine', 50, 18, 80),
      // West snake (correct): alternate baffles force 5 bends
      H('w_w1', 4, 36, 68),
      H('w_w2', 18, 50, 56),
      H('w_w3', 4, 36, 44),
      H('w_w4', 18, 50, 32),
      H('w_home_lip', 4, 38, 18),
      V('w_home_jog', 26, 10, 18),
      // East trap (wrong): short path to grass
      H('w_e1', 62, 96, 55),
      H('w_e_top', 62, 96, 18)
    ],
    lockedDoors: [],
    oneWayGates: [],
    switches: [],
    patrols: [],
    routeLengthLimit: 340,
    vocabularyScaffold: [
      { char: '狗', pinyin: 'gǒu', english: 'Dog', emoji: '🐶', stage: 'new' },
      { char: '家', pinyin: 'jiā', english: 'Home', emoji: '🏠', stage: 'new' },
      { char: '草', pinyin: 'cǎo', english: 'Grass', emoji: '🌿', stage: 'new' }
    ]
  },

  // ─── L2: denser snake, fire pocket shortcut ─────────────────────────────
  {
    id: 'lvl_2',
    title: 'Level 2: Garden Choice',
    mandarinClue: '小狗回家',
    pinyinClue: 'xiǎo gǒu huí jiā',
    englishTranslation: 'The puppy goes home',
    hint: 'Find the connected route to Home (家) and keep clear of Fire (火).',
    forceAssists: true,
    missionFraming: 'Same words, hotter maze — dodge 火 on the tempting shortcut.',
    nodes: [
      { id: 'n_actor', type: 'actor', label: 'Dog', chineseChar: '狗', x: 50, y: 92, color: 'bg-amber-500' },
      { id: 'n_home', type: 'goal', label: 'Home', chineseChar: '家', x: 12, y: 10, color: 'bg-emerald-500' },
      { id: 'n_fire', type: 'hazard', label: 'Fire', chineseChar: '火', x: 86, y: 42, color: 'bg-rose-600' }
    ],
    requiredNodeIds: ['n_actor', 'n_home'],
    forbiddenNodeIds: ['n_fire'],
    walls: [
      H('w_lobby_l', 4, 38, 82),
      H('w_lobby_r', 62, 96, 82),
      V('w_spine_lo', 50, 52, 82),
      V('w_spine_hi', 50, 18, 40),
      // West: tight S-corridor
      H('w_w1', 4, 38, 70),
      H('w_w2', 16, 50, 58),
      H('w_w3', 4, 38, 46),
      H('w_w4', 16, 50, 34),
      H('w_w5', 4, 34, 22),
      H('w_home_bar', 4, 38, 18),
      V('w_home_post', 22, 10, 18),
      // East fire pocket — open mouth on the east lip (drawable trap)
      H('w_e1', 62, 96, 70),
      H('w_e2', 62, 82, 52),
      V('w_fire_v', 70, 30, 52),
      H('w_fire_top', 70, 96, 30),
      H('w_e_top', 62, 96, 18)
    ],
    lockedDoors: [],
    oneWayGates: [],
    switches: [],
    patrols: [],
    routeLengthLimit: 400,
    vocabularyScaffold: [
      { char: '狗', pinyin: 'gǒu', english: 'Dog', emoji: '🐶', stage: 'familiar' },
      { char: '家', pinyin: 'jiā', english: 'Home', emoji: '🏠', stage: 'familiar' },
      { char: '火', pinyin: 'huǒ', english: 'Fire', emoji: '🔥', stage: 'new' }
    ]
  },

  // ─── L3: water cul-de-sac then north maze to home ────────────────────────
  {
    id: 'lvl_3',
    title: 'Level 3: Water First',
    mandarinClue: '先喝水再回家',
    pinyinClue: 'xiān hē shuǐ zài huí jiā',
    englishTranslation: 'Drink water first, then go home',
    hint: '先…再… means first… then…: reach Water (水) before Home (家), avoiding Fire (火).',
    missionFraming: 'Water first, then home — the order in the clue is the order on the path.',
    nodes: [
      { id: 'n_actor', type: 'actor', label: 'Dog', chineseChar: '狗', x: 50, y: 92, color: 'bg-amber-500' },
      { id: 'n_water', type: 'checkpoint', label: 'Water', chineseChar: '水', x: 12, y: 48, color: 'bg-blue-500' },
      { id: 'n_home', type: 'goal', label: 'Home', chineseChar: '家', x: 50, y: 10, color: 'bg-emerald-500' },
      { id: 'n_fire', type: 'hazard', label: 'Fire', chineseChar: '火', x: 88, y: 48, color: 'bg-rose-600' }
    ],
    requiredNodeIds: ['n_actor', 'n_water', 'n_home'],
    forbiddenNodeIds: ['n_fire'],
    walls: [
      H('w_lobby_l', 4, 38, 80),
      H('w_lobby_r', 62, 96, 80),
      V('w_spine', 50, 24, 80),
      // Water alcove (must enter + exit)
      H('w_alc_top', 4, 38, 58),
      H('w_alc_bot', 4, 38, 38),
      V('w_alc_mouth', 38, 38, 48),
      // East fire trap
      H('w_e_top', 62, 96, 58),
      H('w_e_bot', 62, 96, 38),
      V('w_e_mouth', 62, 38, 48),
      // North approach maze to home
      H('w_n1', 4, 38, 24),
      H('w_n2', 62, 96, 24),
      V('w_n_jog_l', 30, 10, 24),
      V('w_n_jog_r', 70, 10, 24),
      H('w_n_cap_l', 4, 22, 14),
      H('w_n_cap_r', 78, 96, 14)
    ],
    lockedDoors: [],
    oneWayGates: [],
    switches: [],
    patrols: [],
    routeLengthLimit: 460,
    vocabularyScaffold: [
      { char: '水', pinyin: 'shuǐ', english: 'Water', emoji: '💧', stage: 'new' },
      { char: '火', pinyin: 'huǒ', english: 'Fire', emoji: '🔥', stage: 'familiar' },
      { char: '狗', pinyin: 'gǒu', english: 'Dog', emoji: '🐶', stage: 'familiar' },
      { char: '家', pinyin: 'jiā', english: 'Home', emoji: '🏠', stage: 'strong' }
    ]
  },

  // ─── L4: meat alcove + grass trap + bent home approach ──────────────────
  {
    id: 'lvl_4',
    title: 'Level 4: Meat or Grass',
    mandarinClue: '先吃肉再回家',
    pinyinClue: 'xiān chī ròu zài huí jiā',
    englishTranslation: 'Eat meat first, then go home',
    hint: 'The order is Meat (肉), then Home (家). Grass (草) is not part of the instruction.',
    missionFraming: 'Meat, not grass — only the clue’s word opens the way home.',
    nodes: [
      { id: 'n_actor', type: 'actor', label: 'Dog', chineseChar: '狗', x: 50, y: 92, color: 'bg-amber-500' },
      { id: 'n_meat', type: 'checkpoint', label: 'Meat', chineseChar: '肉', x: 12, y: 52, color: 'bg-amber-600' },
      { id: 'n_grass', type: 'item', label: 'Grass', chineseChar: '草', x: 88, y: 52, color: 'bg-green-500' },
      { id: 'n_home', type: 'goal', label: 'Home', chineseChar: '家', x: 50, y: 10, color: 'bg-emerald-500' }
    ],
    requiredNodeIds: ['n_actor', 'n_meat', 'n_home'],
    forbiddenNodeIds: ['n_grass'],
    walls: [
      H('w_lobby_l', 4, 38, 82),
      H('w_lobby_r', 62, 96, 82),
      V('w_spine', 50, 22, 82),
      H('w_meat_top', 4, 38, 62),
      H('w_meat_bot', 4, 38, 42),
      V('w_meat_mouth', 38, 42, 52),
      H('w_grass_top', 62, 96, 62),
      H('w_grass_bot', 62, 96, 42),
      V('w_grass_mouth', 62, 42, 52),
      H('w_mid_cross', 38, 62, 32),
      H('w_n_l', 4, 38, 22),
      H('w_n_r', 62, 96, 22),
      V('w_approach', 38, 12, 22),
      H('w_cap_l', 4, 28, 12)
    ],
    lockedDoors: [],
    oneWayGates: [],
    switches: [],
    patrols: [],
    routeLengthLimit: 460,
    vocabularyScaffold: [
      { char: '肉', pinyin: 'ròu', english: 'Meat', emoji: '🥩', stage: 'new' },
      { char: '草', pinyin: 'cǎo', english: 'Grass', emoji: '🌿', stage: 'familiar' },
      { char: '家', pinyin: 'jiā', english: 'Home', emoji: '🏠', stage: 'strong' }
    ]
  },

  // ─── L5: binary fork — short lane hits 火; long lane hits 路 then 家 ─────
  {
    id: 'lvl_5',
    title: 'Level 5: Safe Road',
    mandarinClue: '避开火，走安全路',
    pinyinClue: 'bì kāi huǒ, zǒu ān quán lù',
    englishTranslation: 'Avoid the fire, take the safe path',
    hint: '避开火 means avoid Fire (火). Find a route through Safe Road (路) to Home (家).',
    missionFraming: 'Avoid the fire wing — the safe road is the long way that still works.',
    nodes: [
      { id: 'n_actor', type: 'actor', label: 'Dog', chineseChar: '狗', x: 50, y: 92, color: 'bg-amber-500' },
      { id: 'n_fire', type: 'hazard', label: 'Fire', chineseChar: '火', x: 18, y: 52, color: 'bg-rose-600' },
      { id: 'n_safe', type: 'checkpoint', label: 'Path', chineseChar: '路', x: 88, y: 46, color: 'bg-blue-500' },
      { id: 'n_home', type: 'goal', label: 'Home', chineseChar: '家', x: 18, y: 10, color: 'bg-emerald-500' }
    ],
    requiredNodeIds: ['n_actor', 'n_safe', 'n_home'],
    forbiddenNodeIds: ['n_fire'],
    walls: [
      H('w_lobby_l', 4, 38, 82),
      H('w_lobby_r', 62, 96, 82),
      V('w_spine_lo', 50, 22, 82),
      V('w_spine_hi', 50, 4, 12),
      // West fire temptation: open mouth toward lobby; sealed above so it cannot skip to 家
      H('w_fire_top', 4, 38, 40),
      V('w_fire_side', 38, 40, 64),
      H('w_fire_jog', 4, 28, 64),
      // East safe snake (required longer route)
      H('w_e1', 62, 96, 78),
      H('w_e2', 50, 84, 64),
      H('w_e3', 62, 96, 50),
      H('w_e4', 50, 84, 36),
      H('w_e5', 62, 96, 24),
      H('w_n_bar', 4, 38, 16)
    ],
    lockedDoors: [],
    oneWayGates: [],
    switches: [],
    patrols: [],
    routeLengthLimit: 520,
    vocabularyScaffold: [
      { char: '火', pinyin: 'huǒ', english: 'Fire', emoji: '🔥', stage: 'strong' },
      { char: '路', pinyin: 'lù', english: 'Safe road', emoji: '🛣️', stage: 'new' },
      { char: '家', pinyin: 'jiā', english: 'Home', emoji: '🏠', stage: 'strong' }
    ]
  },

  // ─── L6: sequence + door + first moving catcher ─────────────────────────
  {
    id: 'lvl_6',
    title: 'Level 6: Sequence Trial',
    mandarinClue: '先喝水，后吃肉，再回家',
    pinyinClue: 'xiān hē shuǐ, hòu chī ròu, zài huí jiā',
    englishTranslation: 'Drink water first, then eat meat, then go home',
    hint: 'Water (水) unlocks the way to Meat (肉). Avoid the Catcher (捕) corridor, then continue Home (家).',
    missionFraming: 'Three stops in clue order — water unlocks the meat door.',
    nodes: [
      { id: 'n_actor', type: 'actor', label: 'Dog', chineseChar: '狗', x: 14, y: 90, color: 'bg-amber-500' },
      { id: 'n_water', type: 'key', label: 'Water', chineseChar: '水', x: 14, y: 14, color: 'bg-blue-500' },
      { id: 'n_meat', type: 'checkpoint', label: 'Meat', chineseChar: '肉', x: 86, y: 14, color: 'bg-amber-600' },
      { id: 'n_grass', type: 'item', label: 'Grass', chineseChar: '草', x: 86, y: 52, color: 'bg-green-500' },
      { id: 'n_home', type: 'goal', label: 'Home', chineseChar: '家', x: 86, y: 90, color: 'bg-emerald-500' }
    ],
    requiredNodeIds: ['n_actor', 'n_water', 'n_meat', 'n_home'],
    forbiddenNodeIds: ['n_grass'],
    walls: [
      V('w_spine', 50, 28, 94),
      H('w_w1', 4, 38, 72),
      H('w_w2', 16, 50, 56),
      H('w_w3', 4, 38, 40),
      H('w_nw', 4, 38, 28),
      H('w_e1', 62, 96, 72),
      H('w_e2', 50, 84, 56),
      H('w_se', 62, 96, 40)
    ],
    lockedDoors: [
      { id: 'd_meat_door', x1: 50, y1: 28, x2: 96, y2: 28, keyNodeId: 'n_water' }
    ],
    oneWayGates: [],
    switches: [],
    patrols: [
      patrol('p_catcher', 'Catcher', '捕', [
        { x: 72, y: 48 },
        { x: 92, y: 48 },
        { x: 92, y: 64 },
        { x: 72, y: 64 }
      ], 32, { radius: 7, phase: 0.2, emoji: '🚨' })
    ],
    routeLengthLimit: 520,
    vocabularyScaffold: [
      { char: '水', pinyin: 'shuǐ', english: 'Water', emoji: '💧', stage: 'strong' },
      { char: '肉', pinyin: 'ròu', english: 'Meat', emoji: '🥩', stage: 'familiar' },
      { char: '草', pinyin: 'cǎo', english: 'Grass', emoji: '🌿', stage: 'strong' },
      { char: '家', pinyin: 'jiā', english: 'Home', emoji: '🏠', stage: 'later' }
    ]
  },

  // ─── L7: key maze + catcher on east trap ────────────────────────────────
  {
    id: 'lvl_7',
    title: 'Level 7: Key & Door',
    mandarinClue: '用钥匙开门，避开火',
    pinyinClue: 'yòng yào shi kāi mén, bì kāi huǒ',
    englishTranslation: 'Use the key to open the door, avoid the fire',
    hint: 'Reach Key (钥) before the locked passage. Avoid Fire (火), Switch (开), and Catcher (捕).',
    missionFraming: 'Grab the key first — the tempting east wing is a trap.',
    nodes: [
      { id: 'n_actor', type: 'actor', label: 'Dog', chineseChar: '狗', x: 50, y: 92, color: 'bg-amber-500' },
      { id: 'n_key', type: 'key', label: 'Key', chineseChar: '钥', x: 12, y: 48, color: 'bg-yellow-500' },
      { id: 'n_switch', type: 'item', label: 'Switch', chineseChar: '开', x: 88, y: 55, color: 'bg-purple-500' },
      { id: 'n_fire', type: 'hazard', label: 'Fire', chineseChar: '火', x: 88, y: 22, color: 'bg-rose-600' },
      { id: 'n_home', type: 'goal', label: 'Home', chineseChar: '家', x: 50, y: 10, color: 'bg-emerald-500' }
    ],
    requiredNodeIds: ['n_actor', 'n_key', 'n_home'],
    forbiddenNodeIds: ['n_fire', 'n_switch'],
    walls: [
      H('w_lobby_l', 4, 38, 80),
      H('w_lobby_r', 62, 96, 80),
      V('w_spine', 50, 28, 80),
      H('w_w1', 4, 38, 66),
      H('w_w2', 16, 50, 52),
      H('w_w3', 4, 38, 38),
      H('w_e1', 62, 96, 66),
      H('w_e2', 50, 84, 48),
      H('w_trap', 62, 96, 28),
      H('w_n_l', 4, 38, 20),
      H('w_n_r', 62, 96, 20)
    ],
    lockedDoors: [
      { id: 'd_north', x1: 4, y1: 28, x2: 50, y2: 28, keyNodeId: 'n_key' }
    ],
    oneWayGates: [],
    switches: [],
    patrols: [
      patrol('p_catcher', 'Catcher', '捕', [
        { x: 68, y: 36 },
        { x: 92, y: 36 },
        { x: 92, y: 58 },
        { x: 68, y: 58 }
      ], 34, { radius: 7.5, emoji: '🚨' })
    ],
    routeLengthLimit: 480,
    vocabularyScaffold: [
      { char: '钥', pinyin: 'yào', english: 'Key', emoji: '🔑', stage: 'new' },
      { char: '开', pinyin: 'kāi', english: 'Switch / Open', emoji: '🎛️', stage: 'new' },
      { char: '火', pinyin: 'huǒ', english: 'Fire', emoji: '🔥', stage: 'later' }
    ]
  },

  // ─── L8: spatial left — dense west snake; right fire + catcher ───────────
  {
    id: 'lvl_8',
    title: 'Level 8: Left or Right',
    mandarinClue: '向左走是水源，避开右边',
    pinyinClue: 'xiàng zuǒ zǒu shì shuǐ yuán, bì kāi yòu biān',
    englishTranslation: 'To the left is the water source, avoid the right side',
    hint: '向左 means go left: pass Left (左), Water (水), then Home while avoiding Right (右).',
    missionFraming: 'Left is life — the right wing looks open but ends badly.',
    nodes: [
      { id: 'n_actor', type: 'actor', label: 'Dog', chineseChar: '狗', x: 50, y: 92, color: 'bg-amber-500' },
      { id: 'n_left', type: 'checkpoint', label: 'Left', chineseChar: '左', x: 28, y: 74, color: 'bg-sky-500' },
      { id: 'n_right', type: 'item', label: 'Right', chineseChar: '右', x: 72, y: 74, color: 'bg-gray-400' },
      { id: 'n_water', type: 'checkpoint', label: 'Water', chineseChar: '水', x: 12, y: 36, color: 'bg-blue-500' },
      { id: 'n_fire', type: 'hazard', label: 'Fire', chineseChar: '火', x: 88, y: 36, color: 'bg-rose-600' },
      { id: 'n_home', type: 'goal', label: 'Home', chineseChar: '家', x: 50, y: 10, color: 'bg-emerald-500' }
    ],
    requiredNodeIds: ['n_actor', 'n_left', 'n_water', 'n_home'],
    forbiddenNodeIds: ['n_right', 'n_fire'],
    walls: [
      H('w_lobby_l', 4, 38, 84),
      H('w_lobby_r', 62, 96, 84),
      V('w_spine', 50, 20, 84),
      H('w_mid_cross', 38, 62, 58),
      H('w_l1', 4, 38, 68),
      H('w_l2', 16, 50, 52),
      H('w_l3', 4, 38, 40),
      H('w_r1', 62, 96, 68),
      H('w_r2', 50, 84, 48),
      H('w_n_l', 4, 38, 20),
      H('w_n_r', 62, 96, 20),
      V('w_home_jog', 38, 10, 20)
    ],
    lockedDoors: [],
    oneWayGates: [],
    switches: [],
    patrols: [
      patrol('p_catcher', 'Catcher', '捕', [
        { x: 66, y: 30 },
        { x: 92, y: 30 },
        { x: 92, y: 50 },
        { x: 66, y: 50 }
      ], 30, { radius: 7, emoji: '🚨' })
    ],
    routeLengthLimit: 500,
    vocabularyScaffold: [
      { char: '左', pinyin: 'zuǒ', english: 'Left', emoji: '⬅️', stage: 'new' },
      { char: '右', pinyin: 'yòu', english: 'Right', emoji: '➡️', stage: 'new' },
      { char: '水', pinyin: 'shuǐ', english: 'Water', emoji: '💧', stage: 'later' }
    ]
  },

  // ─── L9: one-way + dense return hall + technician patrol ────────────────
  {
    id: 'lvl_9',
    title: 'Level 9: One-Way Stream',
    mandarinClue: '向下走，通过安全门',
    pinyinClue: 'xiàng xià zǒu, tōng guò ān quán mén',
    englishTranslation: 'Go downward, pass through the safe gate',
    hint: '向下 means downward. Use the Down (下) gate, avoid Up (上), and watch the Technician (员).',
    missionFraming: 'Only the down gate lets the beagle through — up is a decoy.',
    nodes: [
      { id: 'n_actor', type: 'actor', label: 'Dog', chineseChar: '狗', x: 86, y: 12, color: 'bg-amber-500' },
      { id: 'n_safe_chk', type: 'checkpoint', label: 'Gate', chineseChar: '下', x: 86, y: 48, color: 'bg-sky-500' },
      { id: 'n_wrong_chk', type: 'item', label: 'Up', chineseChar: '上', x: 14, y: 48, color: 'bg-gray-400' },
      { id: 'n_home', type: 'goal', label: 'Home', chineseChar: '家', x: 14, y: 88, color: 'bg-emerald-500' }
    ],
    requiredNodeIds: ['n_actor', 'n_safe_chk', 'n_home'],
    forbiddenNodeIds: ['n_wrong_chk'],
    walls: [
      V('w_spine', 50, 6, 78),
      H('w_e1', 62, 96, 28),
      H('w_e2', 50, 84, 56),
      H('w_w1', 4, 38, 28),
      H('w_w2', 16, 50, 56),
      H('w_south', 4, 38, 78),
      H('w_s_east', 62, 96, 78)
    ],
    lockedDoors: [],
    oneWayGates: [
      { id: 'g_right', x1: 50, y1: 42, x2: 100, y2: 42, allowDirection: 'down' },
      { id: 'g_left', x1: 0, y1: 42, x2: 50, y2: 42, allowDirection: 'up' }
    ],
    switches: [],
    patrols: [
      patrol('p_tech', 'Technician', '员', [
        { x: 12, y: 34 },
        { x: 36, y: 34 },
        { x: 36, y: 62 },
        { x: 12, y: 62 }
      ], 28, { radius: 7, emoji: '🧪' })
    ],
    routeLengthLimit: 480,
    vocabularyScaffold: [
      { char: '下', pinyin: 'xià', english: 'Down', emoji: '⬇️', stage: 'new' },
      { char: '上', pinyin: 'shàng', english: 'Up', emoji: '⬆️', stage: 'new' },
      { char: '家', pinyin: 'jiā', english: 'Home', emoji: '🏠', stage: 'later' }
    ]
  },

  // ─── L10: dual collect + dual fire + dual patrols ───────────────────────
  {
    id: 'lvl_10',
    title: 'Level 10: Multi-Constraint',
    mandarinClue: '先拿水和肉，再避开火回家',
    pinyinClue: 'xiān ná shuǐ hé ròu, zài bì kāi huǒ huí jiā',
    englishTranslation: 'Get water and meat first, then avoid fire and go home',
    hint: 'Plan one continuous route through Water (水), Meat (肉), then Home without touching Fire (火).',
    missionFraming: 'Collect both supplies before home — fire guards the middle lanes.',
    nodes: [
      { id: 'n_actor', type: 'actor', label: 'Dog', chineseChar: '狗', x: 50, y: 92, color: 'bg-amber-500' },
      { id: 'n_water', type: 'checkpoint', label: 'Water', chineseChar: '水', x: 12, y: 14, color: 'bg-blue-500' },
      { id: 'n_meat', type: 'checkpoint', label: 'Meat', chineseChar: '肉', x: 88, y: 14, color: 'bg-amber-600' },
      { id: 'n_fire1', type: 'hazard', label: 'Fire', chineseChar: '火', x: 50, y: 62, color: 'bg-rose-600' },
      { id: 'n_fire2', type: 'hazard', label: 'Fire', chineseChar: '火', x: 50, y: 38, color: 'bg-rose-600' },
      { id: 'n_home', type: 'goal', label: 'Home', chineseChar: '家', x: 50, y: 50, color: 'bg-emerald-500' }
    ],
    requiredNodeIds: ['n_actor', 'n_water', 'n_meat', 'n_home'],
    forbiddenNodeIds: ['n_fire1', 'n_fire2'],
    walls: [
      H('w_lobby_l', 4, 38, 84),
      H('w_lobby_r', 62, 96, 84),
      // Ring with side doors into the home chamber
      V('w_v_l_top', 34, 34, 46),
      V('w_v_l_bot', 34, 54, 70),
      V('w_v_r_top', 66, 34, 46),
      V('w_v_r_bot', 66, 54, 70),
      H('w_ring_s', 34, 66, 70),
      H('w_ring_n', 34, 66, 34),
      H('w_mid_l', 4, 26, 58),
      H('w_mid_r', 74, 96, 58),
      H('w_top_l', 4, 26, 34),
      H('w_top_r', 74, 96, 34),
      // Block N/S onto fires — force side approach
      H('w_home_n', 40, 60, 44),
      H('w_home_s', 40, 60, 56)
    ],
    lockedDoors: [],
    oneWayGates: [],
    switches: [],
    patrols: [
      patrol('p_catcher_a', 'Catcher', '捕', [
        { x: 38, y: 74 },
        { x: 62, y: 74 },
        { x: 62, y: 82 },
        { x: 38, y: 82 }
      ], 36, { radius: 7, emoji: '🚨' }),
      patrol('p_tech', 'Technician', '员', [
        { x: 38, y: 20 },
        { x: 62, y: 20 },
        { x: 62, y: 28 },
        { x: 38, y: 28 }
      ], 30, { radius: 7, phase: 1.1, emoji: '🧪' })
    ],
    routeLengthLimit: 620,
    vocabularyScaffold: [
      { char: '水', pinyin: 'shuǐ', english: 'Water', emoji: '💧', stage: 'later' },
      { char: '肉', pinyin: 'ròu', english: 'Meat', emoji: '🥩', stage: 'later' },
      { char: '火', pinyin: 'huǒ', english: 'Fire', emoji: '🔥', stage: 'later' },
      { char: '家', pinyin: 'jiā', english: 'Home', emoji: '🏠', stage: 'later' }
    ]
  },

  // ─── L11: switch shortcut under ink pressure + catcher on long way ──────
  {
    id: 'lvl_11',
    title: 'Level 11: Shortcut Energy',
    mandarinClue: '走捷径，省能源回家',
    pinyinClue: 'zǒu jié jìng, shěng néng yuán huí jiā',
    englishTranslation: 'Take the shortcut, save energy to go home',
    hint: 'Ink is scarce. Find Switch (开), skip the Catcher (捕) corridor, and use the opened passage to Home.',
    missionFraming: 'Flip the switch for the shortcut — the long way burns your ink.',
    nodes: [
      { id: 'n_actor', type: 'actor', label: 'Dog', chineseChar: '狗', x: 12, y: 88, color: 'bg-amber-500' },
      { id: 'n_switch', type: 'switch', label: 'Switch', chineseChar: '开', x: 12, y: 28, color: 'bg-purple-500' },
      { id: 'n_fire', type: 'hazard', label: 'Fire', chineseChar: '火', x: 78, y: 55, color: 'bg-rose-600' },
      { id: 'n_home', type: 'goal', label: 'Home', chineseChar: '家', x: 88, y: 88, color: 'bg-emerald-500' }
    ],
    requiredNodeIds: ['n_actor', 'n_switch', 'n_home'],
    forbiddenNodeIds: ['n_fire'],
    walls: [
      V('w_divider', 50, 16, 96),
      H('w_w1', 4, 38, 72),
      H('w_w2', 4, 38, 52),
      H('w_w3', 4, 38, 36),
      H('w_e1', 62, 96, 72),
      H('w_e2', 62, 96, 52),
      H('w_e3', 62, 96, 36),
      H('w_e4', 62, 96, 20)
    ],
    lockedDoors: [],
    oneWayGates: [],
    switches: [
      { id: 'sw1', nodeId: 'n_switch', targetWallId: 'w_divider' }
    ],
    patrols: [
      patrol('p_catcher', 'Catcher', '捕', [
        { x: 68, y: 44 },
        { x: 92, y: 44 },
        { x: 92, y: 68 },
        { x: 68, y: 68 }
      ], 34, { radius: 7.5, emoji: '🚨' })
    ],
    routeLengthLimit: 300,
    vocabularyScaffold: [
      { char: '开', pinyin: 'kāi', english: 'Switch', emoji: '🎛️', stage: 'later' },
      { char: '火', pinyin: 'huǒ', english: 'Fire', emoji: '🔥', stage: 'later' },
      { char: '家', pinyin: 'jiā', english: 'Home', emoji: '🏠', stage: 'later' }
    ]
  },

  // ─── L12: grand multi-mechanic + dual patrols ───────────────────────────
  {
    id: 'lvl_12',
    title: 'Level 12: The Grand Rescue',
    mandarinClue: '先拿钥匙，开门避开火，踩开关回家',
    pinyinClue: 'xiān ná yào shi, kāi mén bì kāi huǒ, cǎi kāi guān huí jiā',
    englishTranslation: 'Get key first, open door to avoid fire, then flip switch to go home',
    hint: 'Follow the required order: Key (钥), Switch (开), then Home. Avoid Fire (火), Meat (肉), and both patrols.',
    missionFraming: 'Final lab breakout — key, switch, home. Ignore the meat bait.',
    nodes: [
      { id: 'n_actor', type: 'actor', label: 'Dog', chineseChar: '狗', x: 12, y: 14, color: 'bg-amber-500' },
      { id: 'n_key', type: 'key', label: 'Key', chineseChar: '钥', x: 12, y: 86, color: 'bg-yellow-500' },
      { id: 'n_switch', type: 'switch', label: 'Switch', chineseChar: '开', x: 88, y: 86, color: 'bg-purple-500' },
      { id: 'n_fire', type: 'hazard', label: 'Fire', chineseChar: '火', x: 50, y: 86, color: 'bg-rose-600' },
      { id: 'n_meat', type: 'item', label: 'Meat', chineseChar: '肉', x: 50, y: 50, color: 'bg-amber-600' },
      { id: 'n_home', type: 'goal', label: 'Home', chineseChar: '家', x: 88, y: 14, color: 'bg-emerald-500' }
    ],
    requiredNodeIds: ['n_actor', 'n_key', 'n_switch', 'n_home'],
    forbiddenNodeIds: ['n_fire', 'n_meat'],
    walls: [
      // Leave a west shaft (x≈10) so actor can reach the key before unlocking center
      H('w_left_mid', 20, 34, 50),
      H('w_right_mid', 66, 96, 50),
      V('w_exit_block', 50, 4, 34),
      V('w_nw', 34, 4, 36),
      H('w_sw1', 4, 34, 70),
      H('w_sw2', 20, 34, 82),
      H('w_se1', 66, 96, 70),
      H('w_se2', 66, 96, 82),
      H('w_ne1', 66, 96, 28),
      V('w_ne_post', 72, 14, 28)
    ],
    lockedDoors: [
      { id: 'd_center', x1: 34, y1: 50, x2: 66, y2: 50, keyNodeId: 'n_key' }
    ],
    oneWayGates: [
      { id: 'g_down', x1: 66, y1: 50, x2: 78, y2: 50, allowDirection: 'down' }
    ],
    switches: [
      { id: 'sw1', nodeId: 'n_switch', targetWallId: 'w_exit_block' }
    ],
    patrols: [
      patrol('p_catcher', 'Catcher', '捕', [
        { x: 40, y: 58 },
        { x: 60, y: 58 },
        { x: 60, y: 76 },
        { x: 40, y: 76 }
      ], 32, { radius: 7, emoji: '🚨' }),
      patrol('p_tech', 'Technician', '员', [
        { x: 58, y: 18 },
        { x: 78, y: 18 },
        { x: 78, y: 36 },
        { x: 58, y: 36 }
      ], 28, { radius: 7, phase: 0.8, emoji: '🧪' })
    ],
    routeLengthLimit: 640,
    vocabularyScaffold: [
      { char: '钥', pinyin: 'yào', english: 'Key', emoji: '🔑', stage: 'later' },
      { char: '开', pinyin: 'kāi', english: 'Switch', emoji: '🎛️', stage: 'later' },
      { char: '火', pinyin: 'huǒ', english: 'Fire', emoji: '🔥', stage: 'later' },
      { char: '肉', pinyin: 'ròu', english: 'Meat', emoji: '🥩', stage: 'later' },
      { char: '家', pinyin: 'jiā', english: 'Home', emoji: '🏠', stage: 'later' }
    ]
  }
];
