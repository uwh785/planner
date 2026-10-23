import type { Locale } from '@/application/i18n';

/** The Intl tag for each app language (Latin American Spanish). */
const INTL_TAG: Record<Locale, string> = { es: 'es-419', en: 'en' };

/** Used only when Intl is missing or misbehaves on the device. */
const MONTHS: Record<Locale, readonly string[]> = {
  en: [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ], // prettier-ignore
  es: [
    'ene', 'feb', 'mar', 'abr', 'may', 'jun',
    'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
  ], // prettier-ignore
};

const pad = (n: number): string => String(n).padStart(2, '0');

/** Intl output, or null when Intl throws or does not even contain the digits. */
function intl(
  ms: number,
  locale: Locale,
  options: Intl.DateTimeFormatOptions,
  mustContain: string,
): string | null {
  try {
    const text = new Intl.DateTimeFormat(INTL_TAG[locale], options).format(
      new Date(ms),
    );
    return text.includes(mustContain) ? text : null;
  } catch {
    return null;
  }
}

/** "Dec 3" / "3 dic", with the year when it is not this one. */
export function dateText(ms: number, now: number, locale: Locale): string {
  const d = new Date(ms);
  const withYear = d.getFullYear() !== new Date(now).getFullYear();
  const formatted = intl(
    ms,
    locale,
    withYear
      ? { day: 'numeric', month: 'short', year: 'numeric' }
      : { day: 'numeric', month: 'short' },
    String(d.getDate()),
  );
  if (formatted !== null) {
    return formatted;
  }
  const month = MONTHS[locale][d.getMonth()]!;
  if (locale === 'es') {
    return withYear
      ? `${d.getDate()} ${month} ${d.getFullYear()}`
      : `${d.getDate()} ${month}`;
  }
  return withYear
    ? `${month} ${d.getDate()}, ${d.getFullYear()}`
    : `${month} ${d.getDate()}`;
}

/** 24-hour "14:30" in every language, like the web app. */
export function timeText(ms: number, locale: Locale): string {
  const d = new Date(ms);
  const manual = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const formatted = intl(
    ms,
    locale,
    { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
    ':',
  );
  // Only trust Intl when it agrees with the plain 24-hour reading.
  return formatted !== null && formatted.replace(/\s/g, '') === manual
    ? formatted
    : manual;
}
