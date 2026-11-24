import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Lang, Study } from './data/types';
import { loadStudy } from './data/studies';
import { DICTS, I18n } from './i18n';
import UploadScreen from './components/UploadScreen';
import DecodeScreen from './components/DecodeScreen';
import ResultsScreen from './components/ResultsScreen';
import { headerFromStudy, type HeaderInfo } from './components/stages/Stages';
import { IconAlert, IconCheck, IconWave } from './components/Icons';

type Screen = 'upload' | 'decode' | 'results';

const initialLang = (): Lang => {
  try { const v = localStorage.getItem('eeg-lang'); if (v === 'ru' || v === 'en') return v; } catch { /* storage blocked */ }
  return 'ru';
};

export default function App() {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [screen, setScreen] = useState<Screen>('upload');
  const [study, setStudy] = useState<Study | null>(null);
  const [header, setHeader] = useState<HeaderInfo | null>(null);
  const [err, setErr] = useState(false);
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
  const go = (s: Screen) => { setScreen(s); window.scrollTo({ top: 0 }); };
  const idx = ['upload', 'decode', 'results'].indexOf(screen);

  return (
    <I18n.Provider value={{ lang, t, setLang }}>
      <header className="bar">
        <div className="bar-in">
          <div className="brand"><IconWave s={22} /><b>{t.product}</b><span className="tag">{t.stage}</span></div>
          <nav className="steps" aria-label="workflow">
            {t.steps.map((label, i) => {
              const clickable = i < idx || (i === 2 && study && screen === 'decode');
              return (
                <button key={label} type="button" className={'step' + (i === idx ? ' on' : i < idx ? ' done' : '') + (clickable ? ' click' : '')}
                  disabled={!clickable} onClick={() => clickable && go((['upload', 'decode', 'results'] as Screen[])[i])} aria-current={i === idx ? 'step' : undefined}>
                  <span className="n">{i < idx ? <IconCheck s={12} /> : i + 1}</span>{label}
                </button>
              );
            })}
          </nav>
          <div className="lang" role="group" aria-label="Language">
            {(['ru', 'en'] as Lang[]).map((l) => <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}
          </div>
        </div>
      </header>
      <main className="wrap">
        <div className="banner" role="note"><IconAlert />{t.disclaimer}</div>
        {err && <div className="banner" role="alert" style={{ background: 'var(--bad-soft)', color: 'var(--bad)' }}>{t.loadError}</div>}
        <AnimatePresence mode="wait">
          <motion.div key={screen} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.28 }}>
            {screen === 'upload' && <UploadScreen onStart={start} />}
            {screen === 'decode' && study && header && <DecodeScreen study={study} header={header} onDone={() => go('results')} />}
            {screen === 'results' && study && header && <ResultsScreen study={study} header={header} onNew={() => go('upload')} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </I18n.Provider>
  );
}
