import { useEffect, useRef } from 'react';
import type { Page } from '../data/types';
import { css, mmss } from '../lib/format';
import { setupCanvas, useThemeTick, useWidth } from '../lib/useCanvas';

export interface Band { start: number; end: number; kind: 'expert' | 'event' | 'artifact'; label?: string }

interface Props {
  page: Page;
  channels: string[];
  fs: number;
  gain?: number; // µV per channel row
  bands?: Band[];
  reveal?: number; // 0..1 sweep
  scan?: number | null; // 0..1 scanner line
  rowH?: number;
  minWidth?: number;
  only?: number[]; // channel subset
  highlight?: string[];
  transform?: (v: number[], c: number) => number[];
}

export default function EEGCanvas({ page, channels, fs, gain = 150, bands = [], reveal = 1, scan = null, rowH = 30, minWidth = 620, only, highlight, transform }: Props) {
  const [box, bw] = useWidth<HTMLDivElement>();
  const cv = useRef<HTMLCanvasElement>(null);
  const tick = useThemeTick();
  const idx = only ?? channels.map((_, i) => i);

  useEffect(() => {
    if (!cv.current || !bw) return;
    const w = Math.max(bw, minWidth), labelW = 66, top = 6, axis = 20, nCh = idx.length;
    const h = top + nCh * rowH + axis;
    const ctx = setupCanvas(cv.current, w, h);
    const plotW = w - labelW - 6, dur = 10;
    const X = (t: number) => labelW + ((t - page.t0) / dur) * plotW;
    const H = nCh * rowH;
    // bands
    for (const b of bands) {
      const a = Math.max(b.start, page.t0), z = Math.min(b.end, page.t0 + dur);
      if (z <= a) continue;
      ctx.fillStyle = b.kind === 'expert' ? css('--expert') : css('--event-soft');
      ctx.fillRect(X(a), top, X(z) - X(a), H);
      ctx.strokeStyle = b.kind === 'expert' ? css('--accent') : css('--event');
      ctx.lineWidth = 1;
      if (b.kind !== 'event') ctx.strokeRect(X(a) + 0.5, top + 0.5, X(z) - X(a) - 1, H - 1);
      if (b.label) {
        ctx.font = '600 11px ' + css('--font');
        const tw = ctx.measureText(b.label).width + 10;
        ctx.fillStyle = b.kind === 'expert' ? css('--accent') : css('--event');
        ctx.fillRect(X(a) + 1, top + 1, tw, 16);
        ctx.fillStyle = css('--panel');
        ctx.textBaseline = 'middle';
        ctx.fillText(b.label, X(a) + 6, top + 9);
      }
    }
    // grid: major 1 s, minor 0.2 s
    for (let i = 0; i <= dur * 5; i++) {
      const x = Math.round(X(page.t0 + i / 5)) + 0.5;
      ctx.strokeStyle = i % 5 === 0 ? css('--grid-major') : css('--grid');
      ctx.globalAlpha = i % 5 === 0 ? 1 : 0.6;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top + H); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const k = rowH / gain;
    const muted = css('--muted'), trace = css('--trace'), accent = css('--accent');
    const n = page.data[0].length;
    const last = Math.floor((n - 1) * reveal);
    idx.forEach((c, r) => {
      const mid = top + r * rowH + rowH / 2;
      const hl = highlight?.includes(channels[c]);
      ctx.font = (hl ? '600 ' : '500 ') + '11.5px ' + css('--mono');
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.fillStyle = hl ? accent : muted;
      ctx.fillText(channels[c], 4, mid);
      const d = transform ? transform(page.data[c], c) : page.data[c];
      ctx.strokeStyle = hl ? accent : trace;
      ctx.lineWidth = hl ? 1.3 : 1;
      ctx.beginPath();
      const m = d.length;
      const lastI = Math.floor((m - 1) * reveal);
      for (let i = 0; i <= lastI; i++) {
        const x = labelW + (i / (m - 1)) * plotW, y = mid - d[i] * k;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    });
    if (reveal < 1) {
      const x = labelW + (last / (n - 1)) * plotW;
      ctx.fillStyle = accent; ctx.fillRect(x - 1, top, 2, H);
    }
    if (scan !== null) {
      const x = labelW + scan * plotW;
      const g = ctx.createLinearGradient(x - 40, 0, x, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, css('--expert'));
      ctx.fillStyle = g; ctx.fillRect(x - 40, top, 40, H);
      ctx.fillStyle = accent; ctx.fillRect(x - 1, top, 2, H);
    }
    ctx.fillStyle = muted; ctx.font = '11.5px ' + css('--mono'); ctx.textBaseline = 'alphabetic';
    for (let s = 0; s <= dur; s += 2) {
      ctx.textAlign = s === 0 ? 'left' : s === dur ? 'right' : 'center';
      ctx.fillText(mmss(page.t0 + s), X(page.t0 + s), top + H + 15);
    }
    void fs;
  }, [page, channels, fs, gain, bands, reveal, scan, rowH, minWidth, bw, tick, idx.join(','), highlight?.join(','), transform]);

  return (
    <div ref={box} className="scroll">
      <canvas ref={cv} role="img" aria-label={`EEG ${mmss(page.t0)}–${mmss(page.t0 + 10)}`} />
    </div>
  );
}
