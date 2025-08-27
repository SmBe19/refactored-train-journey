import { parseDuration, parseTimeOfDay } from './time';
import { asTimeOfDaySeconds, asTimeSeconds } from './types';

describe('time parsing', () => {
  describe('parseDuration', () => {
    it('parses MM:SS', () => {
      const res = parseDuration('05:30');
      expect(res.ok).toBeTrue();
      if (res.ok) {
        expect(res.value).toBe(asTimeSeconds(5 * 60 + 30));
      }
    });

    it('parses HH:MM:SS', () => {
      const res = parseDuration('01:02:03');
      expect(res.ok).toBeTrue();
      if (res.ok) {
        expect(res.value).toBe(asTimeSeconds(1 * 3600 + 2 * 60 + 3));
      }
    });

    it('rejects seconds >= 60', () => {
      const res = parseDuration('00:61');
      expect(res.ok).toBeFalse();
    });
  });

  describe('parseTimeOfDay', () => {
    it('parses HH:MM', () => {
      const res = parseTimeOfDay('09:15');
      expect(res.ok).toBeTrue();
      if (res.ok) {
        expect(res.value).toBe(asTimeOfDaySeconds(9 * 3600 + 15 * 60));
      }
    });

    it('parses HH:MM:SS', () => {
      const res = parseTimeOfDay('23:59:59');
      expect(res.ok).toBeTrue();
      if (res.ok) {
        expect(res.value).toBe(asTimeOfDaySeconds(23 * 3600 + 59 * 60 + 59));
      }
    });

    it('rejects invalid format', () => {
      const res = parseTimeOfDay('9-15');
      expect(res.ok).toBeFalse();
    });
  });
});
