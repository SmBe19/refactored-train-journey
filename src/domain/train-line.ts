import { ParseError, Result, TimeOfDaySeconds, TimeSeconds, TrainLineSegment, TrainLineSpec, TrainLineMeta, asTimeOfDaySeconds, asTimeSeconds, err, ok } from './types';
import { parseDuration, parseTimeOfDay } from './time';

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
  // Validate extra_stop_times and stop_location keys exist among stops
  const stopSet = new Set(segments.map((s) => s.stop));
  for (const key of Object.keys(meta.extraStopTimes ?? {})) {
    if (!stopSet.has(key)) {
      errors.push({ file: fileName, message: `extra_stop_times contains unknown stop "${key}"` });
    }
  }
  if (meta.stopLocation) {
    for (const [k, v] of Object.entries(meta.stopLocation)) {
      if (!stopSet.has(k)) {
        errors.push({ file: fileName, message: `stop_location contains unknown stop "${k}"` });
      }
      if (!(typeof v === 'number') || v < 0 || !Number.isFinite(v)) {
        errors.push({ file: fileName, message: `stop_location[${k}] must be a non-negative number` });
      }
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

function parseFrontmatter(yaml: string, fileName: string, baseLine: number): Result<TrainLineMeta, ParseError[]> {
  interface TempMeta {
    name?: string;
    default_stop_time?: TimeSeconds;
    period?: TimeSeconds;
    runs?: TimeOfDaySeconds[];
    stop_location?: Record<string, number>;
    extra_stop_times?: Record<string, TimeSeconds>;
  }
  const temp: TempMeta = {};
  const errors: ParseError[] = [];

  const lines = yaml.split(/\r?\n/);
  let i = 0;
  function currentLine(): number { return baseLine + i; }

  // Minimal YAML subset parser: supports key: value, arrays with '-', and nested maps via indentation
  const ctxStack: { type: 'root' | 'map' | 'array'; key?: string; indent: number }[] = [{ type: 'root', indent: -1 }];
  let currentMap: any = {};

  while (i < lines.length) {
    const raw = lines[i];
    i++;
    if (!raw || raw.trim().length === 0) continue;
    const indent = raw.match(/^\s*/)?.[0].length ?? 0;
    const line = raw.trim();
    if (line.startsWith('#')) continue;

    // Key: value or key: or - item
    if (line.startsWith('- ')) {
      // Array item for the last seen array key. We only expect arrays for "runs"
      const valueStr = line.substring(2).trim();
      if (!Array.isArray((currentMap as any).__runs)) {
        (currentMap as any).__runs = [] as string[];
      }
      (currentMap as any).__runs.push(valueStr);
      continue;
    }

    const kv = line.match(/^(\w[\w_]*):\s*(.*)$/);
    if (!kv) {
      errors.push({ file: fileName, line: currentLine(), message: `Invalid frontmatter line: ${raw}` });
      continue;
    }
    const key = kv[1];
    const value = kv[2];

    // Handle maps: if value looks like { a: 1, b: 2 }
    if (value.startsWith('{') && value.endsWith('}')) {
      const map = parseInlineMap(value, fileName, currentLine());
      if (key === 'stop_location') {
        temp.stop_location = {};
        for (const [k, v] of Object.entries(map)) {
          const num = Number(v);
          if (!Number.isFinite(num) || num < 0) {
            errors.push({ file: fileName, line: currentLine(), message: `stop_location[${k}] must be a non-negative number` });
          } else {
            temp.stop_location[k] = num;
          }
        }
      } else if (key === 'extra_stop_times') {
        temp.extra_stop_times = {};
        for (const [k, v] of Object.entries(map)) {
          const d = parseDuration(String(v));
          if (!d.ok) {
            errors.push({ file: fileName, line: currentLine(), message: `Invalid extra_stop_times for ${k}: ${d.error}` });
          } else {
            temp.extra_stop_times[k] = d.value;
          }
        }
      } else {
        // Unknown inline map key
        // Store nothing; non-fatal
      }
      continue;
    }

    // If value is empty, expect indented block map for known keys
    if (value === '') {
      // Collect subsequent indented lines as a map until dedent
      const block: string[] = [];
      const blockIndent = (lines[i]?.match(/^\s*/)?.[0].length ?? 0);
      while (i < lines.length) {
        const r = lines[i];
        const ind = r.match(/^\s*/)?.[0].length ?? 0;
        if (r.trim().length === 0 || r.trim().startsWith('#')) { i++; continue; }
        if (ind < blockIndent) break;
        block.push(r.slice(blockIndent));
        i++;
      }
      const blockMap = parseBlockMap(block, fileName, currentLine());
      if (key === 'stop_location') {
        temp.stop_location = {};
        for (const [k, v] of Object.entries(blockMap)) {
          const num = Number(v);
          if (!Number.isFinite(num) || num < 0) {
            errors.push({ file: fileName, message: `stop_location[${k}] must be a non-negative number` });
          } else {
            temp.stop_location[k] = num;
          }
        }
      } else if (key === 'extra_stop_times') {
        temp.extra_stop_times = {};
        for (const [k, v] of Object.entries(blockMap)) {
          const d = parseDuration(String(v));
          if (!d.ok) {
            errors.push({ file: fileName, message: `Invalid extra_stop_times for ${k}: ${d.error}` });
          } else {
            temp.extra_stop_times[k] = d.value;
          }
        }
      } else if (key === 'runs') {
        const arr: string[] = [];
        for (const [k, v] of Object.entries(blockMap)) {
          // Support "- HH:MM" style in blockMap: key will be '-' or 'itemX'
          arr.push(`${k} ${v}`.trim());
        }
        (currentMap as any).__runs = arr.filter((s) => s.length > 0);
      }
      continue;
    }

    // Scalar values
    switch (key) {
      case 'name':
        temp.name = value.replace(/^"|"$/g, '');
        break;
      case 'default_stop_time': {
        const d = parseDuration(value);
        if (!d.ok) errors.push({ file: fileName, line: currentLine(), message: `default_stop_time: ${d.error}` });
        else temp.default_stop_time = d.value;
        break;
      }
      case 'period': {
        const d = parseDuration(value);
        if (!d.ok) errors.push({ file: fileName, line: currentLine(), message: `period: ${d.error}` });
        else temp.period = d.value;
        break;
      }
      case 'runs': {
        // Inline array not supported except via subsequent "-" lines; if provided as comma list, split
        const items = value.replace(/^[\[\s]|[\]\s]$/g, '').split(/\s*,\s*/).filter(Boolean);
        (currentMap as any).__runs = items;
        break;
      }
      case 'stop_location':
      case 'extra_stop_times':
        // Handled above for maps; if scalar appears, treat as error
        errors.push({ file: fileName, line: currentLine(), message: `${key} must be a map` });
        break;
      default:
        // ignore unknown keys (non-fatal)
        break;
    }
  }

  const runsRaw: string[] = (currentMap as any).__runs ?? [];
  const runs: TimeOfDaySeconds[] = [];
  for (const r of runsRaw) {
    const pr = parseTimeOfDay(r);
    if (!pr.ok) errors.push({ file: fileName, message: `runs entry "${r}": ${pr.error}` });
    else runs.push(pr.value);
  }

  if (!temp.extra_stop_times) temp.extra_stop_times = {};

  if (errors.length > 0) return err(errors);

  if (temp.name == null || temp.default_stop_time == null || temp.period == null) {
    errors.push({ file: fileName, message: 'Frontmatter must include name, default_stop_time, and period' });
    return err(errors);
  }

  const meta: TrainLineMeta = {
    name: temp.name,
    defaultStopTime: temp.default_stop_time,
    period: temp.period,
    runs,
    stopLocation: temp.stop_location,
    extraStopTimes: temp.extra_stop_times,
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
