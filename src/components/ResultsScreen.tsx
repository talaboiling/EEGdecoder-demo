import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import clsx from 'clsx';
import Select from './Select';
import type { Study } from '../data/types';
import { PAGE_LABEL, useI18n } from '../i18n';
import { mmss, num } from '../lib/format';
import { psd } from '../lib/spectrum';
import { generateReport, mainSide, topChannels, type Section } from '../lib/report';
import { useReveal } from '../lib/useCanvas';
import EEGCanvas, { type Band } from './EEGCanvas';
import Timeline from './Timeline';
import Spectrum from './Spectrum';
import type { HeaderInfo } from './stages/Stages';

interface Props { study: Study; header: HeaderInfo; onNew: () => void }

const fade = (i: number) => ({ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.06 * i, duration: 0.3 } });

export function Legend({ doubt = true }: { doubt?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="legend">
      <span><i className="sw expert" />{t.lgExpert}</span>
      <span><i className="sw hit" />{t.lgHit}</span>
      <span><i className="sw false" />{t.lgFalse}</span>
      {doubt && <span><i className="sw doubt" />{t.lgDoubt}</span>}
      <span><i className="sw thr" />{t.lgThr}</span>
    </div>
  );
}

export default function ResultsScreen({ study: s, header, onNew }: Props) {
  const { t, lang } = useI18n();
  const ru = lang === 'ru';
  const firstInteresting = Math.max(0, s.pages.findIndex((p) => p.kind === 'seizure' || p.kind === 'discharge'));
  const [cur, setCur] = useState(firstInteresting);
  const [gain, setGain] = useState(150);
  const report = useMemo(() => generateReport(s, lang), [s, lang]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [doc, setDoc] = useState('');
  const [signed, setSigned] = useState<{ name: string; at: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const page = s.pages[cur];
  const reveal = useReveal(cur + ':' + gain, 550);
  const bg = s.pages.find((p) => p.kind === 'background') ?? s.pages[0];
  const sp = useMemo(() => psd(bg, s.channels, s.displayFs), [bg, s]);
  const hit = s.events.filter((e) => e.match);
  const bands: Band[] = [
    ...s.expert.map((e) => ({ start: e.start, end: e.end, kind: 'expert' as const })),
    ...s.events.map((e) => ({ start: e.start, end: e.end, kind: 'event' as const })),
  ];

  const goT = (time: number) => {
    let best = 0, d = Infinity;
    s.pages.forEach((p, i) => { const dd = time >= p.t0 && time < p.t0 + 10 ? -1 : Math.abs(p.t0 + 5 - time); if (dd < d) { d = dd; best = i; } });
    setCur(best);
    document.getElementById('viewer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const secText = (sec: Section) => edits[sec.key] ?? sec.sentences.map((x) => x.text).join(' ');
  const fullText = () => report.sections.map((sec) => sec.title.toUpperCase() + '\n' + secText(sec)).join('\n\n');
  const copy = async () => {
    try { await navigator.clipboard.writeText(fullText()); setCopied(true); toast.success(t.copied); setTimeout(() => setCopied(false), 1600); } catch { toast.error(ru ? 'Буфер обмена недоступен — выделите текст вручную.' : 'Clipboard unavailable — select the text manually.'); }
  };

  const side = mainSide(hit.length ? hit : s.events);
  const sideTxt = { ru: { right: 'Справа', left: 'Слева', bilateral: 'Билатерально', generalized: 'Генерализованно' }, en: { right: 'Right', left: 'Left', bilateral: 'Bilateral', generalized: 'Generalized' } }[lang][side];

  const range = (a: number, z: number) => `${mmss(a)}–${mmss(z)}`;
  const conclusion = report.sections.find((x) => x.key === 'conclusion')!;
  const conclText = secText(conclusion);
  const plural = (n: number, f: [string, string, string]) => f[n % 10 === 1 && n % 100 !== 11 ? 0 : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 1 : 2];
  const finding = hit.length
    ? s.profile === 'absence'
      ? { v: ru ? 'Разряды «пик–волна» 3 Гц' : '3 Hz spike-and-wave', sub: ru ? `${hit.length} ${plural(hit.length, ['эпизод', 'эпизода', 'эпизодов'])}, провоцируются ГВ` : `${hit.length} episodes, provoked by HV` }
      : { v: ru ? 'Электрографический приступ' : 'Electrographic seizure', sub: range(Math.min(...hit.map((e) => e.start)), Math.max(...hit.map((e) => e.end))) }
    : { v: ru ? 'Эпилептиформной активности нет' : 'No epileptiform activity', sub: ru ? 'по всей записи' : 'whole record' };
  const facts = [
    { k: t.mainFinding, v: finding.v, sub: finding.sub },
    { k: t.tileSide, v: hit.length ? sideTxt : '—', sub: hit.length ? topChannels(hit, 3).join(', ') : t.noneShort },
    s.background.alphaPeakHz <= 8 && s.background.slowFastRatio > 3
      ? { k: t.tileRhythm, v: t.slowBg, sub: `${t.noAlpha} · ${t.slowFast.toLowerCase()} ${num(s.background.slowFastRatio, lang, 2)}` }
      : { k: t.tileRhythm, v: `α ${num(s.background.alphaPeakHz, lang)} ${t.hz}`, sub: `${s.background.alphaAmpUv} ${t.uv} · ${t.reactivity.toLowerCase()}: ${s.background.reactivity ? t.preserved : t.notTested}` },
  ];

  const detTiles = [
    s.expert.length
      ? { k: t.tileExpert, v: s.stats.detected ? t.found : t.missed, sub: s.stats.latencyS !== null ? t.latency(s.stats.latencyS) : '' }
      : { k: t.tileExpert, v: '—', sub: t.noneShort },
    { k: t.tileFalse, v: `${s.stats.falseAlarms} ${t.perRecord}`, sub: t.perHour(num(s.stats.falsePerHour, lang, s.stats.falsePerHour % 1 ? 1 : 0)), warn: s.stats.falsePerHour > 5 },
    { k: t.tileThr, v: `z > ${s.threshold}`, sub: t.thrNote },
  ];

  // group contiguous pages into episodes
  const groups: number[][] = [];
  s.pages.forEach((p, i) => {
    const g = groups[groups.length - 1];
    if (g && p.t0 - s.pages[g[g.length - 1]].t0 <= 10) g.push(i); else groups.push([i]);
  });
  const gi = groups.findIndex((g) => g.includes(cur));
  const group = groups[gi];
  const groupLabel = (g: number[]) => {
    const kinds = g.map((i) => s.pages[i].kind);
    const k = kinds.find((x) => x === 'seizure' || x === 'discharge') ?? kinds[0];
    return PAGE_LABEL[lang][k];
  };
  const step = (d: -1 | 1) => setCur((c) => Math.min(s.pages.length - 1, Math.max(0, c + d)));

  const validation = s.profile === 'focalSeizure' ? (ru ? [
    ['Работает:', 'программа читает настоящий EDF, строит монтаж на 16 электродах и находит отмеченный экспертом приступ с правильной стороной.'],
    ['Слабое место — ложные тревоги.', 'Почти все они в правых отведениях: вероятно, это движения и мышечные артефакты пациента в постели. Отличать их от приступов должна обученная модель (этап 1, базы TUH).'],
    ['Фон:', 'чёткого альфа-ритма нет, преобладают медленные ритмы. Состояние (сон или бодрствование) в файле не отмечено — без видео или пометок врача программа не может решить, норма это для сна или нет.'],
    ['Следующий шаг:', 'прогнать все 14 пациентов базы (47 приступов), посчитать чувствительность и ложные тревоги в час, затем — запись с вашего аппарата.'],
  ] : [
    ['Works:', 'the program reads a real EDF, builds the 16-electrode montage and finds the expert-marked seizure on the correct side.'],
    ['Weak spot: false alarms.', 'Almost all are in right-sided leads, likely patient movement and muscle artifacts in bed. Telling them from seizures needs a trained model (stage 1, TUH corpora).'],
    ['Background:', 'no clear alpha rhythm; slow rhythms predominate. Sleep/wake state is not annotated, so the program cannot judge whether this is normal for sleep.'],
    ['Next step:', 'run all 14 patients (47 seizures), compute sensitivity and false alarms per hour, then a recording from your device.'],
  ]) : s.profile === 'normal' ? (ru ? [
    ['Норма распознаётся:', 'альфа-ритм, реакция на открывание глаз, усвоение ритма при фотостимуляции и умеренное замедление при гипервентиляции описаны правилами без ошибок.'],
    ['Ложная тревога:', 'мышечный артефакт жевания в височных отведениях превысил порог. Отличать миограмму от ритмической активности — задача модели этапа 1.'],
    ['Ограничение:', 'запись синтетическая, построена по образцу типичной нормы для проверки шаблонов текста.'],
  ] : [
    ['Normal is recognized:', 'alpha rhythm, eye-opening reactivity, photic driving and mild hyperventilation slowing are described by rules without errors.'],
    ['False alarm:', 'a chewing muscle artifact in temporal leads crossed the threshold. Separating EMG from rhythmic activity is a stage 1 model task.'],
    ['Limitation:', 'the recording is synthetic, built from a typical normal pattern to test text templates.'],
  ]) : (ru ? [
    ['Разряды найдены:', 'все 3 генерализованных разряда «пик–медленная волна» обнаружены, включая спровоцированный гипервентиляцией.'],
    ['Ложная тревога:', 'серия морганий в лобных отведениях. Правило лобной локализации без эволюции пометило её как сомнительную.'],
    ['Ограничение:', 'запись синтетическая, построена по образцу детской абсансной эпилепсии для проверки шаблонов текста.'],
  ] : [
    ['Discharges found:', 'all 3 generalized spike-and-wave discharges detected, including the one provoked by hyperventilation.'],
    ['False alarm:', 'a run of eye blinks in frontal leads. The frontal-only rule flagged it as doubtful.'],
    ['Limitation:', 'the recording is synthetic, built from a childhood absence epilepsy pattern to test text templates.'],
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <motion.section className="panel" {...fade(0)}>
        <div className="study-head">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <span className="eyebrow">{t.resultsTitle}</span>
            <h1>{s.file.replace('.edf', '')}</h1>
            <p className="muted">{s.indication[lang]}</p>
            <div className="facts muted">
              <span>ID: <b className="mono">{s.patient.code}</b></span>
              <span>{t.patient}: <b>{t.age(s.patient.age)}, {t.sex[s.patient.sex]}</b></span>
              <span>{t.duration}: <b className="mono">{mmss(s.durationS)}</b></span>
              <span>{t.fs}: <b>{s.fs} {t.hz}</b></span>
              <span>{t.montage}: <b>{t.montageVal}</b></span>
              {header.own && <span>{t.yourFile}: <b>{header.fileName}</b></span>}
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <span className="tag-out">{s.source === 'real' ? t.realBadge : t.synthBadge}</span>
            <button className="btn sm" type="button" onClick={onNew}>{t.newStudy}</button>
          </div>
        </div>
        <span className="muted small">{s.expertNote[lang]}</span>
      </motion.section>

      <motion.section className={clsx('panel summary', report.verdict)} aria-label={t.clinicalTitle} {...fade(1)}>
        <div className="sum-main">
          <span className="eyebrow">{t.clinicalTitle}</span>
          <span className={clsx('pill', report.verdict === 'normal' ? 'good' : 'bad')} style={{ alignSelf: 'flex-start' }}><span className="dot" />{t.verdict[report.verdict]}</span>
          <p className="sum-concl">{conclText}</p>
          <a className="small" href="#report" onClick={(e) => { e.preventDefault(); document.getElementById('report')?.scrollIntoView({ behavior: 'smooth' }); }}>{t.toReport}</a>
        </div>
        {facts.map((f) => (
          <div className="sum-fact" key={f.k}>
            <span className="muted lbl">{f.k}</span>
            <span className="val">{f.v}</span>
            <span className="muted sub">{f.sub}</span>
          </div>
        ))}
      </motion.section>

      <motion.section className="panel" {...fade(5)}>
        <div className="panel-h"><h2>{t.timeline}</h2><span className="time muted">{t.durationLbl} {mmss(s.durationS)}</span></div>
        <Legend />
        <Timeline study={s} marker={page.t0} onPick={goT} onStep={step} label={t.timeline} />
        <span className="muted small">{t.timelineHint}</span>
      </motion.section>

      <motion.section className="panel" id="viewer" {...fade(6)}>
        <div className="panel-h"><h2>{t.viewer}</h2><span className="time">{mmss(page.t0)} – {mmss(page.t0 + 10)} · {PAGE_LABEL[lang][page.kind]}</span></div>
        <div className="chips" role="group" aria-label={t.episodes}>
          {groups.map((g, k) => {
            const first = s.pages[g[0]], last = s.pages[g[g.length - 1]];
            const f = first.kind === 'false' && g.length === 1;
            return (
              <button key={k} type="button" className={clsx('chip', f && 'false')} aria-pressed={k === gi}
                onClick={() => setCur(g.find((i) => s.pages[i].kind === 'seizure' || s.pages[i].kind === 'discharge') ?? g[0])}>
                <span className="mono">{g.length > 1 ? range(first.t0, last.t0 + 10) : mmss(first.t0)}</span>{groupLabel(g)}
                {g.length > 1 && <span className="count">{t.pagesN(g.length)}</span>}
              </button>
            );
          })}
        </div>
        {group.length > 1 && (
          <div className="pages" role="group" aria-label={groupLabel(group)}>
            {group.map((i) => {
              const p = s.pages[i];
              return (
                <button key={i} type="button" className={clsx('pg', p.kind)} aria-pressed={i === cur} onClick={() => setCur(i)} aria-label={`${mmss(p.t0)} ${PAGE_LABEL[lang][p.kind]}`}>
                  <i /><span className="mono">{mmss(p.t0)}</span>
                </button>
              );
            })}
          </div>
        )}
        <div className="ctrl">
          <button className="btn sm" type="button" disabled={cur === 0} onClick={() => setCur(cur - 1)}>{t.prev}</button>
          <button className="btn sm" type="button" disabled={cur === s.pages.length - 1} onClick={() => setCur(cur + 1)}>{t.next}</button>
          <span className="time muted">{t.pageOf(cur + 1, s.pages.length)}</span>
          <label htmlFor="gain" className="muted small">{t.gain}</label>
          <Select id="gain" label={t.gain} value={gain} onChange={setGain} items={[70, 150, 300].map((g) => ({ value: g, label: `${g} ${t.perCh}` }))} />
          <span className="legend"><span><i className="sw expert" />{t.lgExpert}</span><span><i className="sw evsoft" />{t.eventsTitle}</span></span>
        </div>
        <EEGCanvas page={page} channels={s.channels} fs={s.displayFs} gain={gain} bands={bands} reveal={reveal} rowH={30} />
      </motion.section>

      <div className="cols">
        <motion.section className="panel" {...fade(7)}>
          <h2>{t.bgTitle}</h2>
          <Spectrum freqs={sp.freqs} power={sp.power} unit={t.hz} />
          <dl className="kv">
            <dt>{t.alphaPeak}</dt><dd>{num(s.background.alphaPeakHz, lang)} {t.hz}</dd>
            <dt>{ru ? 'Амплитуда α' : 'α amplitude'}</dt><dd>≈ {s.background.alphaAmpUv} {t.uv}</dd>
            <dt>{t.asym}</dt><dd>{s.background.asymmetryPct} %</dd>
            <dt>{t.slowFast}</dt><dd>{num(s.background.slowFastRatio, lang, 2)}</dd>
            <dt>{t.reactivity}</dt><dd>{s.background.reactivity === null ? t.notTested : t.preserved}</dd>
          </dl>
          <p className="muted small">{t.bgNote(mmss(s.background.windowS[0]), mmss(s.background.windowS[1]))}</p>
        </motion.section>
        <motion.section className="panel" {...fade(8)}>
          <div className="panel-h"><h2>{t.eventsTitle}</h2><span className="muted small">{s.events.length}</span></div>
          <div className="scroll">
            <table className="ev">
              <thead><tr><th>{t.colTime}</th><th>{t.colDur}</th><th>{t.colCh}</th><th>{t.colZ}</th><th>{t.colVerdict}</th></tr></thead>
              <tbody>
                {s.events.map((e) => (
                  <tr key={e.start} className="click" onClick={() => goT(e.start)} tabIndex={0} onKeyDown={(k) => k.key === 'Enter' && goT(e.start)}>
                    <td className="mono">{mmss(e.start)}</td>
                    <td className="mono">{e.end - e.start} {t.s}</td>
                    <td className="small">{e.channels.slice(0, 3).join(', ')}{e.note && <div className="muted">{e.note[lang]}</div>}</td>
                    <td className="mono">{num(e.peak, lang)}</td>
                    <td><span className={clsx('pill', e.match ? 'info' : e.doubtful ? 'neutral' : 'warn')}>{e.match ? t.vHit : e.doubtful ? t.vDoubt : t.vFalse}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.section>
      </div>

      <div className="cols">
        <motion.section className="panel" id="report" {...fade(9)}>
          <div className="panel-h">
            <h2>{t.reportTitle}</h2>
            <div className="row">
              <button className="btn sm" type="button" onClick={copy}>{copied ? t.copied : t.copy}</button>
            </div>
          </div>
          <div className="report">
            {report.sections.map((sec) => (
              <div key={sec.key} className={clsx('rsec', sec.key === 'conclusion' && 'concl')}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <h3>{sec.title}</h3>
                  {!signed && <button className="btn sm ghost" type="button" onClick={() => setEditing(editing === sec.key ? null : sec.key)}>{editing === sec.key ? t.done : t.edit}</button>}
                </div>
                {editing === sec.key ? (
                  <textarea id={'edit-' + sec.key} className="edit" value={secText(sec)} onChange={(e) => setEdits({ ...edits, [sec.key]: e.target.value })} />
                ) : edits[sec.key] !== undefined ? <p>{edits[sec.key]}</p> : (
                  <p>{sec.sentences.map((x, i) => (
                    <span key={i}>
                      <span className={clsx('sent click', focus === sec.key + i && 'focus')} onClick={() => setFocus(sec.key + i)} onKeyDown={(e) => e.key === 'Enter' && setFocus(sec.key + i)} role="button" tabIndex={0}>{x.text}</span>{' '}
                    </span>
                  ))}</p>
                )}
              </div>
            ))}
          </div>
          <div className="row" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            {signed ? (
              <>
                <motion.span className="stamp" initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}>
                  <b>{t.signed}</b><span>{signed.name} · {signed.at}</span>
                </motion.span>
                <button className="btn sm ghost" type="button" onClick={() => setSigned(null)}>{t.unsign}</button>
              </>
            ) : (
              <form className="row" style={{ flex: 1 }} onSubmit={(e) => { e.preventDefault(); if (doc.trim()) { setEditing(null); toast.success(t.approvedToast, { description: doc.trim() }); setSigned({ name: doc.trim(), at: new Date().toLocaleString(ru ? 'ru-RU' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' }) }); } }}>
                <input id="physician" className="txt" placeholder={t.physicianPh} value={doc} onChange={(e) => setDoc(e.target.value)} aria-label={t.physician} />
                <button className="btn primary" type="submit" disabled={!doc.trim()}>{t.sign}</button>
              </form>
            )}
          </div>
          <p className="muted small">{t.reportNote}</p>
        </motion.section>

        <motion.section className="panel" {...fade(10)}>
          <h2>{t.howBuilt}</h2>
          <p className="muted small">{ru ? 'Каждое предложение черновика получено правилом из измеренных показателей. Нажмите на предложение или основание, чтобы перейти к фрагменту ЭЭГ.' : 'Each draft sentence comes from a rule applied to measured values. Tap a sentence or its evidence to open the EEG page.'}</p>
          <div className="why">
            {report.sections.flatMap((sec) => sec.sentences.map((x, i) => (
              <div key={sec.key + i} className="why-item" style={focus === sec.key + i ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)' } : undefined} onMouseEnter={() => setFocus(sec.key + i)} onFocus={() => setFocus(sec.key + i)}>
                <span className="eyebrow">{sec.title}</span>
                <div className="rulecard"><b>{t.rule}:</b> {x.rule}</div>
                <div className="chips">
                  {x.evidence.map((ev) => ev.t !== undefined
                    ? <button key={ev.label} type="button" className="chip" onClick={() => goT(ev.t!)}><span className="mono">{ev.label}</span></button>
                    : <span key={ev.label} className="chip static"><span className="mono">{ev.label}</span></span>)}
                </div>
              </div>
            )))}
          </div>
        </motion.section>
      </div>

      <motion.section className="panel" {...fade(11)}>
        <div className="panel-h"><h2>{t.detectorCheck}</h2></div>
        <p className="muted small">{t.detectorLead}</p>
        <div className="det-tiles">
          {detTiles.map((x) => (
            <div className="det" key={x.k}>
              <span className="muted lbl">{x.k}</span>
              <span className="val">{x.v}</span>
              {x.sub && <span className={clsx('sub', 'warn' in x && x.warn ? 'warn' : 'muted')}>{x.sub}</span>}
            </div>
          ))}
        </div>
        <h3>{t.validTitle}</h3>
        <ul className="plain">{validation.map(([a, b]) => <li key={a}><strong>{a}</strong> {b}</li>)}</ul>
        {s.citation && <p className="muted small">{t.source}: <a href={s.citation.url} target="_blank" rel="noreferrer">{s.citation.text}</a></p>}
      </motion.section>
    </div>
  );
}
