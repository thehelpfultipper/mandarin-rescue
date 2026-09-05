import { Level, GameNode, Wall, LockedDoor, OneWayGate } from '../types';

/**
 * Seeded board instantiation for curated (no-AI) levels.
 * Same linguistic challenge + difficulty class; different solution geometry each play.
 * Memory of a prior path must never be sufficient.
 */

type LayoutPack = {
  nodes: Array<Pick<GameNode, 'id' | 'x' | 'y'>>;
  walls: Wall[];
  lockedDoors?: LockedDoor[];
  oneWayGates?: OneWayGate[];
};

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function cloneLevel(level: Level): Level {
  return structuredClone(level);
}

function mirrorXCoord(x: number): number {
  return Math.round((100 - x) * 10) / 10;
}

function mirrorYCoord(y: number): number {
  return Math.round((100 - y) * 10) / 10;
}

function mirrorLevelX(level: Level): Level {
  const next = cloneLevel(level);
  next.nodes = next.nodes.map(n => ({ ...n, x: mirrorXCoord(n.x) }));
  next.walls = (next.walls || []).map(w => ({
    ...w,
    x1: mirrorXCoord(w.x1),
    x2: mirrorXCoord(w.x2)
  }));
  next.lockedDoors = (next.lockedDoors || []).map(d => ({
    ...d,
    x1: mirrorXCoord(d.x1),
    x2: mirrorXCoord(d.x2)
  }));
  next.oneWayGates = (next.oneWayGates || []).map(g => {
    const mirrored = {
      ...g,
      x1: mirrorXCoord(g.x1),
      x2: mirrorXCoord(g.x2)
    };
    // Horizontal travel flips; vertical gates keep allowDirection
    if (g.allowDirection === 'left') mirrored.allowDirection = 'right';
    else if (g.allowDirection === 'right') mirrored.allowDirection = 'left';
    return mirrored;
  });
  return next;
}

function mirrorLevelY(level: Level): Level {
  const next = cloneLevel(level);
  next.nodes = next.nodes.map(n => ({ ...n, y: mirrorYCoord(n.y) }));
  next.walls = (next.walls || []).map(w => ({
    ...w,
    y1: mirrorYCoord(w.y1),
    y2: mirrorYCoord(w.y2)
  }));
  next.lockedDoors = (next.lockedDoors || []).map(d => ({
    ...d,
    y1: mirrorYCoord(d.y1),
    y2: mirrorYCoord(d.y2)
  }));
  next.oneWayGates = (next.oneWayGates || []).map(g => {
    const mirrored = {
      ...g,
      y1: mirrorYCoord(g.y1),
      y2: mirrorYCoord(g.y2)
    };
    if (g.allowDirection === 'up') mirrored.allowDirection = 'down';
    else if (g.allowDirection === 'down') mirrored.allowDirection = 'up';
    return mirrored;
  });
  return next;
}

function applyLayoutPack(level: Level, pack: LayoutPack): Level {
  const next = cloneLevel(level);
  const byId = new Map(pack.nodes.map(n => [n.id, n]));
  next.nodes = next.nodes.map(n => {
    const pos = byId.get(n.id);
    return pos ? { ...n, x: pos.x, y: pos.y } : n;
  });
  next.walls = pack.walls.map(w => ({ ...w }));
  if (pack.lockedDoors) next.lockedDoors = pack.lockedDoors.map(d => ({ ...d }));
  if (pack.oneWayGates) next.oneWayGates = pack.oneWayGates.map(g => ({ ...g }));
  return next;
}

/**
 * Hand-authored alternate geometries (same nodes/ids, different corridors).
 * Used especially when spatial Mandarin forbids free mirroring.
 */
