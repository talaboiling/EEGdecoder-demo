import { BANDS } from '../lib/spectrum';

interface Props { freqs: number[]; power: number[]; progress?: number; peak?: number; unit: string }

export default function Spectrum({ freqs, power, progress = 1, peak, unit }: Props) {
  const W = 420, H = 170, l = 34, r = 8, t = 10, b = 24;
  const lp = power.map((v) => Math.log10(v + 1e-9));
  const lo = Math.min(...lp), hi = Math.max(...lp);
  const X = (f: number) => l + ((f - freqs[0]) / (30 - freqs[0])) * (W - l - r);
  const Y = (v: number) => t + (1 - (v - lo) / (hi - lo || 1)) * (H - t - b);
  const n = Math.max(2, Math.round(freqs.length * progress));
  const pts = freqs.slice(0, n).map((f, i) => `${X(f).toFixed(1)},${Y(lp[i]).toFixed(1)}`);
  const area = `M${X(freqs[0])},${H - b} L${pts.join(' L')} L${X(freqs[n - 1])},${H - b} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="PSD" style={{ display: 'block' }}>
      {BANDS.map((bd, i) => (
        <g key={bd.key}>
          <rect x={X(Math.max(bd.lo, freqs[0]))} y={t} width={X(bd.hi) - X(Math.max(bd.lo, freqs[0]))} height={H - t - b}
            fill={bd.key === 'alpha' ? 'var(--expert)' : i % 2 ? 'var(--panel-2)' : 'transparent'} />
          <text x={(X(Math.max(bd.lo, freqs[0])) + X(bd.hi)) / 2} y={t + 14} textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--muted)">{bd.sym}</text>
        </g>
      ))}
      {[0, 4, 8, 13, 20, 30].map((f) => (
        <text key={f} x={X(Math.max(f, freqs[0]))} y={H - 7} textAnchor={f === 0 ? 'start' : f === 30 ? 'end' : 'middle'} fontSize="11" fontFamily="var(--mono)" fill="var(--muted)">{f}</text>
      ))}
      <text x={4} y={t + 8} fontSize="10.5" fontFamily="var(--mono)" fill="var(--muted)">log P</text>
      <text x={W - r} y={H - b - 4} textAnchor="end" fontSize="10.5" fontFamily="var(--mono)" fill="var(--muted)">{unit}</text>
      <path d={area} fill="var(--accent)" fillOpacity="0.14" />
      <polyline points={pts.join(' ')} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
      {peak !== undefined && progress >= 1 && (
        <g>
          <line x1={X(peak)} x2={X(peak)} y1={t} y2={H - b} stroke="var(--event)" strokeDasharray="3 3" />
          <text x={X(peak) + 4} y={t + 30} fontSize="11" fontFamily="var(--mono)" fill="var(--event)">{String(peak)}</text>
        </g>
      )}
      <line x1={l} x2={W - r} y1={H - b + 0.5} y2={H - b + 0.5} stroke="var(--grid-major)" />
    </svg>
  );
}
