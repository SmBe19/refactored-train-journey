import { Injectable, computed, signal } from '@angular/core';

/**
 * Tracks visibility of graph series by their unique id.
 * By default, all series are visible unless explicitly hidden.
 */
@Injectable({ providedIn: 'root' })
export class SeriesVisibilityService {
  private static readonly STORE_KEY = 'train-graph-viewer:v1:series-visibility';

  // store hidden ids for compactness
  private readonly hidden = signal<Set<string>>(new Set<string>());

  constructor() {
    // Hydrate from localStorage if present
    try {
      const raw = localStorage.getItem(SeriesVisibilityService.STORE_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as unknown;
        if (Array.isArray(arr)) {
          const set = new Set<string>();
          for (const v of arr) if (typeof v === 'string') set.add(v);
          this.hidden.set(set);
        }
      }
    } catch {
      // ignore storage errors
    }
  }

  private persist(): void {
    try {
      const arr = Array.from(this.hidden());
      localStorage.setItem(SeriesVisibilityService.STORE_KEY, JSON.stringify(arr));
    } catch {
      // swallow storage errors (quota, etc.)
    }
  }

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
    this.persist();
  }

  toggle(id: string): void {
    this.setVisible(id, !this.isVisible(id));
  }

  // utility for components to derive current map
  readonly hiddenIds = computed(() => this.hidden());
}