const LAYOUT_PACKS: Record<string, LayoutPack[]> = {
  // L1: binary fork — alternate starts home on the east branch
  lvl_1: [
    {
      nodes: [
        { id: 'n_actor', x: 50, y: 88 },
        { id: 'n_home', x: 78, y: 15 },
        { id: 'n_grass', x: 22, y: 15 }
      ],
      walls: [
        { id: 'w_south_l', x1: 5, y1: 75, x2: 38, y2: 75 },
        { id: 'w_south_r', x1: 62, y1: 75, x2: 95, y2: 75 },
        { id: 'w_mid', x1: 50, y1: 28, x2: 50, y2: 75 },
        { id: 'w_mid_cross', x1: 40, y1: 52, x2: 60, y2: 52 },
        { id: 'w_left_baffle', x1: 14, y1: 55, x2: 38, y2: 55 },
        { id: 'w_right_baffle', x1: 62, y1: 55, x2: 86, y2: 55 },
        { id: 'w_north_l', x1: 5, y1: 28, x2: 38, y2: 28 },
        { id: 'w_north_r', x1: 62, y1: 28, x2: 95, y2: 28 }
      ]
    }
  ],
  // L2 denser serpentine — east-home alternate (canonical is west-home)
  lvl_2: [
    {
      nodes: [
        { id: 'n_actor', x: 50, y: 90 },
        { id: 'n_home', x: 82, y: 12 },
        { id: 'n_fire', x: 18, y: 48 }
      ],
      walls: [
        { id: 'w_lobby_l', x1: 5, y1: 78, x2: 38, y2: 78 },
        { id: 'w_lobby_r', x1: 62, y1: 78, x2: 95, y2: 78 },
        { id: 'w_spine', x1: 50, y1: 20, x2: 50, y2: 78 },
        { id: 'w_west_low', x1: 62, y1: 62, x2: 92, y2: 62 },
        { id: 'w_west_mid', x1: 50, y1: 46, x2: 80, y2: 46 },
        { id: 'w_west_high', x1: 65, y1: 32, x2: 92, y2: 32 },
        { id: 'w_home_bar', x1: 62, y1: 20, x2: 95, y2: 20 },
        { id: 'w_east_low', x1: 8, y1: 62, x2: 38, y2: 62 },
        { id: 'w_fire_cage', x1: 32, y1: 32, x2: 32, y2: 62 },
        { id: 'w_east_top', x1: 5, y1: 20, x2: 38, y2: 20 }
      ]
    }
  ],
  lvl_3: [
    {
      nodes: [
        { id: 'n_actor', x: 50, y: 88 },
        { id: 'n_water', x: 82, y: 42 },
        { id: 'n_home', x: 50, y: 12 },
        { id: 'n_fire', x: 18, y: 42 }
      ],
      walls: [
        { id: 'w_south_l', x1: 5, y1: 68, x2: 38, y2: 68 },
        { id: 'w_south_r', x1: 62, y1: 68, x2: 95, y2: 68 },
        { id: 'w_mid', x1: 50, y1: 28, x2: 50, y2: 68 },
        { id: 'w_mid_cross', x1: 40, y1: 50, x2: 60, y2: 50 },
        { id: 'w_west_chamber', x1: 5, y1: 28, x2: 38, y2: 28 },
        { id: 'w_east_chamber', x1: 62, y1: 28, x2: 95, y2: 28 },
        { id: 'w_west_baffle', x1: 28, y1: 48, x2: 38, y2: 48 },
        { id: 'w_east_baffle', x1: 62, y1: 48, x2: 72, y2: 48 }
      ]
    }
  ],
  lvl_4: [
    {
      nodes: [
        { id: 'n_actor', x: 50, y: 88 },
        { id: 'n_meat', x: 82, y: 48 },
        { id: 'n_grass', x: 18, y: 48 },
        { id: 'n_home', x: 50, y: 12 }
      ],
      walls: [
        { id: 'w_south_l', x1: 5, y1: 70, x2: 38, y2: 70 },
        { id: 'w_south_r', x1: 62, y1: 70, x2: 95, y2: 70 },
        { id: 'w_mid', x1: 50, y1: 28, x2: 50, y2: 70 },
        { id: 'w_west_baffle', x1: 10, y1: 58, x2: 38, y2: 58 },
        { id: 'w_east_baffle', x1: 62, y1: 58, x2: 90, y2: 58 },
        { id: 'w_north_l', x1: 5, y1: 28, x2: 38, y2: 28 },
        { id: 'w_north_r', x1: 62, y1: 28, x2: 95, y2: 28 },
        { id: 'w_approach_stub', x1: 62, y1: 18, x2: 62, y2: 28 }
      ]
    }
  ],
  // Spatial: 左 must remain the correct branch — packs keep left = water path
  lvl_8: [
    {
      nodes: [
        { id: 'n_actor', x: 50, y: 88 },
        { id: 'n_left', x: 28, y: 72 },
        { id: 'n_right', x: 72, y: 72 },
        { id: 'n_water', x: 18, y: 32 },
        { id: 'n_fire', x: 82, y: 32 },
        { id: 'n_home', x: 50, y: 12 }
      ],
      walls: [
        { id: 'w_mid', x1: 50, y1: 25, x2: 50, y2: 80 },
        { id: 'w_mid_cross', x1: 40, y1: 55, x2: 60, y2: 55 },
        { id: 'w_left_baffle', x1: 12, y1: 48, x2: 38, y2: 48 },
        { id: 'w_right_baffle', x1: 62, y1: 48, x2: 88, y2: 48 },
        { id: 'w_north_l', x1: 5, y1: 25, x2: 38, y2: 25 },
        { id: 'w_north_r', x1: 62, y1: 25, x2: 95, y2: 25 },
        { id: 'w_south_l', x1: 5, y1: 80, x2: 38, y2: 80 },
        { id: 'w_south_r', x1: 62, y1: 80, x2: 95, y2: 80 },
        { id: 'w_left_jog', x1: 28, y1: 25, x2: 28, y2: 40 }
      ]
    },
    {
      nodes: [
        { id: 'n_actor', x: 50, y: 90 },
        { id: 'n_left', x: 22, y: 65 },
        { id: 'n_right', x: 78, y: 65 },
        { id: 'n_water', x: 18, y: 40 },
        { id: 'n_fire', x: 82, y: 40 },
        { id: 'n_home', x: 42, y: 12 }
      ],
      walls: [
        { id: 'w_mid', x1: 50, y1: 22, x2: 50, y2: 82 },
        { id: 'w_mid_cross', x1: 38, y1: 52, x2: 62, y2: 52 },
        { id: 'w_left_baffle', x1: 8, y1: 58, x2: 38, y2: 58 },
        { id: 'w_right_baffle', x1: 62, y1: 58, x2: 92, y2: 58 },
        { id: 'w_north_l', x1: 5, y1: 22, x2: 38, y2: 22 },
        { id: 'w_north_r', x1: 62, y1: 22, x2: 95, y2: 22 },
        { id: 'w_south_l', x1: 5, y1: 82, x2: 38, y2: 82 },
        { id: 'w_south_r', x1: 62, y1: 82, x2: 95, y2: 82 },
        { id: 'w_home_stub', x1: 38, y1: 12, x2: 38, y2: 22 }
      ]
    }
  ],
  // Spatial: 下 must stay the safe one-way; packs vary corridor jogs only
  lvl_9: [
    {
      nodes: [
        { id: 'n_actor', x: 78, y: 15 },
        { id: 'n_safe_chk', x: 78, y: 52 },
        { id: 'n_wrong_chk', x: 22, y: 52 },
        { id: 'n_home', x: 22, y: 85 }
      ],
      walls: [
        { id: 'w_mid', x1: 50, y1: 8, x2: 50, y2: 78 },
        { id: 'w_east_baffle', x1: 62, y1: 28, x2: 95, y2: 28 },
        { id: 'w_west_baffle', x1: 5, y1: 66, x2: 38, y2: 66 },
        { id: 'w_east_jog', x1: 70, y1: 42, x2: 70, y2: 58 }
      ],
      oneWayGates: [
        { id: 'g_right', x1: 50, y1: 42, x2: 100, y2: 42, allowDirection: 'down' },
        { id: 'g_left', x1: 0, y1: 42, x2: 50, y2: 42, allowDirection: 'up' }
      ]
    },
    {
      nodes: [
        { id: 'n_actor', x: 85, y: 12 },
        { id: 'n_safe_chk', x: 85, y: 48 },
        { id: 'n_wrong_chk', x: 15, y: 48 },
        { id: 'n_home', x: 15, y: 88 }
      ],
      walls: [
        { id: 'w_mid', x1: 50, y1: 8, x2: 50, y2: 80 },
        { id: 'w_east_baffle', x1: 62, y1: 35, x2: 95, y2: 35 },
        { id: 'w_west_baffle', x1: 5, y1: 58, x2: 38, y2: 58 },
        { id: 'w_south_lip', x1: 5, y1: 80, x2: 38, y2: 80 }
      ],
      oneWayGates: [
        { id: 'g_right', x1: 50, y1: 42, x2: 100, y2: 42, allowDirection: 'down' },
        { id: 'g_left', x1: 0, y1: 42, x2: 50, y2: 42, allowDirection: 'up' }
      ]
    }
  ],
  lvl_5: [
    {
      nodes: [
        { id: 'n_actor', x: 82, y: 88 },
        { id: 'n_fire', x: 82, y: 48 },
        { id: 'n_safe', x: 18, y: 48 },
        { id: 'n_home', x: 82, y: 12 }
      ],
      walls: [
        { id: 'w_vert', x1: 50, y1: 20, x2: 50, y2: 95 },
        { id: 'w_fire_block', x1: 62, y1: 62, x2: 95, y2: 62 },
        { id: 'w_fire_side', x1: 62, y1: 35, x2: 62, y2: 62 },
        { id: 'w_east_baffle', x1: 5, y1: 62, x2: 38, y2: 62 },
        { id: 'w_east_upper', x1: 5, y1: 35, x2: 38, y2: 35 },
        { id: 'w_north_cross', x1: 62, y1: 20, x2: 95, y2: 20 },
        { id: 'w_north_gap', x1: 5, y1: 20, x2: 38, y2: 20 }
      ]
    }
  ],
  lvl_6: [
    {
      nodes: [
        { id: 'n_actor', x: 82, y: 88 },
        { id: 'n_water', x: 82, y: 18 },
        { id: 'n_meat', x: 18, y: 18 },
        { id: 'n_grass', x: 18, y: 55 },
        { id: 'n_home', x: 18, y: 88 }
      ],
      walls: [
        { id: 'w_mid', x1: 50, y1: 35, x2: 50, y2: 92 },
        { id: 'w_west_guide', x1: 50, y1: 50, x2: 68, y2: 50 },
        { id: 'w_nw', x1: 65, y1: 35, x2: 95, y2: 35 },
        { id: 'w_se_baffle', x1: 5, y1: 70, x2: 38, y2: 70 }
      ],
      lockedDoors: [
        { id: 'd_meat_door', x1: 5, y1: 35, x2: 50, y2: 35, keyNodeId: 'n_water' }
      ]
    }
  ],
  lvl_7: [
    {
      nodes: [
        { id: 'n_actor', x: 50, y: 88 },
        { id: 'n_key', x: 82, y: 55 },
        { id: 'n_switch', x: 18, y: 55 },
        { id: 'n_fire', x: 18, y: 22 },
        { id: 'n_home', x: 50, y: 12 }
      ],
      walls: [
        { id: 'w_mid', x1: 50, y1: 30, x2: 50, y2: 75 },
        { id: 'w_trap', x1: 0, y1: 30, x2: 35, y2: 30 },
        { id: 'w_west_corridor', x1: 62, y1: 72, x2: 90, y2: 72 },
        { id: 'w_east_baffle', x1: 10, y1: 72, x2: 38, y2: 72 },
        { id: 'w_nw_chamber', x1: 65, y1: 40, x2: 95, y2: 40 }
      ],
      lockedDoors: [
        { id: 'd_left', x1: 50, y1: 30, x2: 100, y2: 30, keyNodeId: 'n_key' }
      ]
    }
  ],
  lvl_10: [
    {
      nodes: [
        { id: 'n_actor', x: 50, y: 90 },
        { id: 'n_water', x: 85, y: 18 },
        { id: 'n_meat', x: 15, y: 18 },
        { id: 'n_fire1', x: 50, y: 72 },
        { id: 'n_fire2', x: 50, y: 12 },
        { id: 'n_home', x: 50, y: 48 }
      ],
      walls: [
        { id: 'w_mid_left', x1: 12, y1: 55, x2: 40, y2: 55 },
        { id: 'w_mid_right', x1: 60, y1: 55, x2: 88, y2: 55 },
        { id: 'w_vert_left', x1: 32, y1: 28, x2: 32, y2: 48 },
        { id: 'w_vert_right', x1: 68, y1: 28, x2: 68, y2: 48 },
        { id: 'w_top_bar_l', x1: 5, y1: 30, x2: 28, y2: 30 },
        { id: 'w_top_bar_r', x1: 72, y1: 30, x2: 95, y2: 30 },
        { id: 'w_south_l', x1: 5, y1: 78, x2: 38, y2: 78 },
        { id: 'w_south_r', x1: 62, y1: 78, x2: 95, y2: 78 },
        { id: 'w_home_ring_l', x1: 38, y1: 40, x2: 38, y2: 55 },
        { id: 'w_home_ring_r', x1: 62, y1: 40, x2: 62, y2: 55 }
      ]
    }
  ],
  lvl_11: [
    {
      nodes: [
        { id: 'n_actor', x: 85, y: 85 },
        { id: 'n_switch', x: 85, y: 35 },
        { id: 'n_fire', x: 50, y: 55 },
        { id: 'n_home', x: 15, y: 85 }
      ],
      walls: [
        { id: 'w_divider', x1: 50, y1: 20, x2: 50, y2: 100 },
        { id: 'w_west_baffle', x1: 65, y1: 55, x2: 95, y2: 55 },
        { id: 'w_east_long', x1: 5, y1: 40, x2: 35, y2: 40 }
      ]
    }
  ],
  lvl_12: [
    {
      nodes: [
        { id: 'n_actor', x: 85, y: 18 },
        { id: 'n_key', x: 85, y: 82 },
        { id: 'n_switch', x: 15, y: 82 },
        { id: 'n_fire', x: 50, y: 82 },
        { id: 'n_meat', x: 50, y: 50 },
        { id: 'n_home', x: 15, y: 18 }
      ],
      walls: [
        { id: 'w_left_mid', x1: 68, y1: 50, x2: 100, y2: 50 },
        { id: 'w_right_mid', x1: 0, y1: 50, x2: 22, y2: 50 },
        { id: 'w_exit_block', x1: 50, y1: 0, x2: 50, y2: 32 },
        { id: 'w_nw', x1: 68, y1: 5, x2: 68, y2: 35 },
        { id: 'w_sw_baffle', x1: 72, y1: 68, x2: 95, y2: 68 }
      ],
      lockedDoors: [
        { id: 'd_center', x1: 32, y1: 50, x2: 68, y2: 50, keyNodeId: 'n_key' }
      ],
      oneWayGates: [
        { id: 'g_down', x1: 22, y1: 50, x2: 32, y2: 50, allowDirection: 'down' }
      ]
    }
  ]
};

