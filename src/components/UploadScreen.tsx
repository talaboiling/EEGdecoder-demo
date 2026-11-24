import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import clsx from 'clsx';
import Select from './Select';
import Num from './Num';
import { LIBRARY, type StudyMeta } from '../data/studies';
import { useI18n } from '../i18n';
import { readEdfHeader } from '../lib/edf';
import { mmss } from '../lib/format';
import { IconAlert, IconChevron, IconFile, IconUpload } from './Icons';
import type { HeaderInfo } from './stages/Stages';

type Phase = 'idle' | 'uploading' | 'verifying' | 'ready';

interface Props { onStart: (studyId: string, own: HeaderInfo | null) => void }

export default function UploadScreen({ onStart }: Props) {
  const { t, lang } = useI18n();
  const [over, setOver] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [meta, setMeta] = useState<StudyMeta | null>(null);
  const [own, setOwn] = useState<HeaderInfo | null>(null);
  const [ref, setRef] = useState('pn00');
  const [prog, setProg] = useState(0);
  const [err, setErr] = useState('');
  const input = useRef<HTMLInputElement>(null);

  const size = own ? own.sizeMb : meta?.sizeMb ?? 0;
  useEffect(() => {
    if (phase !== 'uploading' && phase !== 'verifying') return;
    let raf = 0; const t0 = performance.now();
    const dur = phase === 'uploading' ? 2200 : 1400;
    const step = (now: number) => {
      const v = Math.min(1, (now - t0) / dur);
      setProg(v);
      if (v < 1) raf = requestAnimationFrame(step);
      else setPhase(phase === 'uploading' ? 'verifying' : 'ready');
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const pick = (m: StudyMeta) => { setErr(''); setOwn(null); setMeta(m); setRef(m.id); setPhase('uploading'); };
  const file = async (f: File) => {
    setErr('');
    try {
      const h = await readEdfHeader(f);
      setOwn({
        fileName: f.name, sizeMb: Math.max(0.1, Math.round((f.size / 1e6) * 10) / 10), version: h.version, patient: h.patient, recording: h.recording,
        date: h.startDate, time: h.startTime, records: h.records, recDur: h.recordDuration, signals: h.signals, fs: h.fs, durationS: h.durationS, own: true,
      });
      setMeta(null);
      setPhase('uploading');
    } catch {
      setErr(t.notEdf);
      toast.error(t.notEdf);
      setPhase('idle');
    }
  };
  const reset = () => { setPhase('idle'); setMeta(null); setOwn(null); setProg(0); };
  const name = own?.fileName ?? meta?.file ?? '';

  return (
    <div className="upload-grid">
      <section className="panel" aria-labelledby="up-h">
        <div className="panel-h"><h2 id="up-h">{t.uploadTitle}</h2><span className="muted small">EDF / EDF+</span></div>
        <p className="muted small">{t.uploadLead}</p>
        <AnimatePresence mode="wait">
          {phase === 'idle' ? (
            <motion.div key="drop" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              className={clsx('drop', over && 'over')}
              onDragOver={(e) => { e.preventDefault(); setOver(true); }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) file(f); }}>
              <WaveBg />
              <motion.span animate={{ y: over ? -4 : 0 }} style={{ color: 'var(--accent)' }}><IconUpload s={36} /></motion.span>
              <b>{t.drop}</b>
              <span className="muted small">{t.dropOr}</span>
              <button className="btn primary" type="button" onClick={() => input.current?.click()}>{t.browse}</button>
              <input ref={input} id="edf-file" type="file" accept=".edf,.EDF,.bdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) file(f); e.target.value = ''; }} />
              <span className="muted small">{t.dropHint}</span>
            </motion.div>
          ) : (
            <motion.div key="prog" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="row" style={{ gap: 12, flexWrap: 'nowrap' }}>
                <span className="file-ico"><IconFile /></span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{name}</div>
                  <div className="muted small mono">
                    {phase === 'uploading' ? <><Num value={Math.round(size * prog)} /> / {size} {t.mb} · {(size / 2.2).toFixed(1)} {t.mb}/s</> : `${size} ${t.mb}`}
                  </div>
                </div>
                <span className={clsx('pill', phase === 'ready' ? 'good' : 'info')}>{phase === 'uploading' ? t.uploading : phase === 'verifying' ? t.verifying : t.ready}</span>
              </div>
              <div className="progress"><i style={{ width: `${(phase === 'uploading' ? prog : 1) * 100}%`, background: phase === 'ready' ? 'var(--good)' : undefined }} /></div>
              {phase !== 'uploading' && (
                <ul className="checks">
                  {t.checks.map((c, i) => {
                    const on = phase === 'ready' || prog > (i + 1) / (t.checks.length + 1);
                    return <motion.li key={c} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}><span className={clsx('tick', !on && 'wait')}>{on ? '✓' : ''}</span>{c}</motion.li>;
                  })}
                </ul>
              )}
              {phase === 'ready' && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <dl className="kv">
                    {own ? <>
                      <dt>{t.patient}</dt><dd className="mono">{own.patient || '—'}</dd>
                      <dt>{t.recorded}</dt><dd className="mono">{own.date} {own.time}</dd>
                      <dt>{t.duration}</dt><dd>{mmss(own.durationS)}</dd>
                      <dt>{t.signals}</dt><dd>{own.signals}</dd>
                      <dt>{t.fs}</dt><dd>{Math.round(own.fs)} {t.hz}</dd>
                    </> : meta && <>
                      <dt>{t.patient}</dt><dd>{meta.patient.code} · {t.age(meta.patient.age)}, {t.sex[meta.patient.sex]}</dd>
                      <dt>{t.duration}</dt><dd>{mmss(meta.durationS)}</dd>
                      <dt>{t.montage}</dt><dd>{t.montageVal}</dd>
                      <dt>{t.source}</dt><dd>{meta.tag[lang]}</dd>
                    </>}
                  </dl>
                  {own && (
                    <div className="banner" style={{ background: 'var(--accent-soft)', color: 'var(--fg)', flexDirection: 'column', gap: 8 }}>
                      <span>{t.replayNote}</span>
                      <div className="row small"><label className="muted" htmlFor="ref-sel">{t.profile}</label>
                        <Select id="ref-sel" label={t.profile} value={ref} onChange={setRef} items={LIBRARY.map((m) => ({ value: m.id, label: `${m.file} · ${m.title[lang]}` }))} />
                      </div>
                    </div>
                  )}
                  <div className="row">
                    <button className="btn primary" type="button" onClick={() => onStart(ref, own)}>{t.start}<IconChevron /></button>
                    <button className="btn ghost" type="button" onClick={reset}>{t.another}</button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {err && <div className="banner" role="alert" style={{ background: 'var(--bad-soft)', color: 'var(--bad)' }}><IconAlert />{err}</div>}
      </section>
      <section className="panel" aria-labelledby="lib-h">
        <div className="panel-h"><h2 id="lib-h">{t.library}</h2><span className="muted small">{LIBRARY.length}</span></div>
        <div className="lib">
          {LIBRARY.map((m, i) => (
            <motion.button key={m.id} type="button" onClick={() => pick(m)} disabled={phase === 'uploading' || phase === 'verifying'}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }} whileTap={{ scale: 0.99 }}
              className={clsx('study', meta?.id === m.id && 'sel-on')}>
              <span className="ico"><IconFile /></span>
              <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span className="t">{m.title[lang]}</span>
                <span className="m mono">{m.file} · {m.patient.code} · {t.age(m.patient.age)}, {t.sex[m.patient.sex]} · {mmss(m.durationS)}</span>
                <span><span className="tag-out">{m.tag[lang]}</span></span>
              </span>
              <IconChevron />
            </motion.button>
          ))}
        </div>
      </section>
    </div>
  );
}

function WaveBg() {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = cv.current!; let raf = 0;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const draw = (now: number) => {
      const w = c.clientWidth, h = c.clientHeight, dpr = window.devicePixelRatio || 1;
      if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
      const ctx = c.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = getComputedStyle(c).color; ctx.lineWidth = 1;
      const tt = now / 1000;
      for (let k = 0; k < 4; k++) {
        const y0 = h * (0.2 + k * 0.2);
        ctx.globalAlpha = 0.35; ctx.beginPath();
        for (let x = 0; x <= w; x += 3) {
          const u = x / 40 + tt * (1.4 + k * 0.2);
          const y = y0 + 6 * Math.sin(u * (2 + k * 0.3)) + 3 * Math.sin(u * 5.3 + k) + 2 * Math.sin(u * 11.1);
          x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={cv} style={{ color: 'var(--accent)' }} aria-hidden />;
}
