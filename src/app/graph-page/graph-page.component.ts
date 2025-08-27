import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-graph-page',
  // Standalone by default (do not set standalone: true per guidelines)
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'graph-page',
  },
  template: `
    <section class="graph-page__container" aria-labelledby="graphPageTitle">
      <h2 id="graphPageTitle" class="graph-page__title">Train Graph Viewer</h2>
      <p class="graph-page__subtitle">Load train lines and a topography to visualize schedules.</p>
      <!-- Placeholder; components to be added in later tasks -->
    </section>
  `,
  styles: [
    `
      :host { display: block; padding: 1rem; }
      .graph-page__title { margin: 0 0 .25rem; }
      .graph-page__subtitle { color: #555; margin: 0 0 1rem; }
    `,
  ],
})
export class GraphPageComponent {}
