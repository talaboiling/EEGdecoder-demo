import type { Page } from '../data/types';

export const POSTERIOR = ['T5–O1', 'T6–O2', 'P3–O1', 'P4–O2'];
export const BANDS = [
  { key: 'delta', sym: 'δ', lo: 0.5, hi: 4 },
  { key: 'theta', sym: 'θ', lo: 4, hi: 8 },
  { key: 'alpha', sym: 'α', lo: 8, hi: 13 },
  { key: 'beta', sym: 'β', lo: 13, hi: 30 },
] as const;

/** Welch PSD (2 s Hann windows, 50 % overlap) averaged over posterior channels. */
export function psd(page: Page, channels: string[], fs: number) {
  const idx = POSTERIOR.map((c) => channels.indexOf(c)).filter((i) => i >= 0);
  const win = 2 * fs, step = win / 2, df = fs / win;
  const freqs: number[] = [];
  for (let k = 1; k * df <= 30; k++) freqs.push(k * df);
  const out = new Array(freqs.length).fill(0);
  let n = 0;
  const hann = Array.from({ length: win }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (win - 1)));
  for (const c of idx) {
    const x = page.data[c];
    for (let s = 0; s + win <= x.length; s += step) {
      let mean = 0;
      for (let i = 0; i < win; i++) mean += x[s + i];
      mean /= win;
      freqs.forEach((_, j) => {
        const k = j + 1;
        let re = 0, im = 0;
        for (let i = 0; i < win; i++) {
          const v = (x[s + i] - mean) * hann[i];
          const a = (2 * Math.PI * k * i) / win;
          re += v * Math.cos(a);
          im -= v * Math.sin(a);
        }
        out[j] += re * re + im * im;
      });
      n++;
    }
  }
  const power = out.map((v) => v / Math.max(1, n));
  const bands = BANDS.map((b) => {
    let s = 0;
    freqs.forEach((f, j) => { if (f >= b.lo && f < b.hi) s += power[j]; });
    return s;
  });
  const total = bands.reduce((a, b) => a + b, 0) || 1;
  return { freqs, power, rel: bands.map((b) => b / total) };
}
