// Seeded random numbers (mulberry32) plus small helpers, so a play test can
// replay the same city with ?seed=N.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

export function rangeInt(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function chance(rng, p) {
  return rng() < p;
}

// Deterministic pick of an element by index (used for fixed palettes).
export function at(list, i) {
  return list[((i % list.length) + list.length) % list.length];
}
