import { useMemo } from 'react';
import type { Lang, Study } from '../../data/types';
import { useI18n, PAGE_LABEL } from '../../i18n';
import { ease, mmss, num, seg } from '../../lib/format';
import { psd, BANDS } from '../../lib/spectrum';
import { generateReport, mainSide, topChannels } from '../../lib/report';
import EEGCanvas, { type Band } from '../EEGCanvas';
import HeadMap from '../HeadMap';
import Timeline from '../Timeline';
import Spectrum from '../Spectrum';

export interface HeaderInfo {
  fileName: string; sizeMb: number; version: string; patient: string; recording: string;
  date: string; time: string; records: number; recDur: number; signals: number; fs: number; durationS: number;
  own: boolean;
}

export function headerFromStudy(s: Study): HeaderInfo {
  return {
    fileName: s.file, sizeMb: s.sizeMb, version: 'EDF+', own: false,
    patient: `${s.patient.code} ${s.patient.sex.toUpperCase()} X ${s.patient.age}`,
    recording: s.source === 'real' ? 'Startdate X X X Siena' : `Startdate ${s.recorded} X Kompakt-Neuro`,
    date: s.source === 'real' ? '—' : s.recorded.split('-').reverse().join('.').slice(0, 6) + s.recorded.slice(2, 4),
    time: s.source === 'real' ? '—' : '09.12.40',
    records: s.durationS, recDur: 1, signals: s.nativeChannels || s.channels.length, fs: s.fs, durationS: s.durationS,
  };
}

export interface StageProps { study: Study; p: number; header: HeaderInfo }

