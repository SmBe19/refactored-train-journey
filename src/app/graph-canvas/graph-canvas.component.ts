import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ScheduleService } from '../services/schedule.service';
import { FileParserService } from '../services/file-parser.service';
import { SeriesVisibilityService } from '../services/series-visibility.service';
import { GraphSeries } from '../../domain/types';
import { TimeWindow, TimeWindowService } from '../services/time-window.service';

@Component({
  selector: 'app-graph-canvas',
  // standalone by default (do not set standalone: true)
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'graph-canvas',
    role: 'img',
    'aria-label': 'Train time-distance graph',
    tabindex: '0',
    'aria-keyshortcuts': '+, -, ArrowUp, ArrowDown, PageUp, PageDown',
    '(keydown)': 'onKeydown($event)',
    '(document:keydown)': 'onKeydown($event)',
    '(document:mousemove)': 'onDocumentMouseMove($event)',
    '(document:mouseup)': 'onDocumentMouseUp()',
    '[class.dragging]': 'dragging()'
  },
  template: `
    <svg
      [attr.viewBox]="'0 0 ' + width + ' ' + height"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      class="graph"
      aria-labelledby="graphTitle"
      role="group"
      (mousemove)="onPointerMove($event)"
      (mouseleave)="onPointerLeave()"
      (mousedown)="onDragStart($event)"
      [style.cursor]="dragging() ? 'grabbing' : 'grab'"
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
      } @else {
        <!-- Real-distance mode: numeric X-axis ticks and grid lines -->
        @for (tick of xTicks(); track tick) {
          <!-- bottom tick mark -->
          <line
            [attr.x1]="xForDistance(tick)"
            [attr.y1]="height - margin.bottom"
            [attr.x2]="xForDistance(tick)"
            [attr.y2]="height - margin.bottom + 4"
            stroke="#424242"
            stroke-width="1"
          />
          <!-- vertical grid line -->
          <line
            [attr.x1]="xForDistance(tick)"
            [attr.y1]="margin.top"
            [attr.x2]="xForDistance(tick)"
            [attr.y2]="height - margin.bottom"
            stroke="#eeeeee"
            stroke-width="1"
          />
          <!-- numeric label -->
          <text
            [attr.x]="xForDistance(tick)"
            [attr.y]="height - margin.bottom + 16"
            text-anchor="middle"
            fill="#616161"
            font-size="9"
          >{{ formatDistanceLabel(tick) }}</text>
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

      <!-- Hover tooltip -->
      @if (hoverActive()) {
        <g class="tooltip" [attr.transform]="'translate(' + hoverX() + ',' + hoverY() + ')'">
          <circle r="3" fill="#000"/>
          <rect x="6" y="-22" rx="3" ry="3" width="160" height="40" fill="rgba(255,255,255,0.9)" stroke="#999"/>
          <text x="12" y="-6" font-size="10" fill="#111">{{ hoverTextLine1() }}</text>
          <text x="12" y="8" font-size="10" fill="#444">{{ hoverTextLine2() }}</text>
        </g>
      }
    </svg>
  `,
  styles: [
    `
      :host { display: block; border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden; height: 100%; box-sizing: border-box; }
      :host.dragging { user-select: none; }
      .graph { display: block; width: 100%; height: 100%; }
    `,
  ],
})
export class GraphCanvasComponent {
  private readonly schedule = inject(ScheduleService);
  private readonly files = inject(FileParserService);
  private readonly visibility = inject(SeriesVisibilityService);
  private readonly timeWindow = inject(TimeWindowService);

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

  protected readonly hasStopDistances = computed(() => false);

  protected readonly topoIndices = computed(() => Array.from({ length: this.topoCount() }, (_, i) => i));

  protected readonly topoLabels = computed(() => this.topoStops().map((name, index) => ({ index, name })));

