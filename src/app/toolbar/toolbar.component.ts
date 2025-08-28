import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ScheduleService } from '../services/schedule.service';
import { TimeWindowService } from '../services/time-window.service';
import { XWindowService } from '../services/x-window.service';

@Component({
  selector: 'app-toolbar',
  // standalone by default; do not set standalone: true per guidelines
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'toolbar',
    role: 'toolbar',
    'aria-label': 'Graph tools',
  },
  template: `
    <div class="toolbar__row">
      <button type="button" class="toolbar__btn" (click)="exportSvg()">Export SVG</button>
      <button type="button" class="toolbar__btn" (click)="exportPng()">Export PNG</button>
      <button type="button" class="toolbar__btn" (click)="exportJson()">Export JSON</button>
      <span class="toolbar__spacer" aria-hidden="true"></span>
      <button type="button" class="toolbar__btn" (click)="resetView()" title="Clear time range selection">Reset</button>
      <button type="button" class="toolbar__btn" (click)="fitToData()" title="Fit time range to data">Fit</button>
      <button type="button" class="toolbar__btn" (click)="zoomIn()" title="Zoom in (time)">+ Y</button>
      <button type="button" class="toolbar__btn" (click)="zoomOut()" title="Zoom out (time)">- Y</button>
      <button type="button" class="toolbar__btn" (click)="zoomInX()" title="Zoom in (horizontal)">+ X</button>
      <button type="button" class="toolbar__btn" (click)="zoomOutX()" title="Zoom out (horizontal)">- X</button>
    </div>
  `,
  styles: [
    `
      :host { display: block; margin: .25rem 0 .5rem; }
      .toolbar__row { display: flex; gap: .5rem; flex-wrap: wrap; }
      .toolbar__btn {
        appearance: none;
        border: 1px solid #0d47a1; /* darker for contrast */
        background: #1976d2;      /* AA contrast on white */
        color: #fff;
        padding: .4rem .6rem;
        border-radius: 4px;
        cursor: pointer;
      }
      .toolbar__btn:hover { background: #1565c0; }
      .toolbar__btn:active { background: #0f5bb1; }
      .toolbar__btn:focus-visible {
        outline: 3px solid #ffab00; /* high-vis focus */
        outline-offset: 2px;
      }
    `,
  ],
})
export class ToolbarComponent {
  private readonly schedule = inject(ScheduleService);
  private readonly timeWindow = inject(TimeWindowService);
  private readonly xWindow = inject(XWindowService);

  // cache series as a computed for JSON export
  protected readonly series = computed(() => this.schedule.graphSeries());

  exportSvg(): void {
    // Find the first SVG element with class 'graph' (rendered by GraphCanvasComponent)
    const el = document.querySelector('svg.graph');
    if (!el) {
      return;
    }
    const svg = el as SVGSVGElement;
    // Ensure xmlns attribute exists for standalone file
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const serialized = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
    this.downloadBlob(blob, `train-graph-${this.timestamp()}.svg`);
  }

