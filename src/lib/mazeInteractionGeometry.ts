export type BoardPoint = { x: number; y: number };

export type BoardBarrier = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type PixelBarrier = BoardBarrier;

export type LabelSpec = {
  id: string;
  anchorX: number;
  anchorY: number;
  halfWidth: number;
};

export type LabelPlacement = {
  id: string;
  x: number;
  y: number;
  halfWidth: number;
};

export type PixelRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
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

export function labelRect(placement: LabelPlacement, halfHeight = 7): PixelRect {
  return {
    left: placement.x - placement.halfWidth,
    right: placement.x + placement.halfWidth,
    top: placement.y - halfHeight,
    bottom: placement.y + halfHeight,
  };
}

export function barrierIntersectsRect(
  barrier: PixelBarrier,
  rect: PixelRect,
  padding = 0
): boolean {
  const expanded = {
    left: rect.left - padding,
    right: rect.right + padding,
    top: rect.top - padding,
    bottom: rect.bottom + padding,
  };
  if (
    (barrier.x1 < expanded.left && barrier.x2 < expanded.left) ||
    (barrier.x1 > expanded.right && barrier.x2 > expanded.right) ||
    (barrier.y1 < expanded.top && barrier.y2 < expanded.top) ||
    (barrier.y1 > expanded.bottom && barrier.y2 > expanded.bottom)
  ) {
    return false;
  }
  if (
    (barrier.x1 >= expanded.left && barrier.x1 <= expanded.right &&
      barrier.y1 >= expanded.top && barrier.y1 <= expanded.bottom) ||
    (barrier.x2 >= expanded.left && barrier.x2 <= expanded.right &&
      barrier.y2 >= expanded.top && barrier.y2 <= expanded.bottom)
  ) {
    return true;
  }
  const corners = [
    [{ x: expanded.left, y: expanded.top }, { x: expanded.right, y: expanded.top }],
    [{ x: expanded.right, y: expanded.top }, { x: expanded.right, y: expanded.bottom }],
    [{ x: expanded.right, y: expanded.bottom }, { x: expanded.left, y: expanded.bottom }],
    [{ x: expanded.left, y: expanded.bottom }, { x: expanded.left, y: expanded.top }],
  ] as const;
  return corners.some(([start, end]) => lineIntersection(
    { x: barrier.x1, y: barrier.y1 },
    { x: barrier.x2, y: barrier.y2 },
    start,
    end
  ));
}

function overlapArea(a: PixelRect, b: PixelRect): number {
  const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return width * height;
}

/**
 * Places compact floor labels near their node while preferring open space.
 * Walls still render above these labels, so an unavoidable overlap can never
 * conceal maze topology.
 */
export function placeMazeLabels(
  specs: LabelSpec[],
  barriers: PixelBarrier[],
  boardWidth: number,
  boardHeight: number,
  insetPx: { x: number; y: number },
  avoidRects: PixelRect[] = []
): LabelPlacement[] {
  const placed: LabelPlacement[] = [];
  const occupied: PixelRect[] = [];
  const halfHeight = 7;

  for (const spec of specs) {
    const sideOffset = spec.halfWidth + 26;
    const candidates = [
      { x: spec.anchorX, y: spec.anchorY + 34 },
      { x: spec.anchorX, y: spec.anchorY - 34 },
      { x: spec.anchorX, y: spec.anchorY + 54 },
      { x: spec.anchorX, y: spec.anchorY - 54 },
      { x: spec.anchorX + sideOffset, y: spec.anchorY },
      { x: spec.anchorX - sideOffset, y: spec.anchorY },
      { x: spec.anchorX + sideOffset, y: spec.anchorY + 24 },
      { x: spec.anchorX - sideOffset, y: spec.anchorY + 24 },
      { x: spec.anchorX + sideOffset, y: spec.anchorY - 24 },
      { x: spec.anchorX - sideOffset, y: spec.anchorY - 24 },
      { x: spec.anchorX + sideOffset, y: spec.anchorY + 48 },
      { x: spec.anchorX - sideOffset, y: spec.anchorY + 48 },
      { x: spec.anchorX + sideOffset, y: spec.anchorY - 48 },
      { x: spec.anchorX - sideOffset, y: spec.anchorY - 48 },
      { x: spec.anchorX + sideOffset + 34, y: spec.anchorY },
      { x: spec.anchorX - sideOffset - 34, y: spec.anchorY },
    ];

    let best: { placement: LabelPlacement; score: number } | null = null;
    candidates.forEach((candidate, preference) => {
      const x = Math.min(
        boardWidth - insetPx.x - spec.halfWidth - 2,
        Math.max(insetPx.x + spec.halfWidth + 2, candidate.x)
      );
      const y = Math.min(
        boardHeight - insetPx.y - halfHeight - 2,
        Math.max(insetPx.y + halfHeight + 2, candidate.y)
      );
      const placement = { id: spec.id, x, y, halfWidth: spec.halfWidth };
      const rect = labelRect(placement, halfHeight);
      const wallHits = barriers.filter(wall => barrierIntersectsRect(wall, rect, 5.5)).length;
      const labelOverlap = occupied.reduce((sum, other) => sum + overlapArea(rect, other), 0);
      const nodeOverlap = avoidRects.reduce((sum, other) => sum + overlapArea(rect, other), 0);
      const nodeHits = avoidRects.filter(other => overlapArea(rect, other) > 0).length;
      if (nodeHits > 0 || labelOverlap > 0) return;
      const displacement = Math.hypot(x - candidate.x, y - candidate.y);
      const score =
        wallHits * 10_000 +
        nodeOverlap * 100 +
        displacement * 4 +
        preference;
      if (!best || score < best.score) best = { placement, score };
    });

    if (best) {
      placed.push(best.placement);
      occupied.push(labelRect(best.placement, halfHeight));
    }
  }
  return placed;
}
