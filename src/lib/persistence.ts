import { Level, PlayerProgress, PlayerProgressSchema } from '../types';

/**
 * Curated curriculum: intro ramp (L1–L2) → grammar/order → denser labyrinths.
 * Actor character is 狗 (matches clue vocabulary). Every linguistic level has a distractor.
 */
export const DEFAULT_LEVELS: Level[] = [
  {
    id: 'lvl_1',
    title: 'Level 1: First Path',
    mandarinClue: '小狗回家',
    pinyinClue: 'xiǎo gǒu huí jiā',
    englishTranslation: 'The puppy goes home',
    hint: 'Two top chambers look similar. Take the west corridor to Home (家). The east corridor ends at Grass (草) — that is not home.',
    forceAssists: true,
    missionFraming: 'Learn to draw a path. Tap any character in the clue to see what it means.',
    nodes: [
      // Bottom lobby: both corridors look viable (binary fork — industry standard first decision)
      { id: 'n_actor', type: 'actor', label: 'Dog', chineseChar: '狗', x: 50, y: 88, color: 'bg-amber-500' },
      { id: 'n_home', type: 'goal', label: 'Home', chineseChar: '家', x: 22, y: 15, color: 'bg-emerald-500' },
      { id: 'n_grass', type: 'item', label: 'Grass', chineseChar: '草', x: 78, y: 15, color: 'bg-green-500' }
    ],
    requiredNodeIds: ['n_actor', 'n_home'],
    forbiddenNodeIds: ['n_grass'],
    // Junction + baffles: straight shot blocked; wrong branch is fully drawable; correct path needs 2–3 bends
    walls: [
      { id: 'w_south_l', x1: 5, y1: 75, x2: 38, y2: 75 },
      { id: 'w_south_r', x1: 62, y1: 75, x2: 95, y2: 75 },
      { id: 'w_mid', x1: 50, y1: 28, x2: 50, y2: 75 },
      { id: 'w_mid_cross', x1: 40, y1: 52, x2: 60, y2: 52 },
      { id: 'w_left_baffle', x1: 14, y1: 55, x2: 38, y2: 55 },
      { id: 'w_right_baffle', x1: 62, y1: 55, x2: 86, y2: 55 },
      { id: 'w_north_l', x1: 5, y1: 28, x2: 38, y2: 28 },
      { id: 'w_north_r', x1: 62, y1: 28, x2: 95, y2: 28 }
    ],
    lockedDoors: [],
    oneWayGates: [],
    switches: [],
    routeLengthLimit: 300,
    vocabularyScaffold: [
      { char: '狗', pinyin: 'gǒu', english: 'Dog', emoji: '🐶', stage: 'new' },
      { char: '家', pinyin: 'jiā', english: 'Home', emoji: '🏠', stage: 'new' },
      { char: '草', pinyin: 'cǎo', english: 'Grass', emoji: '🌿', stage: 'new' }
    ]
  },
  {
    id: 'lvl_2',
    title: 'Level 2: Garden Choice',
    mandarinClue: '小狗回家',
    pinyinClue: 'xiǎo gǒu huí jiā',
    englishTranslation: 'The puppy goes home',
    hint: 'Serpentine courtyard: zig west through the chicanes to Home (家). The east pocket with Fire (火) looks shorter — it is a trap.',
    forceAssists: true,
    missionFraming: 'Same words as Room 1, but a denser maze — Mandarin still picks the safe wing.',
    nodes: [
      { id: 'n_actor', type: 'actor', label: 'Dog', chineseChar: '狗', x: 50, y: 90, color: 'bg-amber-500' },
      { id: 'n_home', type: 'goal', label: 'Home', chineseChar: '家', x: 18, y: 12, color: 'bg-emerald-500' },
      { id: 'n_fire', type: 'hazard', label: 'Fire', chineseChar: '火', x: 82, y: 48, color: 'bg-rose-600' }
    ],
    requiredNodeIds: ['n_actor', 'n_home'],
    forbiddenNodeIds: ['n_fire'],
    // Denser than L1: staggered west chicanes + east fire pocket (not a twin fork)
    walls: [
      { id: 'w_lobby_l', x1: 5, y1: 78, x2: 38, y2: 78 },
      { id: 'w_lobby_r', x1: 62, y1: 78, x2: 95, y2: 78 },
      { id: 'w_spine', x1: 50, y1: 20, x2: 50, y2: 78 },
      { id: 'w_west_low', x1: 8, y1: 62, x2: 38, y2: 62 },
      { id: 'w_west_mid', x1: 20, y1: 46, x2: 50, y2: 46 },
      { id: 'w_west_high', x1: 8, y1: 32, x2: 35, y2: 32 },
      { id: 'w_home_bar', x1: 5, y1: 20, x2: 38, y2: 20 },
      { id: 'w_east_low', x1: 62, y1: 62, x2: 92, y2: 62 },
      { id: 'w_fire_cage', x1: 68, y1: 32, x2: 68, y2: 62 },
      { id: 'w_east_top', x1: 62, y1: 20, x2: 95, y2: 20 }
    ],
    lockedDoors: [],
    oneWayGates: [],
    switches: [],
    routeLengthLimit: 380,
    vocabularyScaffold: [
      { char: '狗', pinyin: 'gǒu', english: 'Dog', emoji: '🐶', stage: 'familiar' },
      { char: '家', pinyin: 'jiā', english: 'Home', emoji: '🏠', stage: 'familiar' },
      { char: '火', pinyin: 'huǒ', english: 'Fire', emoji: '🔥', stage: 'new' }
    ]
  },
  {
    id: 'lvl_3',
    title: 'Level 3: Water First',
    mandarinClue: '先喝水再回家',
    pinyinClue: 'xiān hē shuǐ zài huí jiā',
    englishTranslation: 'Drink water first, then go home',
    hint: 'Order matters: visit Water (水) in the west chamber before Home (家). Fire (火) in the east is wrong.',
    missionFraming: 'New pattern: 先…再… means first… then…',
    nodes: [
      { id: 'n_actor', type: 'actor', label: 'Dog', chineseChar: '狗', x: 50, y: 88, color: 'bg-amber-500' },
      { id: 'n_water', type: 'checkpoint', label: 'Water', chineseChar: '水', x: 18, y: 42, color: 'bg-blue-500' },
      { id: 'n_home', type: 'goal', label: 'Home', chineseChar: '家', x: 50, y: 12, color: 'bg-emerald-500' },
      { id: 'n_fire', type: 'hazard', label: 'Fire', chineseChar: '火', x: 82, y: 42, color: 'bg-rose-600' }
    ],
    requiredNodeIds: ['n_actor', 'n_water', 'n_home'],
    forbiddenNodeIds: ['n_fire'],
    walls: [
      { id: 'w_south_l', x1: 5, y1: 68, x2: 38, y2: 68 },
      { id: 'w_south_r', x1: 62, y1: 68, x2: 95, y2: 68 },
      { id: 'w_mid', x1: 50, y1: 28, x2: 50, y2: 68 },
      { id: 'w_mid_cross', x1: 40, y1: 50, x2: 60, y2: 50 },
      { id: 'w_west_chamber', x1: 5, y1: 28, x2: 38, y2: 28 },
      { id: 'w_east_chamber', x1: 62, y1: 28, x2: 95, y2: 28 },
      { id: 'w_west_baffle', x1: 28, y1: 48, x2: 38, y2: 48 },
      { id: 'w_east_baffle', x1: 62, y1: 48, x2: 72, y2: 48 },
      { id: 'w_north_gate_l', x1: 5, y1: 28, x2: 5, y2: 12 },
      { id: 'w_north_gate_r', x1: 95, y1: 28, x2: 95, y2: 12 }
    ],
    lockedDoors: [],
    oneWayGates: [],
    switches: [],
    routeLengthLimit: 400,
    vocabularyScaffold: [
      { char: '水', pinyin: 'shuǐ', english: 'Water', emoji: '💧', stage: 'new' },
      { char: '火', pinyin: 'huǒ', english: 'Fire', emoji: '🔥', stage: 'familiar' },
      { char: '狗', pinyin: 'gǒu', english: 'Dog', emoji: '🐶', stage: 'familiar' },
      { char: '家', pinyin: 'jiā', english: 'Home', emoji: '🏠', stage: 'strong' }
    ]
  },
  {
    id: 'lvl_4',
    title: 'Level 4: Meat or Grass',
    mandarinClue: '先吃肉再回家',
    pinyinClue: 'xiān chī ròu zài huí jiā',
    englishTranslation: 'Eat meat first, then go home',
    hint: 'West chamber has Meat (肉); east has Grass (草). After meat, weave north through the center gap to Home — a straight shot is blocked.',
    nodes: [
      { id: 'n_actor', type: 'actor', label: 'Dog', chineseChar: '狗', x: 50, y: 88, color: 'bg-amber-500' },
      { id: 'n_meat', type: 'checkpoint', label: 'Meat', chineseChar: '肉', x: 18, y: 48, color: 'bg-amber-600' },
      { id: 'n_grass', type: 'item', label: 'Grass', chineseChar: '草', x: 82, y: 48, color: 'bg-green-500' },
      { id: 'n_home', type: 'goal', label: 'Home', chineseChar: '家', x: 50, y: 12, color: 'bg-emerald-500' }
    ],
    requiredNodeIds: ['n_actor', 'n_meat', 'n_home'],
    forbiddenNodeIds: ['n_grass'],
    walls: [
      { id: 'w_south_l', x1: 5, y1: 70, x2: 38, y2: 70 },
      { id: 'w_south_r', x1: 62, y1: 70, x2: 95, y2: 70 },
      { id: 'w_mid', x1: 50, y1: 28, x2: 50, y2: 70 },
      { id: 'w_west_baffle', x1: 10, y1: 58, x2: 38, y2: 58 },
      { id: 'w_east_baffle', x1: 62, y1: 58, x2: 90, y2: 58 },
      // Open gap into home, plus a stub that forces an S-bend (not a straight climb)
      { id: 'w_north_l', x1: 5, y1: 28, x2: 38, y2: 28 },
      { id: 'w_north_r', x1: 62, y1: 28, x2: 95, y2: 28 },
      { id: 'w_approach_stub', x1: 38, y1: 18, x2: 38, y2: 28 }
    ],
    lockedDoors: [],
    oneWayGates: [],
    switches: [],
    routeLengthLimit: 400,
    vocabularyScaffold: [
      { char: '肉', pinyin: 'ròu', english: 'Meat', emoji: '🥩', stage: 'new' },
      { char: '草', pinyin: 'cǎo', english: 'Grass', emoji: '🌿', stage: 'familiar' },
      { char: '家', pinyin: 'jiā', english: 'Home', emoji: '🏠', stage: 'strong' }
    ]
  },
  {
    id: 'lvl_5',
    title: 'Level 5: Safe Road',
    mandarinClue: '避开火，走安全路',
    pinyinClue: 'bì kāi huǒ, zǒu ān quán lù',
    englishTranslation: 'Avoid the fire, take the safe path',
    hint: 'Western dead-end has Fire (火). Take the eastern Safe Road (路), then loop to Home (家).',
    nodes: [
      { id: 'n_actor', type: 'actor', label: 'Dog', chineseChar: '狗', x: 18, y: 88, color: 'bg-amber-500' },
      { id: 'n_fire', type: 'hazard', label: 'Fire', chineseChar: '火', x: 18, y: 48, color: 'bg-rose-600' },
      { id: 'n_safe', type: 'checkpoint', label: 'Path', chineseChar: '路', x: 82, y: 48, color: 'bg-blue-500' },
      { id: 'n_home', type: 'goal', label: 'Home', chineseChar: '家', x: 18, y: 12, color: 'bg-emerald-500' }
    ],
    requiredNodeIds: ['n_actor', 'n_safe', 'n_home'],
    forbiddenNodeIds: ['n_fire'],
    walls: [
      { id: 'w_vert', x1: 50, y1: 20, x2: 50, y2: 95 },
      { id: 'w_fire_block', x1: 5, y1: 62, x2: 38, y2: 62 },
      { id: 'w_fire_side', x1: 38, y1: 35, x2: 38, y2: 62 },
      { id: 'w_east_baffle', x1: 62, y1: 62, x2: 95, y2: 62 },
      { id: 'w_east_upper', x1: 62, y1: 35, x2: 95, y2: 35 },
      { id: 'w_north_cross', x1: 5, y1: 20, x2: 38, y2: 20 },
      { id: 'w_north_gap', x1: 62, y1: 20, x2: 95, y2: 20 }
    ],
    lockedDoors: [],
    oneWayGates: [],
    switches: [],
    routeLengthLimit: 450,
    vocabularyScaffold: [
      { char: '火', pinyin: 'huǒ', english: 'Fire', emoji: '🔥', stage: 'strong' },
      { char: '路', pinyin: 'lù', english: 'Safe road', emoji: '🛣️', stage: 'new' },
      { char: '家', pinyin: 'jiā', english: 'Home', emoji: '🏠', stage: 'strong' }
    ]
  },
  {
    id: 'lvl_6',
    title: 'Level 6: Sequence Trial',
    mandarinClue: '先喝水，后吃肉，再回家',
    pinyinClue: 'xiān hē shuǐ, hòu chī ròu, zài huí jiā',
    englishTranslation: 'Drink water first, then eat meat, then go home',
    hint: 'Water (水) unlocks the gate to Meat (肉). Visit in order, then Home. Grass (草) is a distractor.',
    nodes: [
      { id: 'n_actor', type: 'actor', label: 'Dog', chineseChar: '狗', x: 18, y: 88, color: 'bg-amber-500' },
      { id: 'n_water', type: 'key', label: 'Water', chineseChar: '水', x: 18, y: 18, color: 'bg-blue-500' },
      { id: 'n_meat', type: 'checkpoint', label: 'Meat', chineseChar: '肉', x: 82, y: 18, color: 'bg-amber-600' },
      { id: 'n_grass', type: 'item', label: 'Grass', chineseChar: '草', x: 82, y: 55, color: 'bg-green-500' },
      { id: 'n_home', type: 'goal', label: 'Home', chineseChar: '家', x: 82, y: 88, color: 'bg-emerald-500' }
    ],
    requiredNodeIds: ['n_actor', 'n_water', 'n_meat', 'n_home'],
    forbiddenNodeIds: ['n_grass'],
    walls: [
      // Mid stops just above the south lip so Grass is reachable via the bottom hall,
      // while still blocking a straight actor→home dash along y≈88
      { id: 'w_mid', x1: 50, y1: 35, x2: 50, y2: 92 },
      { id: 'w_west_guide', x1: 32, y1: 50, x2: 50, y2: 50 },
      { id: 'w_nw', x1: 5, y1: 35, x2: 35, y2: 35 },
      { id: 'w_se_baffle', x1: 62, y1: 70, x2: 95, y2: 70 }
    ],
    lockedDoors: [
      { id: 'd_meat_door', x1: 50, y1: 35, x2: 95, y2: 35, keyNodeId: 'n_water' }
    ],
    oneWayGates: [],
    switches: [],
    routeLengthLimit: 450,
    vocabularyScaffold: [
      { char: '水', pinyin: 'shuǐ', english: 'Water', emoji: '💧', stage: 'strong' },
      { char: '肉', pinyin: 'ròu', english: 'Meat', emoji: '🥩', stage: 'familiar' },
      { char: '草', pinyin: 'cǎo', english: 'Grass', emoji: '🌿', stage: 'strong' },
      { char: '家', pinyin: 'jiā', english: 'Home', emoji: '🏠', stage: 'later' }
    ]
  },
  {
    id: 'lvl_7',
    title: 'Level 7: Key & Door',
    mandarinClue: '用钥匙开门，避开火',
    pinyinClue: 'yòng yào shi kāi mén, bì kāi huǒ',
    englishTranslation: 'Use the key to open the door, avoid the fire',
    hint: 'Fetch the Key (钥) west, unlock the north gate, bypass Fire (火). The trap Switch (开) opens a useless dead wall — skip it.',
    nodes: [
      { id: 'n_actor', type: 'actor', label: 'Dog', chineseChar: '狗', x: 50, y: 88, color: 'bg-amber-500' },
      { id: 'n_key', type: 'key', label: 'Key', chineseChar: '钥', x: 18, y: 55, color: 'bg-yellow-500' },
      { id: 'n_switch', type: 'item', label: 'Switch', chineseChar: '开', x: 82, y: 55, color: 'bg-purple-500' },
      { id: 'n_fire', type: 'hazard', label: 'Fire', chineseChar: '火', x: 82, y: 22, color: 'bg-rose-600' },
      { id: 'n_home', type: 'goal', label: 'Home', chineseChar: '家', x: 50, y: 12, color: 'bg-emerald-500' }
    ],
    requiredNodeIds: ['n_actor', 'n_key', 'n_home'],
    forbiddenNodeIds: ['n_fire', 'n_switch'],
    walls: [
      { id: 'w_mid', x1: 50, y1: 30, x2: 50, y2: 75 },
      { id: 'w_trap', x1: 65, y1: 30, x2: 100, y2: 30 },
      { id: 'w_west_corridor', x1: 10, y1: 72, x2: 38, y2: 72 },
      { id: 'w_east_baffle', x1: 62, y1: 72, x2: 90, y2: 72 },
      { id: 'w_nw_chamber', x1: 5, y1: 40, x2: 35, y2: 40 }
    ],
    lockedDoors: [
      { id: 'd_left', x1: 0, y1: 30, x2: 50, y2: 30, keyNodeId: 'n_key' }
    ],
    oneWayGates: [],
    switches: [],
    routeLengthLimit: 400,
    vocabularyScaffold: [
      { char: '钥', pinyin: 'yào', english: 'Key', emoji: '🔑', stage: 'new' },
      { char: '开', pinyin: 'kāi', english: 'Switch / Open', emoji: '🎛️', stage: 'new' },
      { char: '火', pinyin: 'huǒ', english: 'Fire', emoji: '🔥', stage: 'later' }
    ]
  },
  {
    id: 'lvl_8',
    title: 'Level 8: Left or Right',
    mandarinClue: '向左走是水源，避开右边',
    pinyinClue: 'xiàng zuǒ zǒu shì shuǐ yuán, bì kāi yòu biān',
    englishTranslation: 'To the left is the water source, avoid the right side',
    hint: 'Pass Left (左) into the western hall for Water (水), then Home. Right (右) leads to Fire.',
    nodes: [
      { id: 'n_actor', type: 'actor', label: 'Dog', chineseChar: '狗', x: 50, y: 88, color: 'bg-amber-500' },
      { id: 'n_left', type: 'checkpoint', label: 'Left', chineseChar: '左', x: 28, y: 68, color: 'bg-sky-500' },
      { id: 'n_right', type: 'item', label: 'Right', chineseChar: '右', x: 72, y: 68, color: 'bg-gray-400' },
      { id: 'n_water', type: 'checkpoint', label: 'Water', chineseChar: '水', x: 18, y: 38, color: 'bg-blue-500' },
      { id: 'n_fire', type: 'hazard', label: 'Fire', chineseChar: '火', x: 82, y: 38, color: 'bg-rose-600' },
      { id: 'n_home', type: 'goal', label: 'Home', chineseChar: '家', x: 50, y: 12, color: 'bg-emerald-500' }
    ],
    requiredNodeIds: ['n_actor', 'n_left', 'n_water', 'n_home'],
    forbiddenNodeIds: ['n_right', 'n_fire'],
    walls: [
      { id: 'w_mid', x1: 50, y1: 25, x2: 50, y2: 80 },
      { id: 'w_mid_cross', x1: 40, y1: 48, x2: 60, y2: 48 },
      { id: 'w_left_baffle', x1: 12, y1: 55, x2: 38, y2: 55 },
      { id: 'w_right_baffle', x1: 62, y1: 55, x2: 88, y2: 55 },
      { id: 'w_north_l', x1: 5, y1: 25, x2: 38, y2: 25 },
      { id: 'w_north_r', x1: 62, y1: 25, x2: 95, y2: 25 },
      { id: 'w_south_l', x1: 5, y1: 80, x2: 38, y2: 80 },
      { id: 'w_south_r', x1: 62, y1: 80, x2: 95, y2: 80 }
    ],
    lockedDoors: [],
    oneWayGates: [],
    switches: [],
    routeLengthLimit: 400,
    vocabularyScaffold: [
      { char: '左', pinyin: 'zuǒ', english: 'Left', emoji: '⬅️', stage: 'new' },
      { char: '右', pinyin: 'yòu', english: 'Right', emoji: '➡️', stage: 'new' },
      { char: '水', pinyin: 'shuǐ', english: 'Water', emoji: '💧', stage: 'later' }
    ]
  },
  {
    id: 'lvl_9',
    title: 'Level 9: One-Way Stream',
    mandarinClue: '向下走，通过安全门',
    pinyinClue: 'xiàng xià zǒu, tōng guò ān quán mén',
    englishTranslation: 'Go downward, pass through the safe gate',
    hint: 'Right channel one-way allows only Down (下). Pass the gate, then loop through the open southern hallway to Home (家). Avoid the Up (上) distractor on the left.',
    nodes: [
      { id: 'n_actor', type: 'actor', label: 'Dog', chineseChar: '狗', x: 82, y: 15, color: 'bg-amber-500' },
      { id: 'n_safe_chk', type: 'checkpoint', label: 'Gate', chineseChar: '下', x: 82, y: 48, color: 'bg-sky-500' },
      { id: 'n_wrong_chk', type: 'item', label: 'Up', chineseChar: '上', x: 18, y: 48, color: 'bg-gray-400' },
      { id: 'n_home', type: 'goal', label: 'Home', chineseChar: '家', x: 18, y: 85, color: 'bg-emerald-500' }
    ],
    requiredNodeIds: ['n_actor', 'n_safe_chk', 'n_home'],
    forbiddenNodeIds: ['n_wrong_chk'],
    walls: [
      // Mid divider stops above the south hall so a thick-safe corridor remains
      { id: 'w_mid', x1: 50, y1: 8, x2: 50, y2: 78 },
      { id: 'w_east_baffle', x1: 62, y1: 32, x2: 95, y2: 32 },
      { id: 'w_west_baffle', x1: 5, y1: 62, x2: 38, y2: 62 }
    ],
    lockedDoors: [],
    oneWayGates: [
      { id: 'g_right', x1: 50, y1: 42, x2: 100, y2: 42, allowDirection: 'down' },
      { id: 'g_left', x1: 0, y1: 42, x2: 50, y2: 42, allowDirection: 'up' }
    ],
    switches: [],
    routeLengthLimit: 400,
    vocabularyScaffold: [
      { char: '下', pinyin: 'xià', english: 'Down', emoji: '⬇️', stage: 'new' },
      { char: '上', pinyin: 'shàng', english: 'Up', emoji: '⬆️', stage: 'new' },
      { char: '家', pinyin: 'jiā', english: 'Home', emoji: '🏠', stage: 'later' }
    ]
  },
  {
    id: 'lvl_10',
    title: 'Level 10: Multi-Constraint',
    mandarinClue: '先拿水和肉，再避开火回家',
    pinyinClue: 'xiān ná shuǐ hé ròu, zài bì kāi huǒ huí jiā',
    englishTranslation: 'Get water and meat first, then avoid fire and go home',
    hint: 'Collect Water then Meat (order), weave past both Fires through the corridor maze to Home.',
    nodes: [
      { id: 'n_actor', type: 'actor', label: 'Dog', chineseChar: '狗', x: 50, y: 90, color: 'bg-amber-500' },
      { id: 'n_water', type: 'checkpoint', label: 'Water', chineseChar: '水', x: 15, y: 18, color: 'bg-blue-500' },
      { id: 'n_meat', type: 'checkpoint', label: 'Meat', chineseChar: '肉', x: 85, y: 18, color: 'bg-amber-600' },
      { id: 'n_fire1', type: 'hazard', label: 'Fire', chineseChar: '火', x: 50, y: 72, color: 'bg-rose-600' },
      { id: 'n_fire2', type: 'hazard', label: 'Fire', chineseChar: '火', x: 50, y: 12, color: 'bg-rose-600' },
      { id: 'n_home', type: 'goal', label: 'Home', chineseChar: '家', x: 50, y: 48, color: 'bg-emerald-500' }
    ],
    requiredNodeIds: ['n_actor', 'n_water', 'n_meat', 'n_home'],
    forbiddenNodeIds: ['n_fire1', 'n_fire2'],
    walls: [
      { id: 'w_mid_left', x1: 12, y1: 55, x2: 40, y2: 55 },
      { id: 'w_mid_right', x1: 60, y1: 55, x2: 88, y2: 55 },
      { id: 'w_vert_left', x1: 32, y1: 28, x2: 32, y2: 48 },
      { id: 'w_vert_right', x1: 68, y1: 28, x2: 68, y2: 48 },
      { id: 'w_top_bar_l', x1: 5, y1: 30, x2: 28, y2: 30 },
      { id: 'w_top_bar_r', x1: 72, y1: 30, x2: 95, y2: 30 },
      { id: 'w_south_l', x1: 5, y1: 78, x2: 38, y2: 78 },
      { id: 'w_south_r', x1: 62, y1: 78, x2: 95, y2: 78 }
    ],
    lockedDoors: [],
    oneWayGates: [],
    switches: [],
    routeLengthLimit: 520,
    vocabularyScaffold: [
      { char: '水', pinyin: 'shuǐ', english: 'Water', emoji: '💧', stage: 'later' },
      { char: '肉', pinyin: 'ròu', english: 'Meat', emoji: '🥩', stage: 'later' },
      { char: '火', pinyin: 'huǒ', english: 'Fire', emoji: '🔥', stage: 'later' },
      { char: '家', pinyin: 'jiā', english: 'Home', emoji: '🏠', stage: 'later' }
    ]
  },
  {
    id: 'lvl_11',
    title: 'Level 11: Shortcut Energy',
    mandarinClue: '走捷径，省能源回家',
    pinyinClue: 'zǒu jié jìng, shěng néng yuán huí jiā',
    englishTranslation: 'Take the shortcut, save energy to go home',
    hint: 'Ink is scarce! Step on Switch (开) to collapse the divider, then cut across to Home. Fire (火) is a trap corridor.',
    nodes: [
      { id: 'n_actor', type: 'actor', label: 'Dog', chineseChar: '狗', x: 15, y: 85, color: 'bg-amber-500' },
      { id: 'n_switch', type: 'switch', label: 'Switch', chineseChar: '开', x: 15, y: 35, color: 'bg-purple-500' },
      { id: 'n_fire', type: 'hazard', label: 'Fire', chineseChar: '火', x: 50, y: 55, color: 'bg-rose-600' },
      { id: 'n_home', type: 'goal', label: 'Home', chineseChar: '家', x: 85, y: 85, color: 'bg-emerald-500' }
    ],
    requiredNodeIds: ['n_actor', 'n_switch', 'n_home'],
    forbiddenNodeIds: ['n_fire'],
    walls: [
      { id: 'w_divider', x1: 50, y1: 20, x2: 50, y2: 100 },
      { id: 'w_west_baffle', x1: 5, y1: 55, x2: 35, y2: 55 },
      { id: 'w_east_long', x1: 65, y1: 40, x2: 95, y2: 40 }
    ],
    lockedDoors: [],
    oneWayGates: [],
    switches: [
      { id: 'sw1', nodeId: 'n_switch', targetWallId: 'w_divider' }
    ],
    routeLengthLimit: 280,
    vocabularyScaffold: [
      { char: '开', pinyin: 'kāi', english: 'Switch', emoji: '🎛️', stage: 'later' },
      { char: '火', pinyin: 'huǒ', english: 'Fire', emoji: '🔥', stage: 'later' },
      { char: '家', pinyin: 'jiā', english: 'Home', emoji: '🏠', stage: 'later' }
    ]
  },
  {
    id: 'lvl_12',
    title: 'Level 12: The Grand Rescue',
    mandarinClue: '先拿钥匙，开门避开火，踩开关回家',
    pinyinClue: 'xiān ná yào shi, kāi mén bì kāi huǒ, cǎi kāi guān huí jiā',
    englishTranslation: 'Get key first, open door to avoid fire, then flip switch to go home',
    hint: 'Key southwest → unlock center door → avoid Fire → Switch opens the exit wall → Home. Meat (肉) is a distractor.',
    nodes: [
      { id: 'n_actor', type: 'actor', label: 'Dog', chineseChar: '狗', x: 15, y: 18, color: 'bg-amber-500' },
      { id: 'n_key', type: 'key', label: 'Key', chineseChar: '钥', x: 15, y: 82, color: 'bg-yellow-500' },
      { id: 'n_switch', type: 'switch', label: 'Switch', chineseChar: '开', x: 85, y: 82, color: 'bg-purple-500' },
      { id: 'n_fire', type: 'hazard', label: 'Fire', chineseChar: '火', x: 50, y: 82, color: 'bg-rose-600' },
      { id: 'n_meat', type: 'item', label: 'Meat', chineseChar: '肉', x: 50, y: 50, color: 'bg-amber-600' },
      { id: 'n_home', type: 'goal', label: 'Home', chineseChar: '家', x: 85, y: 18, color: 'bg-emerald-500' }
    ],
    requiredNodeIds: ['n_actor', 'n_key', 'n_switch', 'n_home'],
    forbiddenNodeIds: ['n_fire', 'n_meat'],
    walls: [
      { id: 'w_left_mid', x1: 0, y1: 50, x2: 32, y2: 50 },
      { id: 'w_right_mid', x1: 78, y1: 50, x2: 100, y2: 50 },
      { id: 'w_exit_block', x1: 50, y1: 0, x2: 50, y2: 32 },
      { id: 'w_nw', x1: 32, y1: 5, x2: 32, y2: 35 },
      { id: 'w_sw_baffle', x1: 5, y1: 68, x2: 28, y2: 68 }
    ],
    lockedDoors: [
      { id: 'd_center', x1: 32, y1: 50, x2: 68, y2: 50, keyNodeId: 'n_key' }
    ],
    oneWayGates: [
      { id: 'g_down', x1: 68, y1: 50, x2: 78, y2: 50, allowDirection: 'down' }
    ],
    switches: [
      { id: 'sw1', nodeId: 'n_switch', targetWallId: 'w_exit_block' }
    ],
    routeLengthLimit: 580,
    vocabularyScaffold: [
      { char: '钥', pinyin: 'yào', english: 'Key', emoji: '🔑', stage: 'later' },
      { char: '开', pinyin: 'kāi', english: 'Switch', emoji: '🎛️', stage: 'later' },
      { char: '火', pinyin: 'huǒ', english: 'Fire', emoji: '🔥', stage: 'later' },
      { char: '肉', pinyin: 'ròu', english: 'Meat', emoji: '🥩', stage: 'later' },
      { char: '家', pinyin: 'jiā', english: 'Home', emoji: '🏠', stage: 'later' }
    ]
  }
];

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
