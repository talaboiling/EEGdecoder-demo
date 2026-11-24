export type Lang = 'ru' | 'en';
export type L10n = { ru: string; en: string };

export type PageKind =
  | 'background' | 'near' | 'seizure' | 'false'
  | 'eyesOpen' | 'photic' | 'hv' | 'discharge' | 'blink';

export interface Page {
  t0: number;
  kind: PageKind;
  data: number[][]; // [channel][sample] µV at displayFs, 10 s
}

export type Side = 'right' | 'left' | 'bilateral' | 'generalized';

export interface DetEvent {
  start: number;
  end: number;
  peak: number;
  channels: string[];
  side: Side;
  match: boolean; // overlaps expert annotation
  doubtful?: boolean; // unmatched but adjacent to an expert event (e.g. post-ictal)
  note?: L10n; // program's guess for unmatched events
}

export interface Background {
  alphaPeakHz: number;
  alphaAmpUv: number;
  asymmetryPct: number;
  slowFastRatio: number;
  windowS: [number, number];
  reactivity: boolean | null; // null = not tested
}

export interface FunctionalTests {
  eyes: boolean;
  photic: boolean;
  hv: boolean;
}

export type Profile = 'focalSeizure' | 'normal' | 'absence';

export interface Study {
  id: string;
  file: string;
  sizeMb: number;
  source: 'real' | 'synthetic';
  profile: Profile;
  fs: number;
  displayFs: number;
  nativeChannels: number;
  durationS: number;
  channels: string[];
  patient: { code: string; age: number; sex: 'm' | 'f' };
  recorded: string;
  indication: L10n;
  expertNote: L10n;
  expert: { start: number; end: number }[];
  events: DetEvent[];
  score: number[]; // detector z-score per second
  threshold: number;
  background: Background;
  tests: FunctionalTests;
  pages: Page[];
  stats: { detected: boolean | null; latencyS: number | null; falseAlarms: number; falsePerHour: number };
  citation?: { text: string; url: string };
}
