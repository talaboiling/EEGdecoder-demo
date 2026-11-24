import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Drawer } from 'vaul';
import { toast } from 'sonner';
import clsx from 'clsx';
import Num from './Num';
import type { Lang, Study } from '../data/types';
import { useI18n } from '../i18n';
import { mmss, num } from '../lib/format';
import { generateReport, mainSide } from '../lib/report';
import { DURATIONS, STAGES, type HeaderInfo } from './stages/Stages';
import { IconCheck, IconChevron, IconPause, IconPlay, IconRestart } from './Icons';

interface Props { study: Study; header: HeaderInfo; narrow: boolean; onDone: () => void }
interface Line { at: number; text: string; cls?: 'ok' | 'wr' }

function stageLogs(i: number, s: Study, h: HeaderInfo, L: Lang): Line[] {
  const ru = L === 'ru';
  const hit = s.events.filter((e) => e.match);
  switch (i) {
    case 0: return [
      { at: 0.05, text: `open ${h.fileName} (${h.sizeMb} MB)` },
      { at: 0.35, text: `${h.version} · ${h.signals} signals · ${h.records} × ${h.recDur} s` },
      { at: 0.7, text: `fs = ${Math.round(h.fs)} Hz → ${s.displayFs} Hz (display)` },
      { at: 0.95, text: ru ? 'заголовок корректен' : 'header OK', cls: 'ok' },
    ];
    case 1: return [
      { at: 0.1, text: ru ? 'сопоставление меток с системой 10–20: 19/19' : 'map labels to 10–20 system: 19/19' },
      { at: 0.5, text: 'Fp1–F7 → T5–O1, Fp2–F8 → T6–O2' },
      { at: 0.75, text: 'Fp1–F3 → P3–O1, Fp2–F4 → P4–O2' },
      { at: 0.97, text: ru ? 'монтаж: 16 биполярных отведений' : 'montage: 16 bipolar channels', cls: 'ok' },
    ];
    case 2: return [
      { at: 0.25, text: 'butterworth HPF 0.5 Hz, order 4' },
      { at: 0.5, text: 'IIR notch 50 Hz, Q = 30' },
      { at: 0.75, text: 'butterworth LPF 70 Hz, order 4' },
      { at: 0.95, text: ru ? 'фильтрация завершена' : 'filtering done', cls: 'ok' },
    ];
    case 3: {
      const fa = s.events.filter((e) => !e.match);
      return [
        { at: 0.1, text: ru ? 'поиск: моргания (Fp), миограмма (> 20 Гц), движения' : 'scan: blinks (Fp), EMG (> 20 Hz), movement' },
        { at: 0.6, text: (ru ? 'сомнительных эпизодов: ' : 'doubtful episodes: ') + fa.length, cls: fa.length ? 'wr' : undefined },
        { at: 0.95, text: ru ? 'артефакты помечены, не удалены' : 'artifacts flagged, not removed', cls: 'ok' },
      ];
    }
    case 4: return [
      { at: 0.1, text: `welch PSD · 2 s hann · ${mmss(s.background.windowS[0])}–${mmss(s.background.windowS[1])}` },
      { at: 0.6, text: `alpha peak ${num(s.background.alphaPeakHz, L)} Hz · ${s.background.alphaAmpUv} µV` },
      { at: 0.9, text: `slow/fast = ${num(s.background.slowFastRatio, L, 2)} · asym ${s.background.asymmetryPct} %`, cls: 'ok' },
    ];
    case 5: return [
      { at: 0.05, text: `line-length + rhythmicity, 1 s · z > ${s.threshold}` },
      ...s.events.map((e) => ({ at: 0.05 + 0.67 * (e.start / s.durationS), text: `${ru ? 'событие' : 'event'} ${mmss(e.start)}–${mmss(e.end)} · z ${num(e.peak, L)}`, cls: 'wr' as const })),
      { at: 0.82, text: `${ru ? 'сверка с разметкой' : 'expert check'}: ${hit.length}/${s.events.length}`, cls: 'ok' },
    ];
    case 6: return [
      { at: 0.2, text: ru ? 'ранжирование отведений по энергии' : 'rank leads by energy' },
      { at: 0.75, text: (ru ? 'сторона: ' : 'side: ') + mainSide(hit.length ? hit : s.events), cls: 'ok' },
    ];
    default: {
      const r = generateReport(s, L);
      return [
        ...r.sections.map((sec, k) => ({ at: 0.05 + k * 0.22, text: `${ru ? 'раздел' : 'section'} «${sec.title}»: ${sec.sentences.length} ${ru ? 'правил' : 'rules'}` })),
        { at: 0.95, text: (ru ? 'черновик готов · ' : 'draft ready · ') + r.verdict, cls: 'ok' },
      ];
    }
  }
}

