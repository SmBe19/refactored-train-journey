import { GraphPoint, GraphSeries, RunInstance, TimeSeconds, Topology, TrainLineSpec, asTimeSeconds } from './types';

/**
 * Compute run instances (arrival/departure per stop) for a TrainLineSpec.
 * Pure function: no side effects.
 */
export function computeRunsForLine(spec: TrainLineSpec): RunInstance[] {
  const { meta, segments } = spec;
  return meta.runs.map((runStart) => {
    let currentTime: TimeSeconds = runStart as unknown as TimeSeconds; // runStart is TimeOfDaySeconds branded; timeline is compatible in seconds

    const schedule = segments.map((seg, idx): { stop: string; arrival: TimeSeconds; departure: TimeSeconds } => {
      // Arrival at first stop equals currentTime (departure of implicit origin)
      const arrival = currentTime;
      const extra = meta.extraStopTimes[seg.stop] ?? (0 as TimeSeconds);
      const dwell = (meta.defaultStopTime as number) + (extra as number);
      const departure = asTimeSeconds((arrival as number) + dwell);

      // Advance time by travel to next for next iteration
      const travel = seg.travelToNext ?? (0 as TimeSeconds);
      currentTime = asTimeSeconds((departure as number) + (travel as number));

      return { stop: seg.stop, arrival, departure };
    });

    // Enforce period rule: if run finishes early, wait at last stop until runStart + period
    const plannedEnd = asTimeSeconds((runStart as unknown as number) + (meta.period as number));
    const last = schedule[schedule.length - 1];
    if ((last.departure as number) < (plannedEnd as number)) {
      // Extend last departure to match plannedEnd
      last.departure = plannedEnd;
    }

    return { lineName: meta.name, runStart, schedule } satisfies RunInstance;
  });
}

/**
 * Build graph series points for runs filtered by topology stops.
 * X-axis: distance (from stopLocation when provided; else evenly spaced index by topology order).
 * Y-axis: time (seconds).
 */
export function buildGraphSeriesForRuns(
  runs: RunInstance[],
  spec: TrainLineSpec,
  topology: Topology,
  options?: { colorForSeries?: (seriesIndex: number, run: RunInstance) => string }
): GraphSeries[] {
  const topoIndex = new Map<string, number>();
  topology.stops.forEach((s, i) => topoIndex.set(s, i));

  const useStopLocation = !!spec.meta.stopLocation && Object.keys(spec.meta.stopLocation!).length > 0;

  const series: GraphSeries[] = [];

  runs.forEach((run, idx) => {
    const points: GraphPoint[] = [];

    run.schedule.forEach((p) => {
      if (!topoIndex.has(p.stop)) return; // skip stops not in topology
      const distance = useStopLocation
        ? (spec.meta.stopLocation![p.stop] ?? topoIndex.get(p.stop)!)
        : topoIndex.get(p.stop)!;

      points.push({ distance, time: p.arrival });
      // If dwell time exists (departure > arrival), we can add a vertical segment point at same distance
      if ((p.departure as number) !== (p.arrival as number)) {
        points.push({ distance, time: p.departure });
      }
    });

    const color = options?.colorForSeries?.(idx, run) ?? defaultColor(idx);
    series.push({ id: `${spec.meta.name}-${idx}`, color, points });
  });

  return series;
}

function defaultColor(i: number): string {
  const palette = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b'];
  return palette[i % palette.length];
}
