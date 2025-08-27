import { ChangeDetectionStrategy, Component, WritableSignal, signal } from '@angular/core';
import { ErrorListComponent } from '../error-list/error-list.component';
import { FileDropComponent } from '../file-drop/file-drop.component';
import { GraphCanvasComponent } from '../graph-canvas/graph-canvas.component';
import { LegendComponent } from '../legend/legend.component';
import { ToolbarComponent } from '../toolbar/toolbar.component';
import { HelpExamplesComponent } from '../help-examples/help-examples.component';

@Component({
  selector: 'app-graph-page',
  // Standalone by default (do not set standalone: true per guidelines)
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ErrorListComponent, FileDropComponent, GraphCanvasComponent, LegendComponent, ToolbarComponent, HelpExamplesComponent],
  host: {
    class: 'graph-page',
  },
  template: `
    <section class="graph-page__container" aria-labelledby="graphPageTitle">
      <div class="split" role="group" aria-label="Workspace split between inputs and graph">
        <!-- Left pane: inputs, messages, legend -->
        <aside class="split__left" [style.width.px]="leftWidth()" role="region" aria-label="Inputs and messages">
          <header class="graph-page__header">
            <h2 id="graphPageTitle" class="graph-page__title">Train Graph Viewer</h2>
            <p class="graph-page__subtitle">Load train lines and a topology to visualize schedules.</p>
          </header>
          <section class="graph-page__panel" aria-labelledby="loadTitle">
            <h3 id="loadTitle" class="graph-page__panel-title">Load files</h3>
            <app-help-examples />
            <app-file-drop />
          </section>

          <section class="graph-page__panel" aria-labelledby="errorsTitle">
            <h3 id="errorsTitle" class="graph-page__panel-title">Messages</h3>
            <app-error-list />
          </section>

          <section class="graph-page__panel" aria-labelledby="legendTitle">
            <h3 id="legendTitle" class="graph-page__panel-title">Legend</h3>
            <app-legend />
          </section>
        </aside>

        <!-- Resizer -->
        <div
          class="split__separator"
          role="separator"
          aria-orientation="vertical"
          tabindex="0"
          aria-label="Resize panels"
          (mousedown)="onSeparatorMouseDown($event)"
          (pointerdown)="onSeparatorPointerDown($event)"
          (dblclick)="onSeparatorDoubleClick()"
          (keydown)="onSeparatorKeydown($event)"
        ></div>

        <!-- Right pane: graph -->
        <main class="split__right" role="region" aria-label="Graph area">
          <section class="graph-page__panel" aria-labelledby="graphTitle">
            <h3 id="graphTitle" class="graph-page__panel-title">Graph</h3>
            <app-toolbar />
            <app-graph-canvas />
          </section>
        </main>
      </div>
    </section>
  `,
  styles: [
    `
      :host { display: block; position: fixed; inset: 0; padding: 1rem; box-sizing: border-box; }
      .graph-page__container { height: 100%; min-height: 0; display: flex; }
      .graph-page__title { margin: 0 0 .25rem; }
      .graph-page__subtitle { color: #555; margin: 0 0 1rem; }
      .graph-page__panel-title { margin: .75rem 0 .5rem; font-size: 1rem; }

      .split { display: flex; height: 100%; flex: 1 1 auto; border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden; min-height: 0; }
      .split__left { flex: 0 0 auto; min-width: 240px; max-width: 70vw; padding: .75rem; overflow: auto; background: #fafafa; min-height: 0; -webkit-overflow-scrolling: touch; }
      .split__right { flex: 1 1 auto; padding: .75rem; overflow: hidden; display: flex; min-width: 0; min-height: 0; }
      .split__separator { width: 6px; cursor: col-resize; background: #e0e0e0; outline: none; touch-action: none; user-select: none; }
      .split__separator:focus { box-shadow: inset 0 0 0 2px #1976d2; }

      /* Right panel layout: toolbar top, graph fills remaining height */
      .split__right .graph-page__panel { display: flex; flex-direction: column; flex: 1 1 auto; min-width: 0; min-height: 0; overflow: hidden; }
      .split__right app-toolbar { flex: 0 0 auto; }
      .split__right app-graph-canvas { flex: 1 1 auto; min-height: 0; }

      @media (max-width: 800px) {
        .split { flex-direction: column; height: auto; }
        .split__left { width: auto !important; max-width: none; }
        .split__right { display: block; overflow: auto; }
        .split__separator { display: none; }
      }
    `,
  ],
})
export class GraphPageComponent {
  protected readonly leftWidth: WritableSignal<number> = signal(GraphPageComponent.loadWidth());

