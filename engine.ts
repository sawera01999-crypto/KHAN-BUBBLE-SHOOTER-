import { Board, type Resolve } from "../core/board";
import { COLS, D, DANGER_ROW, GRID_W, MAX_ROWS, NEIGHBORS, R, SIZE, VALID_CELLS, cellX, cellY, rowOf, SHOOTER_X, SHOOTER_Y, MIN_ANGLE, MAX_ANGLE } from "../core/grid";
import type { LevelData } from "../core/levels";
import { pointAlong, traceShot, type Trace } from "../core/physics";
import { sfx } from "./audio";
import type { Theme } from "./themes";

export const W = GRID_W;
export const H = 690;
const OY = 6;
const SX = SHOOTER_X;
const SY = SHOOTER_Y;
const NX = SX - 92, NY = SY + 26;
const SPEED = 1150;
const MIN_A = MIN_ANGLE, MAX_A = MAX_ANGLE;

export type Kind = "normal" | "bomb" | "fire";
export interface HudState { score: number; shotsLeft: number; shotsUsed: number; current: number; next: number; armed: Kind | null; combo: number; remaining: number; danger: boolean }
export interface EndState { won: boolean; score: number; shotsUsed: number; shotsLeft: number; bonus: number; reason: string }
interface Callbacks { onHud: (h: HudState) => void; onEnd: (e: EndState) => void; onBooster: (k: Kind) => void }
const guard = (eng: { isDead: () => boolean }, cb: Callbacks): Callbacks => ({
  onHud: (h) => { if (!eng.isDead()) cb.onHud(h); },
  onEnd: (e) => { if (!eng.isDead()) cb.onEnd(e); },
  onBooster: (k) => { if (!eng.isDead()) cb.onBooster(k); },
});

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; type: "dot" | "star" | "flame" | "ring" | "spark"; g: number; rot?: number }
interface Pop { x: number; y: number; color: number; delay: number; t: number; idx: number; drop: boolean }
interface Fall { x: number; y: number; vx: number; vy: number; color: number; rot: number; vr: number; t: number }
interface Text { x: number; y: number; text: string; t: number; color: string; size: number }
interface Flight { trace: Trace; dist: number; color: number; kind: Kind; burnedDone: number; burnedSet: Set<number> }

// ---------- colour helpers ----------
function rgb(hex: string) {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function mix(hex: string, to: number, amt: number) {
  const [r, g, b] = rgb(hex);
  const m = (v: number) => Math.round(v + (to - v) * amt);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

function makeBubble(color: string, size = 96) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const s = size, r = s / 2 - 2;
  g.shadowColor = "rgba(0,0,0,0.35)";
  g.shadowBlur = 4;
  g.shadowOffsetY = 2;
  const grad = g.createRadialGradient(s * 0.38, s * 0.33, r * 0.05, s / 2, s / 2, r);
  grad.addColorStop(0, mix(color, 255, 0.65));
  grad.addColorStop(0.42, color);
  grad.addColorStop(1, mix(color, 0, 0.5));
  g.fillStyle = grad;
  g.beginPath();
  g.arc(s / 2, s / 2, r, 0, Math.PI * 2);
  g.fill();
  g.shadowColor = "transparent";
  g.strokeStyle = "rgba(255,255,255,0.35)";
  g.lineWidth = s * 0.02;
  g.stroke();
  g.save();
  g.translate(s * 0.36, s * 0.3);
  g.rotate(-0.6);
  g.fillStyle = "rgba(255,255,255,0.8)";
  g.beginPath();
  g.ellipse(0, 0, r * 0.34, r * 0.17, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.fillStyle = "rgba(255,255,255,0.55)";
  g.beginPath();
  g.arc(s * 0.66, s * 0.7, r * 0.08, 0, Math.PI * 2);
  g.fill();
  return c;
}

function makeBomb(size = 96) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const s = size, r = s / 2 - 6;
  const grad = g.createRadialGradient(s * 0.38, s * 0.4, 2, s / 2, s * 0.55, r);
  grad.addColorStop(0, "#6b7280");
  grad.addColorStop(0.5, "#1f2937");
  grad.addColorStop(1, "#030712");
  g.fillStyle = grad;
  g.beginPath();
  g.arc(s / 2, s * 0.55, r * 0.9, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#9ca3af";
  g.fillRect(s * 0.42, s * 0.08, s * 0.16, s * 0.14);
  g.strokeStyle = "#d97706";
  g.lineWidth = s * 0.05;
  g.beginPath();
  g.moveTo(s * 0.5, s * 0.1);
  g.quadraticCurveTo(s * 0.62, -s * 0.02, s * 0.74, s * 0.08);
  g.stroke();
  g.fillStyle = "rgba(255,255,255,0.6)";
  g.beginPath();
  g.ellipse(s * 0.38, s * 0.42, r * 0.22, r * 0.12, -0.6, 0, Math.PI * 2);
  g.fill();
  return c;
}

function makeFire(size = 96) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const s = size;
  const grad = g.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
  grad.addColorStop(0, "#fffbeb");
  grad.addColorStop(0.25, "#fde047");
  grad.addColorStop(0.55, "#f97316");
  grad.addColorStop(0.8, "rgba(220,38,38,0.7)");
  grad.addColorStop(1, "rgba(220,38,38,0)");
  g.fillStyle = grad;
  g.beginPath();
  g.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
  g.fill();
  return c;
}

function makeStar(size = 48) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  g.translate(size / 2, size / 2);
  g.shadowColor = "#fff7ae";
  g.shadowBlur = size * 0.2;
  g.fillStyle = "#fff59d";
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? size * 0.16 : size * 0.4;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
  return c;
}

