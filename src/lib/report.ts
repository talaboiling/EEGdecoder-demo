// Rule-based draft report (no ML). Each sentence keeps the rule that produced
// it and the evidence it rests on, so the UI can show how it was generated.
import type { DetEvent, Lang, Side, Study } from '../data/types';
import { mmss, num } from './format';

export interface Evidence { label: string; t?: number }
export interface Sentence { text: string; rule: string; evidence: Evidence[] }
export interface Section { key: 'background' | 'tests' | 'pathology' | 'conclusion'; title: string; sentences: Sentence[] }
export interface Report { sections: Section[]; verdict: 'normal' | 'abnormal' }

const SIDE: Record<Lang, Record<Side, string>> = {
  ru: { right: 'преимущественно справа', left: 'преимущественно слева', bilateral: 'билатерально', generalized: 'генерализованно' },
  en: { right: 'right-predominant', left: 'left-predominant', bilateral: 'bilateral', generalized: 'generalized' },
};

export function mainSide(ev: DetEvent[]): Side {
  const c: Record<string, number> = {};
  ev.forEach((e) => (c[e.side] = (c[e.side] ?? 0) + 1));
  return (Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] as Side) ?? 'bilateral';
}

export function topChannels(ev: DetEvent[], n = 4) {
  const c = new Map<string, number>();
  ev.forEach((e) => e.channels.forEach((ch) => c.set(ch, (c.get(ch) ?? 0) + 1)));
  return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
}

