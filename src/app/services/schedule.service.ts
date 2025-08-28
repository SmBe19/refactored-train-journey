import { Injectable, computed, inject } from '@angular/core';
import {
  GraphPoint,
  GraphSeries,
  RunInstance,
  TimeSeconds,
  Topology,
  TrainLineSpec,
  asTimeSeconds,
} from '../../domain/types';
import { FileParserService } from './file-parser.service';
import { ColorService } from './color.service';

@Injectable({ providedIn: 'root' })
export class ScheduleService {
  private readonly files = inject(FileParserService);
  private readonly colors = inject(ColorService);

  // Derived: all run instances across all parsed train lines
  readonly runs = computed<RunInstance[]>(() => {
    const out: RunInstance[] = [];
    for (const { spec } of this.files.parsedTrainLines()) {
      out.push(...computeRunsForLine(spec));
    }
    return out;
  });

  // Derived: graph series filtered by current topology (if valid)
  readonly graphSeries = computed<GraphSeries[]>(() => {
    const topoRes = this.files.parsedTopology();
    if (!topoRes || !topoRes.ok) return [];
    const topo = topoRes.value;

    const series: GraphSeries[] = [];
    for (const { spec } of this.files.parsedTrainLines()) {
      const runs = computeRunsForLine(spec);
      for (const run of runs) {
        const id = `${run.lineName}@${formatTimeOfDay(run.runStart as unknown as number)}`;
        const color = this.colors.colorFor(id, run.lineName, spec.meta.baseColor);
        const points = computeGraphPoints(spec, topo, run);
        if (points.length >= 2) {
          series.push({ id, color, points });
        }
      }
    }
    return series;
  });
}

// ---- Pure functions below (no Angular dependencies) ----

function computeRunsForLine(spec: TrainLineSpec): RunInstance[] {
  const meta = spec.meta;
  const runs: RunInstance[] = [];

  // Expand run starts by repeatRuns
  const repeat = Math.max(0, Math.floor((meta.repeatRuns ?? 0)));
  const starts: number[] = meta.runs.flatMap((s) => {
    const base = s as unknown as number;
    const per = meta.period as unknown as number;
    const out: number[] = [];
    for (let k = 0; k < repeat + 1; k++) out.push(base + k * per);
    return out;
  });

  for (const startNum of starts) {
    const start = asTimeSeconds(startNum) as unknown as typeof meta.runs[number];
    let t: TimeSeconds = start as unknown as TimeSeconds; // start is branded TimeOfDaySeconds; timeline is consistent in seconds

    const occurrence = new Map<string, number>();

    const schedule = spec.segments.map((seg, idx) => {
      const arrival = t;
      // Track 1-based occurrence index for this stop along the line
      const occ = (occurrence.get(seg.stop) ?? 0) + 1;
      occurrence.set(seg.stop, occ);
      // No dwell at the initial stop; ignore extra_stop_times for the first stop
      const occExtra = meta.occurrenceExtraStopTimes?.[seg.stop]?.[occ] ?? (0 as unknown as TimeSeconds);
      const baseExtra = meta.extraStopTimes[seg.stop] ?? (0 as unknown as TimeSeconds);
      const dwell = idx === 0 ? (0 as TimeSeconds) : add(meta.defaultStopTime, add(baseExtra, occExtra));
      const departure = add(arrival, dwell);

      // Advance time to next stop by travel time
      if (seg.travelToNext !== undefined) {
        t = add(departure, seg.travelToNext);
      } else {
        // last stop: update t to departure for period check
        t = departure;
      }

      return { stop: seg.stop, arrival, departure };
    });

    // Enforce period: if run finished early, idle at last stop until start + period
    const last = schedule[schedule.length - 1];
    const endByPeriod = add(start as unknown as TimeSeconds, meta.period);
    if (compare(last.departure, endByPeriod) < 0) {
      last.departure = endByPeriod; // extend idle at last stop
    }

    runs.push({ lineName: meta.name, runStart: start, schedule });
  }

  return runs;
}

function computeGraphPoints(spec: TrainLineSpec, topo: Topology, run: RunInstance): GraphPoint[] {
  const topoIndex = new Map<string, number>();
  topo.stops.forEach((s, i) => topoIndex.set(s, i));

  const pts: GraphPoint[] = [];
  for (const p of run.schedule) {
    if (!topoIndex.has(p.stop)) continue; // only include stops present in topology
    const dist = topoIndex.get(p.stop)!;
    // Add arrival point
    pts.push({ distance: dist, time: p.arrival });
    // If there is dwell time at this stop, add a departure point at the same distance to create a vertical segment
    if ((p.departure as unknown as number) !== (p.arrival as unknown as number)) {
      pts.push({ distance: dist, time: p.departure });
    }
  }
  return pts;
}

// Helpers for branded TimeSeconds arithmetic
function add(a: TimeSeconds, b: TimeSeconds): TimeSeconds {
  return asTimeSeconds((a as unknown as number) + (b as unknown as number));
}

function compare(a: TimeSeconds, b: TimeSeconds): number {
  const na = a as unknown as number;
  const nb = b as unknown as number;
  return na === nb ? 0 : na < nb ? -1 : 1;
}

// Format time-of-day seconds into HH:MM:SS
function formatTimeOfDay(totalSeconds: number): string {
  const total = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
}

function pad2(n: number): string { return n < 10 ? `0${n}` : String(n); }
