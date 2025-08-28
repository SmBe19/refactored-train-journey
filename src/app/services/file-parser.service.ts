import { Injectable, computed, signal } from '@angular/core';
import { Result, ParseError, Topology, TrainLineSpec } from '../../domain/types';
import { parseTopology } from '../../domain/topology';
import { parseTrainLine } from '../../domain/train-line';

export interface ParsedTrainLine {
  fileName: string;
  spec: TrainLineSpec;
}

export interface FileInputs {
  trainLineFiles: { fileName: string; text: string }[];
  topologyFile?: { fileName: string; text: string };
}

@Injectable({ providedIn: 'root' })
export class FileParserService {
  // Raw inputs state
  private readonly trainLineTexts = signal<{ fileName: string; text: string }[]>([]);
  private readonly topologyText = signal<{ fileName: string; text: string } | null>(null);

  // Parsed outputs
  readonly parsedTrainLines = computed<ParsedTrainLine[]>(() => {
    const inputs = this.trainLineTexts();
    const out: ParsedTrainLine[] = [];
    for (const f of inputs) {
      const res = parseTrainLine(f.text, f.fileName);
      if (res.ok) {
        out.push({ fileName: f.fileName, spec: res.value });
      }
    }
    return out;
  });

  readonly trainLineErrors = computed<ParseError[]>(() => {
    const inputs = this.trainLineTexts();
    const errs: ParseError[] = [];
    for (const f of inputs) {
      const res = parseTrainLine(f.text, f.fileName);
      if (!res.ok) errs.push(...res.error);
    }
    return errs;
  });

  readonly parsedTopology = computed<Result<Topology, ParseError[]> | null>(() => {
    const top = this.topologyText();
    if (!top) return null;
    return parseTopology(top.text, top.fileName);
  });

  readonly topologyErrors = computed<ParseError[]>(() => {
    const res = this.parsedTopology();
    if (!res) return [];
    return res.ok ? [] : res.error;
  });

  // Cross-file validation: topology must be subset of union of stops across all lines.
  readonly crossFileErrors = computed<ParseError[]>(() => {
    const errs: ParseError[] = [];
    const topoRes = this.parsedTopology();
    if (!topoRes || !topoRes.ok) return errs; // if topo invalid or absent, skip cross-check for now

    const topoStops = new Set(topoRes.value.stops);
    // Build union of stops across all successfully parsed lines
    const unionStops = new Set<string>();
    for (const { spec } of this.parsedTrainLines()) {
      for (const seg of spec.segments) unionStops.add(seg.stop);
    }

    for (const stop of topoStops) {
      if (!unionStops.has(stop)) {
        // Attach the topology file name if available
        const top = this.topologyText();
        errs.push({
          file: top?.fileName ?? 'topology.txt',
          message: `Topology stop "${stop}" does not exist in any loaded train line`,
        });
      }
    }

    return errs;
  });

  // Non-fatal warnings: redundant extra_stop_times entries (zero durations)
  readonly extraStopTimesWarnings = computed<ParseError[]>(() => {
    const warns: ParseError[] = [];
    for (const { fileName, spec } of this.parsedTrainLines()) {
      const entries = Object.entries(spec.meta.extraStopTimes);
      for (const [stop, dur] of entries) {
        const seconds = (dur as unknown as number);
        if (seconds === 0) {
          warns.push({
            file: fileName,
            message: `Warning: extra_stop_times for stop "${stop}" is 0s and has no effect`,
          });
        }
      }
      // Also occurrence-specific map
      const occ = spec.meta.occurrenceExtraStopTimes ?? {};
      for (const [stop, byIdx] of Object.entries(occ)) {
        for (const [idxStr, dur] of Object.entries(byIdx)) {
          const seconds = (dur as unknown as number);
          if (seconds === 0) {
            warns.push({
              file: fileName,
              message: `Warning: extra_stop_times for stop "${stop}#${idxStr}" is 0s and has no effect`,
            });
          }
        }
      }
    }
    return warns;
  });

  // Warn when total natural runtime of a train line exceeds its stated period
  readonly periodOverrunWarnings = computed<ParseError[]>(() => {
    const warns: ParseError[] = [];
    for (const { fileName, spec } of this.parsedTrainLines()) {
      const { meta, segments } = spec;
      // Compute natural runtime from start until last departure without enforcing period idle
      let total = 0; // seconds as number
      const occurrence = new Map<string, number>();
      segments.forEach((seg, idx) => {
        const occ = (occurrence.get(seg.stop) ?? 0) + 1;
        occurrence.set(seg.stop, occ);
        const baseExtra = (meta.extraStopTimes[seg.stop] ?? (0 as unknown as number)) as number;
        const occExtra = (meta.occurrenceExtraStopTimes?.[seg.stop]?.[occ] ?? (0 as unknown as number)) as number;
        const dwell = idx === 0 ? 0 : ((meta.defaultStopTime as unknown as number) + baseExtra + occExtra);
        const travel = (seg.travelToNext as unknown as number) || 0;
        total += dwell + travel;
      });
      const period = meta.period as unknown as number;
      if (total > period) {
        const over = total - period;
        warns.push({
          file: fileName,
          message: `Warning: total runtime ${FileParserService.formatDuration(total)} exceeds period ${FileParserService.formatDuration(period)} by ${FileParserService.formatDuration(over)}`,
        });
      }
    }
    return warns;
  });

  readonly allErrors = computed<ParseError[]>(() => [
    ...this.trainLineErrors(),
    ...this.topologyErrors(),
    ...this.crossFileErrors(),
    ...this.extraStopTimesWarnings(),
    ...this.periodOverrunWarnings(),
  ]);

  // Local helper to format seconds into HH:MM:SS
  // Keeps logic here to avoid a broader public API change
  // Accepts a number in seconds, returns zero-padded HH:MM:SS
  // Note: durations can exceed 24h; we don't wrap.
  private static formatDuration(totalSeconds: number): string {
    const s = Math.max(0, Math.floor(totalSeconds));
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    const hStr = String(hh).padStart(2, '0');
    const mStr = String(mm).padStart(2, '0');
    const sStr = String(ss).padStart(2, '0');
    return `${hStr}:${mStr}:${sStr}`;
  }

  // Public API to set inputs
  setTrainLineFiles(files: { fileName: string; text: string }[]): void {
    // Replace entire list; ensure stable copy
    this.trainLineTexts.set([...files]);
  }

  setTopologyFile(file: { fileName: string; text: string } | null): void {
    this.topologyText.set(file);
  }

  setInputs(inputs: FileInputs): void {
    this.setTrainLineFiles(inputs.trainLineFiles);
    this.setTopologyFile(inputs.topologyFile ?? null);
  }
}