  // Hover state
  protected readonly hoverActive = signal(false);
  protected readonly hoverX = signal(0);
  protected readonly hoverY = signal(0);
  protected readonly hoverTextLine1 = signal('');
  protected readonly hoverTextLine2 = signal('');

  // Drag state
  protected readonly dragging = signal(false);
  private dragStartY = 0;
  private dragStartWindow: TimeWindow | null = null;
  private dragSvgEl: SVGSVGElement | null = null;

  onPointerMove(ev: MouseEvent): void {
    if (this.dragging()) return; // suppress hover updates during drag
    const svg = ev.currentTarget as SVGSVGElement | null;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    // convert pointer position from CSS pixels to SVG user-space (viewBox) units
    const scaleX = this.width / rect.width;
    const scaleY = this.height / rect.height;
    const px = (ev.clientX - rect.left) * scaleX;
    const py = (ev.clientY - rect.top) * scaleY;
    // Note: we compute nearest point in SVG user space for simplicity

    // Find nearest point across visible series (euclidean in screen space)
    let best: { sx: number; sy: number; label1: string; label2: string } | null = null;
    const sers = this.series();
    for (const s of sers) {
      for (const p of s.points) {
        const sx = this.xForDistance(p.distance);
        const sy = this.yForTime(p.time as unknown as number);
        const dx = sx - px;
        const dy = sy - py;
        const dist2 = dx * dx + dy * dy;
        if (!best || dist2 < (best as any).d2) {
          const timeLabel = this.formatTimeFull(p.time as unknown as number);
          let stopLabel = '';
          if (!this.hasStopDistances()) {
            const idx = Math.round(p.distance);
            const stops = this.topoStops();
            if (idx >= 0 && idx < stops.length) stopLabel = stops[idx];
          }
          const l1 = stopLabel ? `${stopLabel} — ${timeLabel}` : `${timeLabel}`;
          const l2 = s.id;
          best = { sx, sy, label1: l1, label2: l2 } as any;
          (best as any).d2 = dist2;
        }
      }
    }

    if (best) {
      this.hoverActive.set(true);
      this.hoverX.set(best.sx);
      this.hoverY.set(best.sy);
      this.hoverTextLine1.set(best.label1);
      this.hoverTextLine2.set(best.label2);
    } else {
      this.hoverActive.set(false);
    }
  }

  onPointerLeave(): void {
    if (!this.dragging()) this.hoverActive.set(false);
  }

  onDragStart(ev: MouseEvent): void {
    // Start dragging to pan vertically (time axis)
    const svg = ev.currentTarget as SVGSVGElement | null;
    if (!svg) return;
    this.ensureWindow();
    const win = this.timeWindow.window();
    // If still no window (no data?), do nothing
    if (!win) return;
    this.dragging.set(true);
    this.dragStartY = ev.clientY;
    this.dragStartWindow = { ...win } as TimeWindow;
    this.dragSvgEl = svg;
    // also hide hover to avoid flicker
    this.hoverActive.set(false);
    // prevent default to avoid text selection
    ev.preventDefault();
  }

  onDocumentMouseMove(ev: MouseEvent): void {
    if (!this.dragging() || !this.dragStartWindow || !this.dragSvgEl) return;
    const rect = this.dragSvgEl.getBoundingClientRect();
    const scaleY = this.height / rect.height; // CSS px -> SVG units
    const dyCss = ev.clientY - this.dragStartY;
    const dySvg = dyCss * scaleY;
    const h = this.height - this.margin.top - this.margin.bottom;
    const range = this.dragStartWindow.max - this.dragStartWindow.min;
    if (!(range > 0 && h > 0)) return;
    // Invert to make content follow the pointer: dragging down moves content down (earlier times)
    const deltaSeconds = -dySvg * (range / h);
    const next: TimeWindow = {
      min: this.dragStartWindow.min + deltaSeconds,
      max: this.dragStartWindow.max + deltaSeconds,
    };
    this.timeWindow.setWindow(next);
  }

