import { ParseError, Result, TimeOfDaySeconds, TimeSeconds, TrainLineSegment, TrainLineSpec, TrainLineMeta, asTimeOfDaySeconds, asTimeSeconds, err, ok } from './types';
import { parseDuration, parseTimeOfDay } from './time';
import { parse as parseYaml } from 'yaml';

/**
 * Parse a train line file consisting of YAML frontmatter and a body of alternating lines:
 * ---\n
 * name: ...\n
 * default_stop_time: MM:SS | HH:MM:SS\n
 * period: MM:SS | HH:MM:SS\n
 * runs:\n
 *   - HH:MM[:SS]\n
 * stop_location: { Stop: number, ... } OR indented map\n
 * extra_stop_times: { Stop: MM:SS, ... } OR indented map\n
 * ---\n
 * Stop A\n
 * 01:30\n
 * Stop B\n
 * 00:45\n
 * Stop C\n
 * ... (last stop has no time after it)
 */
export function parseTrainLine(text: string, fileName: string = 'train-line.txt'): Result<TrainLineSpec, ParseError[]> {
  const errors: ParseError[] = [];
  const { frontmatter, body, fmStartLine } = splitFrontmatter(text);
  if (frontmatter == null) {
    errors.push({ file: fileName, message: 'Missing YAML frontmatter delimited by ---' });
    return err(errors);
  }

  const metaRes = parseFrontmatter(frontmatter, fileName, fmStartLine + 1);
  if (!metaRes.ok) {
    return err(metaRes.error);
  }
  const meta = metaRes.value;

  const bodyRes = parseBody(body, fileName, fmStartLine + countLines(frontmatter) + 2);
  if (!bodyRes.ok) {
    return err(bodyRes.error);
  }
  const segments = bodyRes.value;

  // Cross validations
  if (!meta.name || meta.name.trim().length === 0) {
    errors.push({ file: fileName, message: 'Frontmatter "name" must be non-empty' });
  }
  if (segments.length < 2) {
    errors.push({ file: fileName, message: 'At least two stops are required' });
  }
  if ((meta.period as number) <= 0) {
    errors.push({ file: fileName, message: '"period" must be > 0' });
  }
  // Validate extra_stop_times keys exist among stops
  const stopSet = new Set(segments.map((s) => s.stop));
  for (const key of Object.keys(meta.extraStopTimes ?? {})) {
    if (!stopSet.has(key)) {
      errors.push({ file: fileName, message: `extra_stop_times contains unknown stop "${key}"` });
    }
  }

  if (errors.length > 0) return err(errors);

  const spec: TrainLineSpec = { meta, segments };
  return ok(spec);
}

function splitFrontmatter(text: string): { frontmatter: string | null; body: string; fmStartLine: number } {
  const lines = text.split(/\r?\n/);
  let i = 0;
  // find first '---' line
  while (i < lines.length && lines[i].trim().length === 0) i++;
  if (i >= lines.length || lines[i].trim() !== '---') {
    return { frontmatter: null, body: text, fmStartLine: 1 };
  }
  const fmStart = i;
  i++;
  const fmLines: string[] = [];
  while (i < lines.length && lines[i].trim() !== '---') {
    fmLines.push(lines[i]);
    i++;
  }
  if (i >= lines.length) {
    // no closing ---
    return { frontmatter: null, body: text, fmStartLine: fmStart + 1 };
  }
  const bodyLines = lines.slice(i + 1);
  return { frontmatter: fmLines.join('\n'), body: bodyLines.join('\n'), fmStartLine: fmStart + 1 };
}

function countLines(s: string): number {
  return s.length === 0 ? 0 : s.split(/\r?\n/).length;
}

