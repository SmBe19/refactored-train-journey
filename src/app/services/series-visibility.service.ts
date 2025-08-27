import { Injectable, computed, signal } from '@angular/core';

/**
 * Tracks visibility of graph series by their unique id.
 * By default, all series are visible unless explicitly hidden.
 */
@Injectable({ providedIn: 'root' })
export class SeriesVisibilityService {
  // store hidden ids for compactness
  private readonly hidden = signal<Set<string>>(new Set<string>());

  readonly isAllVisible = computed(() => this.hidden().size === 0);

  isVisible(id: string): boolean {
    return !this.hidden().has(id);
  }

  setVisible(id: string, visible: boolean): void {
    this.hidden.update((set) => {
      const next = new Set(set);
      if (visible) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  toggle(id: string): void {
    this.setVisible(id, !this.isVisible(id));
  }

  // utility for components to derive current map
  readonly hiddenIds = computed(() => this.hidden());
}