  onDocumentMouseUp(): void {
    if (!this.dragging()) return;
    this.dragging.set(false);
    this.dragStartWindow = null;
    this.dragSvgEl = null;
  }

  onKeydown(ev: KeyboardEvent): void {
    // Enable keyboard pan/zoom of the time window
    const key = ev.key;
    const ctrlOrMeta = ev.ctrlKey || ev.metaKey;
    const shift = ev.shiftKey;

    // Determine actions. We consider common keys without requiring modifiers.
    // Prevent default scrolling for handled keys.
    const panSmall = 60; // seconds
    const panLarge = 300; // seconds

    if (key === '+' || key === '=' || (key === 'Add' && ctrlOrMeta)) {
      this.ensureWindow();
      this.timeWindow.zoom(0.8); // zoom in (20% tighter)
      ev.preventDefault();
      return;
    }
    if (key === '-' || key === '_' || key === 'Subtract') {
      this.ensureWindow();
      this.timeWindow.zoom(1.25); // zoom out (25% wider)
      ev.preventDefault();
      return;
    }
    if (key === 'ArrowUp' || key === 'PageUp') {
      this.ensureWindow();
      this.timeWindow.pan(-(shift ? panLarge : panSmall));
      ev.preventDefault();
      return;
    }
    if (key === 'ArrowDown' || key === 'PageDown') {
      this.ensureWindow();
      this.timeWindow.pan(shift ? panLarge : panSmall);
      ev.preventDefault();
      return;
    }
  }

  private ensureWindow(): void {
    if (this.timeWindow.window()) return;
    // If no selection is set, initialize using current auto-fit y-domain
    const [min, max] = this.yDomain();
    if (Number.isFinite(min) && Number.isFinite(max) && max > min) {
      this.timeWindow.setWindow({ min, max });
    }
  }

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
    // y grows downward in SVG; later times should have larger y
    return this.margin.top + t * h;
  };

  protected pointsAttr(s: GraphSeries): string {
    return s.points.map((p) => `${this.xForDistance(p.distance)},${this.yForTime(p.time as unknown as number)}`).join(' ');
  }

  protected readonly xTicks = computed<number[]>(() => this.generateXTicks());
  protected readonly yTicks = computed<number[]>(() => this.generateYTicks());

  protected formatDistanceLabel = (d: number): string => formatNumberCompact(d);

  protected formatTimeLabel = (tSec: number): string => {
    const total = Math.max(0, Math.floor(tSec));
    const hh = Math.floor(total / 3600);
    const mm = Math.floor((total % 3600) / 60);
    const ss = total % 60;
    if (hh >= 1) return `${pad2(hh)}:${pad2(mm)}`; // show HH:MM once hours present
    return `${pad2(mm)}:${pad2(ss)}`; // otherwise MM:SS
  };

  // Tooltip formatter: always show HH:MM:SS for seconds precision
  protected formatTimeFull = (tSec: number): string => {
    const total = Math.max(0, Math.floor(tSec));
    const hh = Math.floor(total / 3600);
    const mm = Math.floor((total % 3600) / 60);
    const ss = total % 60;
    return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
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

  private generateXTicks(): number[] {
    const [min, max] = this.xDomain();
    if (!(Number.isFinite(min) && Number.isFinite(max))) return [];
    const count = 6;
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
    const sel = this.timeWindow.window();
    if (sel) {
      return [sel.min, sel.max];
    }
    // auto-fit from series if no selection
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
  if (!(raw > 0)) return 1;
  const exp = Math.floor(Math.log10(raw));
  const base = raw / Math.pow(10, exp);
  let nice = 1;
  if (base > 5) nice = 10; else if (base > 2) nice = 5; else if (base > 1) nice = 2; else nice = 1;
  return nice * Math.pow(10, exp);
}

// format numeric distance compactly
function formatNumberCompact(n: number): string {
  const s = n.toFixed(2);
  return s.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}
