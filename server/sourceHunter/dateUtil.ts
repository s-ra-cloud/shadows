/**
 * Date helpers producing timestamps that match Python's
 * `datetime.isoformat()` output for UTC-aware datetimes.
 */

/** Coerce an ISO string or Date (default now) into a Date. */
export function coerceAssessedAt(assessedAt?: string | Date): Date {
  if (assessedAt === undefined) {
    return new Date();
  }
  if (assessedAt instanceof Date) {
    return assessedAt;
  }
  return new Date(assessedAt);
}

/**
 * Format a Date like Python's `datetime.isoformat()` for a UTC-aware value:
 * `YYYY-MM-DDTHH:MM:SS[.ffffff]+00:00`. Microseconds are only included when
 * the millisecond component is non-zero (Python omits a zero fractional part).
 */
export function isoFormat(date: Date): string {
  const pad = (value: number, width = 2) => String(value).padStart(width, "0");
  const yyyy = pad(date.getUTCFullYear(), 4);
  const mm = pad(date.getUTCMonth() + 1);
  const dd = pad(date.getUTCDate());
  const hh = pad(date.getUTCHours());
  const min = pad(date.getUTCMinutes());
  const ss = pad(date.getUTCSeconds());
  const ms = date.getUTCMilliseconds();
  let fractional = "";
  if (ms !== 0) {
    // Python isoformat renders microseconds (6 digits); JS Date only has ms.
    fractional = "." + pad(ms, 3) + "000";
  }
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}${fractional}+00:00`;
}