function parseFrontmatter(yamlText: string, fileName: string, baseLine: number): Result<TrainLineMeta, ParseError[]> {
  const errors: ParseError[] = [];

  let data: unknown;
  try {
    data = parseYaml(yamlText);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return err([{ file: fileName, line: baseLine, message: `YAML parse error: ${msg}` }]);
  }

  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    return err([{ file: fileName, line: baseLine, message: 'Frontmatter must be a YAML map/object' }]);
  }

  const obj = data as Record<string, unknown>;

  // name
  const nameVal = obj['name'];
  const name = typeof nameVal === 'string' ? nameVal : undefined;

  // default_stop_time
  const dstRaw = obj['default_stop_time'];
  let defaultStopTime: TimeSeconds | undefined;
  if (dstRaw != null) {
    const d = parseDuration(String(dstRaw));
    if (!d.ok) errors.push({ file: fileName, line: baseLine, message: `default_stop_time: ${d.error}` });
    else defaultStopTime = d.value;
  }

  // period
  const perRaw = obj['period'];
  let period: TimeSeconds | undefined;
  if (perRaw != null) {
    const d = parseDuration(String(perRaw));
    if (!d.ok) errors.push({ file: fileName, line: baseLine, message: `period: ${d.error}` });
    else period = d.value;
  }

  // runs
  const runsRaw = obj['runs'];
  const runs: TimeOfDaySeconds[] = [];
  if (Array.isArray(runsRaw)) {
    for (const r of runsRaw) {
      const pr = parseTimeOfDay(String(r));
      if (!pr.ok) errors.push({ file: fileName, line: baseLine, message: `runs entry "${String(r)}": ${pr.error}` });
      else runs.push(pr.value);
    }
  } else if (runsRaw != null) {
    // Allow a comma-separated string as a convenience
    const parts = String(runsRaw).split(/\s*,\s*/).filter(Boolean);
    for (const r of parts) {
      const pr = parseTimeOfDay(r);
      if (!pr.ok) errors.push({ file: fileName, line: baseLine, message: `runs entry "${r}": ${pr.error}` });
      else runs.push(pr.value);
    }
  }

  // extra_stop_times
  const estRaw = obj['extra_stop_times'];
  const extraStopTimes: Record<string, TimeSeconds> = {};
  if (estRaw != null) {
    if (typeof estRaw !== 'object' || estRaw == null || Array.isArray(estRaw)) {
      errors.push({ file: fileName, line: baseLine, message: 'extra_stop_times must be a map' });
    } else {
      for (const [k, v] of Object.entries(estRaw as Record<string, unknown>)) {
        const d = parseDuration(String(v));
        if (!d.ok) errors.push({ file: fileName, line: baseLine, message: `Invalid extra_stop_times for ${k}: ${d.error}` });
        else extraStopTimes[k] = d.value;
      }
    }
  }

  if (errors.length > 0) return err(errors);

  if (name == null || defaultStopTime == null || period == null) {
    errors.push({ file: fileName, message: 'Frontmatter must include name, default_stop_time, and period' });
    return err(errors);
  }

  const meta: TrainLineMeta = {
    name,
    defaultStopTime,
    period,
    runs,
    extraStopTimes,
  };
  return ok(meta);
}

function parseInlineMap(src: string, file: string, line: number): Record<string, string> {
  const inner = src.slice(1, -1).trim();
  if (!inner) return {};
  const out: Record<string, string> = {};
  // Split by commas not considering nested structures (we don't support nesting here)
  const parts = inner.split(',');
  for (const p of parts) {
    const kv = p.split(':');
    if (kv.length < 2) continue;
    const k = kv[0].trim().replace(/^"|"$/g, '');
    const v = kv.slice(1).join(':').trim().replace(/^"|"$/g, '');
    out[k] = v;
  }
  return out;
}

function parseBlockMap(lines: string[], file: string, baseLine: number): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const kv = raw.trim().match(/^(.*?):\s*(.*)$/);
    if (!kv) continue;
    const k = kv[1].trim();
    const v = kv[2].trim();
    out[k] = v;
  }
  return out;
}

function parseBody(body: string, fileName: string, baseLine: number): Result<TrainLineSegment[], ParseError[]> {
  const lines = body.split(/\r?\n/);
  const segments: TrainLineSegment[] = [];
  const errors: ParseError[] = [];

  let i = 0;
  function lineNo(): number { return baseLine + i; }

  while (i < lines.length) {
    // Read stop line (non-empty, non-comment)
    let stopLine: string | undefined;
    while (i < lines.length) {
      const raw = lines[i];
      i++;
      if (raw == null) break;
      const trimmed = raw.trim();
      if (trimmed.length === 0) continue;
      if (trimmed.startsWith('#')) continue;
      stopLine = trimmed;
      break;
    }
    if (!stopLine) break;

    // Next significant line might be a duration (travelToNext) or another stop (meaning last stop)
    let travel: TimeSeconds | undefined = undefined;
    const mark = i;
    while (i < lines.length) {
      const raw = lines[i];
      const trimmed = raw.trim();
      if (trimmed.length === 0 || trimmed.startsWith('#')) { i++; continue; }
      // Try parse as duration
      const d = parseDuration(trimmed);
      if (d.ok) {
        travel = d.value;
        i++; // consume this line
      }
      break;
    }

    segments.push({ stop: stopLine, travelToNext: travel });
  }

  // Validate travel times non-negative already enforced in parseDuration; ensure last item may have undefined travel
  if (segments.length === 0) {
    errors.push({ file: fileName, line: baseLine, message: 'No stops found in body' });
  }

  return errors.length > 0 ? err(errors) : ok(segments);
}
