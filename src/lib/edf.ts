export interface EdfHeader {
  version: string;
  patient: string;
  recording: string;
  startDate: string;
  startTime: string;
  records: number;
  recordDuration: number;
  signals: number;
  labels: string[];
  fs: number;
  durationS: number;
}

const txt = (b: Uint8Array, a: number, n: number) =>
  String.fromCharCode(...b.subarray(a, a + n)).trim();

/** Parses the fixed ASCII header of an EDF/EDF+ file. Signals are not read. */
export async function readEdfHeader(file: File): Promise<EdfHeader> {
  const head = new Uint8Array(await file.slice(0, 256).arrayBuffer());
  if (head.length < 256 || txt(head, 0, 8) !== '0') throw new Error('not-edf');
  const ns = parseInt(txt(head, 252, 4), 10);
  if (!(ns > 0 && ns < 1000)) throw new Error('not-edf');
  const full = new Uint8Array(await file.slice(0, 256 + ns * 256).arrayBuffer());
  const field = (offset: number, width: number) =>
    Array.from({ length: ns }, (_, i) => txt(full, 256 + offset + i * width, width));
  const labels = field(0, 16);
  const samplesOff = ns * (16 + 80 + 8 + 8 + 8 + 8 + 8 + 80);
  const samples = field(samplesOff, 8).map((s) => parseInt(s, 10));
  const records = parseInt(txt(head, 236, 8), 10);
  const recordDuration = parseFloat(txt(head, 244, 8)) || 1;
  const eegIdx = labels.findIndex((l) => /EEG|Fp|F\d|C\d|O\d|T\d|P\d/i.test(l));
  const fs = (samples[eegIdx >= 0 ? eegIdx : 0] || 0) / recordDuration;
  return {
    version: 'EDF' + (txt(head, 192, 44).startsWith('EDF+') ? '+' : ''),
    patient: txt(head, 8, 80), recording: txt(head, 88, 80),
    startDate: txt(head, 168, 8), startTime: txt(head, 176, 8),
    records, recordDuration, signals: ns, labels, fs,
    durationS: Math.max(0, records) * recordDuration,
  };
}
