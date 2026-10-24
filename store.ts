import { useSyncExternalStore } from "react";
import { TOTAL_LEVELS } from "../core/levels";

export interface SaveData {
  unlocked: number; // highest playable level
  stars: Record<number, number>;
  best: Record<number, number>;
  coins: number;
  bombs: number;
  fireballs: number;
  music: boolean;
  sfx: boolean;
  theme: number | "auto";
  totalStars: number;
}

const KEY = "khan-bubble-shooter-v1";
const DEFAULT: SaveData = { unlocked: 1, stars: {}, best: {}, coins: 200, bombs: 3, fireballs: 3, music: true, sfx: true, theme: "auto", totalStars: 0 };

function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT };
}

let state = load();
const subs = new Set<() => void>();

export const store = {
  get: () => state,
  set(patch: Partial<SaveData> | ((s: SaveData) => Partial<SaveData>)) {
    const p = typeof patch === "function" ? patch(state) : patch;
    state = { ...state, ...p };
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
    subs.forEach((f) => f());
  },
  subscribe(f: () => void) {
    subs.add(f);
    return () => subs.delete(f);
  },
  /** Record a win. Only the immediately-next level is unlocked (strict sequence). */
  completeLevel(level: number, stars: number, score: number) {
    const s = state;
    const prevStars = s.stars[level] ?? 0;
    const first = prevStars === 0;
    const coins = 10 + stars * 10 + (first ? 20 : 0);
    const giftBooster = first && level % 5 === 0 ? (level % 10 === 0 ? "fireball" : "bomb") : null;
    store.set({
      stars: { ...s.stars, [level]: Math.max(prevStars, stars) },
      best: { ...s.best, [level]: Math.max(s.best[level] ?? 0, score) },
      totalStars: s.totalStars + Math.max(0, stars - prevStars),
      unlocked: level === s.unlocked ? Math.min(TOTAL_LEVELS, level + 1) : s.unlocked,
      coins: s.coins + coins,
      bombs: s.bombs + (giftBooster === "bomb" ? 1 : 0),
      fireballs: s.fireballs + (giftBooster === "fireball" ? 1 : 0),
    });
    return { coins, giftBooster, first };
  },
  reset() {
    state = { ...DEFAULT };
    store.set({});
  },
};

export function useSave(): SaveData {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
