import type { DetEvent, Page, PageKind, Side, Study } from './types';
import { CHANNELS, synthPage, synthScore, type PageSpec } from './synth';

export interface StudyMeta {
  id: string;
  file: string;
  sizeMb: number;
  source: Study['source'];
  profile: Study['profile'];
  patient: Study['patient'];
  durationS: number;
  title: { ru: string; en: string };
  tag: { ru: string; en: string };
}

export const LIBRARY: StudyMeta[] = [
  {
    id: 'pn00', file: 'PN00-1.edf', sizeMb: 78, source: 'real', profile: 'focalSeizure',
    patient: { code: 'PN00', age: 55, sex: 'm' }, durationS: 2625,
    title: { ru: 'Фокальный приступ, правая височная доля', en: 'Focal seizure, right temporal lobe' },
    tag: { ru: 'Реальная запись · Siena Scalp EEG', en: 'Real recording · Siena Scalp EEG' },
  },
  {
    id: 'n01', file: 'DEMO-N01.edf', sizeMb: 48, source: 'synthetic', profile: 'normal',
    patient: { code: 'DEMO-N01', age: 34, sex: 'f' }, durationS: 1200,
    title: { ru: 'Рутинная ЭЭГ взрослого, норма', en: 'Routine adult EEG, normal' },
    tag: { ru: 'Имитация · по образцу нормы', en: 'Simulated · normal pattern' },
  },
  {
    id: 'a01', file: 'DEMO-A01.edf', sizeMb: 60, source: 'synthetic', profile: 'absence',
    patient: { code: 'DEMO-A01', age: 9, sex: 'f' }, durationS: 1500,
    title: { ru: 'Абсансы у ребёнка, разряды 3 Гц', en: 'Childhood absences, 3 Hz discharges' },
    tag: { ru: 'Имитация · по образцу абсансной эпилепсии', en: 'Simulated · absence epilepsy pattern' },
  },
];

const RU_SIDE: Record<string, Side> = { 'справа': 'right', 'слева': 'left', 'билатерально': 'bilateral' };
const RU_KIND: Record<string, PageKind> = {
  'Фон (до приступа)': 'background', 'Около приступа': 'near',
  'Приступ (разметка эксперта)': 'seizure', 'Ложная тревога детектора': 'false',
};

/* eslint-disable @typescript-eslint/no-explicit-any */
async function loadPn00(): Promise<Study> {
  const res = await fetch('data/pn00-1.json');
  if (!res.ok) throw new Error('data');
  const d: any = await res.json();
  const events: DetEvent[] = d.events.map((e: any) => ({
    start: e.start, end: e.end, peak: e.peak, channels: e.channels, side: RU_SIDE[e.side] ?? 'bilateral', match: e.match,
    note: e.match ? undefined : e.side === 'справа'
      ? { ru: 'вероятно, движение или миограмма', en: 'likely movement or muscle artifact' }
      : { ru: 'неясный генез, просмотр врачом', en: 'unclear origin, needs review' },
  }));
  const pages: Page[] = d.pages.map((p: any) => ({ t0: p.t0, kind: RU_KIND[p.label] ?? 'near', data: p.data })).sort((x: Page, y: Page) => x.t0 - y.t0);
  const b = d.background;
  return {
    id: 'pn00', file: d.file, sizeMb: 78, source: 'real', profile: 'focalSeizure',
    fs: d.fs, displayFs: d.display_fs, nativeChannels: 0, durationS: d.duration_s, channels: d.channels,
    patient: { code: 'PN00', age: 55, sex: 'm' }, recorded: 'Siena Scalp EEG DB',
    indication: {
      ru: 'Фокальные приступы с нарушением сознания, височная доля справа (по данным базы)',
      en: 'Focal impaired-awareness seizures, right temporal lobe (per database)',
    },
    expertNote: { ru: 'Экспертная разметка приступа из базы: 19:03–20:13', en: 'Expert seizure annotation from the database: 19:03–20:13' },
    expert: [d.result.expert], events, score: d.score, threshold: d.threshold,
    background: { alphaPeakHz: b.alpha_peak_hz, alphaAmpUv: b.alpha_amp_uv, asymmetryPct: b.asymmetry_pct, slowFastRatio: b.slow_fast_ratio, windowS: b.window_s, reactivity: null },
    tests: { eyes: false, photic: false, hv: false },
    pages,
    stats: { detected: d.result.detected, latencyS: d.result.latency_s, falseAlarms: d.result.false_alarms, falsePerHour: d.result.false_per_hour },
    citation: { text: 'Detti P. et al., Siena Scalp EEG Database, PhysioNet, 2020 (v1.0.0)', url: 'https://physionet.org/content/siena-scalp-eeg/1.0.0/' },
  };
}

function build(meta: StudyMeta, o: {
  fs: number; native: number; recorded: string; indication: Study['indication']; expertNote: Study['expertNote'];
  expert: Study['expert']; events: DetEvent[]; background: Study['background']; tests: Study['tests'];
  pages: { t0: number; kind: PageKind; spec: PageSpec }[]; stats: Study['stats']; seed: number;
}): Study {
  return {
    id: meta.id, file: meta.file, sizeMb: meta.sizeMb, source: meta.source, profile: meta.profile,
    fs: o.fs, displayFs: 128, nativeChannels: o.native, durationS: meta.durationS, channels: CHANNELS,
    patient: meta.patient, recorded: o.recorded, indication: o.indication, expertNote: o.expertNote,
    expert: o.expert, events: o.events, threshold: 4,
    score: synthScore(meta.durationS, o.events, o.seed),
    background: o.background, tests: o.tests,
    pages: o.pages.map((p, i) => ({ t0: p.t0, kind: p.kind, data: synthPage(p.spec, o.seed * 31 + i) })),
    stats: o.stats,
  };
}