  private static readonly STORE_KEY = 'train-graph-viewer:v1:split-left';
  private static loadWidth(): number {
    try {
      const raw = localStorage.getItem(GraphPageComponent.STORE_KEY);
      const v = raw ? Number(raw) : 360;
      return Number.isFinite(v) && v >= 240 ? v : 360;
    } catch { return 360; }
  }
  private persistWidth(): void {
    try { localStorage.setItem(GraphPageComponent.STORE_KEY, String(this.leftWidth())); } catch {}
  }

  // Drag resizing without HostListener decorator
  private dragging = false;
  private startX = 0;
  private startWidth = 0;

  onSeparatorMouseDown(ev: MouseEvent): void {
    ev.preventDefault();
    this.dragging = true;
    this.startX = ev.clientX;
    this.startWidth = this.leftWidth();
    window.addEventListener('mousemove', this.onWindowMouseMove);
    window.addEventListener('mouseup', this.onWindowMouseUp, { once: true });
  }

  private onWindowMouseMove = (e: MouseEvent) => {
    if (!this.dragging) return;
    const delta = e.clientX - this.startX;
    const next = Math.max(240, Math.min(window.innerWidth * 0.7, this.startWidth + delta));
    this.leftWidth.set(next);
  };

  private onWindowMouseUp = () => {
    if (!this.dragging) return;
    this.dragging = false;
    window.removeEventListener('mousemove', this.onWindowMouseMove);
    this.persistWidth();
  };

  // Pointer events for touch/pen support
  private pointerActive = false;
  private pointerId: number | null = null;

  onSeparatorPointerDown(ev: PointerEvent): void {
    ev.preventDefault();
    this.pointerActive = true;
    this.pointerId = ev.pointerId;
    this.startX = ev.clientX;
    this.startWidth = this.leftWidth();
    (ev.target as Element).setPointerCapture(ev.pointerId);
    window.addEventListener('pointermove', this.onWindowPointerMove);
    window.addEventListener('pointerup', this.onWindowPointerUp, { once: true });
  }

  private onWindowPointerMove = (e: PointerEvent) => {
    if (!this.pointerActive) return;
    const delta = e.clientX - this.startX;
    const next = Math.max(240, Math.min(window.innerWidth * 0.7, this.startWidth + delta));
    this.leftWidth.set(next);
    e.preventDefault();
  };

  private onWindowPointerUp = (e: PointerEvent) => {
    if (!this.pointerActive) return;
    this.pointerActive = false;
    if (this.pointerId !== null) {
      try { (e.target as Element | null)?.releasePointerCapture?.(this.pointerId); } catch {}
    }
    window.removeEventListener('pointermove', this.onWindowPointerMove);
    this.persistWidth();
    this.pointerId = null;
  };

  onSeparatorDoubleClick(): void {
    const DEFAULT = 360;
    this.leftWidth.set(DEFAULT);
    this.persistWidth();
  }

  onSeparatorKeydown(ev: KeyboardEvent): void {
    const step = ev.shiftKey ? 40 : 10;
    if (ev.key === 'ArrowLeft') {
      this.leftWidth.update(w => Math.max(240, w - step));
      this.persistWidth();
      ev.preventDefault();
    } else if (ev.key === 'ArrowRight') {
      this.leftWidth.update(w => Math.min(window.innerWidth * 0.7, w + step));
      this.persistWidth();
      ev.preventDefault();
    } else if (ev.key === 'Home') {
      // Reset to default width via keyboard as well
      this.leftWidth.set(360);
      this.persistWidth();
      ev.preventDefault();
    }
  }
}