export function generateReport(s: Study, L: Lang): Report {
  const ru = L === 'ru';
  const b = s.background;
  const hit = s.events.filter((e) => e.match);
  const other = s.events.filter((e) => !e.match && !e.doubtful);
  const doubt = s.events.filter((e) => e.doubtful);
  const sections: Section[] = [];
  const bgEv: Evidence[] = [
    { label: (ru ? 'α-пик ' : 'α peak ') + num(b.alphaPeakHz, L) + (ru ? ' Гц' : ' Hz') },
    { label: (ru ? 'медл./быстр. ' : 'slow/fast ') + num(b.slowFastRatio, L, 2) },
    { label: (ru ? 'асимметрия ' : 'asymmetry ') + b.asymmetryPct + ' %' },
  ];

  // 1. Background
  const bg: Sentence[] = [];
  if (b.alphaPeakHz <= 8 && b.slowFastRatio > 3) {
    bg.push({
      text: ru
        ? `Чёткий альфа-ритм не выделяется; преобладает медленная активность (отношение медленных ритмов к быстрым ${num(b.slowFastRatio, L, 2)}).`
        : `No clear alpha rhythm; slow activity predominates (slow-to-fast ratio ${num(b.slowFastRatio, L, 2)}).`,
      rule: ru ? 'α-пик ≤ 8 Гц и медл./быстр. > 3 → «альфа-ритм не выделяется»' : 'α peak ≤ 8 Hz and slow/fast > 3 → “no clear alpha rhythm”',
      evidence: bgEv,
    });
    bg.push({
      text: ru ? 'Состояние пациента (бодрствование/сон) в файле не отмечено — уточнить по видео.' : 'Patient state (awake/asleep) is not annotated in the file; verify against video.',
      rule: ru ? 'нет меток сна/бодрствования в аннотациях EDF' : 'no sleep/wake labels in EDF annotations',
      evidence: [{ label: ru ? 'аннотации EDF' : 'EDF annotations' }],
    });
  } else {
    const age = s.patient.age < 18 ? (ru ? `, соответствует возрасту (${s.patient.age} лет)` : `, appropriate for age (${s.patient.age} y)`) : '';
    bg.push({
      text: ru
        ? `Альфа-ритм частотой ${num(b.alphaPeakHz, L)} Гц, амплитудой до ${b.alphaAmpUv} мкВ, преобладает в затылочных отведениях${age}; межполушарная асимметрия ${b.asymmetryPct} % (в пределах нормы).`
        : `Alpha rhythm ${num(b.alphaPeakHz, L)} Hz, up to ${b.alphaAmpUv} µV, occipital-predominant${age}; interhemispheric asymmetry ${b.asymmetryPct} % (within normal limits).`,
      rule: ru ? 'α-пик 8–13 Гц в задних отведениях, асимметрия < 50 % → «альфа-ритм сохранён»' : 'posterior α peak 8–13 Hz, asymmetry < 50 % → “alpha rhythm preserved”',
      evidence: bgEv,
    });
    bg.push({
      text: ru ? `Медленная активность не выражена (отношение медленных ритмов к быстрым ${num(b.slowFastRatio, L, 2)}).` : `Slow activity is not prominent (slow-to-fast ratio ${num(b.slowFastRatio, L, 2)}).`,
      rule: ru ? 'медл./быстр. < 2,5 → «медленная активность не выражена»' : 'slow/fast < 2.5 → “no prominent slowing”',
      evidence: [bgEv[1]],
    });
  }
  sections.push({ key: 'background', title: ru ? 'Фоновая активность' : 'Background activity', sentences: bg });

  // 2. Functional tests
  const ts: Sentence[] = [];
  const pageT = (k: string) => s.pages.find((p) => p.kind === k)?.t0;
  if (!s.tests.eyes && !s.tests.photic && !s.tests.hv) {
    ts.push({
      text: ru ? 'В файле не отмечены.' : 'Not annotated in the file.',
      rule: ru ? 'нет меток проб в аннотациях EDF' : 'no procedure markers in EDF annotations',
      evidence: [{ label: ru ? 'аннотации EDF' : 'EDF annotations' }],
    });
  } else {
    if (s.tests.eyes) ts.push({
      text: ru ? 'Проба открывания глаз: депрессия альфа-ритма, реакция сохранена.' : 'Eye opening: alpha attenuation, reactivity preserved.',
      rule: ru ? 'подавление α-мощности после метки «глаза открыты» > 50 %' : 'α power drop after “eyes open” marker > 50 %',
      evidence: [{ label: ru ? 'метка «глаза открыты»' : '“eyes open” marker', t: pageT('eyesOpen') ?? pageT('background') }],
    });
    if (s.tests.photic) ts.push({
      text: s.profile === 'normal'
        ? (ru ? 'Ритмическая фотостимуляция: реакция усвоения ритма на частоте 10 Гц, без пароксизмальных изменений.' : 'Photic stimulation: photic driving at 10 Hz, no paroxysmal response.')
        : (ru ? 'Ритмическая фотостимуляция: пароксизмальных реакций не выявлено.' : 'Photic stimulation: no photoparoxysmal response.'),
      rule: ru ? 'пик спектра на частоте вспышек в задних отведениях; нет событий детектора' : 'posterior spectral peak at flash rate; no detector events',
      evidence: [{ label: ru ? 'метки фотостимуляции' : 'photic markers', t: pageT('photic') }],
    });
    if (s.tests.hv) {
      const hvHit = hit.find((e) => s.profile === 'absence' && e.start >= 780 && e.start <= 960);
      ts.push({
        text: hvHit
          ? (ru ? `Гипервентиляция: диффузное замедление; с ${mmss(hvHit.start)} по ${mmss(hvHit.end)} спровоцирован генерализованный разряд.` : `Hyperventilation: diffuse slowing; a generalized discharge was provoked at ${mmss(hvHit.start)}–${mmss(hvHit.end)}.`)
          : (ru ? 'Гипервентиляция: умеренное диффузное замедление без пароксизмальных изменений.' : 'Hyperventilation: mild diffuse slowing without paroxysmal changes.'),
        rule: hvHit
          ? (ru ? 'событие детектора внутри интервала пробы → «спровоцирован»' : 'detector event inside procedure interval → “provoked”')
          : (ru ? 'рост δ/θ-мощности на пробе, нет событий детектора' : 'δ/θ power rises during procedure, no detector events'),
        evidence: [{ label: ru ? 'метки гипервентиляции' : 'HV markers', t: hvHit?.start ?? pageT('hv') }],
      });
    }
  }
  sections.push({ key: 'tests', title: ru ? 'Функциональные пробы' : 'Activation procedures', sentences: ts });

  // 3. Pathology
  const pt: Sentence[] = [];
  const chans = topChannels(hit).join(', ');
  if (hit.length && s.profile === 'focalSeizure') {
    const a = Math.min(...hit.map((e) => e.start)), z = Math.max(...hit.map((e) => e.end));
    pt.push({
      text: ru
        ? `С ${mmss(a)} по ${mmss(z)} от начала записи регистрируется ритмическая активность с вовлечением отведений ${chans} (${SIDE.ru[mainSide(hit)]}), по характеру — электрографический приступ.`
        : `From ${mmss(a)} to ${mmss(z)} rhythmic activity involving ${chans} (${SIDE.en[mainSide(hit)]}), consistent with an electrographic seizure.`,
      rule: ru ? 'z > порога ≥ 10 с, эволюция частоты/амплитуды, слияние соседних событий → «электрографический приступ»' : 'z above threshold ≥ 10 s, evolving frequency/amplitude, adjacent events merged → “electrographic seizure”',
      evidence: hit.map((e) => ({ label: `${mmss(e.start)}–${mmss(e.end)} · z ${num(e.peak, L)}`, t: e.start })),
    });
  } else if (hit.length && s.profile === 'absence') {
    const durs = hit.map((e) => e.end - e.start);
    pt.push({
      text: ru
        ? `Зарегистрированы ${hit.length} генерализованных разряда комплексов «пик–медленная волна» частотой 3 Гц длительностью ${Math.min(...durs)}–${Math.max(...durs)} с, с максимумом в лобно-центральных отведениях (${chans}): ${hit.map((e) => mmss(e.start) + '–' + mmss(e.end)).join(', ')}.`
        : `${hit.length} generalized 3 Hz spike-and-wave discharges lasting ${Math.min(...durs)}–${Math.max(...durs)} s, fronto-central maximum (${chans}): ${hit.map((e) => mmss(e.start) + '–' + mmss(e.end)).join(', ')}.`,
      rule: ru ? 'периодичность 2,5–4 Гц, синхронно во всех отведениях, острый компонент + медленная волна → «пик–медленная волна»' : '2.5–4 Hz periodicity, synchronous in all leads, sharp + slow component → “spike-and-wave”',
      evidence: hit.map((e) => ({ label: `${mmss(e.start)}–${mmss(e.end)} · z ${num(e.peak, L)}`, t: e.start })),
    });
  } else {
    pt.push({
      text: ru ? 'Эпилептиформная активность не зарегистрирована.' : 'No epileptiform activity recorded.',
      rule: ru ? 'нет событий с эпилептиформным паттерном' : 'no events with an epileptiform pattern',
      evidence: [{ label: ru ? 'детектор, вся запись' : 'detector, whole record' }],
    });
  }
  doubt.forEach((e) => pt.push({
    text: ru
      ? `Эпизод ${mmss(e.start)}–${mmss(e.end)} следует непосредственно за приступом — ${e.note?.ru ?? 'генез неясен'}; требует просмотра врачом.`
      : `The episode at ${mmss(e.start)}–${mmss(e.end)} directly follows the seizure (${e.note?.en ?? 'unclear origin'}); needs physician review.`,
    rule: ru ? 'событие выше порога в пределах 60 с после окончания приступа → «сомнительное, вероятно постиктальное»' : 'above-threshold event within 60 s after seizure end → “doubtful, likely post-ictal”',
    evidence: [{ label: `${mmss(e.start)}–${mmss(e.end)} · z ${num(e.peak, L)}`, t: e.start }],
  }));
  if (other.length) pt.push({
    text: ru
      ? `${doubt.length ? 'Ещё ' : ''}${other.length} ${other.length === 1 ? 'эпизод отмечен' : other.length < 5 ? 'эпизода отмечены' : 'эпизодов отмечены'} программой как ${other.length === 1 ? 'сомнительный' : 'сомнительные'} (${other[0].note?.ru ?? 'артефакт'}) — требуют просмотра врачом.`
      : `${other.length} more episode${other.length === 1 ? ' was' : 's were'} flagged as doubtful (${other[0].note?.en ?? 'artifact'}) and need physician review.`,
    rule: ru ? 'высокочастотная мощность или лобная локализация без эволюции → «вероятный артефакт»' : 'high-frequency power or frontal-only without evolution → “probable artifact”',
    evidence: other.map((e) => ({ label: mmss(e.start), t: e.start })),
  });
  sections.push({ key: 'pathology', title: ru ? 'Патологическая активность' : 'Abnormal activity', sentences: pt });

  // 4. Conclusion
  const verdict = hit.length ? 'abnormal' : 'normal';
  const concl = s.profile === 'focalSeizure' && hit.length
    ? (ru ? 'ЭЭГ с отклонениями от нормы: зарегистрирован электрографический приступ.' : 'Abnormal EEG: an electrographic seizure was recorded.')
    : s.profile === 'absence' && hit.length
      ? (ru ? 'ЭЭГ с отклонениями от нормы: генерализованная эпилептиформная активность (комплексы «пик–медленная волна» 3 Гц), провоцируемая гипервентиляцией. Паттерн характерен для абсансной эпилепсии — сопоставить с клинической картиной.' : 'Abnormal EEG: generalized epileptiform activity (3 Hz spike-and-wave), provoked by hyperventilation. The pattern is typical of absence epilepsy; correlate clinically.')
      : (ru ? 'ЭЭГ в пределах нормы. Эпилептиформной активности не выявлено.' : 'Normal EEG. No epileptiform activity.');
  sections.push({
    key: 'conclusion', title: ru ? 'Заключение (черновик)' : 'Conclusion (draft)',
    sentences: [{
      text: concl,
      rule: ru ? 'итог по разделам: есть подтверждённая патологическая активность → «с отклонениями»' : 'summary of sections: confirmed abnormal activity → “abnormal”',
      evidence: [{ label: ru ? 'разделы 1–3' : 'sections 1–3' }],
    }],
  });
  return { sections, verdict };
}

export const reportText = (r: Report) =>
  r.sections.map((s) => s.title.toUpperCase() + '\n' + s.sentences.map((x) => x.text).join(' ')).join('\n\n');
