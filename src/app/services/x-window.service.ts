import { Injectable, computed, signal } from '@angular/core';

export interface XWindow {
  // distance axis window (units depend on topology mode; either stop index or real distance)
  min: number;
  max: number;
}

/**
 * Holds the selected X-axis distance window. If unset, components may auto-fit.
 * Persists to localStorage.
 */
@Injectable({ providedIn: 'root' })
export class XWindowService {
  private static readonly STORE_KEY = 'train-graph-viewer:v1:x-window';

  private readonly _window = signal<XWindow | null>(null);

  constructor() {
    // Hydrate from storage if present
    try {
      const raw = localStorage.getItem(XWindowService.STORE_KEY);
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

  setWindow(win: XWindow | null): void {
    this._window.set(win ? { ...win } : null);
    this.persist();
  }

  reset(): void {
    this.setWindow(null);
  }

  zoom(factor: number): void {
    // factor < 1 => zoom in, > 1 => zoom out. If unset, do nothing here.
    const win = this._window();
    if (!win) return;
    const center = (win.min + win.max) / 2;
    const half = ((win.max - win.min) / 2) * factor;
    const next: XWindow = { min: center - half, max: center + half };
    if (Number.isFinite(next.min) && Number.isFinite(next.max) && next.max > next.min) {
      this.setWindow(next);
    }
  }

  pan(delta: number): void {
    const win = this._window();
    if (!win) return;
    const next: XWindow = { min: win.min + delta, max: win.max + delta };
    this.setWindow(next);
  }

  private persist(): void {
    try {
      const w = this._window();
      if (w) localStorage.setItem(XWindowService.STORE_KEY, JSON.stringify(w));
      else localStorage.removeItem(XWindowService.STORE_KEY);
    } catch {
      // ignore storage failures
    }
  }
}
