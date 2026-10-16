// Formattazione di date e scadenze per la UI, sempre nell'ora del Malawi.
const TIME_ZONE = "Africa/Blantyre";
const DAY_MS = 24 * 60 * 60 * 1000;

const dayKey = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

function calendarDaysBetween(from: Date, to: Date): number {
  return Math.round((Date.parse(dayKey(to)) - Date.parse(dayKey(from))) / DAY_MS);
}

/** "overdue", "today", "tomorrow", "in 3 days". */
export function formatDue(dueAt: string | Date | null, now: Date): string | null {
  if (!dueAt) return null;
  const due = typeof dueAt === "string" ? new Date(dueAt) : dueAt;
  if (due.getTime() < now.getTime()) return "overdue";
  const days = calendarDaysBetween(now, due);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

/** "1 Mar" */
export function formatShortDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, day: "numeric", month: "short" }).format(d);
}

/** "Mon 1 Mar 2027" */
export function formatLongDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** "07:00" */
export function formatTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(d);
}

/** "Mon" per una data "YYYY-MM-DD". */
export function formatWeekday(isoDate: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short" }).format(new Date(isoDate));
}

export function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ");
}
