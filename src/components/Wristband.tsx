import type { Study } from '../data/types';
import type { HeaderInfo } from './stages/Stages';
import { useI18n } from '../i18n';
import { mmss } from '../lib/format';

/** Patient ID band, styled after a hospital wristband, with a barcode drawn from the study ID. */
export default function Wristband({ study, header }: { study: Study; header: HeaderInfo }) {
  const { t, lang } = useI18n();
  let h = 2166136261;
  for (const c of study.id + study.file) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const bars: number[] = [];
  for (let i = 0; i < 34; i++) { h = Math.imul(h ^ (h >>> 13), 0x5bd1e995); bars.push(1 + ((h >>> 0) % 3)); }
  let x = 0;
  return (
    <div className="band" aria-label={t.patient}>
      <div className="band-top">
        <span className="band-id">{study.patient.code}</span>
        <span className="band-src">{study.source === 'real' ? t.realBadge : t.synthBadge}</span>
      </div>
      <div className="band-row">{t.age(study.patient.age)} · {t.sex[study.patient.sex]} · {mmss(study.durationS)}</div>
      <div className="band-row mono">{header.own ? header.fileName : study.file}</div>
      <div className="band-ind">{study.indication[lang]}</div>
      <svg className="barcode" viewBox="0 0 120 22" preserveAspectRatio="none" aria-hidden>
        {bars.map((w, i) => { const r = i % 2 === 0 ? <rect key={i} x={x} y={0} width={w * 0.9} height={22} /> : null; x += w * 1.15; return r; })}
      </svg>
    </div>
  );
}
