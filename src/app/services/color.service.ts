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

  // Public API: id = run identifier, group = line name, baseHexOverride = optional custom base color (e.g. from config)
  colorFor(id: string, group?: string, baseHexOverride?: string): string {
    const baseHex = baseHexOverride ?? this.baseColorForGroup(group ?? id);
    // Derive stable H, S, L variations from the run id
    const { dh, ds, dl } = this.variationFromId(id);
    const { h, s, l } = this.hexToHsl(baseHex);
    // Apply deltas with clamping; hue wraps around [0,1)
    let h2 = (h + dh) % 1;
    if (h2 < 0) h2 += 1;
    const s2 = this.clamp01(s + ds);
    const l2 = this.clamp01(l + dl);
    return this.hslToHex(h2, s2, l2);
  }

  // Choose base color using group name (line) mapped to palette index
  private baseColorForGroup(key: string): string {
    const hash = this.fnv1a(key);
    const idx = Math.abs(hash) % this.palette.length;
    return this.palette[idx];
  }

  private variationFromId(id: string): { dh: number; ds: number; dl: number } {
    // Use hash-derived, bounded deltas to adjust hue, saturation, and lightness per run
    const h = this.fnv1a(id);

    // Components derived from different portions of the hash to avoid correlation
    const a = Math.abs(h);
    const b = Math.abs((h >>> 1) | 0);
    const c = Math.abs((h >>> 2) | 0);

    // Hue: ±10 degrees (~±0.028 in 0..1 range)
    const hueSteps = (a % 21) - 10; // -10..+10 (degrees)
    const dh = hueSteps / 360; // convert degrees to [0..1] hue delta

    // Saturation: ±0.10
    const satSteps = (b % 21) - 10; // -10..+10
    const ds = satSteps * (0.10 / 10); // -0.10..+0.10

    // Lightness: ±0.12 for stronger distinction
    const lightSteps = (c % 25) - 12; // -12..+12
    const dl = lightSteps * (0.12 / 12); // -0.12..+0.12

    return { dh, ds, dl };
  }

  private fnv1a(str: string): number {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash | 0;
  }

  private clamp01(x: number): number { return Math.max(0, Math.min(1, x)); }

  private hexToHsl(hex: string): { h: number; s: number; l: number } {
    const m = hex.match(/^#([0-9a-fA-F]{6})$/);
    if (!m) return { h: 0, s: 0, l: 0.5 };
    const int = parseInt(m[1], 16);
    const r = ((int >> 16) & 0xff) / 255;
    const g = ((int >> 8) & 0xff) / 255;
    const b = (int & 0xff) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    const d = max - min;
    if (d !== 0) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h, s, l };
  }

  private hslToHex(h: number, s: number, l: number): string {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    let r: number, g: number, b: number;
    if (s === 0) {
      r = g = b = l; // achromatic
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
}
