import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ScheduleService } from '../services/schedule.service';
import { FileParserService } from '../services/file-parser.service';
import { SeriesVisibilityService } from '../services/series-visibility.service';
import { GraphSeries } from '../../domain/types';

@Component({
  selector: 'app-graph-canvas',
  // standalone by default (do not set standalone: true)
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'graph-canvas',
    role: 'img',
    'aria-label': 'Train time-distance graph',
  },
  template: `
    <svg
      [attr.viewBox]="'0 0 ' + width + ' ' + height"
      [attr.width]="width"
      [attr.height]="height"
      xmlns="http://www.w3.org/2000/svg"
      class="graph"
      aria-labelledby="graphTitle"
      role="group"
    >
      <title id="graphTitle">Time-Distance Graph</title>

      <!-- Axes -->
      <line [attr.x1]="margin.left" [attr.y1]="height - margin.bottom" [attr.x2]="width - margin.right" [attr.y2]="height - margin.bottom" stroke="#424242" stroke-width="1" />
      <line [attr.x1]="margin.left" [attr.y1]="margin.top" [attr.x2]="margin.left" [attr.y2]="height - margin.bottom" stroke="#424242" stroke-width="1" />

      <!-- X axis label (bottom) -->
      <text
        [attr.x]="(margin.left + (width - margin.right)) / 2"
        [attr.y]="height - 2"
        text-anchor="middle"
        fill="#424242"
        font-size="10"
        aria-hidden="true"
      >Distance</text>

      <!-- Y axis label (left, rotated) -->
      <text
        [attr.x]="- (margin.top + (height - margin.bottom)) / 2"
        [attr.y]="12"
        transform="rotate(-90)"
        text-anchor="middle"
        fill="#424242"
        font-size="10"
        aria-hidden="true"
      >Time</text>

      <!-- Series polylines -->
      @for (s of series(); track s.id) {
        <polyline [attr.points]="pointsAttr(s)" [attr.stroke]="s.color" fill="none" stroke-width="1.5" />
      }

      <!-- Topology stop grid lines (vertical) if stop indices are used -->
      @if (topoCount() > 0 && !hasStopDistances()) {
        @for (i of topoIndices(); track i) {
          <line
            [attr.x1]="xForDistance(i)"
            [attr.y1]="margin.top"
            [attr.x2]="xForDistance(i)"
            [attr.y2]="height - margin.bottom"
            stroke="#e0e0e0"
            stroke-width="1"
          />
        }
        <!-- X-axis tick labels with stop names -->
        @for (label of topoLabels(); track label.index) {
          <text
            [attr.x]="xForDistance(label.index)"
            [attr.y]="height - margin.bottom + 12"
            text-anchor="end"
            fill="#616161"
            font-size="9"
            [attr.transform]="'rotate(-45, ' + xForDistance(label.index) + ', ' + (height - margin.bottom + 12) + ')'"
          >{{ label.name }}</text>
        }
      }

      <!-- Y-axis ticks and labels -->
      @for (tick of yTicks(); track tick) {
        <line
          [attr.x1]="margin.left - 3"
          [attr.y1]="yForTime(tick)"
          [attr.x2]="margin.left"
          [attr.y2]="yForTime(tick)"
          stroke="#424242"
          stroke-width="1"
        />
        <text
          [attr.x]="margin.left - 6"
          [attr.y]="yForTime(tick) + 3"
          text-anchor="end"
          fill="#616161"
          font-size="9"
        >{{ formatTimeLabel(tick) }}</text>
        <line
          [attr.x1]="margin.left"
          [attr.y1]="yForTime(tick)"
          [attr.x2]="width - margin.right"
          [attr.y2]="yForTime(tick)"
          stroke="#eeeeee"
          stroke-width="1"
        />
      }
    </svg>
  `,
  styles: [
    `
      :host { display: block; border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden; }
      .graph { display: block; width: 100%; height: auto; }
    `,
  ],
})
export class GraphCanvasComponent {
  private readonly schedule = inject(ScheduleService);
  private readonly files = inject(FileParserService);
  private readonly visibility = inject(SeriesVisibilityService);