function normal(): Study {
  const base = { alphaUv: 42, alphaHz: 10.2, asym: 0.94 };
  return build(LIBRARY[1], {
    fs: 500, native: 21, recorded: '2026-10-14', seed: 11,
    indication: { ru: 'Головные боли напряжения; исключить эпилептиформную активность', en: 'Tension headaches; rule out epileptiform activity' },
    expertNote: { ru: 'Имитация нормальной рутинной ЭЭГ взрослого. По разметке эпилептиформной активности нет.', en: 'Simulated normal routine adult EEG. No epileptiform activity in the annotation.' },
    expert: [],
    events: [{
      start: 951, end: 958, peak: 6.8, channels: ['F7–T3', 'F8–T4', 'T3–T5', 'T4–T6'], side: 'bilateral', match: false,
      note: { ru: 'вероятно, мышечный артефакт (жевание)', en: 'likely muscle artifact (chewing)' },
    }],
    background: { alphaPeakHz: 10.2, alphaAmpUv: 38, asymmetryPct: 6, slowFastRatio: 0.72, windowS: [60, 360], reactivity: true },
    tests: { eyes: true, photic: true, hv: true },
    pages: [
      { t0: 60, kind: 'background', spec: base },
      { t0: 200, kind: 'eyesOpen', spec: { ...base, eyesOpenAt: 3.5, blinks: [3.6, 6.4, 8.9] } },
      { t0: 300, kind: 'blink', spec: { ...base, alphaUv: 8, blinks: [1.2, 2.9, 4.1, 6.6, 8.2] } },
      { t0: 480, kind: 'photic', spec: { ...base, photicHz: 10 } },
      { t0: 720, kind: 'hv', spec: { ...base, slowUv: 16 } },
      { t0: 950, kind: 'false', spec: { ...base, muscle: [[1, 8]] } },
    ],
    stats: { detected: null, latencyS: null, falseAlarms: 1, falsePerHour: 3 },
  });
}

function absence(): Study {
  const base = { alphaUv: 50, alphaHz: 8.8, asym: 1.03 };
  const gen = ['Fp1–F3', 'Fp2–F4', 'F3–C3', 'F4–C4'];
  return build(LIBRARY[2], {
    fs: 500, native: 21, recorded: '2026-11-03', seed: 23,
    indication: { ru: 'Эпизоды «замирания» до 10 раз в день, подозрение на абсансы', en: 'Staring spells up to 10 times a day, suspected absences' },
    expertNote: { ru: 'Имитация детской абсансной эпилепсии: 3 разряда «пик–медленная волна» 3 Гц, один при гипервентиляции.', en: 'Simulated childhood absence epilepsy: 3 generalized 3 Hz spike-and-wave discharges, one during hyperventilation.' },
    expert: [{ start: 512, end: 519 }, { start: 846, end: 855 }, { start: 1231, end: 1235 }],
    events: [
      { start: 300, end: 304, peak: 5.1, channels: ['Fp1–F7', 'Fp2–F8', 'Fp1–F3', 'Fp2–F4'], side: 'bilateral', match: false, note: { ru: 'вероятно, серия морганий', en: 'likely a run of eye blinks' } },
      { start: 513, end: 519, peak: 24.5, channels: gen, side: 'generalized', match: true },
      { start: 846, end: 855, peak: 31.2, channels: gen, side: 'generalized', match: true },
      { start: 1231, end: 1235, peak: 19.8, channels: gen, side: 'generalized', match: true },
    ],
    background: { alphaPeakHz: 8.8, alphaAmpUv: 46, asymmetryPct: 4, slowFastRatio: 1.9, windowS: [60, 360], reactivity: true },
    tests: { eyes: true, photic: true, hv: true },
    pages: [
      { t0: 120, kind: 'background', spec: base },
      { t0: 298, kind: 'false', spec: { ...base, alphaUv: 10, blinks: [2.3, 3.0, 3.8, 4.6, 5.5] } },
      { t0: 510, kind: 'discharge', spec: { ...base, swd: [[2, 9]] } },
      { t0: 800, kind: 'hv', spec: { ...base, slowUv: 34 } },
      { t0: 845, kind: 'discharge', spec: { ...base, slowUv: 20, swd: [[1, 10]] } },
      { t0: 1228, kind: 'discharge', spec: { ...base, swd: [[3, 7]] } },
    ],
    stats: { detected: true, latencyS: 1, falseAlarms: 1, falsePerHour: 2.4 },
  });
}

const cache = new Map<string, Promise<Study>>();
export function loadStudy(id: string): Promise<Study> {
  if (!cache.has(id)) {
    const p = id === 'pn00' ? loadPn00() : Promise.resolve(id === 'n01' ? normal() : absence());
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return cache.get(id)!;
}
