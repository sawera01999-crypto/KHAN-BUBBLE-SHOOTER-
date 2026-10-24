// Hex-offset grid geometry shared by game, solver and verification scripts.
export const COLS = 11;
export const MAX_ROWS = 15;
export const R = 20;
export const D = R * 2;
export const ROW_H = D * 0.8660254;
export const GRID_W = COLS * D; // 440
export const GRID_H = R * 2 + (MAX_ROWS - 1) * ROW_H;
export const SIZE = COLS * MAX_ROWS;
export const DANGER_ROW = MAX_ROWS - 1; // landing here (unpopped) = defeat
export const SOLVER_MAX_ROW = MAX_ROWS - 3;

export const idx = (r: number, c: number) => r * COLS + c;
export const rowOf = (i: number) => (i / COLS) | 0;
export const colOf = (i: number) => i % COLS;
export const rowLen = (r: number) => (r & 1 ? COLS - 1 : COLS);
export const valid = (r: number, c: number) => r >= 0 && r < MAX_ROWS && c >= 0 && c < rowLen(r);

export const cellX = (r: number, c: number) => c * D + R + (r & 1 ? R : 0);
export const cellY = (r: number) => R + r * ROW_H;

// Precomputed neighbor table
export const NEIGHBORS: number[][] = [];
for (let r = 0; r < MAX_ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const list: number[] = [];
    if (valid(r, c)) {
      const odd = r & 1;
      const cand: [number, number][] = odd
        ? [[r, c - 1], [r, c + 1], [r - 1, c], [r - 1, c + 1], [r + 1, c], [r + 1, c + 1]]
        : [[r, c - 1], [r, c + 1], [r - 1, c - 1], [r - 1, c], [r + 1, c - 1], [r + 1, c]];
      for (const [rr, cc] of cand) if (valid(rr, cc)) list.push(idx(rr, cc));
    }
    NEIGHBORS[idx(r, c)] = list;
  }
}

export const VALID_CELLS: number[] = [];
for (let r = 0; r < MAX_ROWS; r++) for (let c = 0; c < rowLen(r); c++) VALID_CELLS.push(idx(r, c));

export function nearestCell(x: number, y: number): { r: number; c: number } {
  let r = Math.round((y - R) / ROW_H);
  r = Math.max(0, Math.min(MAX_ROWS - 1, r));
  let c = Math.round((x - R - (r & 1 ? R : 0)) / D);
  c = Math.max(0, Math.min(rowLen(r) - 1, c));
  return { r, c };
}

// Shooter position (shared by game + automated tests)
export const SHOOTER_X = GRID_W / 2;
export const SHOOTER_Y = 612;
export const MIN_ANGLE = (8 * Math.PI) / 180;
export const MAX_ANGLE = Math.PI - MIN_ANGLE;
