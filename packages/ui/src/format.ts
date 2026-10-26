/**
 * Dates always read in the event's own timezone, never the phone's, so an
 * attendee abroad and a delegate in Lagos see the same departure time.
 */
export function inZone(iso: string, timezone: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-NG', { timeZone: timezone, ...options }).format(new Date(iso));
}

export function clock(iso: string, timezone: string): string {
  return inZone(iso, timezone, { hour: 'numeric', minute: '2-digit', hour12: true })
    .replace(/\s/g, '')
    .toLowerCase();
}

export function dayMonth(iso: string, timezone: string): string {
  return inZone(iso, timezone, { weekday: 'short', day: 'numeric' }).toUpperCase();
}

export function monthYear(iso: string, timezone: string): string {
  return inZone(iso, timezone, { month: 'short', year: 'numeric' }).toUpperCase();
}

export function fullDate(iso: string, timezone: string): string {
  return inZone(iso, timezone, { weekday: 'long', day: 'numeric', month: 'long' });
}

/** "in 12 minutes", "2 hours ago" — for the live dashboard and trip lists. */
export function relative(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  const minutes = Math.round(diff / 60_000);
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, 'hour');
  return formatter.format(Math.round(hours / 24), 'day');
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}
