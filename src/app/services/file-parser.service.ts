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
  // Backward compatibility: accept single topologyFile
  topologyFile?: { fileName: string; text: string };
  // New: multiple topology files and optional selected topology by name
  topologyFiles?: { fileName: string; text: string }[];
  selectedTopologyName?: string | null;
}

@Injectable({ providedIn: 'root' })
export class FileParserService {
  // Raw inputs state
  private readonly trainLineTexts = signal<{ fileName: string; text: string }[]>([]);
  // Support multiple topology files; maintain a selection by name
  private readonly topologyTexts = signal<{ fileName: string; text: string }[]>([]);
  private readonly selectedTopologyName = signal<string | null>(null);

  // Expose topology names and selection for UI
  readonly topologyNames = computed<string[]>(() => this.topologyTexts().map(f => f.fileName));
  readonly selectedTopology = computed<string | null>(() => this.selectedTopologyName());

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
    const files = this.topologyTexts();
    if (files.length === 0) return null;
    const sel = this.selectedTopologyName();
    const chosen = sel ? files.find(f => f.fileName === sel) ?? files[0] : files[0];
    return parseTopology(chosen.text, chosen.fileName);
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
        // Attach the topology file name if available (use selected or first)
        const files = this.topologyTexts();
        const sel = this.selectedTopologyName();
        const top = sel ? files.find(f => f.fileName === sel) ?? files[0] : files[0];
        errs.push({
          file: top?.fileName ?? 'topology.txt',
          message: `Topology stop "${stop}" does not exist in any loaded train line`,
        });
      }
    }

    return errs;
  });

  // Non-fatal warnings: redundant custom_stop_times entries (zero durations)
  readonly extraStopTimesWarnings = computed<ParseError[]>(() => {
    const warns: ParseError[] = [];
    for (const { fileName, spec } of this.parsedTrainLines()) {
      const entries = Object.entries(spec.meta.extraStopTimes);
      for (const [stop, dur] of entries) {
        const seconds = (dur as unknown as number);
        if (seconds === 0) {
          warns.push({
            file: fileName,
            message: `Warning: custom_stop_times for stop "${stop}" is 0s`,
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
              message: `Warning: custom_stop_times for stop "${stop}#${idxStr}" is 0s`,
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
        const occCustom = meta.occurrenceExtraStopTimes?.[seg.stop]?.[occ] as unknown as number | undefined;
        const baseCustom = meta.extraStopTimes[seg.stop] as unknown as number | undefined;
        const dwell = idx === 0 ? 0 : ((occCustom ?? baseCustom ?? (meta.defaultStopTime as unknown as number)));
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

  // New API: set multiple topology files and manage selected
  setTopologyFiles(files: { fileName: string; text: string }[]): void {
    const arr = [...files];
    this.topologyTexts.set(arr);
    // Keep selection if it still exists; otherwise select first or null
    const sel = this.selectedTopologyName();
    if (!sel || !arr.find(f => f.fileName === sel)) {
      this.selectedTopologyName.set(arr.length > 0 ? arr[0].fileName : null);
    }
  }

  setSelectedTopology(name: string | null): void {
    const arr = this.topologyTexts();
    if (name && arr.find(f => f.fileName === name)) {
      this.selectedTopologyName.set(name);
    } else if (arr.length > 0) {
      this.selectedTopologyName.set(arr[0].fileName);
    } else {
      this.selectedTopologyName.set(null);
    }
  }

  // Back-compat single-file setter: maps to multi
  setTopologyFile(file: { fileName: string; text: string } | null): void {
    if (file) {
      this.setTopologyFiles([file]);
    } else {
      this.setTopologyFiles([]);
    }
  }

  setInputs(inputs: FileInputs): void {
    this.setTrainLineFiles(inputs.trainLineFiles);
    if (Array.isArray(inputs.topologyFiles)) {
      this.setTopologyFiles(inputs.topologyFiles);
      if (inputs.selectedTopologyName !== undefined) this.setSelectedTopology(inputs.selectedTopologyName);
    } else {
      this.setTopologyFile(inputs.topologyFile ?? null);
    }
  }
}
