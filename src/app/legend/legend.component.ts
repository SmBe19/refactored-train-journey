import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ScheduleService } from '../services/schedule.service';
import { SeriesVisibilityService } from '../services/series-visibility.service';

@Component({
  selector: 'app-legend',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'legend',
    role: 'region',
    'aria-label': 'Legend and series visibility',
  },
  template: `
    @if (series().length === 0) {
      <p class="legend__empty">No series</p>
    } @else {
      <ul class="legend__list" role="list">
        @for (s of series(); track s.id) {
          <li class="legend__item">
            <label class="legend__label">
              <input type="checkbox" [checked]="isVisible(s.id)" (change)="onToggle(s.id, $event)" />
              <span class="legend__swatch" [style.background]="s.color" aria-hidden="true"></span>
              <span class="legend__text">{{ s.id }}</span>
            </label>
          </li>
        }
      </ul>
    }
  `,
  styles: [
    `
      :host { display: block; border: 1px solid #e0e0e0; border-radius: 6px; padding: .5rem .75rem; }
      .legend__empty { color: #555; }
      .legend__list { margin: 0; padding: 0; list-style: none; display: grid; gap: .25rem .5rem; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
      .legend__item { }
      .legend__label { display: inline-flex; align-items: center; gap: .4rem; cursor: pointer; }
      .legend__swatch { width: 12px; height: 12px; border-radius: 2px; display: inline-block; border: 1px solid rgba(0,0,0,.15); }
      .legend__text { font-size: .9rem; }
    `,
  ],
})
export class LegendComponent {
  private readonly schedule = inject(ScheduleService);
  private readonly visibility = inject(SeriesVisibilityService);

  protected readonly series = computed(() => this.schedule.graphSeries());

  protected isVisible(id: string): boolean { return this.visibility.isVisible(id); }

  protected onToggle(id: string, event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const checked = !!input?.checked;
    this.visibility.setVisible(id, checked);
  }
}
