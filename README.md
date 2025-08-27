# refactored-train-journey

Train graph viewer for trains in games

## Overview
Displays a train graph (time-distance graph) to help schedule trains in games.

Specify the paths of the train lines using stops and the required time between stops. Then, specify the starting times of the train runs on a given line. Finally, specify a list of stops along which you want to display the train graph.

## Train lines
Each train line is specified by a text file, containing alternating lines of stop names and travel times. At the top, in a yaml formatted frontmatter. A train line represents a certain train type with its characteristics running along a certain route. For example, if you have multiple trains with different maximal speeds, you have to specify them in separate train lines.

The frontmatter contains the following fields: `name`, `default_stop_time`, `period`, `runs`, `extra_stop_times`.

- `name` is the name of the train line.
- `default_stop_time` is the default time the train stops at each stop.
- `period` is the target duration of the whole train line. If the train is too fast, it will wait at the last stop until the end of the period.
- `runs` is a list of departure times for the train line.
- `extra_stop_times` is a map of stop names to extra time the train stops at that stop. This is in addition to the default stop time. If a stop is not specified in this map, no extra time is added.

## Topography
The topography (the list of stops which should be displayed in the graph) is specified in a single text file, containing the name of the stops, one per line.

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