export default function DecodeScreen({ study, header, narrow, onDone }: Props) {
  const { t, lang } = useI18n();
  const [st, setSt] = useState({ i: 0, p: 0 });
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const finished = st.i === STAGES.length - 1 && st.p >= 1;
  const logRef = useRef<HTMLDivElement>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [sheet, setSheet] = useState(false);
  useEffect(() => { setSlot(document.getElementById('rail-stages')); }, []);
  useEffect(() => {
    if (finished) toast.success(t.decodeDone, { action: { label: t.toResults, onClick: onDone } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  useEffect(() => {
    if (!playing || finished) return;
    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(64, now - last); last = now;
      setSt((s) => {
        let p = s.p + (dt * speed) / DURATIONS[s.i];
        if (p < 1) return { i: s.i, p };
        if (s.i === STAGES.length - 1) return { i: s.i, p: 1 };
        p = 0;
        return { i: s.i + 1, p };
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, finished]);

  const logs = useMemo(() => STAGES.map((_, i) => stageLogs(i, study, header, lang)), [study, header, lang]);
  const before = DURATIONS.slice(0, st.i).reduce((a, b) => a + b, 0);
  const totalMs = DURATIONS.reduce((a, b) => a + b, 0);
  const elapsed = before + st.p * DURATIONS[st.i];
  const visible: { ts: string; l: Line }[] = [];
  logs.forEach((ls, i) => {
    if (i > st.i) return;
    const base = DURATIONS.slice(0, i).reduce((a, b) => a + b, 0);
    ls.forEach((l) => { if (i < st.i || l.at <= st.p) visible.push({ ts: ((base + l.at * DURATIONS[i]) / 1000).toFixed(1).padStart(5, '0'), l }); });
  });
  useEffect(() => { const el = logRef.current; if (el) el.scrollTop = el.scrollHeight; }, [visible.length]);

  const Stage = STAGES[st.i];
  const info = t.stages[st.i];
  const jump = (i: number) => setSt({ i, p: 0 });

  const stageList = (
    <ol className="stagelist">
      {t.stages.map((x, i) => {
        const state = i < st.i || (i === st.i && finished) ? 'done' : i === st.i ? 'on' : '';
        return (
          <li key={x.t} className={clsx(state === 'done' && 'done', state === 'on' && 'on')}>
            <button type="button" onClick={() => { jump(i); setSheet(false); }} aria-current={i === st.i ? 'step' : undefined}>
              <span className="n">{state === 'done' ? <IconCheck s={12} /> : i + 1}{state === 'on' && playing && <span className="ring" />}</span>
              <span className="txt"><span className="t">{x.t}</span><span className="d">{x.d}</span></span>
            </button>
          </li>
        );
      })}
    </ol>
  );
  const logView = (
    <div className="log" ref={logRef} aria-live="off">
      {visible.map((v, k) => <div className="ln" key={k}><span>{v.ts}</span><span className={v.l.cls}>{v.l.text}</span></div>)}
    </div>
  );

  return (
    <div className="decode">
      {!narrow && slot && createPortal(stageList, slot)}
      <section className="panel stage-view">
        <div className="stage-head">
          <div style={{ minWidth: 0 }}>
            <span className="eyebrow">{st.i + 1} / {STAGES.length}</span>
            <h2 style={{ fontSize: 19 }}>{info.t}</h2>
            <p className="muted small hide-sm">{info.d}</p>
          </div>
          <div className="ctrls">
            {narrow && (
              <Drawer.Root open={sheet} onOpenChange={setSheet}>
                <Drawer.Trigger className="btn sm">{t.stagesBtn}</Drawer.Trigger>
                <Drawer.Portal>
                  <Drawer.Overlay className="sheet-ov" />
                  <Drawer.Content className="sheet" aria-describedby={undefined}>
                    <div className="sheet-handle" />
                    <Drawer.Title className="sheet-title">{t.decodeTitle}</Drawer.Title>
                    {stageList}
                    <span className="eyebrow">{t.log}</span>
                    {logView}
                  </Drawer.Content>
                </Drawer.Portal>
              </Drawer.Root>
            )}
            <button className="btn sm" type="button" onClick={() => setPlaying((v) => !v)} disabled={finished}>{playing ? <IconPause /> : <IconPlay />}<span className="hide-sm">{playing ? t.pause : t.play}</span></button>
            <div className="seg" role="group" aria-label={t.speed}>
              {[1, 2, 4].map((v) => <button key={v} type="button" aria-pressed={speed === v} onClick={() => setSpeed(v)}>{v}×</button>)}
            </div>
            <button className="btn sm ghost" type="button" onClick={() => { setSt({ i: 0, p: 0 }); setPlaying(true); }} aria-label={t.restart}><IconRestart /></button>
            {!finished && <button className="btn sm ghost" type="button" onClick={onDone} aria-label={t.skip}><span className="hide-sm">{t.skip}</span><IconChevron /></button>}
          </div>
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={st.i} className="stage-body" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>
            <Stage study={study} p={st.p} header={header} />
          </motion.div>
        </AnimatePresence>
        <div className="overall">
          <span className="time muted">{(elapsed / 1000).toFixed(1)} {t.s}</span>
          <div className="progress"><i style={{ width: `${(elapsed / totalMs) * 100}%` }} /></div>
          <span className="time muted"><Num value={Math.round((elapsed / totalMs) * 100)} suffix="%" /></span>
        </div>
        {!narrow && (
          <div>
            <span className="eyebrow">{t.log}</span>
            {logView}
          </div>
        )}
        {finished && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn primary" type="button" onClick={onDone}>{t.toResults}<IconChevron /></button>
          </motion.div>
        )}
      </section>
    </div>
  );
}
