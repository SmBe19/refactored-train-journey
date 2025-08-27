import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ErrorListComponent } from '../error-list/error-list.component';
import { FileDropComponent } from '../file-drop/file-drop.component';

@Component({
  selector: 'app-graph-page',
  // Standalone by default (do not set standalone: true per guidelines)
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ErrorListComponent, FileDropComponent],
  host: {
    class: 'graph-page',
  },
  template: `
    <section class="graph-page__container" aria-labelledby="graphPageTitle">
      <h2 id="graphPageTitle" class="graph-page__title">Train Graph Viewer</h2>
      <p class="graph-page__subtitle">Load train lines and a topology to visualize schedules.</p>

      <section class="graph-page__panel" aria-labelledby="loadTitle">
        <h3 id="loadTitle" class="graph-page__panel-title">Load files</h3>
        <app-file-drop />
      </section>

      <section class="graph-page__panel" aria-labelledby="errorsTitle">
        <h3 id="errorsTitle" class="graph-page__panel-title">Messages</h3>
        <app-error-list />
      </section>
    </section>
  `,
  styles: [
    `
      :host { display: block; padding: 1rem; }
      .graph-page__title { margin: 0 0 .25rem; }
      .graph-page__subtitle { color: #555; margin: 0 0 1rem; }
      .graph-page__panel-title { margin: .75rem 0 .5rem; font-size: 1rem; }
    `,
  ],
})
export class GraphPageComponent {}
