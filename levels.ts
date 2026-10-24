import { Board } from "./board";
import { COLS, MAX_ROWS, SIZE, idx, rowLen, NEIGHBORS } from "./grid";
import { mulberry32, hashSeed, type Rng } from "./rng";
import { solve } from "./solver";

export const TOTAL_LEVELS = 15000;

export interface LevelParams {
  colors: number;
  rows: number;
  cluster: number; // chance to copy neighbour colour (higher = easier)
  slack: number; // shot-limit multiplier on the verified solution
  extra: number; // flat bonus shots
  patternPool: number;
  difficulty: number; // 0..100 display value
}

/** Monotonic difficulty curve: every parameter only ever gets harder. */
export function levelParams(n: number): LevelParams {
  const t = (n - 1) / (TOTAL_LEVELS - 1);
  const u = Math.log(n) / Math.log(TOTAL_LEVELS); // fast early growth, keeps rising
  const colors = n <= 8 ? 3 : n <= 45 ? 4 : n <= 400 ? 5 : n <= 4000 ? 6 : 7;
  const rows = Math.min(11, 4 + Math.floor(u * 7.6 + t * 0.4));
  const cluster = 0.78 - 0.36 * u - 0.06 * t;
  const slack = 1.75 - 0.5 * u - 0.1 * t;
  const extra = Math.max(1, Math.round(4 - 3 * u));
  const patternPool = Math.min(PATTERNS.length, 2 + Math.floor(u * PATTERNS.length * 1.2));
  const difficulty = Math.round(Math.min(100, u * 70 + t * 30));
  return { colors, rows, cluster, slack, extra, patternPool, difficulty };
}

type Mask = (r: number, c: number, rows: number, rng: Rng) => boolean;
const mid = (r: number) => (rowLen(r) - 1) / 2;
export const PATTERNS: { name: string; mask: Mask }[] = [
  { name: "Wall", mask: () => true },
  { name: "Funnel", mask: (r, c, rows) => Math.abs(c - mid(r)) <= (COLS / 2) * (1 - r / (rows + 2)) + 0.6 },
  { name: "Swiss", mask: (r, _c, _rows, rng) => r === 0 || rng() > 0.16 },
  { name: "Pillars", mask: (r, c) => r < 2 || c % 3 !== 1 },
  { name: "Diamond", mask: (r, c, rows) => Math.abs(c - mid(r)) + Math.abs(r - rows / 2) * 0.9 <= COLS / 2 + 0.5 || r === 0 },
  { name: "Zigzag", mask: (r, c, rows) => r < rows - 2 - Math.abs(((c + 2) % 6) - 3) + 2 },
  { name: "Twin Towers", mask: (r, c) => r < 2 || c <= 3 || c >= rowLen(r) - 4 },
  { name: "Rings", mask: (r, c, rows) => {
    const d = Math.hypot(c - mid(r), (r - rows / 2) * 1.1);
    return r === 0 || Math.floor(d) % 3 !== 2;
  } },
  { name: "Chandelier", mask: (r, c, rows) => r < 2 || (c % 4 !== 0 && r < rows) || Math.abs(c - mid(r)) < 1.5 },
  { name: "Lattice", mask: (r, c) => r === 0 || (r + c) % 4 !== 0 },
];

export interface LevelData {
  level: number;
  seed: number;
  cells: Int8Array;
  colors: number;
  shotLimit: number;
  solverShots: number;
  bubbleCount: number;
  pattern: string;
  params: LevelParams;
}

function buildCells(n: number, attempt: number, p: LevelParams) {
  const rng = mulberry32(hashSeed(n, attempt + 11));
  const pat = PATTERNS[Math.floor(rng() * p.patternPool) % PATTERNS.length];
  const cells = new Int8Array(SIZE).fill(-1);
  const on = new Uint8Array(SIZE);
  for (let r = 0; r < p.rows; r++)
    for (let c = 0; c < rowLen(r); c++) if (pat.mask(r, c, p.rows, rng)) on[idx(r, c)] = 1;
  // keep only cells connected to ceiling
  const keep = new Uint8Array(SIZE);
  const st: number[] = [];
  for (let c = 0; c < COLS; c++) if (on[c]) { keep[c] = 1; st.push(c); }
  while (st.length) {
    const i = st.pop()!;
    for (const nb of NEIGHBORS[i]) if (on[nb] && !keep[nb]) { keep[nb] = 1; st.push(nb); }
  }
  // colour cells, copying neighbours with `cluster` probability
  for (let r = 0; r < p.rows; r++) {
    for (let c = 0; c < rowLen(r); c++) {
      const i = idx(r, c);
      if (!keep[i]) continue;
      const prev = NEIGHBORS[i].filter((j) => j < i && cells[j] >= 0);
      if (prev.length && rng() < p.cluster) cells[i] = cells[prev[Math.floor(rng() * prev.length)]];
      else cells[i] = Math.floor(rng() * p.colors);
    }
  }
  return { cells, pattern: pat.name };
}

const cache = new Map<number, LevelData>();

export function getLevel(n: number): LevelData {
  n = Math.max(1, Math.min(TOTAL_LEVELS, Math.floor(n)));
  const hit = cache.get(n);
  if (hit) return { ...hit, cells: new Int8Array(hit.cells) };
  const p = levelParams(n);
  for (let attempt = 0; attempt < 50; attempt++) {
    const { cells, pattern } = buildCells(n, attempt, p);
    let count = 0;
    for (let i = 0; i < SIZE; i++) if (cells[i] >= 0) count++;
    if (count < 10) continue;
    const seed = hashSeed(n, 1000 + attempt);
    const res = solve(new Board(new Int8Array(cells), seed), 300);
    if (!res.won) continue;
    const shotLimit = Math.ceil(res.shots * p.slack) + p.extra;
    const data: LevelData = { level: n, seed, cells, colors: p.colors, shotLimit, solverShots: res.shots, bubbleCount: count, pattern, params: p };
    cache.set(n, data);
    if (cache.size > 200) cache.delete(cache.keys().next().value!);
    return { ...data, cells: new Int8Array(cells) };
  }
  throw new Error(`Level ${n} could not be generated`);
}

/** Star rating from shots used vs. verified solution. */
export function starsFor(level: LevelData, shotsUsed: number) {
  const margin = level.shotLimit - level.solverShots;
  if (shotsUsed <= level.solverShots + margin * 0.35) return 3;
  if (shotsUsed <= level.solverShots + margin * 0.75) return 2;
  return 1;
}

export { MAX_ROWS };
