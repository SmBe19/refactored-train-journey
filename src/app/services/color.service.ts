import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ColorService {
  // High-contrast palette
  private readonly palette = [
    '#1f77b4', // blue
    '#ff7f0e', // orange
    '#2ca02c', // green
    '#d62728', // red
    '#9467bd', // purple
    '#8c564b', // brown
    '#e377c2', // pink
    '#7f7f7f', // gray
    '#bcbd22', // olive
    '#17becf', // cyan
  ];

  colorFor(id: string, group?: string): string {
    // Stable hashing based on id (and optionally group to cluster colors per line)
    const base = group ? `${group}|${id}` : id;
    let hash = 2166136261; // FNV-1a 32-bit offset basis
    for (let i = 0; i < base.length; i++) {
      hash ^= base.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const idx = Math.abs(hash) % this.palette.length;
    return this.palette[idx];
  }
}