const Tick = ({ on }: { on: boolean }) => (
  <span className={'tick' + (on ? '' : ' wait')} aria-hidden>
    {on ? <svg width="11" height="11" viewBox="0 0 12 12"><path d="M2 6.5l2.5 2.5L10 3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg> : <span className="dot" style={{ width: 5, height: 5 }} />}
  </span>
);

/* 1 — EDF header */
export function StageHeader({ p, header: h }: StageProps) {
  const { t } = useI18n();
  const bytes = useMemo(() => {
    const pad = (s: string, n: number) => (s + ' '.repeat(n)).slice(0, n);
    return pad('0', 8) + pad(h.patient, 80) + pad(h.recording, 80) + pad(h.date, 8) + pad(h.time, 8) + pad(String(256 * (h.signals + 1)), 8) + pad(h.version === 'EDF+' ? 'EDF+C' : '', 44) + pad(String(h.records), 8) + pad(String(h.recDur), 8) + pad(String(h.signals), 4);
  }, [h]);
  const pos = Math.floor(seg(p, 0, 0.7) * bytes.length);
  const startRow = Math.max(0, Math.floor(pos / 16) - 4);
  const lines = Array.from({ length: 5 }, (_, i) => {
    const r = startRow + i, a = r * 16, chunk = bytes.slice(a, a + 16);
    if (!chunk) return '';
    const hex = [...chunk].map((ch) => ch.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
    return { off: a.toString(16).padStart(4, '0'), hex, asc: chunk.replace(/[^\x20-\x7e]/g, '.'), cur: pos >= a && pos < a + 16 };
  });
  const vals = [h.version, h.patient || '—', h.recording || '—', h.date || '—', h.time || '—', `${h.records} × ${h.recDur} ${t.s}`, String(h.signals), `${num(h.fs, 'en', 0)} ${t.hz}`];
  const shown = Math.floor(seg(p, 0.05, 0.75) * vals.length);
  return (
    <div className="two">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="hex" aria-hidden>
          {lines.map((l, i) => l ? <div key={i}>{l.off}  {l.cur ? <b>{l.hex}</b> : l.hex}  {l.asc}</div> : <div key={i}>&nbsp;</div>)}
        </div>
        <div className="hdr-table">
          {vals.map((v, i) => i < shown ? [<span className="k" key={'k' + i}>{t.hdrFields[i]}</span>, <span className="v" key={'v' + i}>{v}</span>] : null)}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="metric"><span className="muted small">{t.file}</span><span className="v" style={{ fontSize: 15, overflowWrap: 'anywhere' }}>{h.fileName}</span><span className="muted small">{h.sizeMb} {t.mb} · {mmss(h.durationS)}</span></div>
        <ul className="checks">
          {t.checks.map((c, i) => <li key={c}><Tick on={p > 0.55 + i * 0.1} />{c}</li>)}
        </ul>
      </div>
    </div>
  );
}

/* 2 — montage */
export function StageMontage({ study, p }: StageProps) {
  const { t } = useI18n();
  const pp = seg(p, 0.35, 0.95);
  const chains = [study.channels.slice(0, 4), study.channels.slice(4, 8), study.channels.slice(8, 12), study.channels.slice(12, 16)];
  const drawn = Math.floor(pp * study.channels.length + 0.0001);
  return (
    <div className="two" style={{ alignItems: 'center' }}>
      <HeadMap electrodes={ease(seg(p, 0, 0.35))} pairs={study.channels} pairsProgress={pp} caption="10–20" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="metrics">
          <div className="metric"><span className="v">{Math.round(19 * seg(p, 0, 0.35))}</span><span className="muted small">{t.electrodes}</span></div>
          <div className="metric"><span className="v">{drawn}</span><span className="muted small">{t.pairs}</span></div>
        </div>
        {chains.map((ch, ci) => (
          <div className="chips" key={ci}>
            {ch.map((c, i) => <span key={c} className={'chip static lit' + (ci * 4 + i < drawn ? ' on' : '')}><span className="mono">{c}</span></span>)}
          </div>
        ))}
      </div>
    </div>
  );
}

/* 3 — filtering */
export function StageFilter({ study, p }: StageProps) {
  const { t } = useI18n();
  const page = study.pages.find((x) => x.kind === 'background') ?? study.pages[0];
  const scan = seg(p, 0.08, 0.92);
  const only = [3, 7, 11, 15];
  const transform = (v: number[], c: number) => {
    const n = v.length;
    return v.map((x, i) => (i / n < scan ? x : x + 22 * Math.sin(2 * Math.PI * 50 * (i / 128) + c) + 55 * Math.sin(2 * Math.PI * 0.12 * (i / 128) + c * 0.7) + 25 * Math.sin(2 * Math.PI * 0.4 * (i / 128))));
  };
  const steps = [
    { k: 'HPF 0.5', on: scan > 0.25, d: t.drift },
    { k: 'Notch 50', on: scan > 0.5, d: t.hum },
    { k: 'LPF 70', on: scan > 0.75, d: '' },
  ];
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="legend"><span><i className="sw" style={{ background: 'var(--trace)' }} />{t.filtered}</span><span>→</span><span>{t.raw}</span></div>
        <div className="chips">{steps.map((s) => <span key={s.k} className={'chip static lit' + (s.on ? ' on' : '')}><span className="mono">{s.k} {t.hz}</span>{s.d && <span className="muted small">{s.d}</span>}</span>)}</div>
      </div>
      <EEGCanvas page={page} channels={study.channels} fs={study.displayFs} only={only} rowH={62} gain={260} scan={scan} transform={transform} minWidth={520} />
    </>
  );
}

/* 4 — artifacts */
export function StageArtifacts({ study, p }: StageProps) {
  const { t, lang } = useI18n();
  const page = study.pages.find((x) => x.kind === 'false') ?? study.pages[0];
  const scan = seg(p, 0.05, 0.9);
  const tNow = page.t0 + scan * 10;
  const ev = study.events.filter((e) => e.end > page.t0 && e.start < page.t0 + 10);
  const bands: Band[] = ev.filter((e) => tNow > e.start).map((e) => ({ start: e.start, end: Math.min(e.end, tNow), kind: 'artifact', label: t.artifactFound + '?' }));
  const shown = ev.filter((e) => tNow > e.start);
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="time muted">{mmss(page.t0)}–{mmss(page.t0 + 10)} · {PAGE_LABEL[lang][page.kind]}</span>
        {shown.map((e) => <span key={e.start} className="pill warn">{e.note?.[lang] ?? t.artifactFound} · {e.channels.slice(0, 2).join(', ')}</span>)}
      </div>
      <EEGCanvas page={page} channels={study.channels} fs={study.displayFs} rowH={19} gain={180} scan={scan} bands={bands} minWidth={520} highlight={shown.flatMap((e) => e.channels)} />
    </>
  );
}

