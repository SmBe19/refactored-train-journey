import { Result, TimeOfDaySeconds, TimeSeconds, asTimeOfDaySeconds, asTimeSeconds, err, ok } from './types';

// Parse a duration string in formats HH:MM:SS or MM:SS into TimeSeconds
export function parseDuration(input: string): Result<TimeSeconds, string> {
  const s = input.trim();
  if (!/^\d{1,2}:\d{2}(?::\d{2})?$/.test(s)) {
    return err(`Invalid duration format: ${input}`);
  }
  const parts = s.split(':').map((p) => Number.parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) {
    return err(`Invalid duration number: ${input}`);
  }
  let seconds = 0;
  if (parts.length === 2) {
    const [mm, ss] = parts;
    if (ss >= 60) return err(`Seconds must be < 60 in MM:SS: ${input}`);
    seconds = mm * 60 + ss;
  } else if (parts.length === 3) {
    const [hh, mm, ss] = parts;
    if (mm >= 60 || ss >= 60) return err(`Minutes/seconds must be < 60 in HH:MM:SS: ${input}`);
    seconds = hh * 3600 + mm * 60 + ss;
  } else {
    return err(`Unexpected duration format: ${input}`);
  }
  if (seconds < 0) return err('Duration cannot be negative');
  return ok(asTimeSeconds(seconds));
}

// Parse a time-of-day string HH:MM or HH:MM:SS into seconds since start of day
export function parseTimeOfDay(input: string): Result<TimeOfDaySeconds, string> {
  const s = input.trim();
  if (!/^\d{1,2}:\d{2}(?::\d{2})?$/.test(s)) {
    return err(`Invalid time of day format: ${input}`);
  }
  const parts = s.split(':').map((p) => Number.parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) {
    return err(`Invalid time of day number: ${input}`);
  }
  let seconds = 0;
  if (parts.length === 2) {
    const [hh, mm] = parts;
    if (mm >= 60) return err(`Minutes must be < 60 in HH:MM: ${input}`);
    seconds = hh * 3600 + mm * 60;
  } else if (parts.length === 3) {
    const [hh, mm, ss] = parts;
    if (mm >= 60 || ss >= 60) return err(`Minutes/seconds must be < 60 in HH:MM:SS: ${input}`);
    seconds = hh * 3600 + mm * 60 + ss;
  } else {
    return err(`Unexpected time of day format: ${input}`);
  }
  if (seconds < 0) return err('Time of day cannot be negative');
  // Do not enforce < 24h; spec allows arbitrary baseline if needed, app-level validation can enforce bounds
  return ok(asTimeOfDaySeconds(seconds));
}
