import { COLS, D, GRID_W, MAX_ROWS, NEIGHBORS, R, ROW_H, cellX, cellY, idx, rowLen, valid } from "./grid";

export interface Trace {
  points: { x: number; y: number }[]; // start, bounce points, end
  cell: number; // landing cell (-1 for none)
  bounces: number;
  burned: { cell: number; dist: number }[]; // fireball only
  length: number;
}

const HIT = D * 0.86;

function occupiedNear(cells: Int8Array, x: number, y: number, radius: number): number {
  const r0 = Math.round((y - R) / ROW_H);
  let best = -1, bd = radius * radius;
  for (let r = r0 - 1; r <= r0 + 1; r++) {
    if (r < 0 || r >= MAX_ROWS) continue;
    const c0 = Math.round((x - R - (r & 1 ? R : 0)) / D);
    for (let c = c0 - 1; c <= c0 + 1; c++) {
      if (!valid(r, c)) continue;
      const i = idx(r, c);
      if (cells[i] < 0) continue;
      const dx = cellX(r, c) - x, dy = cellY(r) - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bd) { bd = d2; best = i; }
    }
  }
  return best;
}

/** Snap a moving bubble to the best empty cell near (x,y). */
function snap(cells: Int8Array, x: number, y: number, hit: number): number {
  const cands = new Set<number>();
  const r0 = Math.round((y - R) / ROW_H);
  for (let r = r0 - 1; r <= r0 + 1; r++) {
    if (r < 0 || r >= MAX_ROWS) continue;
    for (let c = 0; c < rowLen(r); c++) cands.add(idx(r, c));
  }
  if (hit >= 0) for (const n of NEIGHBORS[hit]) cands.add(n);
  let best = -1, bd = Infinity;
  for (const i of cands) {
    if (cells[i] >= 0) continue;
    const r = (i / COLS) | 0, c = i % COLS;
    const sticky = r === 0 || NEIGHBORS[i].some((n) => cells[n] >= 0);
    if (!sticky) continue;
    const dx = cellX(r, c) - x, dy = cellY(r) - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bd) { bd = d2; best = i; }
  }
  return best;
}

/**
 * Trace a shot from (sx,sy) at `angle` (radians, 0 = right, PI/2 = up).
 * Used both for the dotted aim guide and the real shot so they always agree.
 */
export function traceShot(cells: Int8Array, sx: number, sy: number, angle: number, fire = false): Trace {
  let x = sx, y = sy;
  let dx = Math.cos(angle), dy = -Math.sin(angle);
  const pts = [{ x, y }];
  const step = 3;
  let bounces = 0, length = 0;
  const burned: { cell: number; dist: number }[] = [];
  const burnedSet = new Set<number>();
  // nothing can be hit below the lowest occupied row -> skip checks there (identical result, faster)
  let lowest = -1;
  for (let i = cells.length - 1; i >= 0; i--) if (cells[i] >= 0) { lowest = (i / COLS) | 0; break; }
  const checkBelow = lowest < 0 ? -Infinity : cellY(lowest) + D + 2;
  for (let k = 0; k < 4000; k++) {
    x += dx * step;
    y += dy * step;
    length += step;
    if (x < R) { x = 2 * R - x; dx = -dx; bounces++; pts.push({ x: R, y }); }
    else if (x > GRID_W - R) { x = 2 * (GRID_W - R) - x; dx = -dx; bounces++; pts.push({ x: GRID_W - R, y }); }
    if (fire) {
      const h = y > checkBelow ? -1 : occupiedNear(cells, x, y, D * 0.8);
      if (h >= 0 && !burnedSet.has(h)) { burnedSet.add(h); burned.push({ cell: h, dist: length }); }
      if (y <= R) { pts.push({ x, y: R }); return { points: pts, cell: -1, bounces, burned, length }; }
      continue;
    }
    if (y <= R) {
      const cell = snap(cells, x, R, -1);
      pts.push({ x, y: R });
      return { points: pts, cell, bounces, burned, length };
    }
    if (y <= checkBelow) {
      const h = occupiedNear(cells, x, y, HIT);
      if (h >= 0) {
        const cell = snap(cells, x, y, h);
        pts.push({ x, y });
        return { points: pts, cell, bounces, burned, length };
      }
    }
  }
  return { points: pts, cell: -1, bounces, burned, length };
}

export function pointAlong(points: { x: number; y: number }[], dist: number) {
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (acc + seg >= dist) {
      const t = seg ? (dist - acc) / seg : 0;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, seg: i, done: false };
    }
    acc += seg;
  }
  const l = points[points.length - 1];
  return { x: l.x, y: l.y, seg: points.length - 1, done: true };
}
