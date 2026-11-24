import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import clsx from 'clsx';
import type { Lang, Study } from './data/types';
import { loadStudy } from './data/studies';
import { DICTS, I18n } from './i18n';
import UploadScreen from './components/UploadScreen';
import DecodeScreen from './components/DecodeScreen';
import ResultsScreen from './components/ResultsScreen';
import Wristband from './components/Wristband';
import { headerFromStudy, type HeaderInfo } from './components/stages/Stages';
import { IconAlert, IconCheck, IconWave } from './components/Icons';

type Screen = 'upload' | 'decode' | 'results';
const SCREENS: Screen[] = ['upload', 'decode', 'results'];

const initialLang = (): Lang => {
  try { const v = localStorage.getItem('eeg-lang'); if (v === 'ru' || v === 'en') return v; } catch { /* storage blocked */ }
  return 'ru';
};

function useNarrow() {
  const q = '(max-width: 1023px)';
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const f = () => setM(mq.matches);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  return m;
}

export default function App() {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [screen, setScreen] = useState<Screen>('upload');
  const [study, setStudy] = useState<Study | null>(null);
  const [header, setHeader] = useState<HeaderInfo | null>(null);
  const [err, setErr] = useState(false);
  const narrow = useNarrow();
  const t = DICTS[lang];
  const setLang = (l: Lang) => { setLangState(l); try { localStorage.setItem('eeg-lang', l); } catch { /* storage blocked */ } };
  useEffect(() => { document.documentElement.lang = lang; document.title = t.product; }, [lang, t.product]);

  const start = async (id: string, own: HeaderInfo | null) => {
    setErr(false);
    try {
      const s = await loadStudy(id);
      setStudy(s);
      setHeader(own ?? headerFromStudy(s));
      setScreen('decode');
      window.scrollTo({ top: 0 });
    } catch { setErr(true); }
  };
  const go = (s: Screen) => { toast.dismiss(); setScreen(s); window.scrollTo({ top: 0 }); };
  const idx = SCREENS.indexOf(screen);
  const canGo = (i: number) => i < idx || (i === 2 && !!study && screen === 'decode');

  const langToggle = (
    <div className="lang" role="group" aria-label={t.langLbl}>
      {(['ru', 'en'] as Lang[]).map((l) => <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}
    </div>
  );
  const brand = <div className="brand"><span className="logo"><IconWave s={18} /></span><b>{t.product}</b><span className="tag">{t.stage}</span></div>;

  return (
    <I18n.Provider value={{ lang, t, setLang }}>
      <div className="shell">
        <aside className="rail" aria-label="workflow">
          {brand}
          {study && header && screen !== 'upload' && <Wristband study={study} header={header} />}
          <ol className="flow">
            {t.steps.map((label, i) => (
              <li key={label} className={clsx('flow-step', i === idx && 'on', i < idx && 'done')}>
                <button type="button" disabled={!canGo(i)} onClick={() => canGo(i) && go(SCREENS[i])} aria-current={i === idx ? 'step' : undefined}>
                  <span className="n">{i < idx ? <IconCheck s={13} /> : i + 1}</span>
                  <span className="txt"><b>{label}</b><span>{t.stepDesc[i]}</span></span>
                </button>
                {i === 1 && <div id="rail-stages" />}
              </li>
            ))}
          </ol>
          <div className="rail-foot">
            <p className="rail-note"><IconAlert s={14} />{t.disclaimer}</p>
            {langToggle}
          </div>
        </aside>

        <header className="top">
          {brand}
          {langToggle}
          <ol className="msteps" aria-label="workflow">
            {t.steps.map((label, i) => (
              <li key={label} className={clsx(i === idx && 'on', i < idx && 'done')}>
                <button type="button" disabled={!canGo(i)} onClick={() => canGo(i) && go(SCREENS[i])} aria-current={i === idx ? 'step' : undefined}>
                  <i />{label}
                </button>
              </li>
            ))}
          </ol>
        </header>

        <main className="main">
          <p className="mnote"><IconAlert s={13} />{t.disclaimer}</p>
          {err && <div className="banner bad" role="alert">{t.loadError}</div>}
          <AnimatePresence mode="wait">
            <motion.div key={screen} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
              {screen === 'upload' && <UploadScreen onStart={start} />}
              {screen === 'decode' && study && header && <DecodeScreen study={study} header={header} narrow={narrow} onDone={() => go('results')} />}
              {screen === 'results' && study && header && <ResultsScreen study={study} header={header} onNew={() => go('upload')} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <Toaster position={narrow ? 'top-center' : 'bottom-right'} theme="system" richColors closeButton toastOptions={{ style: { fontFamily: 'var(--font)' } }} />
    </I18n.Provider>
  );
}