function clueAllowsMirrorX(clue: string): boolean {
  return !clue.includes('左') && !clue.includes('右');
}

function clueAllowsMirrorY(clue: string): boolean {
  // Vertical flips break "go down / go up" and most bottom-start pedagogies
  return !clue.includes('上') && !clue.includes('下');
}

export function freshBoardSeed(): number {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] || (Date.now() >>> 0);
  }
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

/**
 * Instantiate a playable board from a curated template.
 * Picks an authored layout pack (when available), then applies safe mirrors.
 */
export function instantiateLevel(template: Level, seed: number = freshBoardSeed()): Level {
  const rng = mulberry32(seed >>> 0);
  let board = cloneLevel(template);

  const packs = LAYOUT_PACKS[template.id];
  if (packs && packs.length > 0) {
    // Include canonical layout as index 0 choice via "null pack"
    const choice = Math.floor(rng() * (packs.length + 1));
    if (choice > 0) {
      board = applyLayoutPack(board, packs[choice - 1]);
    }
  }

  if (clueAllowsMirrorX(board.mandarinClue) && rng() < 0.5) {
    board = mirrorLevelX(board);
  }

  // Y-mirror only for mid/late non-spatial levels — keeps intro bottom-start feel
  const levelNum = parseInt(template.id.replace('lvl_', ''), 10);
  if (
    !Number.isNaN(levelNum) &&
    levelNum >= 5 &&
    clueAllowsMirrorY(board.mandarinClue) &&
    rng() < 0.35
  ) {
    board = mirrorLevelY(board);
  }

  // Stable play id keeps React keys honest while geometry changes
  board.id = template.id;
  return board;
}

/** Fingerprint geometry so tests can assert two seeds differ. */
export function boardGeometryKey(level: Level): string {
  const nodes = level.nodes.map(n => `${n.id}:${n.x},${n.y}`).join('|');
  const walls = (level.walls || []).map(w => `${w.id}:${w.x1},${w.y1}-${w.x2},${w.y2}`).join('|');
  return `${nodes}#${walls}`;
}
