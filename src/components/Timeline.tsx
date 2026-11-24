import { useEffect, useRef } from 'react';
import type { Study } from '../data/types';
import { css, mmss } from '../lib/format';
import { setupCanvas, useThemeTick, useWidth } from '../lib/useCanvas';

interface Props {
  study: Study;
  progress?: number; // portion of record drawn
  expertAlpha?: number;
  height?: number;
  marker?: number | null; // current page t0
  onPick?: (t: number) => void;
  label: string;
}

export default function Timeline({ study, progress = 1, expertAlpha = 1, height = 150, marker = null, onPick, label }: Props) {
  const [box, w] = useWidth<HTMLDivElement>();
  const cv = useRef<HTMLCanvasElement>(null);
  const tick = useThemeTick();
  const padL = 30, padR = 8, top = 10, bot = 24;

  useEffect(() => {
    if (!cv.current || !w) return;
    const ctx = setupCanvas(cv.current, w, height);
    const s = study.score, D = study.durationS, h = height;
    const X = (t: number) => padL + (t / D) * (w - padL - padR);
    const max = Math.max(study.threshold * 2, ...s.map((v) => Math.min(v, 40)));
    const Y = (v: number) => top + (1 - Math.min(v, max) / max) * (h - top - bot);
    const tEnd = D * progress;
    // y grid
    ctx.font = '11px ' + css('--mono'); ctx.fillStyle = css('--muted'); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = css('--grid'); ctx.lineWidth = 1;
    const stepV = max > 30 ? 10 : 5;
    for (let v = 0; v <= max; v += stepV) {
      const y = Math.round(Y(v)) + 0.5;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillText(String(v), padL - 6, y);
    }
    if (expertAlpha > 0) {
      ctx.globalAlpha = expertAlpha;
      for (const e of study.expert) {
        ctx.fillStyle = css('--expert');
        ctx.fillRect(X(e.start), top, Math.max(3, X(e.end) - X(e.start)), h - top - bot);
        ctx.strokeStyle = css('--accent');
        ctx.strokeRect(X(e.start) + 0.5, top + 0.5, Math.max(3, X(e.end) - X(e.start)) - 1, h - top - bot - 1);
      }
      ctx.globalAlpha = 1;
    }
    for (const e of study.events) {
      if (e.start > tEnd) continue;
      ctx.fillStyle = expertAlpha > 0.5 ? (e.match ? css('--accent') : css('--event')) : css('--event');
      ctx.fillRect(X(e.start), h - bot - 6, Math.max(3, X(Math.min(e.end, tEnd)) - X(e.start)), 6);
    }
    ctx.strokeStyle = css('--muted'); ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(padL, Y(study.threshold)); ctx.lineTo(w - padR, Y(study.threshold)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = css('--trace'); ctx.lineWidth = 1; ctx.beginPath();
    const n = Math.min(s.length, Math.ceil(tEnd));
    for (let i = 0; i < n; i++) { const x = X(i), y = Y(Math.max(0, s[i])); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
    if (progress < 1) {
      ctx.fillStyle = css('--accent'); ctx.fillRect(X(tEnd) - 1, top, 2, h - top - bot);
    }
    if (marker !== null) {
      ctx.strokeStyle = css('--accent'); ctx.lineWidth = 2;
      ctx.strokeRect(X(marker), top - 4, Math.max(4, X(marker + 10) - X(marker)), h - top - bot + 8);
    }
    ctx.fillStyle = css('--muted'); ctx.textBaseline = 'alphabetic';
    const pxPerMin = (60 / D) * (w - padL - padR);
    const stepM = [1, 2, 5, 10, 15, 30].find((m) => m * pxPerMin >= 46) ?? 30;
    for (let m = 0; m <= D / 60; m += stepM) {
      const x = X(m * 60);
      ctx.textAlign = m === 0 ? 'left' : 'center';
      if (x < w - 24) ctx.fillText(mmss(m * 60), x, h - 6);
    }
  }, [study, progress, expertAlpha, height, marker, w, tick]);

  const click = (e: React.MouseEvent) => {
    if (!onPick || !cv.current) return;
    const r = cv.current.getBoundingClientRect();
    const t = ((e.clientX - r.left - padL) / (r.width - padL - padR)) * study.durationS;
    onPick(t);
  };

  return (
    <div ref={box}>
      <canvas ref={cv} onClick={click} style={{ cursor: onPick ? 'pointer' : 'default' }} role="img" aria-label={label} />
    </div>
  );
}