/* 5 — spectrum */
export function StageSpectrum({ study, p }: StageProps) {
  const { t, lang } = useI18n();
  const page = study.pages.find((x) => x.kind === 'background') ?? study.pages[0];
  const sp = useMemo(() => psd(page, study.channels, study.displayFs), [page, study]);
  const b = study.background;
  const k = ease(seg(p, 0.55, 0.95));
  return (
    <div className="two">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Spectrum freqs={sp.freqs} power={sp.power} progress={ease(seg(p, 0, 0.55))} unit={t.hz} />
        <span className="muted small">{t.bgNote(mmss(page.t0), mmss(page.t0 + 10))}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span className="eyebrow">{t.powerRel}</span>
        <div className="bars">
          {BANDS.map((bd, i) => (
            <div key={bd.key} className={'b' + (bd.key === 'alpha' ? ' hl' : '')}>
              <span>{Math.round(sp.rel[i] * 100 * ease(seg(p, 0.2, 0.7)))}%</span>
              <i style={{ height: `${Math.max(2, sp.rel[i] * 100 * ease(seg(p, 0.2, 0.7)))}%` }} />
              <span className="muted">{bd.sym}</span>
            </div>
          ))}
        </div>
        <div className="metrics">
          <div className="metric"><span className="muted small">{t.alphaPeak}</span><span className="v">{num(b.alphaPeakHz * k, lang)} {t.hz}</span></div>
          <div className="metric"><span className="muted small">{t.slowFast}</span><span className="v">{num(b.slowFastRatio * k, lang, 2)}</span></div>
          <div className="metric"><span className="muted small">{t.asym}</span><span className="v">{Math.round(b.asymmetryPct * k)} %</span></div>
        </div>
      </div>
    </div>
  );
}

/* 6 — detection */
export function StageDetect({ study, p }: StageProps) {
  const { t } = useI18n();
  const prog = ease(seg(p, 0, 0.72));
  const tEnd = prog * study.durationS;
  const found = study.events.filter((e) => e.start <= tEnd);
  const cmp = seg(p, 0.78, 0.95);
  const hits = study.events.filter((e) => e.match).length;
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="time">{mmss(tEnd)} / {mmss(study.durationS)}</span>
        <span className="pill info">z &gt; {study.threshold} · {t.eventsFound(found.length)}</span>
      </div>
      <Timeline study={study} progress={prog} expertAlpha={cmp} height={170} label={t.timeline} />
      <div className="legend">
        <span><i className="sw" style={{ background: 'var(--expert)', border: '1px solid var(--accent)' }} />{t.lgExpert}</span>
        <span><i className="sw" style={{ background: 'var(--accent)' }} />{t.lgHit}</span>
        <span><i className="sw" style={{ background: 'var(--event)' }} />{t.lgFalse}</span>
        <span><i className="sw" style={{ height: 2, background: 'var(--muted)' }} />{t.lgThr}</span>
      </div>
      <div className="chips">
        {found.map((e) => (
          <span key={e.start} className={'chip static' + (cmp > 0.5 && !e.match ? ' false' : '')} style={cmp > 0.5 && e.match ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}>
            <span className="mono">{mmss(e.start)}</span><span className="muted small">z {e.peak}</span>
          </span>
        ))}
      </div>
      {cmp > 0 && (
        <div className="row" style={{ opacity: cmp }}>
          <span className="eyebrow">{t.expertCompare}:</span>
          <span className="pill good">{hits} {t.vHit}</span>
          <span className="pill warn">{study.events.length - hits} {t.vFalse}</span>
        </div>
      )}
    </>
  );
}

