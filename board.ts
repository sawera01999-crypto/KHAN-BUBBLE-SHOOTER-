import { NEIGHBORS, VALID_CELLS, COLS, MAX_ROWS, SIZE, idx, rowOf, rowLen, cellX, cellY } from "./grid";
import { mulberry32, type Rng } from "./rng";

export interface Resolve {
  placed: number;
  popped: number[];
  dropped: number[];
  colors: number[]; // color of each popped/dropped (parallel to popped then dropped)
}

/** Pure logic board. Used by the renderer, the solver and the automated tests. */
export class Board {
  cells: Int8Array;
  rng: Rng;
  current = 0;
  next = 0;

  constructor(cells: Int8Array, seed: number, init = true) {
    this.cells = cells;
    this.rng = mulberry32(seed);
    if (init) {
      this.current = this.pickColor();
      this.next = this.pickColor();
    }
  }

  clone(): Board {
    const b = new Board(new Int8Array(this.cells), 0, false);
    b.rng.setState(this.rng.getState());
    b.current = this.current;
    b.next = this.next;
    return b;
  }

  count() {
    let n = 0;
    for (let i = 0; i < SIZE; i++) if (this.cells[i] >= 0) n++;
    return n;
  }
  isEmpty() {
    for (let i = 0; i < SIZE; i++) if (this.cells[i] >= 0) return false;
    return true;
  }
  presentColors(): number[] {
    const seen = new Array(16).fill(false);
    const out: number[] = [];
    for (let i = 0; i < SIZE; i++) {
      const v = this.cells[i];
      if (v >= 0 && !seen[v]) {
        seen[v] = true;
        out.push(v);
      }
    }
    return out.sort((a, b) => a - b);
  }
  pickColor(): number {
    const p = this.presentColors();
    if (!p.length) return 0;
    return p[Math.floor(this.rng() * p.length)];
  }
  /** Make sure queued colours still exist on the board (deterministic). */
  refreshQueue() {
    const p = this.presentColors();
    if (!p.length) return;
    if (!p.includes(this.current)) this.current = p[Math.floor(this.rng() * p.length)];
    if (!p.includes(this.next)) this.next = p[Math.floor(this.rng() * p.length)];
  }
  swap() {
    const t = this.current;
    this.current = this.next;
    this.next = t;
  }
  advance() {
    this.current = this.next;
    this.next = this.pickColor();
    this.refreshQueue();
  }

  /** Cells not connected to the ceiling. */
  floating(): number[] {
    const cells = this.cells;
    const seen = new Uint8Array(SIZE);
    const stack: number[] = [];
    for (let c = 0; c < COLS; c++) if (cells[c] >= 0) {
      seen[c] = 1;
      stack.push(c);
    }
    while (stack.length) {
      const i = stack.pop()!;
      for (const n of NEIGHBORS[i]) if (!seen[n] && cells[n] >= 0) {
        seen[n] = 1;
        stack.push(n);
      }
    }
    const out: number[] = [];
    for (const i of VALID_CELLS) if (cells[i] >= 0 && !seen[i]) out.push(i);
    return out;
  }

  cluster(start: number, color: number): number[] {
    const cells = this.cells;
    const seen = new Uint8Array(SIZE);
    const out = [start];
    seen[start] = 1;
    for (let k = 0; k < out.length; k++) {
      for (const n of NEIGHBORS[out[k]]) if (!seen[n] && cells[n] === color) {
        seen[n] = 1;
        out.push(n);
      }
    }
    return out;
  }

  private removeWithDrops(popped: number[], placed: number): Resolve {
    const colors: number[] = [];
    for (const i of popped) {
      colors.push(this.cells[i]);
      this.cells[i] = -1;
    }
    const dropped = popped.length ? this.floating() : [];
    for (const i of dropped) {
      colors.push(this.cells[i]);
      this.cells[i] = -1;
    }
    return { placed, popped, dropped, colors };
  }

  /** Place a colour at a cell and resolve matches + floating drops. */
  place(i: number, color: number): Resolve {
    this.cells[i] = color;
    const cl = this.cluster(i, color);
    if (cl.length >= 3) return this.removeWithDrops(cl, i);
    return { placed: i, popped: [], dropped: [], colors: [] };
  }

  /** Standard shot using the current queued colour. */
  shoot(i: number): Resolve {
    const res = this.place(i, this.current);
    this.advance();
    return res;
  }

  /** Bomb booster: clears everything within ~2 rings of the impact cell. */
  bomb(i: number): Resolve {
    const x0 = cellX(rowOf(i), i % COLS), y0 = cellY(rowOf(i));
    const hit: number[] = [];
    for (const j of VALID_CELLS) {
      if (this.cells[j] < 0) continue;
      const dx = cellX(rowOf(j), j % COLS) - x0, dy = cellY(rowOf(j)) - y0;
      if (dx * dx + dy * dy <= 100 * 100) hit.push(j);
    }
    const res = this.removeWithDrops(hit, i);
    this.refreshQueue();
    return res;
  }

  /** Fireball booster: burns the given cells. */
  burn(hit: number[]): Resolve {
    const res = this.removeWithDrops(hit.filter((j) => this.cells[j] >= 0), -1);
    this.refreshQueue();
    return res;
  }

  /** Empty cells reachable from the shooter where a bubble could stick. */
  attachCells(maxRow = MAX_ROWS - 1): number[] {
    const cells = this.cells;
    const seen = new Uint8Array(SIZE);
    const queue: number[] = [];
    const last = MAX_ROWS - 1;
    for (let c = 0; c < rowLen(last); c++) {
      const i = idx(last, c);
      if (cells[i] < 0) {
        seen[i] = 1;
        queue.push(i);
      }
    }
    const out: number[] = [];
    for (let k = 0; k < queue.length; k++) {
      const i = queue[k];
      const r = rowOf(i);
      let sticky = r === 0;
      for (const n of NEIGHBORS[i]) {
        if (cells[n] >= 0) sticky = true;
        else if (!seen[n]) {
          seen[n] = 1;
          queue.push(n);
        }
      }
      // ceiling row cells are reachable from below as well
      if (sticky && r <= maxRow) out.push(i);
    }
    // row 0 cells adjacent to reachable empties
    return out.sort((a, b) => a - b);
  }
}