  exportPng(): void {
    const el = document.querySelector('svg.graph');
    if (!el) return;
    const svg = el as SVGSVGElement;

    // Determine size from viewBox or width/height attributes
    const viewBox = svg.getAttribute('viewBox');
    let width = Number(svg.getAttribute('width')) || 0;
    let height = Number(svg.getAttribute('height')) || 0;
    if (viewBox) {
      const parts = viewBox.split(/\s+/).map(Number);
      if (parts.length === 4) {
        width = parts[2];
        height = parts[3];
      }
    }
    if (!(width > 0 && height > 0)) {
      // fallback to bounding box
      const bbox = svg.getBoundingClientRect();
      width = Math.max(1, Math.floor(bbox.width));
      height = Math.max(1, Math.floor(bbox.height));
    }

    // Serialize SVG
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const serialized = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    // Draw onto a canvas via an Image
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        // Clear with white background to avoid transparent PNG if desired
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) this.downloadBlob(blob, `train-graph-${this.timestamp()}.png`);
          URL.revokeObjectURL(url);
        }, 'image/png');
      } catch {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  exportJson(): void {
    const data = this.series().map(s => ({
      id: s.id,
      color: s.color,
      points: s.points.map(p => ({ distance: p.distance, time: p.time as unknown as number })),
    }));
    const json = JSON.stringify({ series: data }, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    this.downloadBlob(blob, `train-graph-series-${this.timestamp()}.json`);
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  private timestamp(): string {
    const d = new Date();
    // YYYYMMDD-HHMMSS
    const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  // ---- Time window controls ----
  fitToData(): void {
    const series = this.series();
    let tmin = Number.POSITIVE_INFINITY;
    let tmax = Number.NEGATIVE_INFINITY;
    for (const s of series) {
      for (const p of s.points) {
        const t = p.time as unknown as number;
        if (t < tmin) tmin = t;
        if (t > tmax) tmax = t;
      }
    }
    if (Number.isFinite(tmin) && Number.isFinite(tmax) && tmax > tmin) {
      this.timeWindow.setWindow({ min: tmin, max: tmax });
    }
    // Also fit horizontal (X) window to data domain
    const [xmin, xmax] = this.xAutoDomain();
    if (Number.isFinite(xmin) && Number.isFinite(xmax) && xmax > xmin) {
      this.xWindow.setWindow({ min: xmin, max: xmax });
    }
  }

  zoomIn(): void {
    if (!this.timeWindow.window()) {
      this.fitToData();
    }
    this.timeWindow.zoom(0.5);
  }

  zoomOut(): void {
    if (!this.timeWindow.window()) {
      this.fitToData();
    }
    this.timeWindow.zoom(2);
  }

  resetView(): void {
    // Reset both Y (time) and X (distance) windows so the canvas returns to auto-fit on both axes
    this.timeWindow.reset();
    this.xWindow.reset();
  }

  // ---- Horizontal (X) zoom controls ----
  zoomInX(): void {
    this.ensureXWindow();
    this.zoomXClamped(0.5);
  }

  zoomOutX(): void {
    this.ensureXWindow();
    this.zoomXClamped(2);
  }

  private ensureXWindow(): void {
    if (this.xWindow.window()) return;
    const [min, max] = this.xAutoDomain();
    if (Number.isFinite(min) && Number.isFinite(max) && max > min) {
      this.xWindow.setWindow({ min, max });
    }
  }

  private xAutoDomain(): [number, number] {
    // Use the same auto-fit rules as the canvas: pad when all distances are identical
    const series = this.series();
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const s of series) {
      for (const p of s.points) {
        const d = p.distance;
        if (d < min) min = d;
        if (d > max) max = d;
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
    if (min === max) return [min - 1, max + 1];
    return [min, max];
  }

  private clampXWindow(win: { min: number; max: number }): { min: number; max: number } {
    const [amin, amax] = this.xAutoDomain();
    let min = win.min;
    let max = win.max;
    const aSpan = amax - amin;
    const span = max - min;
    if (!(aSpan > 0)) return { min: amin, max: amax };
    let clampedSpan = Math.min(span, aSpan);
    if (!(clampedSpan > 0)) clampedSpan = aSpan / 1000;
    const center = (min + max) / 2;
    min = center - clampedSpan / 2;
    max = center + clampedSpan / 2;
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
    min = Math.max(amin, min);
    max = Math.min(amax, max);
    if (max <= min) return { min: amin, max: amax };
    return { min, max };
  }

  private zoomXClamped(factor: number): void {
    const win = this.xWindow.window();
    if (!win) return;
    const center = (win.min + win.max) / 2;
    const half = ((win.max - win.min) / 2) * factor;
    const next = { min: center - half, max: center + half };
    this.xWindow.setWindow(this.clampXWindow(next));
  }
}
