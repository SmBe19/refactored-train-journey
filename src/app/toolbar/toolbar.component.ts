import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ScheduleService } from '../services/schedule.service';
import { TimeWindowService } from '../services/time-window.service';

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
      <button type="button" class="toolbar__btn" (click)="exportJson()">Export JSON</button>
      <span class="toolbar__spacer" aria-hidden="true"></span>
      <button type="button" class="toolbar__btn" (click)="fitToData()" title="Fit time range to data">Fit</button>
      <button type="button" class="toolbar__btn" (click)="zoomIn()" title="Zoom in (time)">Zoom In</button>
      <button type="button" class="toolbar__btn" (click)="zoomOut()" title="Zoom out (time)">Zoom Out</button>
      <button type="button" class="toolbar__btn" (click)="resetView()" title="Clear time range selection">Reset</button>
    </div>
  `,
  styles: [
    `
      :host { display: block; margin: .25rem 0 .5rem; }
      .toolbar__row { display: flex; gap: .5rem; flex-wrap: wrap; }
      .toolbar__btn { appearance: none; border: 1px solid #cfcfcf; background: #fafafa; padding: .4rem .6rem; border-radius: 4px; cursor: pointer; }
      .toolbar__btn:hover { background: #f3f3f3; }
      .toolbar__btn:active { background: #ececec; }
    `,
  ],
})
export class ToolbarComponent {
  private readonly schedule = inject(ScheduleService);
  private readonly timeWindow = inject(TimeWindowService);

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
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const s of series) {
      for (const p of s.points) {
        const t = p.time as unknown as number;
        if (t < min) min = t;
        if (t > max) max = t;
      }
    }
    if (Number.isFinite(min) && Number.isFinite(max) && max > min) {
      this.timeWindow.setWindow({ min, max });
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
    this.timeWindow.reset();
  }
}
