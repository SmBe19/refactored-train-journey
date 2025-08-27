# Train Graph Viewer — Implementation TODO

This document enumerates the tasks required to implement the Angular application described in README.md. It follows the provided guidelines (standalone components by default, signals for state, strict typing, OnPush change detection, native control flow, etc.).

## 1. Requirements and Scope
- Clarify units and conventions:
  - Decide base time unit (seconds recommended due to HH:MM:SS support) and distance unit (prefer real distances via `stop_location`; fall back to stop order if not provided). If distances are not provided, use stop order as the distance axis. ✓/□
  - Confirm input encoding (UTF-8) and line endings. ✓/□
- Non-goals for v1:
  - No server backend; fully client-side. ✓/□
  - Persistence is required in-browser (no server): store user data in browser storage so it survives tab/browser restarts. ✓/□

## 2. Input File Formats
- Train line file (text with YAML frontmatter):
  - Parse frontmatter fields: `name` (string), `default_stop_time` (duration, `HH:MM:SS` or `MM:SS`), `period` (duration, `HH:MM:SS` or `MM:SS`), `runs` (array of start times, `HH:MM:SS` or `HH:MM`), `stop_location` (map stop->distance number, optional), `extra_stop_times` (map stop->duration, `HH:MM:SS` or `MM:SS`). ✓
  - Body contains alternating lines: stop name (string), travel time to next stop (duration, `HH:MM:SS` or `MM:SS`). Last stop has no following travel time. ✓
  - Validation rules:
    - Non-empty name, at least two stops. ✓
    - All travel times non-negative durations. ✓
    - default_stop_time ≥ 0; period > 0. ✓
    - runs times within [00:00:00, 24:00:00) or a consistent arbitrary timeline baseline. ✓
    - extra_stop_times keys must exist among stops; values ≥ 0. ✓
    - If `stop_location` is provided: keys must exist among stops; values are non-negative numbers. If omitted, stops are assumed evenly spaced for distance computations. ✓
  - Time formats:
    - Durations: `HH:MM:SS` or `MM:SS`.
    - Time of day (runs): `HH:MM:SS` or `HH:MM`. ✓
- Topography file (text):
  - One stop name per line; blank lines ignored; comments starting with `#` ignored. ✓
  - Validation:
    - No duplicates. ✓
    - All referenced stops must exist in at least one loaded line. ✓

## 3. Domain Models (TypeScript)
- Types/interfaces (strict types, avoid `any`):
  - `TimeSeconds = number` branded type to avoid unit confusion. ✓
  - `StopId = string`. ✓
  - `TrainLineMeta { name: string; defaultStopTime: TimeSeconds; period: TimeSeconds; runs: TimeOfDay[]; stopLocation?: Record<StopId, number>; extraStopTimes: Record<StopId, TimeSeconds>; }` ✓
  - `TrainLineSpec { meta: TrainLineMeta; segments: { stop: StopId; travelToNext?: TimeSeconds; }[] }` ✓
  - `Topography { stops: StopId[] }` ✓
  - `RunInstance { lineName: string; runStart: number; schedule: StopSchedulePoint[] }` ✓
  - `StopSchedulePoint { stop: StopId; arrival: number; departure: number }` ✓
  - `GraphSeries { id: string; color: string; points: { distance: number; time: number }[] }` ✓
  - `ParseError { file: string; line?: number; message: string }` ✓
  - Utility types: `Result<T, E>` to capture parsing/validation outcomes. ✓

## 4. Parsing and Validation
- Implement a pure parser for train line files:
  - Split frontmatter (YAML) and body; use a minimal YAML parser; normalize keys. ✓ (src/domain/train-line.ts: parseTrainLine)
  - Parse times:
    - Durations: accept `HH:MM:SS` and `MM:SS`; convert to seconds. ✓ (src/domain/time.ts: parseDuration)
    - Time of day (runs): accept `HH:MM:SS` and `HH:MM`; convert to seconds since baseline. ✓ (src/domain/time.ts: parseTimeOfDay)
  - Build `TrainLineSpec`; collect `ParseError[]` on issues. ✓ (src/domain/train-line.ts)
- Implement topography parser (line-by-line). ✓ (src/domain/topography.ts)
- Add cross-file validation:
  - Topography stops must be subset of union of stops across all lines. ✓ (validated in FileParserService.crossFileErrors)
  - Warn (non-fatal) for unused extra_stop_times keys. ✓
    - Implemented as warnings when extra_stop_times entries are zero seconds (redundant, no effect). Exposed via FileParserService.extraStopTimesWarnings and included in allErrors list. ✓

## 5. Scheduling Engine (Pure Functions)
- For each `TrainLineSpec` and each `run`:
  - Compute arrival/departure times per stop:
    - Start at `runStart` seconds from baseline (e.g., midnight). ✓
    - At each stop: arrival = previous departure + travel time; departure = arrival + defaultStopTime + extraStopTimes[stop] (if any). ✓
  - Enforce `period` rule: if the run finishes early, append idle at last stop until `runStart + period`. ✓
- Edge cases:
  - Zero travel time segments. ✓
  - Empty extra_stop_times. ✓
  - Overlapping runs (allowed). ✓
  - Large periods; wrap across midnight not required if using absolute seconds timeline. ✓
- Output `RunInstance` and derive `GraphSeries` points filtered by topography stops. ✓

