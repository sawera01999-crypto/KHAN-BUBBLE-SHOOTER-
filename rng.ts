// Deterministic PRNG so every level is identical on every device (fully offline).
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  const fn = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  fn.getState = () => a;
  fn.setState = (s: number) => {
    a = s >>> 0;
  };
  return fn;
}
export type Rng = ReturnType<typeof mulberry32>;

export function hashSeed(n: number, salt = 0) {
  let h = (n * 2654435761 + salt * 97531) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}
