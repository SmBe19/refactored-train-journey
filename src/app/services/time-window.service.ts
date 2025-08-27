import { Injectable, computed, signal } from '@angular/core';

export interface TimeWindow {
  // seconds since baseline (same scale as series times)
  min: number;
  max: number;
}

/**
 * Holds the selected Y-axis time window. If unset, components may auto-fit.
 * Persists to localStorage.
 */
@Injectable({ providedIn: 'root' })
export class TimeWindowService {
  private static readonly STORE_KEY = 'train-graph-viewer:v1:time-window';

  private readonly _window = signal<TimeWindow | null>(null);

  constructor() {
    // Hydrate from storage if present
    try {
      const raw = localStorage.getItem(TimeWindowService.STORE_KEY);
      if (raw) {
        const obj = JSON.parse(raw) as unknown;
        if (
          obj && typeof obj === 'object' &&
          typeof (obj as any).min === 'number' &&
          typeof (obj as any).max === 'number' &&
          (obj as any).max > (obj as any).min
        ) {
          this._window.set({ min: (obj as any).min, max: (obj as any).max });
        }
      }
    } catch {
      // ignore
    }
  }

  readonly window = computed(() => this._window());

  setWindow(win: TimeWindow | null): void {
    this._window.set(win ? { ...win } : null);
    this.persist();
  }

  reset(): void {
    this.setWindow(null);
  }

  zoom(factor: number): void {
    // factor < 1 => zoom in, > 1 => zoom out. If unset, do nothing here; caller should provide a base window.
    const win = this._window();
    if (!win) return;
    const center = (win.min + win.max) / 2;
    const half = ((win.max - win.min) / 2) * factor;
    const next: TimeWindow = { min: center - half, max: center + half };
    if (Number.isFinite(next.min) && Number.isFinite(next.max) && next.max > next.min) {
      this.setWindow(next);
    }
  }

  pan(deltaSeconds: number): void {
    const win = this._window();
    if (!win) return;
    const next: TimeWindow = { min: win.min + deltaSeconds, max: win.max + deltaSeconds };
    this.setWindow(next);
  }

  private persist(): void {
    try {
      const w = this._window();
      if (w) localStorage.setItem(TimeWindowService.STORE_KEY, JSON.stringify(w));
      else localStorage.removeItem(TimeWindowService.STORE_KEY);
    } catch {
      // ignore storage failures
    }
  }
}