## 6. Graph Computation and Rendering
- Axis definitions:
  - X-axis: distance. Use `stop_location` distance when provided; otherwise use evenly spaced indices based on topography order. ✓
  - Y-axis: time (seconds). ✓
- Series generation:
  - For each run, create polyline segments connecting (distance, time) for each visited stop that exists in topography. ✓
  - If a line has stops not in topography, skip those points. ✓
- Rendering:
  - Choose rendering approach: SVG for clarity/scalability; Canvas optional later for very large datasets. ✓/□
  - Implement pan/zoom (optional v1: vertical scroll, time window selection). ✓/□
  - Draw station grid lines at each topography stop; label axes. ✓/□
  - Color-code lines/runs; legend. ✓/□

## 7. Angular Application Architecture
- Routing (lazy-loaded feature):
  - `routes: [{ path: '', loadComponent: () => import('./app/graph-page/graph-page.component') }]` ✓
- Services (providedIn: 'root') using `inject()`:
  - `FileParserService` for parsing line/topography files. ✓ (src/app/services/file-parser.service.ts)
    - Use domain parsers: parseTrainLine (src/domain/train-line.ts) and parseTopography (src/domain/topography.ts). ✓
    - Return signals or Results with aggregated ParseError[] per file. ✓
  - `ScheduleService` for computing schedules and series. ✓
  - `ColorService` to assign colors per line/run. ✓
- State management (signals):
  - Signals for: loaded train lines, topography, validation errors, derived graph series, selected time window. ✓/□
  - Use `computed()` for derived series from raw inputs. ✓
  - Never use `mutate`; use `set`/`update`. ✓
- Components (standalone, OnPush, small responsibilities, inline templates where small):
  - `GraphPageComponent`: orchestrates inputs and displays graph and side panels. (Shell created; placeholder content) ✓
  - `FileDropComponent`: file picker/drag-drop for uploading multiple train line files and one topography file. ✓
    - Implement file picker (multiple train lines + single topography) and wire to FileParserService. ✓
    - Display selected file names. ✓
    - Drag-and-drop area. □
    - Pasting raw text into textareas. □
  - `ErrorListComponent`: shows parsing/validation errors. ✓ (implemented and integrated into GraphPage)
  - `GraphCanvasComponent` (SVG): renders axis, grid, and series. ✓/□
  - `LegendComponent`: color legend and toggles per line/run. ✓/□
  - `ToolbarComponent`: controls (zoom, time range, export). ✓/□
- Host bindings via `host` in decorators (avoid HostBinding/HostListener). ✓/□
- Use `NgOptimizedImage` for static images if any (logos), avoiding base64 inline. ✓/□
- Templates:
  - Use `@if`, `@for`, `@switch`; avoid structural directives equivalents. ✓/□
  - Avoid `ngClass`/`ngStyle`; prefer property/class/style bindings. ✓/□
- Change detection:
  - Ensure all components (including App and GraphPageComponent) use OnPush. ✓

## 8. UI/UX and Accessibility
- File input & editing UX:
  - Support multiple file selection, drag-and-drop, and pasting raw text into textareas. ✓/□
  - After upload or paste, display file contents in editable textareas; re-parse automatically on changes and update the graph live. ✓/□
  - Show file names and types; validate on load and on each edit; show errors with file/line context. ✓/□ (errors list shows file and line; file names shown in loader; types still pending)
- Graph UX:
  - Tooltips on hover showing stop, time, line/run name. ✓/□
  - Keyboard navigation for panning/zooming; focus management. ✓/□
  - High-contrast color palette; ARIA roles/labels for interactive elements. ✓/□
- Loading/export:
  - Allow exporting current graph as SVG/PNG; export parsed data as JSON for debugging. ✓/□

## 9. Performance and Robustness
- Efficient parsing (chunked for big files if needed). ✓/□
- Memoize computed series via `computed()` signals. ✓/□
- Virtualization for long legends or error lists. ✓/□
- Graceful handling of thousands of runs/points; consider downsampling for view. ✓/□

## 10. Persistence
- Required in-browser persistence (no server):
  - Persist all user data locally so it's available after closing/reopening the browser: uploaded files and edited textarea contents. ✓/□
  - Prefer IndexedDB for larger text blobs; fallback to localStorage if simplicity is acceptable for v1. ✓/□
  - Also persist UI state (last selected time window, toggles, graph options). ✓/□

## 11. Testing Strategy
- Unit tests:
  - Parsers (valid and invalid cases). ✓/□
  - Scheduling engine (edge cases: zero times, extra stop times, period wait). ✓/□
  - Graph series generation mapping to topography indices. ✓/□
- Component tests:
  - Signal-driven derivations and rendering conditions. ✓/□
- E2E tests:
  - Load sample files -> see lines on graph; errors visible for malformed files. ✓/□

## 12. Tooling and Configuration
- Enable strict TypeScript options (no implicit any, strict null checks). ✓ (tsconfig.json strict settings already enabled)
- ESLint/Prettier configuration aligned with Angular and signals. ✓/□
- NPM scripts for build, serve, test, e2e, lint. ✓/□

## 13. Sample Data and Docs
- Create sample train line files (2+ lines) and a sample topography file for testing/demos. ✓/□
- Update README with usage instructions and file format examples. ✓/□

## 14. Delivery Checklist
- All tasks above marked ✓.
- App builds and serves; basic flows work.
- No console errors; a11y checks pass (axe or similar).
- Code adheres to provided guidelines (standalone components, signals, OnPush, no HostBinding/HostListener decorators, etc.).
