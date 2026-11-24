import type { Lang } from '../data/types';

export const mmss = (t: number) => {
  t = Math.max(0, Math.round(t));
  return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
};

export const num = (v: number, lang: Lang, digits = 1) => {
  const s = Number.isInteger(v) && digits === 0 ? String(v) : v.toFixed(digits);
  return lang === 'ru' ? s.replace('.', ',') : s;
};

export const css = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/** progress of sub-interval [a,b] within p */
export const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));

export const ease = (t: number) => 1 - Math.pow(1 - t, 3);
