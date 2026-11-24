// 10–20 electrode map with the longitudinal bipolar chains drawn as segments.
const POS: Record<string, [number, number]> = {
  Fp1: [-0.31, -0.9], Fp2: [0.31, -0.9],
  F7: [-0.76, -0.55], F3: [-0.38, -0.5], Fz: [0, -0.48], F4: [0.38, -0.5], F8: [0.76, -0.55],
  T3: [-0.92, 0], C3: [-0.46, 0], Cz: [0, 0], C4: [0.46, 0], T4: [0.92, 0],
  T5: [-0.76, 0.55], P3: [-0.38, 0.5], Pz: [0, 0.48], P4: [0.38, 0.5], T6: [0.76, 0.55],
  O1: [-0.31, 0.9], O2: [0.31, 0.9],
};
export const ELECTRODES = Object.keys(POS);

interface Props {
  electrodes?: number; // 0..1 portion shown
  pairs?: string[]; // channels like 'Fp1–F7'
  pairsProgress?: number; // 0..1
  heat?: Record<string, number>; // channel → 0..1
  heatColor?: 'event' | 'accent';
  size?: number;
  caption?: string;
}

export default function HeadMap({ electrodes = 1, pairs = [], pairsProgress = 1, heat = {}, heatColor = 'event', size = 300, caption }: Props) {
  const R = 120, c = 150;
  const P = (k: string) => [c + POS[k][0] * R, c + POS[k][1] * R] as const;
  const nE = Math.round(ELECTRODES.length * electrodes);
  const shownE = new Set(ELECTRODES.slice(0, nE));
  const col = heatColor === 'event' ? 'var(--event)' : 'var(--accent)';
  return (
    <svg viewBox="0 0 300 300" width="100%" style={{ maxWidth: size, display: 'block', margin: '0 auto' }} role="img" aria-label={caption}>
      <ellipse cx={c} cy={c} rx={R + 18} ry={R + 18} fill="var(--panel-2)" stroke="var(--grid-major)" strokeWidth="1.5" />
      <path d={`M${c - 14} ${c - R - 17} L${c} ${c - R - 34} L${c + 14} ${c - R - 17}`} fill="var(--panel-2)" stroke="var(--grid-major)" strokeWidth="1.5" />
      <path d={`M${c - R - 18} ${c - 14} q-12 14 0 28`} fill="none" stroke="var(--grid-major)" strokeWidth="1.5" />
      <path d={`M${c + R + 18} ${c - 14} q12 14 0 28`} fill="none" stroke="var(--grid-major)" strokeWidth="1.5" />
      {pairs.map((p, i) => {
        const [a, b] = p.split('–');
        if (!POS[a] || !POS[b]) return null;
        const local = Math.min(1, Math.max(0, pairsProgress * pairs.length - i));
        if (local <= 0) return null;
        const [x1, y1] = P(a), [x2, y2] = P(b);
        const hv = heat[p] ?? 0;
        return (
          <line key={p} x1={x1} y1={y1} x2={x1 + (x2 - x1) * local} y2={y1 + (y2 - y1) * local}
            stroke={hv > 0 ? col : 'var(--accent)'} strokeOpacity={hv > 0 ? 0.35 + 0.65 * hv : 0.55}
            strokeWidth={hv > 0 ? 3 + 5 * hv : 2.5} strokeLinecap="round" />
        );
      })}
      {ELECTRODES.map((k) => {
        const [x, y] = P(k);
        const on = shownE.has(k);
        return (
          <g key={k} style={{ opacity: on ? 1 : 0, transition: 'opacity .25s' }}>
            <circle cx={x} cy={y} r={13} fill="var(--panel)" stroke="var(--trace)" strokeWidth="1.2" />
            <text x={x} y={y + 3.6} textAnchor="middle" fontSize="9.5" fontFamily="var(--mono)" fontWeight="600" fill="var(--fg)">{k}</text>
          </g>
        );
      })}
    </svg>
  );
}