  // Basic layout
  protected readonly width = 800;
  protected readonly height = 400;
  protected readonly margin = { top: 10, right: 10, bottom: 60, left: 42 } as const;

  // Data sources
  protected readonly series = computed<GraphSeries[]>(() => this.schedule.graphSeries().filter(s => this.visibility.isVisible(s.id)));

  protected readonly topoCount = computed(() => {
    const tr = this.files.parsedTopology();
    return tr && tr.ok ? tr.value.stops.length : 0;
  });

  protected readonly topoStops = computed(() => {
    const tr = this.files.parsedTopology();
    return tr && tr.ok ? tr.value.stops : [];
  });

  protected readonly hasStopDistances = computed(() => {
    // If any series has non-integer distances not matching [0..N-1], assume real distances
    const sers = this.series();
    for (const s of sers) {
      for (const p of s.points) {
        if (!Number.isInteger(p.distance)) return true;
      }
    }
    return false;
  });

  protected readonly topoIndices = computed(() => Array.from({ length: this.topoCount() }, (_, i) => i));

  protected readonly topoLabels = computed(() => this.topoStops().map((name, index) => ({ index, name })));

  // Scales
  protected xForDistance = (d: number): number => {
    const domainMinMax = this.xDomain();
    const [dmin, dmax] = domainMinMax;
    const w = this.width - this.margin.left - this.margin.right;
    if (dmax === dmin) return this.margin.left + w / 2;
    const t = (d - dmin) / (dmax - dmin);
    return this.margin.left + t * w;
  };

  protected yForTime = (tSec: number): number => {
    const [tmin, tmax] = this.yDomain();
    const h = this.height - this.margin.top - this.margin.bottom;
    if (tmax === tmin) return this.margin.top + h / 2;
    const t = (tSec - tmin) / (tmax - tmin);
    // y grows downward in SVG
    return this.margin.top + (1 - t) * h;
  };

  protected pointsAttr(s: GraphSeries): string {
    return s.points.map((p) => `${this.xForDistance(p.distance)},${this.yForTime(p.time as unknown as number)}`).join(' ');
  }

  protected readonly yTicks = computed<number[]>(() => this.generateYTicks());

  protected formatTimeLabel = (tSec: number): string => {
    const total = Math.max(0, Math.floor(tSec));
    const hh = Math.floor(total / 3600);
    const mm = Math.floor((total % 3600) / 60);
    const ss = total % 60;
    if (hh >= 1) return `${pad2(hh)}:${pad2(mm)}`; // show HH:MM once hours present
    return `${pad2(mm)}:${pad2(ss)}`; // otherwise MM:SS
  };

  private generateYTicks(): number[] {
    const [min, max] = this.yDomain();
    if (!(Number.isFinite(min) && Number.isFinite(max))) return [];
    const count = 5;
    if (max === min) return [min];
    const step = niceStep((max - min) / count);
    const start = Math.ceil(min / step) * step;
    const ticks: number[] = [];
    for (let v = start; v <= max; v += step) ticks.push(v);
    return ticks;
  }

  private xDomain(): [number, number] {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const s of this.series()) {
      for (const p of s.points) {
        if (p.distance < min) min = p.distance;
        if (p.distance > max) max = p.distance;
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
    if (min === max) return [min - 1, max + 1];
    return [min, max];
  }

  private yDomain(): [number, number] {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const s of this.series()) {
      for (const p of s.points) {
        const t = p.time as unknown as number;
        if (t < min) min = t;
        if (t > max) max = t;
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 60];
    if (min === max) return [min - 1, max + 1];
    return [min, max];
  }
}

function pad2(n: number): string { return n < 10 ? `0${n}` : String(n); }

function niceStep(raw: number): number {
  // choose a 'nice' step from {1,2,5} * 10^k
  const exp = Math.floor(Math.log10(raw));
  const base = raw / Math.pow(10, exp);
  let nice = 1;
  if (base > 5) nice = 10; else if (base > 2) nice = 5; else if (base > 1) nice = 2; else nice = 1;
  return nice * Math.pow(10, exp);
}