/* 7 — localization */
export function StageLocalize({ study, p }: StageProps) {
  const { t, lang } = useI18n();
  const hit = study.events.filter((e) => e.match);
  const src = hit.length ? hit : study.events;
  const heat: Record<string, number> = {};
  const k = ease(seg(p, 0.1, 0.7));
  if (hit.length && study.profile === 'absence') study.channels.forEach((c) => (heat[c] = k * (/^Fp|^F\d/.test(c) ? 1 : 0.55)));
  else {
    const top = topChannels(src, 6);
    top.forEach((c, i) => (heat[c] = k * (1 - i * 0.12)));
  }
  const side = mainSide(src);
  const sideTxt = { ru: { right: 'Справа', left: 'Слева', bilateral: 'Билатерально', generalized: 'Генерализованно' }, en: { right: 'Right', left: 'Left', bilateral: 'Bilateral', generalized: 'Generalized' } }[lang][side];
  const page = study.pages.find((x) => x.kind === 'seizure' || x.kind === 'discharge') ?? study.pages.find((x) => x.kind === 'false')!;
  const hl = Object.keys(heat).filter((c) => heat[c] > 0.5);
  return (
    <div className="two" style={{ alignItems: 'center' }}>
      <HeadMap pairs={study.channels} heat={heat} heatColor={hit.length ? 'event' : 'accent'} caption={sideTxt} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
        <div className="metrics">
          <div className="metric"><span className="muted small">{t.side}</span><span className="v" style={{ opacity: seg(p, 0.6, 0.8) }}>{sideTxt}</span></div>
          <div className="metric"><span className="muted small">{t.colCh}</span><span className="v" style={{ fontSize: 13 }}>{topChannels(src, 4).join(', ')}</span></div>
        </div>
        <EEGCanvas page={page} channels={study.channels} fs={study.displayFs} rowH={13} gain={study.profile === 'absence' ? 300 : 110} reveal={ease(seg(p, 0, 0.9))} highlight={hl} minWidth={300} />
        <span className="muted small time">{mmss(page.t0)}–{mmss(page.t0 + 10)} · {PAGE_LABEL[lang][page.kind]}</span>
      </div>
    </div>
  );
}

/* 8 — report */
export function StageReport({ study, p }: StageProps) {
  const { t, lang } = useI18n();
  const rep = useMemo(() => generateReport(study, lang as Lang), [study, lang]);
  const all = rep.sections.flatMap((s) => s.sentences.map((x) => ({ ...x, sec: s })));
  const total = all.reduce((a, s) => a + s.text.length, 0);
  let budget = Math.floor(seg(p, 0, 0.92) * total);
  let current = all[0];
  const out = rep.sections.map((s) => {
    const parts = s.sentences.map((x) => {
      const n = Math.max(0, Math.min(x.text.length, budget));
      if (budget > 0) current = { ...x, sec: s };
      budget -= x.text.length;
      return x.text.slice(0, n);
    }).filter(Boolean);
    return { s, txt: parts.join(' ') };
  });
  const done = p >= 0.92;
  return (
    <div className="two">
      <div className="report-live" aria-live="polite">
        {out.filter((o) => o.txt).map((o, i, arr) => (
          <div key={o.s.key} className={'rsec' + (o.s.key === 'conclusion' ? ' concl' : '')}>
            <h3>{o.s.title}</h3>
            <p>{o.txt}{!done && i === arr.length - 1 && <span className="caret" />}</p>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span className="eyebrow">{current.sec.title}</span>
        <div className="rulecard"><b>{t.rule}:</b> {current.rule}</div>
        <span className="eyebrow">{t.evidence}</span>
        <div className="chips">{current.evidence.map((e) => <span key={e.label} className="chip static"><span className="mono">{e.label}</span></span>)}</div>
        {done && <span className={'pill ' + (rep.verdict === 'normal' ? 'good' : 'bad')} style={{ alignSelf: 'flex-start' }}><span className="dot" />{t.verdict[rep.verdict]} · {t.draft}</span>}
      </div>
    </div>
  );
}

export const STAGES = [StageHeader, StageMontage, StageFilter, StageArtifacts, StageSpectrum, StageDetect, StageLocalize, StageReport];
export const DURATIONS = [3800, 3800, 4200, 4200, 4200, 6000, 4200, 8000];
