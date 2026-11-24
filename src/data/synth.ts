// Deterministic synthetic EEG generator (no ML) used for demo studies that
// imitate typical findings. 16 longitudinal bipolar channels, 10 s pages.

export const CHANNELS = [
  'Fp1–F7', 'F7–T3', 'T3–T5', 'T5–O1', 'Fp2–F8', 'F8–T4', 'T4–T6', 'T6–O2',
  'Fp1–F3', 'F3–C3', 'C3–P3', 'P3–O1', 'Fp2–F4', 'F4–C4', 'C4–P4', 'P4–O2',
];

const POST = [0.1, 0.15, 0.5, 1, 0.1, 0.15, 0.5, 1, 0.1, 0.2, 0.5, 1, 0.1, 0.2, 0.5, 1];
const FRONT = [1, 0.6, 0.3, 0.15, 1, 0.6, 0.3, 0.15, 1, 0.85, 0.45, 0.2, 1, 0.85, 0.45, 0.2];
const FP = [1, 0.08, 0, 0, 1, 0.08, 0, 0, 1, 0.1, 0, 0, 1, 0.1, 0, 0];
const TEMP = [0.5, 1, 0.8, 0.2, 0.5, 1, 0.8, 0.2, 0.15, 0.1, 0, 0, 0.15, 0.1, 0, 0];
const REGION = [0, 1, 1, 2, 0, 1, 1, 2, 0, 3, 3, 2, 0, 3, 3, 2];

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PageSpec {
  alphaUv: number;
  alphaHz: number;
  eyesOpenAt?: number; // s within page
  blinks?: number[];
  muscle?: [number, number][];
  photicHz?: number;
  slowUv?: number; // diffuse delta/theta (HV)
  swd?: [number, number][]; // 3 Hz spike-wave
  asym?: number; // right/left alpha ratio
}

const FS = 128;
const N = FS * 10;

function noise(r: () => number, amp: number) {
  const out = new Float64Array(N);
  for (let f = 0.5; f <= 30; f += 0.5) {
    const a = (amp / Math.sqrt(f)) * (0.5 + r());
    const ph = r() * Math.PI * 2;
    const m = 0.08 + r() * 0.35;
    const ph2 = r() * Math.PI * 2;
    for (let i = 0; i < N; i++) {
      const t = i / FS;
      out[i] += a * (0.6 + 0.4 * Math.sin(2 * Math.PI * m * t + ph2)) * Math.sin(2 * Math.PI * f * t + ph);
    }
  }
  return out;
}

const gauss = (t: number, mu: number, s: number) => Math.exp(-((t - mu) ** 2) / (2 * s * s));
const smoothstep = (t: number, a: number, w: number) => {
  const x = Math.min(1, Math.max(0, (t - a) / w));
  return x * x * (3 - 2 * x);
};

export function synthPage(spec: PageSpec, seed: number): number[][] {
  const r = rng(seed);
  const shared = [0, 1, 2, 3].map(() => noise(r, 6));
  const alphaPh = r() * Math.PI * 2;
  const envPh = r() * Math.PI * 2;
  return CHANNELS.map((_, c) => {
    const own = noise(r, 5);
    const sh = shared[REGION[c]];
    const right = c >= 4 && c < 8 ? 1 : c >= 12 ? 1 : 0;
    const asym = right ? spec.asym ?? 1 : 1;
    const out: number[] = new Array(N);
    for (let i = 0; i < N; i++) {
      const t = i / FS;
      let v = 0.55 * sh[i] + 0.45 * own[i];
      // posterior dominant rhythm, waxing/waning
      let alpha = spec.alphaUv * POST[c] * asym * (0.55 + 0.45 * Math.sin(2 * Math.PI * 0.35 * t + envPh));
      if (spec.eyesOpenAt !== undefined) alpha *= 1 - 0.85 * smoothstep(t, spec.eyesOpenAt, 0.4);
      if (spec.swd) for (const [a, b] of spec.swd) alpha *= 1 - 0.9 * smoothstep(t, a - 0.3, 0.3) * (1 - smoothstep(t, b, 0.4));
      v += alpha * Math.sin(2 * Math.PI * spec.alphaHz * t + alphaPh + c * 0.05);
      if (spec.photicHz) v += 14 * POST[c] * Math.sin(2 * Math.PI * spec.photicHz * t + c * 0.1);
      if (spec.slowUv) v += spec.slowUv * FRONT[c] * (Math.sin(2 * Math.PI * 2.4 * t + c * 0.2) * 0.7 + Math.sin(2 * Math.PI * 1.3 * t + 1) * 0.5);
      if (spec.blinks) for (const b of spec.blinks) v += 140 * FP[c] * gauss(t, b, 0.11);
      if (spec.muscle) for (const [a, b] of spec.muscle) {
        const env = smoothstep(t, a, 0.2) * (1 - smoothstep(t, b - 0.2, 0.2));
        if (env > 0) v += env * 28 * TEMP[c] * (Math.sin(2 * Math.PI * 41 * t + c) + 0.7 * Math.sin(2 * Math.PI * 53.3 * t + 2 * c) + (r() - 0.5) * 1.6);
      }
      if (spec.swd) for (const [a, b] of spec.swd) {
        if (t < a - 0.2 || t > b + 0.2) continue;
        const env = smoothstep(t, a, 0.15) * (1 - smoothstep(t, b - 0.3, 0.3));
        const ph = ((t - a) * 3) % 1; // 3 Hz cycles
        const w = 0.45 + 0.55 * FRONT[c];
        v += env * w * (-150 * gauss(ph, 0.08, 0.035) + 170 * gauss(ph, 0.45, 0.14) - 40 * gauss(ph, 0.85, 0.08));
      }
      out[i] = Math.round(v);
    }
    return out;
  });
}

/** Per-second detector score (z) with bumps at events. */
export function synthScore(durationS: number, bumps: { start: number; end: number; peak: number }[], seed: number) {
  const r = rng(seed);
  const s: number[] = [];
  let ar = 0;
  for (let i = 0; i < durationS; i++) {
    ar = 0.85 * ar + 0.15 * (r() - 0.5) * 6;
    let v = 1.6 + ar + (r() - 0.5) * 0.6;
    for (const b of bumps) {
      const mid = (b.start + b.end) / 2, half = (b.end - b.start) / 2 + 1.5;
      v += Math.max(0, (b.peak - 1.6) * Math.exp(-(((i - mid) / half) ** 6)));
    }
    s.push(Math.round(Math.max(-0.5, v) * 100) / 100);
  }
  return s;
}
