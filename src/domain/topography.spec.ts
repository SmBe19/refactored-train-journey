import { parseTopography } from './topography';
import { ok } from './types';

describe('topography parser', () => {
  it('parses stop names, ignoring blanks and comments', () => {
    const text = `
# Sample topography
Alpha

  # comment with spaces
Beta
Gamma
`;
    const res = parseTopography(text, 'topo.txt');
    expect(res.ok).toBeTrue();
    if (res.ok) {
      expect(res.value.stops).toEqual(['Alpha', 'Beta', 'Gamma']);
    }
  });

  it('errors on duplicates with line numbers', () => {
    const text = `Alpha\nBeta\nAlpha`;
    const res = parseTopography(text, 'topo.txt');
    expect(res.ok).toBeFalse();
    if (!res.ok) {
      expect(res.error.length).toBe(1);
      expect(res.error[0].message).toContain('Duplicate stop name');
      expect(res.error[0].line).toBe(3);
    }
  });

  it('errors when no stops present', () => {
    const text = `# only comments\n   \n\n`;
    const res = parseTopography(text, 'topo.txt');
    expect(res.ok).toBeFalse();
    if (!res.ok) {
      expect(res.error.some(e => e.message.includes('no stops'))).toBeTrue();
    }
  });
});
