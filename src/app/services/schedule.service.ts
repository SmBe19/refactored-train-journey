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
        const id = `${run.lineName}@${run.runStart}`;
        const color = this.colors.colorFor(id, run.lineName);
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

  for (const start of meta.runs) {
    let t: TimeSeconds = start as unknown as TimeSeconds; // start is branded TimeOfDaySeconds; timeline is consistent in seconds

    const schedule = spec.segments.map((seg, idx) => {
      const arrival = t;
      const extra = meta.extraStopTimes[seg.stop] ?? (0 as unknown as TimeSeconds);
      const dwell = add(meta.defaultStopTime, extra);
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

  // Distance function
  const hasStopLoc = !!spec.meta.stopLocation;
  const distanceFor = (stop: string): number | undefined => {
    if (hasStopLoc) {
      const d = spec.meta.stopLocation![stop];
      if (typeof d === 'number') return d;
    }
    const idx = topoIndex.get(stop);
    return idx !== undefined ? idx : undefined;
  };

  const pts: GraphPoint[] = [];
  for (const p of run.schedule) {
    if (!topoIndex.has(p.stop)) continue; // only include stops present in topology
    const dist = distanceFor(p.stop);
    if (dist === undefined) continue;
    // Use arrival time for plotting; could be tweaked later to include dwell segments
    pts.push({ distance: dist, time: p.arrival });
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
