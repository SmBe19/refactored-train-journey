import { Injectable, computed, signal } from '@angular/core';
import { Result, ParseError, Topography, TrainLineSpec } from '../../domain/types';
import { parseTopography } from '../../domain/topography';
import { parseTrainLine } from '../../domain/train-line';

export interface ParsedTrainLine {
  fileName: string;
  spec: TrainLineSpec;
}

export interface FileInputs {
  trainLineFiles: { fileName: string; text: string }[];
  topographyFile?: { fileName: string; text: string };
}

@Injectable({ providedIn: 'root' })
export class FileParserService {
  // Raw inputs state
  private readonly trainLineTexts = signal<{ fileName: string; text: string }[]>([]);
  private readonly topographyText = signal<{ fileName: string; text: string } | null>(null);

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

  readonly parsedTopography = computed<Result<Topography, ParseError[]> | null>(() => {
    const top = this.topographyText();
    if (!top) return null;
    return parseTopography(top.text, top.fileName);
  });

  readonly topographyErrors = computed<ParseError[]>(() => {
    const res = this.parsedTopography();
    if (!res) return [];
    return res.ok ? [] : res.error;
  });

  // Cross-file validation: topography must be subset of union of stops across all lines.
  readonly crossFileErrors = computed<ParseError[]>(() => {
    const errs: ParseError[] = [];
    const topoRes = this.parsedTopography();
    if (!topoRes || !topoRes.ok) return errs; // if topo invalid or absent, skip cross-check for now

    const topoStops = new Set(topoRes.value.stops);
    // Build union of stops across all successfully parsed lines
    const unionStops = new Set<string>();
    for (const { spec } of this.parsedTrainLines()) {
      for (const seg of spec.segments) unionStops.add(seg.stop);
    }

    for (const stop of topoStops) {
      if (!unionStops.has(stop)) {
        // Attach the topography file name if available
        const top = this.topographyText();
        errs.push({
          file: top?.fileName ?? 'topography.txt',
          message: `Topography stop "${stop}" does not exist in any loaded train line`,
        });
      }
    }

    return errs;
  });

  readonly allErrors = computed<ParseError[]>(() => [
    ...this.trainLineErrors(),
    ...this.topographyErrors(),
    ...this.crossFileErrors(),
  ]);

  // Public API to set inputs
  setTrainLineFiles(files: { fileName: string; text: string }[]): void {
    // Replace entire list; ensure stable copy
    this.trainLineTexts.set([...files]);
  }

  setTopographyFile(file: { fileName: string; text: string } | null): void {
    this.topographyText.set(file);
  }

  setInputs(inputs: FileInputs): void {
    this.setTrainLineFiles(inputs.trainLineFiles);
    this.setTopographyFile(inputs.topographyFile ?? null);
  }
}
