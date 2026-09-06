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
