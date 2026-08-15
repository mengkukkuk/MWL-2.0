import dayjs from 'dayjs';

/** The wire format for every date the API accepts or returns. */
export const DATE_FMT = 'YYYY-MM-DD';

/** The wire format for start_time/end_time. */
export const TIME_FMT = 'HH:mm';

export function toApiDate(value: Date | string | dayjs.Dayjs): string {
  return dayjs(value).format(DATE_FMT);
}

export function monthStart(year: number, month: number): dayjs.Dayjs {
  // dayjs months are 0-indexed; the API's are 1-indexed.
  return dayjs(new Date(year, month - 1, 1));
}

/** Every calendar day in the given 1-indexed month, as YYYY-MM-DD. */
export function daysInMonth(year: number, month: number): string[] {
  const start = monthStart(year, month);
  const count = start.daysInMonth();
  return Array.from({ length: count }, (_, i) => start.add(i, 'day').format(DATE_FMT));
}

export function isWeekend(isoDate: string): boolean {
  const day = dayjs(isoDate).day();
  return day === 0 || day === 6;
}

export function prettyDate(isoDate: string): string {
  return dayjs(isoDate).format('ddd D MMM');
}

/** Decimal hours -> "7h 30m". Hours arrive from the server as floats. */
export function formatHours(hours: number | null | undefined): string {
  if (!hours) return '—';
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  if (!whole) return `${minutes}m`;
  return minutes ? `${whole}h ${minutes}m` : `${whole}h`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exp);
  return `${value >= 10 || exp === 0 ? Math.round(value) : value.toFixed(1)} ${units[exp]}`;
}

/** Options for a year/month picker: the current month and the 23 before it. */
export function recentMonths(count = 24): { value: string; label: string }[] {
  const now = dayjs();
  return Array.from({ length: count }, (_, i) => {
    const d = now.subtract(i, 'month');
    return { value: d.format('YYYY-MM'), label: d.format('MMMM YYYY') };
  });
}
