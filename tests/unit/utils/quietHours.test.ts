
import { shouldNotifyNow } from '../../../src/utils/quietHours';

describe('shouldNotifyNow', () => {
  let mockFormatToParts: jest.Mock;

  beforeEach(() => {
    mockFormatToParts = jest.fn();
    jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => ({
      formatToParts: mockFormatToParts,
    } as any));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Helper to set mock return value for formatToParts
  const setMockTime = (weekday: string, hour: number, minute: number) => {
    mockFormatToParts.mockReturnValue([
      { type: 'weekday', value: weekday },
      { type: 'hour', value: hour.toString().padStart(2, '0') },
      { type: 'minute', value: minute.toString().padStart(2, '0') },
    ]);
  };

  it('should return true when within quiet hours and on an allowed day', () => {
    setMockTime('Seg', 10, 30); // Monday 10:30
    const prefs = { startMinute: 600, endMinute: 1080, weekMask: 2, timezone: 'America/Sao_Paulo' }; // 10:00-18:00, Monday
    expect(shouldNotifyNow(new Date(), prefs)).toBe(true);
  });

  it('should return false when outside quiet hours but on an allowed day', () => {
    setMockTime('Seg', 5, 0); // Monday 05:00
    const prefs = { startMinute: 600, endMinute: 1080, weekMask: 2, timezone: 'America/Sao_Paulo' }; // 10:00-18:00, Monday
    expect(shouldNotifyNow(new Date(), prefs)).toBe(false);
  });

  it('should return false when on a disallowed day', () => {
    setMockTime('Ter', 10, 30); // Tuesday 10:30
    const prefs = { startMinute: 600, endMinute: 1080, weekMask: 2, timezone: 'America/Sao_Paulo' }; // 10:00-18:00, Monday
    expect(shouldNotifyNow(new Date(), prefs)).toBe(false);
  });

  it('should handle quiet hours crossing midnight (start < end)', () => {
    // Window: 22:00 (1320) to 07:00 (420)
    const prefs = { startMinute: 1320, endMinute: 420, weekMask: 2, timezone: 'America/Sao_Paulo' }; // Monday

    setMockTime('Seg', 23, 0); // Monday 23:00 (within window)
    expect(shouldNotifyNow(new Date(), prefs)).toBe(true);

    setMockTime('Seg', 6, 0); // Monday 06:00 (within window, after midnight)
    expect(shouldNotifyNow(new Date(), prefs)).toBe(true);

    setMockTime('Seg', 10, 0); // Monday 10:00 (outside window)
    expect(shouldNotifyNow(new Date(), prefs)).toBe(false);
  });

  it('should handle edge cases for minutes', () => {
    const prefs = { startMinute: 600, endMinute: 601, weekMask: 2, timezone: 'America/Sao_Paulo' }; // 10:00-10:01, Monday

    setMockTime('Seg', 10, 0); // Monday 10:00 (start boundary)
    expect(shouldNotifyNow(new Date(), prefs)).toBe(true);

    setMockTime('Seg', 10, 1); // Monday 10:01 (end boundary, exclusive)
    expect(shouldNotifyNow(new Date(), prefs)).toBe(false);

    setMockTime('Seg', 9, 59); // Monday 09:59 (before start)
    expect(shouldNotifyNow(new Date(), prefs)).toBe(false);
  });

  it('should return false if weekMask is 0', () => {
    setMockTime('Seg', 10, 30);
    const prefs = { startMinute: 600, endMinute: 1080, weekMask: 0, timezone: 'America/Sao_Paulo' }; // No days allowed
    expect(shouldNotifyNow(new Date(), prefs)).toBe(false);
  });
});
