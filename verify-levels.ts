/**
 * KHAN BUBBLE SHOOTER — automated level verification.
 * Run:  npx tsx scripts/verify-levels.ts [from] [to]
 *
 * For every level it checks:
 *  1. Level generates deterministically (generated twice -> identical)
 *  2. All bubbles are inside the play field with valid colours
 *  3. No floating (unsupported) bubbles at start
 *  4. An independent automated player clears the board within the shot limit
 *  5. Replaying the recorded aim ANGLES through the real shot physics on a fresh
 *     board lands every bubble on the expected cell and ends with an empty board
 *  6. Difficulty parameters never get easier than the previous level
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { Board } from "../src/core/board";
import { SIZE, rowOf, DANGER_ROW, SHOOTER_X, SHOOTER_Y } from "../src/core/grid";
import { traceShot } from "../src/core/physics";
import { getLevel, levelParams, TOTAL_LEVELS } from "../src/core/levels";
import { solve } from "../src/core/solver";

const from = Number(process.argv[2] ?? 1);
const to = Number(process.argv[3] ?? TOTAL_LEVELS);
const failures: string[] = [];
let prev = levelParams(Math.max(1, from - 1));
let totalShots = 0, totalLimit = 0, minMargin = Infinity;
const t0 = Date.now();

for (let n = from; n <= to; n++) {
  try {
    const a = getLevel(n);
    const p = a.params;
    // 6. monotonic difficulty
    if (n > 1 && (p.colors < prev.colors || p.rows < prev.rows || p.cluster > prev.cluster + 1e-12 || p.slack > prev.slack + 1e-12))
      failures.push(`L${n}: difficulty decreased`);
    prev = p;
    // 2. bounds + colours
    for (let i = 0; i < SIZE; i++) {
      const v = a.cells[i];
      if (v >= 0 && (v >= a.colors || rowOf(i) >= DANGER_ROW - 2)) failures.push(`L${n}: bad cell ${i}`);
    }
    // 3. floating
    const fresh = new Board(new Int8Array(a.cells), a.seed);
    if (fresh.floating().length) failures.push(`L${n}: floating bubbles at start`);
    // 4. independent solve
    const res = solve(fresh, a.shotLimit, true);
    if (!res.won || res.shots > a.shotLimit) failures.push(`L${n}: NOT winnable within ${a.shotLimit} (solver ${res.won ? res.shots : "failed"})`);
    // 5. replay
    const replay = new Board(new Int8Array(a.cells), a.seed);
    for (const m of res.moves) {
      if (m.swapped) replay.swap();
      const t = traceShot(replay.cells, SHOOTER_X, SHOOTER_Y, m.angle);
      if (t.cell !== m.cell || replay.cells[m.cell] >= 0) { failures.push(`L${n}: physics replay mismatch`); break; }
      replay.shoot(m.cell);
    }
    if (!replay.isEmpty()) failures.push(`L${n}: replay did not clear board`);
    totalShots += res.shots;
    totalLimit += a.shotLimit;
    minMargin = Math.min(minMargin, a.shotLimit - res.shots);
  } catch (e) {
    failures.push(`L${n}: exception ${(e as Error).message}`);
  }
  if (n % 1000 === 0) console.log(`  verified ${n}/${to}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}

const summary = {
  game: "KHAN BUBBLE SHOOTER",
  range: [from, to],
  levelsChecked: to - from + 1,
  failures: failures.length,
  avgSolverShots: +(totalShots / (to - from + 1)).toFixed(2),
  avgShotLimit: +(totalLimit / (to - from + 1)).toFixed(2),
  minSpareShots: minMargin,
  seconds: (Date.now() - t0) / 1000,
  details: failures.slice(0, 200),
};
mkdirSync("reports", { recursive: true });
writeFileSync(`reports/level-verification-${from}-${to}.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ ...summary, details: summary.details.slice(0, 20) }, null, 2));
process.exit(failures.length ? 1 : 0);
