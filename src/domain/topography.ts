import { Topography, Result, ok, err, ParseError } from './types';

/**
 * Parse a topography file content (one stop name per non-empty, non-comment line).
 * - Lines starting with '#' (after optional leading whitespace) are comments and ignored.
 * - Blank/whitespace-only lines are ignored.
 * - Duplicate stop names are not allowed; duplicates produce errors with line numbers.
 * - Returns Result<Topography, ParseError[]>.
 */
export function parseTopography(text: string, fileName: string = 'topography.txt'): Result<Topography, ParseError[]> {
  const lines = text.split(/\r?\n/);
  const stops: string[] = [];
  const seen = new Map<string, number>(); // stop -> first occurrence line
  const errors: ParseError[] = [];

  lines.forEach((raw, idx) => {
    const lineNo = idx + 1;
    const trimmed = raw.trim();
    if (trimmed.length === 0) return; // blank
    if (/^#/.test(trimmed)) return; // comment

    const stop = trimmed;
    const firstIdx = seen.get(stop);
    if (firstIdx !== undefined) {
      errors.push({ file: fileName, line: lineNo, message: `Duplicate stop name \"${stop}\" (first seen at line ${firstIdx})` });
      return;
    }
    seen.set(stop, lineNo);
    stops.push(stop);
  });

  if (stops.length === 0) {
    errors.push({ file: fileName, message: 'Topography contains no stops' });
  }

  if (errors.length > 0) {
    return err(errors);
  }
  return ok({ stops });
}
