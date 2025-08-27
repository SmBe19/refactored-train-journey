# refactored-train-journey

Train graph viewer for trains in games

## Overview
Displays a train graph (time-distance graph) to help schedule trains in games.

Specify the paths of the train lines using stops and the required time between stops. Then, specify the starting times of the train runs on a given line. Finally, specify a list of stops along which you want to display the train graph.

## Train lines
Each train line is specified by a text file, containing alternating lines of stop names and travel times (`HH:MM:SS` or `MM:SS`). At the top, in a yaml formatted frontmatter. A train line represents a certain train type with its characteristics running along a certain route. For example, if you have multiple trains with different maximal speeds, you have to specify them in separate train lines.

The frontmatter contains the following fields: `name`, `default_stop_time`, `period`, `runs`, `stop_location`, `extra_stop_times`.

- `name` is the name of the train line.
- `default_stop_time` is the default time the train stops at each stop (`HH:MM:SS` or `MM:SS`).
- `period` is the target duration of the whole train line. If the train is too fast, it will wait at the last stop until the end of the period (`HH:MM:SS` or `MM:SS`).
- `runs` is a list of departure times for the train line (`HH:MM:SS` or `HH:MM`).
- `stop_location` is a map of stop names to the distance from the start of the line. This is optional, if not specified, it is assumed the stops are spaced evenly along the line.
- `extra_stop_times` is a map of stop names to extra time the train stops at that stop (`HH:MM:SS` or `MM:SS`). This is in addition to the default stop time. If a stop is not specified in this map, no extra time is added.

All durations (e.g. stop times and travel times) are in the format `HH:MM:SS` or `MM:SS`. Time of day (e.g. runs) are in the format `HH:MM:SS` or `HH:MM`.

## Topology
The topology (the list of stops which should be displayed in the graph) is specified in a single text file, containing the name of the stops, one per line.

## Graph details
- Axes:
  - X axis is distance along the line.
    - If `stop_location` is provided in the train line frontmatter, those numeric distances are used and the X axis shows numeric ticks with vertical grid lines.
    - If `stop_location` is not provided, the X axis uses stop order indices (0..N-1) and labels each vertical grid line with the stop name.
  - Y axis is time and increases downward (top = earlier time, bottom = later time), matching SVG coordinate space. Ticks show MM:SS until 1 hour, then HH:MM.
- Multiple runs: every departure in `runs` is rendered as its own colored series. The legend shows one toggle per run (LineName@StartTime).
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
