// Domain types and utility types for Train Graph Viewer
// Following guidelines: strict typing, avoid any, branded number types, etc.

// Branded TimeSeconds type to avoid unit confusion
export type TimeSeconds = number & { readonly __brand: 'TimeSeconds' };
export const asTimeSeconds = (n: number): TimeSeconds => n as TimeSeconds;

export type StopId = string;

export type TimeOfDaySeconds = number & { readonly __brand: 'TimeOfDaySeconds' };
export const asTimeOfDaySeconds = (n: number): TimeOfDaySeconds => n as TimeOfDaySeconds;

export interface TrainLineMeta {
  name: string;
  defaultStopTime: TimeSeconds;
  period: TimeSeconds;
  runs: TimeOfDaySeconds[];
  extraStopTimes: Record<StopId, TimeSeconds>;
}

export interface TrainLineSegment {
  stop: StopId;
  travelToNext?: TimeSeconds; // undefined for last stop
}

export interface TrainLineSpec {
  meta: TrainLineMeta;
  segments: TrainLineSegment[];
}

export interface Topology {
  stops: StopId[];
}

export interface StopSchedulePoint {
  stop: StopId;
  arrival: TimeSeconds;
  departure: TimeSeconds;
}

export interface RunInstance {
  lineName: string;
  runStart: TimeOfDaySeconds;
  schedule: StopSchedulePoint[];
}

export interface GraphPoint {
  distance: number; // x-axis
  time: TimeSeconds; // y-axis
}

export interface GraphSeries {
  id: string;
  color: string;
  points: GraphPoint[];
}

export interface ParseError {
  file: string;
  line?: number;
  message: string;
}

export type Ok<T> = { ok: true; value: T };
export type Err<E> = { ok: false; error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });
