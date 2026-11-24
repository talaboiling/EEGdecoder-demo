# ЭЭГ-ассистент — live demo (stage 0)

React demo of the EEG decoding workflow: **upload → decoding pipeline → draft report**, with animations at every step. No machine learning: detection and report text come from rules.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static build in dist/
npm run build:single  # one-file build in dist-single/ (data stays in public/data)
```

## What the demo shows

1. **Upload** — drag-and-drop an EDF/EDF+ file (the header is really parsed in the browser) or pick a study from the demo archive. Animated transfer and header checks.
2. **Decoding** — 8 animated stages with a processing log, pause / 1×–4× speed / jump to any stage:
   EDF header → 10–20 bipolar montage → filtering → artifact screening → background spectrum (Welch PSD computed in-browser) → event detection (z-score vs threshold, then check against expert annotation) → localization → rule-based report typed out with the rule and evidence behind each sentence.
3. **Report** — summary tiles, whole-record detector timeline, 10-s EEG viewer, findings table, editable draft, “how it was built” traceability (click evidence to jump to the EEG page), physician approval stamp.

RU/EN, light/dark, phone layout.

## Design

Neurophysiology-workstation look: ink workflow rail with a patient wristband (desktop) or a step bar with a bottom sheet of stages (phone), porcelain work surface, hospital-teal accent, chart-paper grid under traces. Type: Geologica (headings), Onest (text), JetBrains Mono (data).

Libraries: [base-ui](https://base-ui.com) selects, [NumberFlow](https://number-flow.barvian.me) animated counters, [Sonner](https://sonner.emilkowal.ski) toasts, [Vaul](https://vaul.emilkowal.ski) mobile stage sheet, [motion](https://motion.dev) transitions, [clsx](https://github.com/lukeed/clsx).

## Data

| Study | Source |
|---|---|
| `PN00-1` | Real recording from the [Siena Scalp EEG Database](https://physionet.org/content/siena-scalp-eeg/1.0.0/) (Detti P. et al., 2020), migrated from the stage-0 prototype: 14 ten-second pages × 16 bipolar channels at 128 Hz, detector score, events, expert seizure annotation and the prototype’s draft report. `public/data/pn00-1.json` |
| `DEMO-N01` | Simulated normal routine adult EEG (deterministic generator, `src/data/synth.ts`) |
| `DEMO-A01` | Simulated childhood absence epilepsy, 3 Hz spike-and-wave |

A user-uploaded EDF has its header read for real; signal analysis is replayed from the chosen reference study (stated in the UI).

## Code map

- `src/lib/report.ts` — rule-based report generator (each sentence keeps its rule and evidence)
- `src/lib/edf.ts` — EDF header parser
- `src/lib/spectrum.ts` — Welch PSD and band powers
- `src/components/stages/Stages.tsx` — pipeline stage animations
- `src/components/ResultsScreen.tsx` — results and report

Not for clinical use.
