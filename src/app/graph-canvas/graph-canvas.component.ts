import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ScheduleService } from '../services/schedule.service';
import { FileParserService } from '../services/file-parser.service';
import { SeriesVisibilityService } from '../services/series-visibility.service';
import { GraphSeries } from '../../domain/types';
import { TimeWindow, TimeWindowService } from '../services/time-window.service';
import { XWindow, XWindowService } from '../services/x-window.service';

@Component({
  selector: 'app-graph-canvas',
  // standalone by default (do not set standalone: true)
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'graph-canvas',
    role: 'img',
    'aria-label': 'Train time-distance graph',
    tabindex: '0',
    'aria-keyshortcuts': '+, -, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, PageUp, PageDown, [, ]',
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
      (wheel)="onWheel($event)"
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
          <rect [attr.x]="tooltipRectX()" y="-22" rx="3" ry="3" width="160" height="40" fill="rgba(255,255,255,0.9)" stroke="#999"/>
          <text [attr.x]="tooltipTextX()" y="-6" font-size="10" fill="#111">{{ hoverTextLine1() }}</text>
          <text [attr.x]="tooltipTextX()" y="8" font-size="10" fill="#444">{{ hoverTextLine2() }}</text>
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
  private readonly xWindow = inject(XWindowService);

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

  // Tooltip layout and flipping logic: flip to the left if too close to right border
  private readonly tooltipWidth = 160;
  private readonly tooltipPadX = 6; // space between point and tooltip box
  protected readonly hoverFlipLeft = computed<boolean>(() => {
    const x = this.hoverX();
    const rightLimit = this.width - this.margin.right;
    return x + this.tooltipPadX + this.tooltipWidth > rightLimit;
  });
  protected readonly tooltipRectX = computed<number>(() => this.hoverFlipLeft() ? -(this.tooltipWidth + this.tooltipPadX) : this.tooltipPadX);
  protected readonly tooltipTextX = computed<number>(() => this.hoverFlipLeft() ? -this.tooltipWidth : (this.tooltipPadX + 6));

  // Drag state
  protected readonly dragging = signal(false);
  private dragStartY = 0;
  private dragStartX = 0;
  private dragStartWindowY: TimeWindow | null = null;
  private dragStartWindowX: XWindow | null = null;
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
    // Start dragging to pan the view. No modifiers are required; we support panning both axes.
    const svg = ev.currentTarget as SVGSVGElement | null;
    if (!svg) return;

    // Ensure both windows exist (initialize from auto domains if needed)
    this.ensureYWindow();
    this.ensureXWindow();

    const winY = this.timeWindow.window();
    const winX = this.xWindow.window();
    // If neither axis has a valid window (e.g., no data), abort
    if (!winY && !winX) return;

    // Capture drag start positions and windows
    this.dragStartY = ev.clientY;
    this.dragStartX = ev.clientX;
    this.dragStartWindowY = winY ? { ...winY } as TimeWindow : null;
    this.dragStartWindowX = winX ? { ...winX } as XWindow : null;

    this.dragSvgEl = svg;
    this.dragging.set(true);
    this.hoverActive.set(false); // avoid flicker during drag
    ev.preventDefault(); // avoid text selection
  }

  onDocumentMouseMove(ev: MouseEvent): void {
    if (!this.dragging() || !this.dragSvgEl) return;
    const rect = this.dragSvgEl.getBoundingClientRect();

    // Pan Y-axis if we captured a Y window at drag start
    if (this.dragStartWindowY) {
      const scaleY = this.height / rect.height; // CSS px -> SVG units
      const dyCss = ev.clientY - this.dragStartY;
      const dySvg = dyCss * scaleY;
      const h = this.height - this.margin.top - this.margin.bottom;
      const rangeY = this.dragStartWindowY.max - this.dragStartWindowY.min;
      if (rangeY > 0 && h > 0) {
        // Invert so content follows pointer
        const deltaSeconds = -dySvg * (rangeY / h);
        const nextY: TimeWindow = {
          min: this.dragStartWindowY.min + deltaSeconds,
          max: this.dragStartWindowY.max + deltaSeconds,
        };
        this.timeWindow.setWindow(nextY);
      }
    }

    // Pan X-axis if we captured an X window at drag start
    if (this.dragStartWindowX) {
      const scaleX = this.width / rect.width; // CSS px -> SVG units
      const dxCss = ev.clientX - this.dragStartX;
      const dxSvg = dxCss * scaleX;
      const w = this.width - this.margin.left - this.margin.right;
      const rangeX = this.dragStartWindowX.max - this.dragStartWindowX.min;
      if (rangeX > 0 && w > 0) {
        const deltaDist = -dxSvg * (rangeX / w);
        const nextX: XWindow = {
          min: this.dragStartWindowX.min + deltaDist,
          max: this.dragStartWindowX.max + deltaDist,
        };
        this.xWindow.setWindow(this.clampXWindow(nextX));
      }
    }
  }

  onDocumentMouseUp(): void {
    if (!this.dragging()) return;
    this.dragging.set(false);
    this.dragStartWindowY = null;
    this.dragStartWindowX = null;
    this.dragSvgEl = null;
  }

  onKeydown(ev: KeyboardEvent): void {
    // Ignore keyboard shortcuts when focus is in an editable element (e.g., textarea, input, contenteditable)
    if (this.isFromEditable(ev)) return;

    // Enable keyboard pan/zoom of the view
    const key = ev.key;
    const ctrlOrMeta = ev.ctrlKey || ev.metaKey;
    const shift = ev.shiftKey;

    // Y-axis pan increments (seconds)
    const panSmallY = 60;
    const panLargeY = 300;

    // X-axis pan increments depend on current range for consistent feel
    const [xmin, xmax] = this.xDomain();
    const xRange = Math.max(1e-9, xmax - xmin);
    const panSmallX = xRange / 20; // 5% of current view
    const panLargeX = xRange / 4;  // 25% of current view

    if (key === '+' || key === '=' || (key === 'Add' && ctrlOrMeta)) {
      this.ensureYWindow();
      this.timeWindow.zoom(0.8); // zoom in (20% tighter) on Y
      ev.preventDefault();
      return;
    }
    if (key === '-' || key === '_' || key === 'Subtract') {
      this.ensureYWindow();
      this.timeWindow.zoom(1.25); // zoom out (25% wider) on Y
      ev.preventDefault();
      return;
    }
    if (key === 'ArrowUp' || key === 'PageUp') {
      this.ensureYWindow();
      this.timeWindow.pan(-(shift ? panLargeY : panSmallY));
      ev.preventDefault();
      return;
    }
    if (key === 'ArrowDown' || key === 'PageDown') {
      this.ensureYWindow();
      this.timeWindow.pan(shift ? panLargeY : panSmallY);
      ev.preventDefault();
      return;
    }
    if (key === 'ArrowLeft') {
      this.ensureXWindow();
      this.panXClamped(-(shift ? panLargeX : panSmallX));
      ev.preventDefault();
      return;
    }
    if (key === 'ArrowRight') {
      this.ensureXWindow();
      this.panXClamped(shift ? panLargeX : panSmallX);
      ev.preventDefault();
      return;
    }
    if (key === '[') {
      this.ensureXWindow();
      this.zoomXClamped(0.8); // zoom in X
      ev.preventDefault();
      return;
    }
    if (key === ']') {
      this.ensureXWindow();
      this.zoomXClamped(1.25); // zoom out X (limited)
      ev.preventDefault();
      return;
    }
  }

  onWheel(ev: WheelEvent): void {
    // Mouse wheel zoom: Shift + wheel => horizontal zoom, plain wheel => vertical zoom
    const factor = ev.deltaY > 0 ? 1.1 : 0.9; // zoom out on wheel down, in on wheel up
    if (ev.shiftKey) {
      this.ensureXWindow();
      this.zoomXClamped(factor);
      ev.preventDefault();
      return;
    }
    // Default to vertical (time) zoom on wheel without modifiers
    this.ensureYWindow();
    this.timeWindow.zoom(factor);
    ev.preventDefault();
  }

  private panXClamped(delta: number): void {
    const win = this.xWindow.window();
    if (!win) return;
    const next: XWindow = { min: win.min + delta, max: win.max + delta };
    this.xWindow.setWindow(this.clampXWindow(next));
  }

  private zoomXClamped(factor: number): void {
    const win = this.xWindow.window();
    if (!win) return;
    const center = (win.min + win.max) / 2;
    const half = ((win.max - win.min) / 2) * factor;
    const next: XWindow = { min: center - half, max: center + half };
    this.xWindow.setWindow(this.clampXWindow(next));
  }

  // Return true if the keyboard event originated from an editable control where typing should not trigger graph shortcuts
  private isFromEditable(ev: KeyboardEvent): boolean {
    const target = ev.target as EventTarget | null;
    if (!target) return false;
    // If the active element is editable, respect it regardless of event target
    const active = (typeof document !== 'undefined') ? (document.activeElement as Element | null) : null;

    const isEditableElement = (el: Element | null): boolean => {
      if (!el) return false;
      if (el instanceof HTMLInputElement) return true;
      if (el instanceof HTMLTextAreaElement) return true;
      if ((el as HTMLElement).isContentEditable) return true;
      const role = (el as HTMLElement).getAttribute?.('role');
      if (role === 'textbox') return true;
      const tag = el.tagName?.toLowerCase();
      return tag === 'input' || tag === 'textarea';
    };

    return isEditableElement(target as Element | null) || isEditableElement(active);
  }

  private ensureYWindow(): void {
    if (this.timeWindow.window()) return;
    // If no selection is set, initialize using current auto-fit y-domain
    const [min, max] = this.yDomain();
    if (Number.isFinite(min) && Number.isFinite(max) && max > min) {
      this.timeWindow.setWindow({ min, max });
    }
  }

  private ensureXWindow(): void {
    if (this.xWindow.window()) return;
    const [min, max] = this.xDomainAuto();
    if (Number.isFinite(min) && Number.isFinite(max) && max > min) {
      this.xWindow.setWindow({ min, max });
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
    const targetCount = 6;
    if (max === min) return [min];
    const raw = (max - min) / targetCount;
    const step = niceTimeStep(raw);
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
    const sel = this.xWindow.window();
    if (sel) return [sel.min, sel.max];
    return this.xDomainAuto();
  }

  // Clamp an X window to the auto domain (prevents panning outside and zooming out past full extent)
  private clampXWindow(win: XWindow): XWindow {
    const [amin, amax] = this.xDomainAuto();
    let min = win.min;
    let max = win.max;
    const aSpan = amax - amin;
    const span = max - min;
    if (!(aSpan > 0)) {
      // Degenerate; fallback to auto domain
      return { min: amin, max: amax };
    }
    // Do not allow span to exceed available auto domain
    let clampedSpan = Math.min(span, aSpan);
    if (!(clampedSpan > 0)) clampedSpan = aSpan / 1000; // avoid zero/negative
    // Recenter around original center but clamp to bounds
    const center = (min + max) / 2;
    min = center - clampedSpan / 2;
    max = center + clampedSpan / 2;
    // Shift to fit if outside bounds
    if (min < amin) {
      const shift = amin - min;
      min += shift;
      max += shift;
    }
    if (max > amax) {
      const shift = max - amax;
      min -= shift;
      max -= shift;
    }
    // Final clamp in case of numerical drift
    min = Math.max(amin, min);
    max = Math.min(amax, max);
    // Ensure min < max
    if (max <= min) {
      return { min: amin, max: amax };
    }
    return { min, max };
  }

  private xDomainAuto(): [number, number] {
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

function niceTimeStep(rawSeconds: number): number {
  // Predefined nice time steps in seconds: include common 1,2,5 and 10 multiples plus 15 and 30 mins/hours
  if (!(rawSeconds > 0)) return 1;
  const steps: number[] = [
    1, 2, 5, 10, 15, 30,
    60, 120, 300, 600, 900, 1800,
    3600, 7200, 10800, 14400, 21600, 43200, 86400
  ];
  for (const s of steps) {
    if (rawSeconds <= s) return s;
  }
  // If above our largest, scale by factors of 2 to keep it reasonable
  let s = steps[steps.length - 1];
  while (rawSeconds > s) s *= 2;
  return s;
}

// format numeric distance compactly
function formatNumberCompact(n: number): string {
  const s = n.toFixed(2);
  return s.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}
