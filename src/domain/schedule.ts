import { GraphPoint, GraphSeries, RunInstance, TimeSeconds, Topology, TrainLineSpec, asTimeSeconds } from './types';

/**
 * Compute run instances (arrival/departure per stop) for a TrainLineSpec.
 * Pure function: no side effects.
 */
export function computeRunsForLine(spec: TrainLineSpec): RunInstance[] {
  const { meta, segments } = spec;
  // Expand runs by repeats: for each base runStart, add k * period for k=0..repeatRuns
  const repeat = Math.max(0, Math.floor((meta.repeatRuns ?? 0)));
  const baseStarts = meta.runs;
  const expandedStarts = baseStarts.flatMap((s) => {
    const n = repeat + 1; // include original
    const per = meta.period as unknown as number;
    const base = s as unknown as number;
    const out: number[] = [];
    for (let k = 0; k < n; k++) out.push(base + k * per);
    return out.map(asTimeSeconds).map((t) => t as unknown as typeof s);
  });

  return expandedStarts.map((runStart) => {
    let currentTime: TimeSeconds = runStart as unknown as TimeSeconds; // runStart is TimeOfDaySeconds branded; timeline is compatible in seconds

    const occurrence = new Map<string, number>();

    const schedule = segments.map((seg, idx): { stop: string; arrival: TimeSeconds; departure: TimeSeconds } => {
      // Arrival at first stop equals currentTime (train departs at run start)
      const arrival = currentTime;
      // Track 1-based occurrence index for this stop
      const occ = (occurrence.get(seg.stop) ?? 0) + 1;
      occurrence.set(seg.stop, occ);
      // No dwell at the initial stop; ignore custom_stop_times there
      const occCustom = meta.occurrenceExtraStopTimes?.[seg.stop]?.[occ];
      const baseCustom = meta.extraStopTimes[seg.stop];
      const dwellSeconds = idx === 0
        ? 0
        : ((occCustom as unknown as number) ?? (baseCustom as unknown as number) ?? (meta.defaultStopTime as unknown as number));
      const departure = asTimeSeconds((arrival as number) + dwellSeconds);

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
 * X-axis: distance along topology (evenly spaced by stop order).
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

  const series: GraphSeries[] = [];

  runs.forEach((run, idx) => {
    const points: GraphPoint[] = [];

    run.schedule.forEach((p) => {
      if (!topoIndex.has(p.stop)) return; // skip stops not in topology
      const distance = topoIndex.get(p.stop)!;

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
