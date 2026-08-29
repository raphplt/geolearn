export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smootherstep = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);

function octave(size: number, cells: number, rand: () => number): Float32Array {
  const lattice = new Float32Array(cells * cells);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rand();

  const out = new Float32Array(size * size);
  const scale = cells / size;

  for (let y = 0; y < size; y++) {
    const fy = y * scale;
    const y0 = Math.floor(fy) % cells;
    const y1 = (y0 + 1) % cells;
    const ty = smootherstep(fy - Math.floor(fy));

    for (let x = 0; x < size; x++) {
      const fx = x * scale;
      const x0 = Math.floor(fx) % cells;
      const x1 = (x0 + 1) % cells;
      const tx = smootherstep(fx - Math.floor(fx));

      const top = lattice[y0 * cells + x0]! * (1 - tx) + lattice[y0 * cells + x1]! * tx;
      const bottom = lattice[y1 * cells + x0]! * (1 - tx) + lattice[y1 * cells + x1]! * tx;
      out[y * size + x] = top * (1 - ty) + bottom * ty;
    }
  }
  return out;
}

export function fbm(
  size: number,
  { octaves = 5, baseCells = 4, gain = 0.5, seed = 1 } = {},
): Float32Array {
  const rand = mulberry32(seed);
  const out = new Float32Array(size * size);
  let amplitude = 1;
  let total = 0;

  for (let o = 0; o < octaves; o++) {
    const cells = Math.min(baseCells * 2 ** o, size);
    const layer = octave(size, cells, rand);
    for (let i = 0; i < out.length; i++) out[i]! += layer[i]! * amplitude;
    total += amplitude;
    amplitude *= gain;
  }

  for (let i = 0; i < out.length; i++) out[i]! /= total;
  return out;
}

export function whiteNoise(size: number, seed: number): Float32Array {
  const rand = mulberry32(seed);
  const out = new Float32Array(size * size);
  for (let i = 0; i < out.length; i++) out[i] = rand();
  return out;
}
