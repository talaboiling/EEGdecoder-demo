import { useEffect, useRef } from 'react';
import type { Study } from '../data/types';
import { css, mmss } from '../lib/format';
import { setupCanvas, useThemeTick, useWidth } from '../lib/useCanvas';

interface Props {
  study: Study;
  progress?: number; // portion of record drawn
  expertAlpha?: number;
  height?: number;
  marker?: number | null; // current page t0 → cursor
  onPick?: (t: number) => void;
  onStep?: (dir: -1 | 1) => void;
  label: string;
}

function hatch(ctx: CanvasRenderingContext2D, color: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 6;
  const g = c.getContext('2d')!;
  g.strokeStyle = color; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(-1, 7); g.lineTo(7, -1); g.stroke();
  return ctx.createPattern(c, 'repeat')!;
}

export default function Timeline({ study, progress = 1, expertAlpha = 1, height = 170, marker = null, onPick, onStep, label }: Props) {
  const [box, w] = useWidth<HTMLDivElement>();
  const cv = useRef<HTMLCanvasElement>(null);
  const tick = useThemeTick();
  const padL = 36, padR = 10, top = 12, lane = 10, bot = 22;

  useEffect(() => {
    if (!cv.current || !w) return;
    const ctx = setupCanvas(cv.current, w, height);
    const s = study.score, D = study.durationS, h = height;
    const plotB = h - bot - lane - 8; // bottom of score plot
    const laneY = plotB + 4;
    const X = (t: number) => padL + (t / D) * (w - padL - padR);
    const max = Math.max(study.threshold * 2, ...s.map((v) => Math.min(v, 40)));
    const Y = (v: number) => top + (1 - Math.min(v, max) / max) * (plotB - top);
    const tEnd = D * progress;
    const muted = css('--muted'), accent = css('--accent'), event = css('--event'), warn = css('--warn');
    ctx.fillStyle = css('--paper'); ctx.fillRect(padL, top, w - padL - padR, plotB - top);
    // y grid + unit
    ctx.font = '11px ' + css('--mono'); ctx.fillStyle = muted; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = css('--grid'); ctx.lineWidth = 1;
    const stepV = max > 30 ? 10 : 5;
    for (let v = 0; v <= max; v += stepV) {
      const y = Math.round(Y(v)) + 0.5;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillText(String(v), padL - 6, y);
    }
    ctx.textAlign = 'left'; ctx.fillText('z', 2, top - 2);
    // expert annotation bands
    if (expertAlpha > 0) {
      ctx.globalAlpha = expertAlpha;
      for (const e of study.expert) {
        const x = X(e.start), ww = Math.max(3, X(e.end) - X(e.start));
        ctx.fillStyle = css('--expert'); ctx.fillRect(x, top, ww, plotB - top);
        ctx.strokeStyle = accent; ctx.strokeRect(x + 0.5, top + 0.5, ww - 1, plotB - top - 1);
      }
      ctx.globalAlpha = 1;
    }
    // threshold + score
    ctx.strokeStyle = muted; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(padL, Y(study.threshold)); ctx.lineTo(w - padR, Y(study.threshold)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = css('--trace'); ctx.lineWidth = 1; ctx.beginPath();
    const n = Math.min(s.length, Math.ceil(tEnd));
    for (let i = 0; i < n; i++) { const x = X(i), y = Y(Math.max(0, s[i])); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
    // event lane: matched = solid, false = hatched, doubtful = dashed outline
    ctx.fillStyle = css('--panel-2'); ctx.fillRect(padL, laneY, w - padL - padR, lane);
    const pat = hatch(ctx, event);
    const judged = expertAlpha > 0.5;
    for (const e of study.events) {
      if (e.start > tEnd) continue;
      const x = X(e.start), ww = Math.max(4, X(Math.min(e.end, tEnd)) - x);
      if (judged && e.match) { ctx.fillStyle = accent; ctx.fillRect(x, laneY, ww, lane); }
      else if (judged && e.doubtful) { ctx.setLineDash([3, 2]); ctx.strokeStyle = warn; ctx.lineWidth = 1.5; ctx.strokeRect(x + 0.75, laneY + 0.75, ww - 1.5, lane - 1.5); ctx.setLineDash([]); }
      else { ctx.fillStyle = pat; ctx.fillRect(x, laneY, ww, lane); ctx.strokeStyle = event; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, laneY + 0.5, ww - 1, lane - 1); }
    }
    if (progress < 1) { ctx.fillStyle = accent; ctx.fillRect(X(tEnd) - 1, top, 2, plotB - top); }
    // current page cursor
    if (marker !== null) {
      const xc = X(marker + 5);
      ctx.strokeStyle = accent; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(xc, top - 4); ctx.lineTo(xc, laneY + lane); ctx.stroke();
      ctx.fillStyle = accent; ctx.beginPath();
      ctx.moveTo(xc, laneY + lane + 1); ctx.lineTo(xc - 6, laneY + lane + 9); ctx.lineTo(xc + 6, laneY + lane + 9); ctx.closePath(); ctx.fill();
    }
    // x ticks ≥ 60 px apart
    ctx.fillStyle = muted; ctx.textBaseline = 'alphabetic'; ctx.font = '11px ' + css('--mono');
    const pxPerMin = (60 / D) * (w - padL - padR);
    const stepM = [1, 2, 5, 10, 15, 30].find((m) => m * pxPerMin >= 60) ?? 30;
    for (let m = 0; m <= D / 60; m += stepM) {
      const x = X(m * 60);
      ctx.textAlign = m === 0 ? 'left' : 'center';
      if (x < w - 24) ctx.fillText(mmss(m * 60), x, h - 4);
    }
  }, [study, progress, expertAlpha, height, marker, w, tick]);

  const click = (e: React.MouseEvent) => {
    if (!onPick || !cv.current) return;
    const r = cv.current.getBoundingClientRect();
    onPick(((e.clientX - r.left - padL) / (r.width - padL - padR)) * study.durationS);
  };
  const key = (e: React.KeyboardEvent) => {
    if (!onStep) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); onStep(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); onStep(1); }
  };

  return (
    <div ref={box} tabIndex={onStep ? 0 : undefined} onKeyDown={key} className={onStep ? 'tl-focus' : undefined}
      aria-label={onStep ? label + ' — ← →' : undefined}>
      <canvas ref={cv} onClick={click} style={{ cursor: onPick ? 'pointer' : 'default' }} role="img" aria-label={label} />
    </div>
  );
}
