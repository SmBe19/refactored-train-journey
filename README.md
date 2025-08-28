# refactored-train-journey

Train graph viewer for trains in games

## Overview
Displays a train graph (time-distance graph) to help schedule trains in games.

Specify the paths of the train lines using stops and the required time between stops. Then, specify the starting times of the train runs on a given line. Finally, specify a list of stops along which you want to display the train graph.

## Train lines
Each train line is specified by a text file, containing alternating lines of stop names and travel times (`HH:MM:SS` or `MM:SS`). At the top, in a yaml formatted frontmatter. A train line represents a certain train type with its characteristics running along a certain route. For example, if you have multiple trains with different maximal speeds, you have to specify them in separate train lines.

The frontmatter can contain the following fields: `name`, `default_stop_time`, `period`, `runs`, `repeat_runs`, `custom_stop_times`, `base_color`.

- `name` is the name of the train line.
- `default_stop_time` is the default time the train stops at each stop (`HH:MM:SS` or `MM:SS`).
- `period` is the target duration of the whole train line. If the train is too fast, it will wait at the last stop until the end of the period (`HH:MM:SS` or `MM:SS`).
- `runs` is a list of departure times for the train line (`HH:MM:SS` or `HH:MM`).
- `repeat_runs` optionally repeats each listed run additional times, spaced by the `period`. For example, `repeat_runs: 2` renders each run 3 times total at start, start+period, start+2*period.
- `custom_stop_times` is a map of stop names to dwell time (`HH:MM:SS` or `MM:SS`). You can target a specific occurrence of a stop (when the same stop appears multiple times in a line) by using the syntax `StopName#N` where `N` is the 1-based occurrence index. For example: `Central#2: 00:01:00` applies only to the second time "Central" appears. A plain key without `#N` (e.g., `Central: 00:00:30`) applies to all occurrences. When both are present, the occurrence-specific value overrides the plain value for that occurrence.
- `base_color` lets you specify a custom base color for all runs of this line. It must be a hex color in the form `#RRGGBB` or `RRGGBB`. Note: in YAML, `#` starts a comment, so either quote the value (`"#1F77B4"`) or omit the `#` (e.g., `1F77B4`). All runs of the same line share this base color, and each run gets a stable variation (slight hue, saturation, and lightness shifts) for clearer differentiation.


Example of per-occurrence custom stop time:

```
---
name: Local A
default_stop_time: 00:00:30
period: 01:00:00
runs:
  - 06:00
custom_stop_times:
  Meadow: 00:00:30   # applies to all occurrences of Meadow
  Meadow#2: 00:01:00 # custom dwell for the 2nd occurrence only (overrides base)
---
Central
02:00
East Side
02:30
Meadow
01:45
Hilltop
01:45
Meadow
02:30
East Side
02:00
Central
```

In this example, the second time the train stops at Meadow it will dwell for Meadow#2 (00:01:00) because occurrence-specific custom_stop_times override base custom_stop_times, which both replace the default_stop_time.

All durations (e.g. stop times and travel times) are in the format `HH:MM:SS` or `MM:SS`. Time of day (e.g. runs) are in the format `HH:MM:SS` or `HH:MM`.

## Topology
The topology (the list of stops which should be displayed in the graph) is specified in a single text file, containing the name of the stops, one per line.

## Graph details
- Axes:
  - X axis uses stop order indices (0..N-1) and labels each vertical grid line with the stop name.
  - Y axis is time and increases downward (top = earlier time, bottom = later time), matching SVG coordinate space. Ticks show MM:SS until 1 hour, then HH:MM.
- Multiple runs: every departure in `runs` is rendered as its own colored series. The legend shows one toggle per run (LineName@StartTime).
- Colors: All runs of the same line share the same base color. Each run is rendered with a stable variation of that base color (slight hue, saturation, and lightness shifts) for clearer differentiation. You can override the base color per line via the optional `base_color` frontmatter field.
- Period handling: if a run completes early, it idles at the last stop until `runStart + period` (this affects its final timestamp on the graph).

## Usage
Files can either be uploaded or directly pasted into the textareas. After uploading, the files can be edited in textareas and the page will automatically update. All the data is stored in the browser, so it is available after closing the browser.

## Development

### Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

### Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.
