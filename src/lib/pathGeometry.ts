export type PathPoint = { x: number; y: number };

export function pointToPathSegmentDistance(
  point: PathPoint,
  start: PathPoint,
  end: PathPoint
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, (
    (point.x - start.x) * dx + (point.y - start.y) * dy
  ) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function projectionAlongSegment(point: PathPoint, start: PathPoint, end: PathPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return 0;
  return Math.max(0, Math.min(1, (
    (point.x - start.x) * dx + (point.y - start.y) * dy
  ) / (dx * dx + dy * dy)));
}

export function orderedContactsAlongPath<T extends PathPoint & { id: string }>(
  path: PathPoint[],
  targets: T[],
  radius: number
): T[] {
  if (path.length === 0) return [];
  const contacts: T[] = [];
  const seen = new Set<string>();

  if (path.length === 1) {
    return targets.filter(target => Math.hypot(target.x - path[0].x, target.y - path[0].y) <= radius);
  }

  for (let index = 1; index < path.length; index++) {
    const start = path[index - 1];
    const end = path[index];
    const segmentContacts = targets
      .filter(target => !seen.has(target.id) && pointToPathSegmentDistance(target, start, end) <= radius)
      .sort((a, b) => projectionAlongSegment(a, start, end) - projectionAlongSegment(b, start, end));
    for (const target of segmentContacts) {
      seen.add(target.id);
      contacts.push(target);
    }
  }
  return contacts;
}

export function pathTouchesPoint(path: PathPoint[], target: PathPoint, radius: number): boolean {
  if (path.length === 1) return Math.hypot(target.x - path[0].x, target.y - path[0].y) <= radius;
  for (let index = 1; index < path.length; index++) {
    if (pointToPathSegmentDistance(target, path[index - 1], path[index]) <= radius) return true;
  }
  return false;
}

/** True if two segments intersect or come within radius (endpoint / projection). */
export function segmentsWithinRadius(
  a1: PathPoint,
  a2: PathPoint,
  b1: PathPoint,
  b2: PathPoint,
  radius: number
): boolean {
  const dx = a2.x - a1.x;
  const dy = a2.y - a1.y;
  const ex = b2.x - b1.x;
  const ey = b2.y - b1.y;
  const denom = -ex * dy + dx * ey;
  if (Math.abs(denom) > 1e-8) {
    const s = (-dy * (a1.x - b1.x) + dx * (a1.y - b1.y)) / denom;
    const t = (ex * (a1.y - b1.y) - ey * (a1.x - b1.x)) / denom;
    if (s >= 0 && s <= 1 && t >= 0 && t <= 1) return true;
  }
  return (
    pointToPathSegmentDistance(a1, b1, b2) <= radius ||
    pointToPathSegmentDistance(a2, b1, b2) <= radius ||
    pointToPathSegmentDistance(b1, a1, a2) <= radius ||
    pointToPathSegmentDistance(b2, a1, a2) <= radius
  );
}

/**
 * True if a drawn path enters a patrol's guarded corridor (waypoint polyline).
 * Collision is geometric — live catcher position does not matter.
 */
export function pathTouchesPolyline(
  path: PathPoint[],
  polyline: PathPoint[],
  radius: number,
  closed = false
): boolean {
  if (path.length === 0 || polyline.length === 0) return false;
  const poly =
    closed && polyline.length > 1 ? [...polyline, polyline[0]] : polyline.length === 1 ? polyline : polyline;

  if (path.length === 1) {
    if (poly.length === 1) return Math.hypot(path[0].x - poly[0].x, path[0].y - poly[0].y) <= radius;
    for (let i = 1; i < poly.length; i++) {
      if (pointToPathSegmentDistance(path[0], poly[i - 1], poly[i]) <= radius) return true;
    }
    return false;
  }

  if (poly.length === 1) return pathTouchesPoint(path, poly[0], radius);

  for (let i = 1; i < path.length; i++) {
    for (let j = 1; j < poly.length; j++) {
      if (segmentsWithinRadius(path[i - 1], path[i], poly[j - 1], poly[j], radius)) return true;
    }
  }
  return false;
}

/** Closest point on a (optionally closed) polyline to a sample point — for fail FX. */
export function nearestPointOnPolyline(
  point: PathPoint,
  polyline: PathPoint[],
  closed = false
): PathPoint {
  if (polyline.length === 0) return { ...point };
  if (polyline.length === 1) return { ...polyline[0] };
  const poly = closed ? [...polyline, polyline[0]] : polyline;
  let best = { ...polyline[0] };
  let bestDist = Infinity;
  for (let i = 1; i < poly.length; i++) {
    const start = poly[i - 1];
    const end = poly[i];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 < 1e-8 ? 0 : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / len2));
    const candidate = { x: start.x + t * dx, y: start.y + t * dy };
    const dist = Math.hypot(point.x - candidate.x, point.y - candidate.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }
  return best;
}
