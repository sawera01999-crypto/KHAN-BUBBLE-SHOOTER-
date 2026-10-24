import { Board } from "./board";
import { MAX_ANGLE, MIN_ANGLE, NEIGHBORS, SHOOTER_X, SHOOTER_Y, SOLVER_MAX_ROW, rowOf } from "./grid";
import { traceShot } from "./physics";

export interface Move { cell: number; swapped: boolean; angle: number }
export interface SolveResult { won: boolean; shots: number; moves: Move[] }

// Aim angles the bot is allowed to use (a subset of what a human can aim)
export const BOT_ANGLES: number[] = [];
for (let a = MIN_ANGLE; a <= MAX_ANGLE + 1e-9; a += (1.25 * Math.PI) / 180) BOT_ANGLES.push(a);

/** Cells reachable with real shot physics -> angle that reaches them. */
export function reachableCells(b: Board): Map<number, number> {
  const out = new Map<number, number>();
  for (const a of BOT_ANGLES) {
    const t = traceShot(b.cells, SHOOTER_X, SHOOTER_Y, a);
    if (t.cell >= 0 && b.cells[t.cell] < 0 && !out.has(t.cell)) out.set(t.cell, a);
  }
  return out;
}

/**
 * Automated player. It aims with the exact same physics (traceShot: wall
 * bounces + snapping) and the same deterministic colour queue as the game, so
 * a win here proves the level can be won by a human within `shots` moves.
 */
export function solve(start: Board, cap = 400, recordMoves = false): SolveResult {
  const b = start.clone();
  const moves: Move[] = [];
  let shots = 0;
  while (shots < cap) {
    if (b.isEmpty()) return { won: true, shots, moves };
    const reach = reachableCells(b);
    let best = -Infinity, bestCell = -1, bestSwap = false;
    const options = b.current === b.next ? [false] : [false, true];
    for (const swapped of options) {
      const color = swapped ? b.next : b.current;
      for (const i of reach.keys()) {
        if (rowOf(i) > SOLVER_MAX_ROW) continue;
        let score: number;
        b.cells[i] = color;
        const cl = b.cluster(i, color);
        if (cl.length >= 3) {
          for (const j of cl) b.cells[j] = -1;
          const drop = b.floating().length;
          for (const j of cl) b.cells[j] = color;
          score = 10000 + (cl.length + drop * 1.5) * 10;
        } else {
          let otherNb = 0;
          for (const n of NEIGHBORS[i]) if (b.cells[n] >= 0 && b.cells[n] !== color) otherNb++;
          score = cl.length * 40 - otherNb * 6 - rowOf(i) * 3;
        }
        b.cells[i] = -1;
        if (swapped) score -= 0.5;
        if (score > best || (score === best && i < bestCell)) {
          best = score;
          bestCell = i;
          bestSwap = swapped;
        }
      }
    }
    if (bestCell < 0) return { won: false, shots, moves };
    if (bestSwap) b.swap();
    if (recordMoves) moves.push({ cell: bestCell, swapped: bestSwap, angle: reach.get(bestCell)! });
    b.shoot(bestCell);
    shots++;
  }
  return { won: b.isEmpty(), shots, moves };
}
