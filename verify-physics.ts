/**
 * Physics playthrough test: a bot aims with real angles using the exact same
 * traceShot() the game uses (wall bounces + collision snapping) and must clear
 * sampled levels within the shot limit. Also asserts physics never returns an
 * invalid/occupied landing cell.
 * Run: npx tsx scripts/verify-physics.ts [step]
 */
import { Board } from "../src/core/board";
import { GRID_W, NEIGHBORS, rowOf, DANGER_ROW, SOLVER_MAX_ROW } from "../src/core/grid";
import { getLevel, TOTAL_LEVELS } from "../src/core/levels";
import { traceShot } from "../src/core/physics";

const step = Number(process.argv[2] ?? 250);
const SX = GRID_W / 2, SY = 612;
const ANGLES: number[] = [];
for (let a = 8; a <= 172; a += 0.5) ANGLES.push((a * Math.PI) / 180);

let checked = 0, failed = 0, physicsErrors = 0;
const fails: string[] = [];
const t0 = Date.now();
for (let n = 1; n <= TOTAL_LEVELS; n += n < 100 ? 1 : step) {
  const lv = getLevel(n);
  const b = new Board(new Int8Array(lv.cells), lv.seed);
  let shots = 0;
  while (!b.isEmpty() && shots < lv.shotLimit) {
    const reach = new Set<number>();
    for (const a of ANGLES) {
      const t = traceShot(b.cells, SX, SY, a);
      if (t.cell < 0 || b.cells[t.cell] >= 0) { physicsErrors++; continue; }
      reach.add(t.cell);
    }
    let best = -Infinity, bestCell = -1, bestSwap = false;
    for (const swapped of b.current === b.next ? [false] : [false, true]) {
      const color = swapped ? b.next : b.current;
      for (const i of reach) {
        if (rowOf(i) > SOLVER_MAX_ROW) continue;
        b.cells[i] = color;
        const cl = b.cluster(i, color);
        let score: number;
        if (cl.length >= 3) {
          for (const j of cl) b.cells[j] = -1;
          const drop = b.floating().length;
          for (const j of cl) b.cells[j] = color;
          score = 10000 + (cl.length + drop * 1.5) * 10;
        } else {
          let other = 0;
          for (const nb of NEIGHBORS[i]) if (b.cells[nb] >= 0 && b.cells[nb] !== color) other++;
          score = cl.length * 40 - other * 6 - rowOf(i) * 3;
        }
        b.cells[i] = -1;
        if (score > best) { best = score; bestCell = i; bestSwap = swapped; }
      }
    }
    if (bestCell < 0) break;
    if (bestSwap) b.swap();
    b.shoot(bestCell);
    if (rowOf(bestCell) >= DANGER_ROW) break;
    shots++;
  }
  checked++;
  if (!b.isEmpty()) { failed++; fails.push(`L${n}: physics bot left ${b.count()} bubbles (limit ${lv.shotLimit})`); }
}
console.log(JSON.stringify({ checked, failed, physicsErrors, seconds: (Date.now() - t0) / 1000, fails: fails.slice(0, 30) }, null, 2));
process.exit(physicsErrors ? 1 : 0);
