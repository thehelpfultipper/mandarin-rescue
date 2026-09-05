import { Wall, Patrol } from '../types';

/** Horizontal wall segment helper */
export function H(id: string, x1: number, x2: number, y: number): Wall {
  return { id, x1, y1: y, x2, y2: y };
}

/** Vertical wall segment helper */
export function V(id: string, x: number, y1: number, y2: number): Wall {
  return { id, x1: x, y1, x2: x, y2 };
}

export function patrol(
  id: string,
  label: string,
  chineseChar: string,
  waypoints: { x: number; y: number }[],
  speed: number,
  opts?: { radius?: number; phase?: number; emoji?: string }
): Patrol {
  return {
    id,
    label,
    chineseChar,
    emoji: opts?.emoji ?? '🚨',
    waypoints,
    speed,
    radius: opts?.radius ?? 7,
    phase: opts?.phase ?? 0
  };
}

/** Loop length of a patrol polyline (including return to start). */
export function patrolLoopLength(waypoints: { x: number; y: number }[]): number {
  if (waypoints.length < 2) return 0;
  let len = 0;
  for (let i = 1; i < waypoints.length; i++) {
    len += Math.hypot(waypoints[i].x - waypoints[i - 1].x, waypoints[i].y - waypoints[i - 1].y);
  }
  const a = waypoints[waypoints.length - 1];
  const b = waypoints[0];
  len += Math.hypot(b.x - a.x, b.y - a.y);
  return len;
}

/** Position on a looping patrol at time t (seconds). */
export function patrolPositionAt(
  waypoints: { x: number; y: number }[],
  speed: number,
  t: number,
  phase = 0
): { x: number; y: number } {
  const loop = patrolLoopLength(waypoints);
  if (loop < 1e-6 || waypoints.length === 0) {
    return waypoints[0] ? { ...waypoints[0] } : { x: 50, y: 50 };
  }
  let dist = ((t + phase) * speed) % loop;
  if (dist < 0) dist += loop;

  const pts = [...waypoints, waypoints[0]];
  for (let i = 1; i < pts.length; i++) {
    const ax = pts[i - 1].x;
    const ay = pts[i - 1].y;
    const bx = pts[i].x;
    const by = pts[i].y;
    const seg = Math.hypot(bx - ax, by - ay);
    if (seg < 1e-6) continue;
    if (dist <= seg) {
      const u = dist / seg;
      return { x: ax + (bx - ax) * u, y: ay + (by - ay) * u };
    }
    dist -= seg;
  }
  return { ...waypoints[0] };
}
