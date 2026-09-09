export type BoardPoint = { x: number; y: number };

export type BoardBarrier = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

function lineIntersection(
  a: BoardPoint,
  b: BoardPoint,
  c: BoardPoint,
  d: BoardPoint
): BoardPoint | null {
  const abX = b.x - a.x;
  const abY = b.y - a.y;
  const cdX = d.x - c.x;
  const cdY = d.y - c.y;
  const denominator = -cdX * abY + abX * cdY;
  if (Math.abs(denominator) < 1e-8) return null;

  const s = (-abY * (a.x - c.x) + abX * (a.y - c.y)) / denominator;
  const t = (cdX * (a.y - c.y) - cdY * (a.x - c.x)) / denominator;
  if (s < 0 || s > 1 || t < 0 || t > 1) return null;
  return { x: a.x + t * abX, y: a.y + t * abY };
}

function pointToSegmentDistance(
  point: BoardPoint,
  start: BoardPoint,
  end: BoardPoint
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared < 1e-8) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, (
    (point.x - start.x) * dx + (point.y - start.y) * dy
  ) / lengthSquared));
  return Math.hypot(
    point.x - (start.x + t * dx),
    point.y - (start.y + t * dy)
  );
}

/** True centerline crossing only. */
export function segmentCrossesBarrier(
  start: BoardPoint,
  end: BoardPoint,
  barrier: BoardBarrier
): BoardPoint | null {
  return lineIntersection(
    start,
    end,
    { x: barrier.x1, y: barrier.y1 },
    { x: barrier.x2, y: barrier.y2 }
  );
}

function crossSide(origin: BoardPoint, along: BoardPoint, point: BoardPoint): number {
  return (along.x - origin.x) * (point.y - origin.y) - (along.y - origin.y) * (point.x - origin.x);
}

function nearestPointOnSegment(
  point: BoardPoint,
  start: BoardPoint,
  end: BoardPoint
): BoardPoint {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared < 1e-8) return { ...start };
  const t = Math.max(0, Math.min(1, (
    (point.x - start.x) * dx + (point.y - start.y) * dy
  ) / lengthSquared));
  return { x: start.x + t * dx, y: start.y + t * dy };
}

/**
 * Tip→goal separation for win checks: centerline cross, or opposite half-planes
 * with the chord skirting within `endpointSlack` of the finite barrier (MVP).
 */
export function barrierSeparatesPoints(
  start: BoardPoint,
  end: BoardPoint,
  barrier: BoardBarrier,
  endpointSlack = 1.5
): BoardPoint | null {
  const crossing = segmentCrossesBarrier(start, end, barrier);
  if (crossing) return crossing;

  const wallA = { x: barrier.x1, y: barrier.y1 };
  const wallB = { x: barrier.x2, y: barrier.y2 };
  const sideStart = crossSide(wallA, wallB, start);
  const sideEnd = crossSide(wallA, wallB, end);
  if (sideStart * sideEnd >= 0) return null;

  const chordDistToWall = Math.min(
    pointToSegmentDistance(wallA, start, end),
    pointToSegmentDistance(wallB, start, end),
    pointToSegmentDistance(start, wallA, wallB),
    pointToSegmentDistance(end, wallA, wallB)
  );
  if (chordDistToWall > endpointSlack) return null;

  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  return nearestPointOnSegment(mid, wallA, wallB);
}

/**
 * Mobile drawing contact test. A true barrier crossing always blocks, while
 * near-wall contact uses a small fixed pixel radius so portrait aspect ratios
 * do not make one corridor direction less forgiving than the other.
 */
export function getScreenSpaceBarrierContact(
  start: BoardPoint,
  end: BoardPoint,
  barrier: BoardBarrier,
  scaleX: number,
  scaleY: number,
  contactRadiusPx: number
): BoardPoint | null {
  const crossing = lineIntersection(
    start,
    end,
    { x: barrier.x1, y: barrier.y1 },
    { x: barrier.x2, y: barrier.y2 }
  );
  if (crossing) return crossing;

  const toPixel = (point: BoardPoint): BoardPoint => ({
    x: point.x * scaleX,
    y: point.y * scaleY,
  });
  const pixelStart = toPixel(start);
  const pixelEnd = toPixel(end);
  const wallStart = toPixel({ x: barrier.x1, y: barrier.y1 });
  const wallEnd = toPixel({ x: barrier.x2, y: barrier.y2 });

  if (pointToSegmentDistance(pixelStart, wallStart, wallEnd) < contactRadiusPx) return start;
  if (pointToSegmentDistance(pixelEnd, wallStart, wallEnd) < contactRadiusPx) return end;
  if (pointToSegmentDistance(wallStart, pixelStart, pixelEnd) < contactRadiusPx) {
    return { x: barrier.x1, y: barrier.y1 };
  }
  if (pointToSegmentDistance(wallEnd, pixelStart, pixelEnd) < contactRadiusPx) {
    return { x: barrier.x2, y: barrier.y2 };
  }
  return null;
}