function makeBackground(theme: Theme) {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, theme.board[0]);
  grad.addColorStop(1, theme.board[1]);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.globalAlpha = 0.12;
  if (theme.id === "wood") {
    g.strokeStyle = "#fde68a";
    for (let y = 0; y < H; y += 9) {
      g.lineWidth = 1 + rnd() * 1.5;
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= W; x += 20) g.lineTo(x, y + Math.sin(x / 50 + y) * 3);
      g.stroke();
    }
  } else if (theme.id === "candy") {
    g.fillStyle = "#ffffff";
    g.globalAlpha = 0.25;
    for (let x = -H; x < W; x += 36) {
      g.beginPath();
      g.moveTo(x, H); g.lineTo(x + 16, H); g.lineTo(x + 16 + H, 0); g.lineTo(x + H, 0);
      g.fill();
    }
  } else if (theme.id === "jungle") {
    g.fillStyle = "#86efac";
    for (let i = 0; i < 26; i++) {
      g.save();
      g.translate(rnd() * W, rnd() * H);
      g.rotate(rnd() * 6);
      g.beginPath();
      g.ellipse(0, 0, 26 + rnd() * 20, 8 + rnd() * 6, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  } else if (theme.id === "ocean") {
    g.strokeStyle = "#a5f3fc";
    g.lineWidth = 2;
    for (let y = 30; y < H; y += 46) {
      g.beginPath();
      for (let x = 0; x <= W; x += 10) g.lineTo(x, y + Math.sin(x / 30 + y) * 6);
      g.stroke();
    }
  } else {
    g.globalAlpha = 1;
    for (let i = 0; i < 120; i++) {
      g.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.6})`;
      g.beginPath();
      g.arc(rnd() * W, rnd() * H, rnd() * 1.4 + 0.3, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 0.25;
    const ng = g.createRadialGradient(W * 0.75, H * 0.3, 10, W * 0.75, H * 0.3, 180);
    ng.addColorStop(0, "#c084fc");
    ng.addColorStop(1, "transparent");
    g.fillStyle = ng;
    g.fillRect(0, 0, W, H);
  }
  g.globalAlpha = 1;
  // bottom shooter platform glow
  const pg = g.createRadialGradient(SX, SY + 40, 10, SX, SY + 40, 200);
  pg.addColorStop(0, "rgba(255,255,255,0.18)");
  pg.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = pg;
  g.fillRect(0, SY - 160, W, 240);
  return c;
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cb: Callbacks;
  theme!: Theme;
  level: LevelData;
  board: Board;
  private sprites: HTMLCanvasElement[] = [];
  private bombSprite = makeBomb();
  private fireSprite = makeFire();
  private starSprite = makeStar();
  private bg!: HTMLCanvasElement;
  private scale = 1;
  private dpr = 1;
  private raf = 0;
  private last = 0;
  private time = 0;

  score = 0;
  shotsLeft: number;
  shotsUsed = 0;
  combo = 0;
  armed: Kind | null = null;
  paused = false;
  private mode: "aim" | "flying" | "settle" | "ended" = "aim";
  private settle = 0;
  private angle = Math.PI / 2;
  private pointerActive = false;
  private showGuide = true;
  private guideCache: { key: string; trace: Trace } | null = null;
  private boardVersion = 0;
  private flight: Flight | null = null;
  private pops: Pop[] = [];
  private falls: Fall[] = [];
  private parts: Particle[] = [];
  private texts: Text[] = [];
  private shake = 0;
  private swapT = 1;
  private jig = new Float32Array(SIZE * 4);
  private land = new Map<number, number>();
  private hidden = new Set<number>();
  private ambient: { x: number; y: number; s: number; p: number }[] = [];
  private flash = 0;
  private lastLanded = -1;
  private destroyed = false;

  constructor(canvas: HTMLCanvasElement, level: LevelData, theme: Theme, cb: Callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.cb = guard({ isDead: () => this.destroyed }, cb);
    this.level = level;
    this.board = new Board(new Int8Array(level.cells), level.seed);
    this.shotsLeft = level.shotLimit;
    this.setTheme(theme);
    for (let i = 0; i < 26; i++) this.ambient.push({ x: Math.random() * W, y: Math.random() * H, s: 1 + Math.random() * 3, p: Math.random() * 6 });
    canvas.addEventListener("pointerdown", this.onDown);
    canvas.addEventListener("pointermove", this.onMove);
    window.addEventListener("pointerup", this.onUp);
    canvas.addEventListener("pointerleave", this.onLeave);
    canvas.addEventListener("pointercancel", this.onLeave);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
    this.emitHud();
  }

  setTheme(theme: Theme) {
    this.theme = theme;
    this.sprites = theme.bubbles.map((c) => makeBubble(c));
    this.bg = makeBackground(theme);
  }

  resize(cssW: number, cssH: number) {
    this.scale = Math.max(0.2, Math.min(cssW / W, cssH / H));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = Math.floor(W * this.scale), h = Math.floor(H * this.scale);
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener("pointerdown", this.onDown);
    this.canvas.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerup", this.onUp);
    this.canvas.removeEventListener("pointerleave", this.onLeave);
    this.canvas.removeEventListener("pointercancel", this.onLeave);
  }

  // ---------------- public actions ----------------
  swap() {
    if (this.mode === "ended" || this.paused || this.armed) return;
    if (this.board.current === this.board.next) {
      this.texts.push({ x: NX, y: NY - 30, text: "Same!", t: 0, color: "#fff", size: 14 });
    }
    this.board.swap();
    this.swapT = 0;
    this.guideCache = null;
    sfx.swap();
    this.emitHud();
  }
  arm(kind: Kind | null) {
    if (this.mode === "ended") return;
    this.armed = this.armed === kind ? null : kind;
    this.guideCache = null;
    sfx.ui();
    this.emitHud();
  }
  addShots(n: number) {
    this.shotsLeft += n;
    this.mode = "aim";
    this.texts.push({ x: SX, y: SY - 80, text: `+${n} Shots!`, t: 0, color: "#fde047", size: 30 });
    this.emitHud();
  }

  private emitHud() {
    let lowest = -1;
    for (const i of VALID_CELLS) if (this.board.cells[i] >= 0) lowest = Math.max(lowest, rowOf(i));
    this.cb.onHud({
      score: this.score, shotsLeft: this.shotsLeft, shotsUsed: this.shotsUsed, current: this.board.current, next: this.board.next,
      armed: this.armed, combo: this.combo, remaining: this.board.count(), danger: lowest >= DANGER_ROW - 2,
    });
  }

  // ---------------- input ----------------
  private toLocal(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }
  private aimAt(x: number, y: number) {
    let a = Math.atan2(SY - Math.min(y, SY - 5), x - SX);
    a = Math.max(MIN_A, Math.min(MAX_A, a));
    this.angle = a;
  }
  private onDown = (e: PointerEvent) => {
    if (this.paused || this.mode === "ended") return;
    sfx.unlock();
    const p = this.toLocal(e);
    if (Math.hypot(p.x - NX, p.y - NY) < 34 || (Math.hypot(p.x - SX, p.y - SY) < 30 && e.pointerType !== "mouse")) {
      this.swap();
      return;
    }
    this.pointerActive = true;
    this.showGuide = true;
    this.aimAt(p.x, p.y);
  };
  private onMove = (e: PointerEvent) => {
    if (this.paused) return;
    const p = this.toLocal(e);
    if (this.pointerActive || e.pointerType === "mouse") {
      if (p.y < SY + 10) this.aimAt(p.x, p.y);
      this.showGuide = true;
    }
  };
  private onUp = (e: PointerEvent) => {
    if (!this.pointerActive) return;
    this.pointerActive = false;
    const p = this.toLocal(e);
    if (p.y > H + 40) return; // released far outside: cancel
    this.fire();
  };
  private onLeave = (e: PointerEvent) => {
    if (e.type === "pointercancel") this.pointerActive = false;
  };

  private currentTrace(): Trace {
    const fire = this.armed === "fire";
    const key = `${this.angle.toFixed(4)}|${fire}|${this.boardVersion}`;
    if (this.guideCache?.key === key) return this.guideCache.trace;
    const trace = traceShot(this.board.cells, SX, SY, this.angle, fire);
    this.guideCache = { key, trace };
    return trace;
  }

  private fire() {
    if (this.mode !== "aim" || this.paused || this.swapT < 1) return;
    const kind: Kind = this.armed ?? "normal";
    if (kind === "normal" && this.shotsLeft <= 0) return;
    const trace = this.currentTrace();
    if (kind !== "fire" && trace.cell < 0) return;
    const color = this.board.current;
    this.flight = { trace, dist: 0, color, kind, burnedDone: 0, burnedSet: new Set() };
    this.mode = "flying";
    if (kind === "normal") {
      this.shotsLeft--;
      this.shotsUsed++;
    }
    this.armed = null;
    if (kind !== "normal") this.cb.onBooster(kind);
    if (kind === "fire") sfx.fireball();
    else sfx.shoot();
    this.emitHud();
  }

  // ---------------- simulation ----------------
  private loop = (now: number) => {
    const dt = Math.min(0.033, (now - this.last) / 1000);
    this.last = now;
    if (!this.paused) this.update(dt);
    this.render();
    this.raf = requestAnimationFrame(this.loop);
  };

  private spawnBurst(x: number, y: number, color: string, n = 10, power = 1) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, s = (60 + Math.random() * 180) * power;
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: 0.5 + Math.random() * 0.4, max: 0.9, color, size: 2 + Math.random() * 3.5, type: "dot", g: 380 });
    }
    if (Math.random() < 0.7) {
      const a = Math.random() * Math.PI * 2;
      this.parts.push({ x, y, vx: Math.cos(a) * 60, vy: -80 - Math.random() * 60, life: 0.8, max: 0.8, color: "#fff59d", size: 9 + Math.random() * 6, type: "star", g: 120, rot: Math.random() * 6 });
    }
    this.parts.push({ x, y, vx: 0, vy: 0, life: 0.3, max: 0.3, color, size: R, type: "ring", g: 0 });
  }

  private impulse(cell: number, power: number) {
    const x0 = cellX(rowOf(cell), cell % COLS), y0 = cellY(rowOf(cell));
    for (const i of VALID_CELLS) {
      if (this.board.cells[i] < 0 || i === cell) continue;
      const dx = cellX(rowOf(i), i % COLS) - x0, dy = cellY(rowOf(i)) - y0;
      const d = Math.hypot(dx, dy);
      if (d > D * 3 || d === 0) continue;
      const f = (1 - d / (D * 3)) * power;
      this.jig[i * 4 + 2] += (dx / d) * f;
      this.jig[i * 4 + 3] += (dy / d) * f;
    }
  }

  private applyResolve(res: Resolve, originX: number, originY: number, kind: Kind) {
    const all = [...res.popped.map((i) => ({ i, drop: false })), ...res.dropped.map((i) => ({ i, drop: true }))];
    let maxDelay = 0;
    all.forEach(({ i, drop }, k) => {
      const x = cellX(rowOf(i), i % COLS), y = cellY(rowOf(i));
      const color = res.colors[k];
      if (drop) {
        this.falls.push({ x, y, vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 120, color, rot: 0, vr: (Math.random() - 0.5) * 8, t: 0 });
      } else {
        const d = Math.hypot(x - originX, y - originY);
        const delay = kind === "fire" ? 0 : (d / D) * (kind === "bomb" ? 0.03 : 0.055);
        maxDelay = Math.max(maxDelay, delay);
        this.pops.push({ x, y, color, delay, t: 0, idx: k, drop: false });
      }
    });
    const nPop = res.popped.length, nDrop = res.dropped.length;
    if (nPop) {
      this.combo++;
      const mult = Math.min(5, this.combo);
      const gained = (nPop * 10 + nDrop * 20) * mult;
      this.score += gained;
      this.texts.push({ x: originX, y: originY, text: `+${gained}`, t: 0, color: "#fff", size: 22 });
      if (this.combo >= 2) this.texts.push({ x: W / 2, y: 300, text: `Combo x${mult}!`, t: -0.15, color: this.theme.accent, size: 30 });
      const total = nPop + nDrop;
      const word = total >= 20 ? "INCREDIBLE!" : total >= 12 ? "AMAZING!" : total >= 7 ? "GREAT!" : "";
      if (word) this.texts.push({ x: W / 2, y: 250, text: word, t: -0.05, color: "#fde047", size: 40 });
      if (nDrop) setTimeout(() => sfx.star(nDrop), 220);
    } else if (kind === "normal") {
      this.combo = 0;
    }
    this.boardVersion++;
    this.guideCache = null;
    return maxDelay;
  }

  private land_(f: Flight) {
    const { trace, kind } = f;
    const end = trace.points[trace.points.length - 1];
    if (kind === "fire") {
      const res = this.board.burn(trace.burned.map((b) => b.cell));
      this.hidden.clear();
      // burned pops were already spawned; only handle drops & scoring
      const fakePop = { ...res, popped: [] as number[], colors: res.colors.slice(res.popped.length) };
      const gained = res.popped.length * 15;
      this.score += gained;
      if (gained) this.texts.push({ x: end.x, y: 60, text: `+${gained}`, t: 0, color: "#fdba74", size: 24 });
      this.applyResolve(fakePop, end.x, end.y, "fire");
      if (res.dropped.length) this.score += res.dropped.length * 20;
      this.settle = 0.35;
      this.mode = "settle";
      this.emitHud();
      return;
    }
    const cell = trace.cell;
    const cx = cellX(rowOf(cell), cell % COLS), cy = cellY(rowOf(cell));
    if (kind === "bomb") {
      const res = this.board.bomb(cell);
      sfx.bomb();
      this.shake = 0.5;
      this.flash = 1;
      this.parts.push({ x: cx, y: cy, vx: 0, vy: 0, life: 0.6, max: 0.6, color: "#fde047", size: 110, type: "ring", g: 0 });
      this.parts.push({ x: cx, y: cy, vx: 0, vy: 0, life: 0.45, max: 0.45, color: "#f97316", size: 70, type: "ring", g: 0 });
      for (let k = 0; k < 50; k++) {
        const a = Math.random() * Math.PI * 2, s = 100 + Math.random() * 360;
        this.parts.push({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.6, max: 1.1, color: ["#fde047", "#f97316", "#ef4444", "#fff"][k % 4], size: 2 + Math.random() * 5, type: k % 3 ? "spark" : "flame", g: 200 });
      }
      this.impulse(cell, 420);
      const md = this.applyResolve(res, cx, cy, "bomb");
      this.score += res.popped.length * 5;
      this.settle = md + 0.3;
      this.mode = "settle";
      this.emitHud();
      return;
    }
    const placedColor = this.board.current;
    const res = this.board.shoot(cell);
    this.lastLanded = cell;
    this.land.set(cell, 0);
    if (!res.popped.length) {
      sfx.stick();
      this.impulse(cell, 90);
    } else {
      this.impulse(cell, 160);
    }
    void placedColor;
    const md = this.applyResolve(res, cx, cy, "normal");
    this.settle = md + (res.popped.length ? 0.25 : 0.05);
    this.mode = "settle";
    this.emitHud();
  }

  private checkEnd() {
    if (this.board.isEmpty()) {
      this.mode = "ended";
      const bonus = this.shotsLeft * 50;
      this.score += bonus;
      for (let k = 0; k < 5; k++) setTimeout(() => this.firework(), k * 220);
      this.texts.push({ x: W / 2, y: 280, text: "BOARD CLEARED!", t: -0.1, color: "#fde047", size: 38 });
      this.emitHud();
      setTimeout(() => this.cb.onEnd({ won: true, score: this.score, shotsUsed: this.shotsUsed, shotsLeft: this.shotsLeft, bonus, reason: "" }), 1500);
      return;
    }
    if (this.lastLanded >= 0 && rowOf(this.lastLanded) >= DANGER_ROW && this.board.cells[this.lastLanded] >= 0) {
      this.mode = "ended";
      this.shake = 0.3;
      setTimeout(() => this.cb.onEnd({ won: false, score: this.score, shotsUsed: this.shotsUsed, shotsLeft: this.shotsLeft, bonus: 0, reason: "danger" }), 900);
      return;
    }
    if (this.shotsLeft <= 0) {
      this.mode = "ended";
      setTimeout(() => this.cb.onEnd({ won: false, score: this.score, shotsUsed: this.shotsUsed, shotsLeft: 0, bonus: 0, reason: "shots" }), 900);
      return;
    }
    this.lastLanded = -1;
    this.mode = "aim";
  }

  private firework() {
    const x = 60 + Math.random() * (W - 120), y = 80 + Math.random() * 260;
    const col = this.theme.bubbles[Math.floor(Math.random() * this.theme.bubbles.length)];
    sfx.pop(Math.floor(Math.random() * 10));
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * Math.PI * 2, s = 120 + Math.random() * 120;
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, max: 1, color: k % 5 ? col : "#fff", size: 2.5, type: "spark", g: 120 });
    }
    for (let k = 0; k < 4; k++) this.parts.push({ x, y, vx: (Math.random() - 0.5) * 160, vy: -Math.random() * 150, life: 1.1, max: 1.1, color: "#fff59d", size: 12, type: "star", g: 150, rot: 0 });
  }

  private update(dt: number) {
    this.time += dt;
    if (this.swapT < 1) this.swapT = Math.min(1, this.swapT + dt / 0.22);
    this.shake = Math.max(0, this.shake - dt);
    this.flash = Math.max(0, this.flash - dt * 3);

    // flight
    const f = this.flight;
    if (f && this.mode === "flying") {
      const prevSeg = pointAlong(f.trace.points, f.dist).seg;
      f.dist += SPEED * (f.kind === "fire" ? 0.85 : 1) * dt;
      const p = pointAlong(f.trace.points, f.dist);
      if (p.seg !== prevSeg && p.seg < f.trace.points.length - 1) sfx.click();
      if (f.kind === "fire") {
        for (let k = 0; k < 4; k++)
          this.parts.push({ x: p.x + (Math.random() - 0.5) * 14, y: p.y + (Math.random() - 0.5) * 14, vx: (Math.random() - 0.5) * 50, vy: 30 + Math.random() * 60, life: 0.45, max: 0.45, color: ["#fde047", "#f97316", "#ef4444"][k % 3], size: 6 + Math.random() * 8, type: "flame", g: -60 });
        while (f.burnedDone < f.trace.burned.length && f.trace.burned[f.burnedDone].dist <= f.dist) {
          const b = f.trace.burned[f.burnedDone++];
          const r = rowOf(b.cell), c = b.cell % COLS;
          this.hidden.add(b.cell);
          this.spawnBurst(cellX(r, c), cellY(r), "#f97316", 8, 1.1);
          this.spawnBurst(cellX(r, c), cellY(r), this.theme.bubbles[this.board.cells[b.cell]] ?? "#fff", 6);
          sfx.burn();
        }
      } else if (Math.random() < 0.6) {
        this.parts.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.25, max: 0.25, color: f.kind === "bomb" ? "#9ca3af" : this.theme.bubbles[f.color], size: 6, type: "dot", g: 0 });
      }
      if (p.done) {
        this.flight = null;
        this.land_(f);
      }
    }

    // pops
    let popIdx = 0;
    for (const p of this.pops) {
      if (p.delay > 0) {
        p.delay -= dt;
        if (p.delay <= 0) {
          this.spawnBurst(p.x, p.y, this.theme.bubbles[p.color], 12);
          if (popIdx < 10) sfx.pop(p.idx);
          popIdx++;
        }
      } else p.t += dt;
    }
    this.pops = this.pops.filter((p) => p.t < 0.22);

    // falling bubbles
    for (const b of this.falls) {
      b.vy += 1400 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += b.vr * dt;
      b.t += dt;
      if (b.x < R || b.x > W - R) b.vx = -b.vx;
      if (b.y > SY - 10 && b.t < 10) {
        b.t = 10;
        this.spawnBurst(b.x, SY - 10, this.theme.bubbles[b.color], 8, 0.8);
        this.parts.push({ x: b.x, y: SY - 20, vx: 0, vy: -140, life: 0.9, max: 0.9, color: "#fff59d", size: 13, type: "star", g: 60, rot: 0 });
        sfx.drop(Math.floor(Math.random() * 8));
      }
    }
    this.falls = this.falls.filter((b) => b.t < 10);

    // particles
    for (const p of this.parts) {
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.rot !== undefined) p.rot += dt * 4;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    if (this.parts.length > 900) this.parts.splice(0, this.parts.length - 900);
    for (const t of this.texts) t.t += dt;
    this.texts = this.texts.filter((t) => t.t < 1.2);

    // jiggle springs
    const j = this.jig;
    for (let i = 0; i < SIZE; i++) {
      const o = i * 4;
      if (j[o] === 0 && j[o + 1] === 0 && j[o + 2] === 0 && j[o + 3] === 0) continue;
      j[o + 2] += (-260 * j[o] - 14 * j[o + 2]) * dt;
      j[o + 3] += (-260 * j[o + 1] - 14 * j[o + 3]) * dt;
      j[o] += j[o + 2] * dt;
      j[o + 1] += j[o + 3] * dt;
      if (Math.abs(j[o]) + Math.abs(j[o + 1]) + Math.abs(j[o + 2]) + Math.abs(j[o + 3]) < 0.05) j.fill(0, o, o + 4);
    }
    for (const [k, v] of this.land) {
      if (v > 0.35) this.land.delete(k);
      else this.land.set(k, v + dt);
    }

    if (this.mode === "settle") {
      this.settle -= dt;
      if (this.settle <= 0) this.checkEnd();
    }
  }

  // ---------------- rendering ----------------
  private drawBubble(g: CanvasRenderingContext2D, color: number, x: number, y: number, s = 1) {
    const sp = this.sprites[color];
    if (!sp) return;
    const r = R * s;
    g.drawImage(sp, x - r, y - r, r * 2, r * 2);
  }

  private render() {
    const g = this.ctx;
    const k = this.scale * this.dpr;
    g.setTransform(k, 0, 0, k, 0, 0);
    g.drawImage(this.bg, 0, 0);
    // ambient
    const th = this.theme.id;
    for (const a of this.ambient) {
      if (th === "ocean" || th === "jungle" || th === "candy") {
        a.y -= a.s * 0.25;
        if (a.y < -10) { a.y = H + 10; a.x = Math.random() * W; }
        g.globalAlpha = 0.25;
        g.strokeStyle = th === "candy" ? "#fff" : "#e0f2fe";
        g.beginPath();
        g.arc(a.x + Math.sin(this.time + a.p) * 6, a.y, a.s * 1.6, 0, Math.PI * 2);
        g.stroke();
      } else {
        g.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(this.time * 1.5 + a.p));
        g.drawImage(this.starSprite, a.x - a.s * 2, a.y - a.s * 2, a.s * 4, a.s * 4);
      }
    }
    g.globalAlpha = 1;

    g.save();
    if (this.shake > 0) g.translate((Math.random() - 0.5) * 14 * this.shake, (Math.random() - 0.5) * 14 * this.shake);
    g.translate(0, OY);

    // ceiling bar
    g.fillStyle = "rgba(0,0,0,0.25)";
    g.fillRect(0, -OY, W, OY);

    // danger line
    let lowest = -1;
    for (const i of VALID_CELLS) if (this.board.cells[i] >= 0) lowest = Math.max(lowest, rowOf(i));
    const dy = cellY(DANGER_ROW) - R + 2;
    const danger = lowest >= DANGER_ROW - 2;
    g.setLineDash([10, 8]);
    g.lineDashOffset = -this.time * 20;
    g.strokeStyle = danger ? `rgba(239,68,68,${0.5 + 0.5 * Math.sin(this.time * 10)})` : "rgba(255,255,255,0.18)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, dy);
    g.lineTo(W, dy);
    g.stroke();
    g.setLineDash([]);

    // board bubbles
    const cells = this.board.cells;
    for (const i of VALID_CELLS) {
      const c = cells[i];
      if (c < 0 || this.hidden.has(i)) continue;
      const r = rowOf(i);
      let s = 1;
      const lt = this.land.get(i);
      if (lt !== undefined) s = 1 + Math.sin(lt * 18) * 0.12 * (1 - lt / 0.35);
      this.drawBubble(g, c, cellX(r, i % COLS) + this.jig[i * 4], cellY(r) + this.jig[i * 4 + 1], s);
    }

    // pops
    for (const p of this.pops) {
      if (p.delay > 0) this.drawBubble(g, p.color, p.x, p.y);
      else {
        g.globalAlpha = Math.max(0, 1 - p.t / 0.22);
        this.drawBubble(g, p.color, p.x, p.y, 1 + p.t * 2.5);
        g.globalAlpha = 1;
      }
    }
    // falls
    for (const b of this.falls) {
      g.save();
      g.translate(b.x, b.y);
      g.rotate(b.rot);
      this.drawBubble(g, b.color, 0, 0);
      g.restore();
    }

    // guide
    if (this.mode === "aim" && this.showGuide && !this.paused) this.drawGuide(g);

    // flight
    if (this.flight) {
      const p = pointAlong(this.flight.trace.points, this.flight.dist);
      if (this.flight.kind === "bomb") g.drawImage(this.bombSprite, p.x - R * 1.2, p.y - R * 1.2, R * 2.4, R * 2.4);
      else if (this.flight.kind === "fire") {
        g.globalCompositeOperation = "lighter";
        g.drawImage(this.fireSprite, p.x - R * 1.8, p.y - R * 1.8, R * 3.6, R * 3.6);
        g.globalCompositeOperation = "source-over";
      } else this.drawBubble(g, this.flight.color, p.x, p.y);
    }
    g.restore();

    // particles
    for (const p of this.parts) {
      const a = Math.max(0, p.life / p.max);
      g.globalAlpha = a;
      if (p.type === "star") {
        const s = p.size * (0.6 + a * 0.6);
        g.save();
        g.translate(p.x, p.y + OY);
        g.rotate(p.rot ?? 0);
        g.drawImage(this.starSprite, -s, -s, s * 2, s * 2);
        g.restore();
      } else if (p.type === "ring") {
        g.strokeStyle = p.color;
        g.lineWidth = 4 * a + 1;
        g.beginPath();
        g.arc(p.x, p.y + OY, p.size * (1.6 - a * 0.9), 0, Math.PI * 2);
        g.stroke();
      } else if (p.type === "flame") {
        g.globalCompositeOperation = "lighter";
        g.fillStyle = p.color;
        g.beginPath();
        g.arc(p.x, p.y + OY, p.size * a, 0, Math.PI * 2);
        g.fill();
        g.globalCompositeOperation = "source-over";
      } else {
        g.fillStyle = p.color;
        g.beginPath();
        g.arc(p.x, p.y + OY, p.size * (p.type === "spark" ? a : 1), 0, Math.PI * 2);
        g.fill();
      }
    }
    g.globalAlpha = 1;

    this.drawShooter(g);

    // texts
    for (const t of this.texts) {
      if (t.t < 0) continue;
      const a = t.t < 0.15 ? t.t / 0.15 : Math.max(0, 1 - (t.t - 0.6) / 0.6);
      const s = t.t < 0.15 ? 0.5 + (t.t / 0.15) * 0.6 : 1.1 - Math.min(0.1, (t.t - 0.15) * 0.3);
      g.globalAlpha = Math.max(0, Math.min(1, a));
      g.save();
      g.translate(t.x, t.y + OY - t.t * 40);
      g.scale(s, s);
      g.font = `900 ${t.size}px system-ui, -apple-system, Segoe UI, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.lineWidth = 5;
      g.strokeStyle = "rgba(0,0,0,0.55)";
      g.strokeText(t.text, 0, 0);
      g.fillStyle = t.color;
      g.fillText(t.text, 0, 0);
      g.restore();
    }
    g.globalAlpha = 1;

    if (this.flash > 0) {
      g.fillStyle = `rgba(255,240,200,${this.flash * 0.5})`;
      g.fillRect(0, 0, W, H);
    }
  }

  private drawGuide(g: CanvasRenderingContext2D) {
    const trace = this.currentTrace();
    const fire = this.armed === "fire";
    const col = fire ? "#fb923c" : this.armed === "bomb" ? "#e5e7eb" : this.theme.bubbles[this.board.current];
    const total = trace.length;
    const gap = 16;
    const offset = (this.time * 40) % gap;
    for (let d = 24 + offset; d < total - 6; d += gap) {
      const p = pointAlong(trace.points, d);
      const a = 1 - (d / Math.max(total, 1)) * 0.55;
      g.globalAlpha = a;
      g.fillStyle = "rgba(0,0,0,0.3)";
      g.beginPath();
      g.arc(p.x + 1, p.y + 1, 4, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = col;
      g.beginPath();
      g.arc(p.x, p.y, 3.6, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.8)";
      g.beginPath();
      g.arc(p.x - 1, p.y - 1, 1.2, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    if (fire) {
      for (const b of trace.burned) {
        const r = rowOf(b.cell);
        g.strokeStyle = `rgba(251,146,60,${0.6 + 0.4 * Math.sin(this.time * 12)})`;
        g.lineWidth = 3;
        g.beginPath();
        g.arc(cellX(r, b.cell % COLS), cellY(r), R - 1, 0, Math.PI * 2);
        g.stroke();
      }
    } else if (trace.cell >= 0) {
      const r = rowOf(trace.cell);
      const x = cellX(r, trace.cell % COLS), y = cellY(r);
      g.globalAlpha = 0.45 + 0.2 * Math.sin(this.time * 6);
      g.strokeStyle = "#fff";
      g.lineWidth = 2;
      g.setLineDash([5, 4]);
      g.beginPath();
      g.arc(x, y, R - 2, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
      if (this.armed === "bomb") {
        g.globalAlpha = 0.18;
        g.fillStyle = "#ef4444";
        g.beginPath();
        g.arc(x, y, 100 + R, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    }
  }

  private drawShooter(g: CanvasRenderingContext2D) {
    const y = SY + OY;
    // base
    const base = g.createRadialGradient(SX, y + 10, 4, SX, y + 10, 46);
    base.addColorStop(0, "rgba(255,255,255,0.35)");
    base.addColorStop(1, "rgba(0,0,0,0.35)");
    g.fillStyle = base;
    g.beginPath();
    g.ellipse(SX, y + 22, 52, 18, 0, 0, Math.PI * 2);
    g.fill();
    // barrel
    g.save();
    g.translate(SX, y);
    g.rotate(-this.angle + Math.PI / 2);
    const bar = g.createLinearGradient(-12, 0, 12, 0);
    bar.addColorStop(0, mix(this.theme.accent2, 0, 0.4));
    bar.addColorStop(0.5, mix(this.theme.accent2, 255, 0.35));
    bar.addColorStop(1, mix(this.theme.accent2, 0, 0.4));
    g.fillStyle = bar;
    g.beginPath();
    if (g.roundRect) g.roundRect(-13, -54, 26, 40, 6);
    else g.rect(-13, -54, 26, 40);
    g.fill();
    g.strokeStyle = "rgba(255,255,255,0.5)";
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = this.theme.accent;
    g.fillRect(-15, -58, 30, 8);
    g.restore();
    // ring
    g.strokeStyle = this.theme.accent;
    g.lineWidth = 4;
    g.beginPath();
    g.arc(SX, y, R + 7, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = "rgba(0,0,0,0.35)";
    g.beginPath();
    g.arc(SX, y, R + 5, 0, Math.PI * 2);
    g.fill();

    // current + next with swap flip animation
    const t = this.swapT;
    const e = t * t * (3 - 2 * t);
    const cur = this.board.current, nxt = this.board.next;
    const flying = this.mode === "flying" || this.mode === "ended";
    const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
    const arc = Math.sin(e * Math.PI) * 34;
    // "current" travels from next slot -> shooter, "next" from shooter -> next slot
    const cx = lerp(NX, SX, e), cy = lerp(NY + OY, y, e) - arc;
    const nx = lerp(SX, NX, e), ny = lerp(y, NY + OY, e) + arc * 0.6;
    if (!flying || this.mode === "ended") {
      g.save();
      g.translate(nx, ny);
      g.scale(0.78 * (t < 1 ? Math.abs(Math.cos(e * Math.PI)) * 0.3 + 0.7 : 1), 0.78);
      this.drawBubble(g, nxt, 0, 0);
      g.restore();
    }
    g.fillStyle = "rgba(255,255,255,0.75)";
    g.font = "800 10px system-ui, sans-serif";
    g.textAlign = "center";
    g.fillText("NEXT", NX, NY + OY + 26);
    g.fillText("TAP TO SWAP", NX, NY + OY + 38);
    if (this.mode !== "flying" && this.mode !== "ended") {
      if (this.armed === "bomb") g.drawImage(this.bombSprite, SX - R * 1.25, y - R * 1.25, R * 2.5, R * 2.5);
      else if (this.armed === "fire") {
        g.globalCompositeOperation = "lighter";
        const pulse = 1 + Math.sin(this.time * 10) * 0.08;
        g.drawImage(this.fireSprite, SX - R * 1.7 * pulse, y - R * 1.7 * pulse, R * 3.4 * pulse, R * 3.4 * pulse);
        g.globalCompositeOperation = "source-over";
      } else {
        g.save();
        g.translate(cx, cy);
        g.scale(t < 1 ? Math.abs(Math.cos(e * Math.PI)) * 0.4 + 0.6 : 1, 1);
        this.drawBubble(g, cur, 0, 0);
        g.restore();
      }
    }
    // shots counter
    g.font = "900 13px system-ui, sans-serif";
    g.fillStyle = this.shotsLeft <= 3 ? "#fca5a5" : "rgba(255,255,255,0.85)";
    g.fillText(`${this.shotsLeft} shots`, SX + 92, NY + OY + 4);
    void MAX_ROWS;
    void NEIGHBORS;
  }
}
