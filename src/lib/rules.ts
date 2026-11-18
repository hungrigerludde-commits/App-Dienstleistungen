// Reine Logik ohne Abhängigkeiten – wird auch in Node-Tests verwendet.
// Die gleichen Regeln prüft die Datenbank noch einmal (siehe supabase/migrations).

import type { StringKey } from './strings';

// ---------------------------------------------------------------- Leistungen

export type Service =
  | 'rasen' | 'unkraut' | 'hecke' | 'fenster' | 'nachhilfe' | 'tanzen' | 'yoga' | 'sport'
  | 'instrument' | 'einkaufen' | 'gassi' | 'babysitting' | 'tagesmutter' | 'senioren';

export type Category = 'garten' | 'reinigung' | 'unterricht' | 'einkaufen' | 'haustiere' | 'kinder' | 'senioren';

export const CATEGORIES: { key: Category; icon: string; services: Service[] }[] = [
  { key: 'garten', icon: '🌿', services: ['rasen', 'unkraut', 'hecke'] },
  { key: 'reinigung', icon: '🪟', services: ['fenster'] },
  { key: 'unterricht', icon: '🎓', services: ['nachhilfe', 'tanzen', 'yoga', 'sport', 'instrument'] },
  { key: 'einkaufen', icon: '🛒', services: ['einkaufen'] },
  { key: 'haustiere', icon: '🐕', services: ['gassi'] },
  { key: 'kinder', icon: '🧸', services: ['babysitting', 'tagesmutter'] },
  { key: 'senioren', icon: '👵', services: ['senioren'] },
];

export const SERVICE_ICON: Record<Service, string> = {
  rasen: '🌱', unkraut: '🌾', hecke: '🌳', fenster: '🪟', nachhilfe: '📚', tanzen: '💃', yoga: '🧘',
  sport: '⚽', instrument: '🎸', einkaufen: '🛒', gassi: '🐕', babysitting: '🧸', tagesmutter: '🏠', senioren: '👵',
};

export const serviceKey = (s: string) => `svc_${s}` as StringKey;
export const categoryKey = (c: string) => `cat_${c}` as StringKey;

/** Übliche Stundensätze (Richtwerte für die Ampel), in €. Bei Bedarf anpassen. */
export const REFERENCE_PRICE: Record<Service, [number, number]> = {
  rasen: [10, 15], unkraut: [10, 14], hecke: [12, 18], fenster: [10, 15],
  nachhilfe: [10, 20], tanzen: [10, 20], yoga: [10, 20], sport: [10, 20], instrument: [12, 25],
  einkaufen: [8, 12], gassi: [8, 12], babysitting: [10, 14], tagesmutter: [8, 14], senioren: [10, 15],
};

export type PriceRating = 'fair' | 'low' | 'high';

/**
 * Ampel: Ist die Preisspanne angemessen?
 *  grün  = Mittelwert liegt im üblichen Bereich
 *  gelb  = leicht darunter/darüber
 *  rot   = deutlich darunter/darüber
 * Bei Preisen „pro Auftrag“ wird über die Dauer in einen Stundensatz umgerechnet (falls bekannt).
 */
export function ratePrice(
  service: string, min: number, max: number, unit: string, durationMinutes?: number,
): { rating: PriceRating; color: 'green' | 'yellow' | 'red'; ref: [number, number] } | null {
  const ref = REFERENCE_PRICE[service as Service];
  if (!ref || !(max >= min) || max <= 0) return null;
  let mid = (min + max) / 2;
  if (unit === 'auftrag') {
    if (!durationMinutes) return null;
    mid = mid / (durationMinutes / 60);
  }
  const [lo, hi] = ref;
  if (mid >= lo && mid <= hi) return { rating: 'fair', color: 'green', ref };
  if (mid < lo) return { rating: 'low', color: mid >= lo * 0.75 ? 'yellow' : 'red', ref };
  return { rating: 'high', color: mid <= hi * 1.3 ? 'yellow' : 'red', ref };
}

export function ageOn(birthDate: Date, at: Date = new Date()): number {
  let age = at.getFullYear() - birthDate.getFullYear();
  const m = at.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < birthDate.getDate())) age--;
  return age;
}

/** "18.11.2026" → Date (lokal) oder null */
export function parseGermanDate(s: string): Date | null {
  const m = /^\s*(\d{1,2})\.(\d{1,2})\.(\d{4})\s*$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  if (d.getDate() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1) return null;
  return d;
}

/** "14:30" → [14, 30] oder null */
export function parseTime(s: string): [number, number] | null {
  const m = /^\s*(\d{1,2})[:.](\d{2})\s*$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return [h, min];
}

/** Date → "2026-11-18" (für Postgres `date`) */
export function toIsoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function formatDateTime(iso: string, lang: 'de' | 'en' = 'de'): string {
  return new Date(iso).toLocaleString(lang === 'de' ? 'de-DE' : 'en-GB', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin',
  });
}

export function formatMoney(n: number, lang: 'de' | 'en' = 'de'): string {
  return n.toLocaleString(lang === 'de' ? 'de-DE' : 'en-GB', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
}

/** z. B. "8–12 €" (Einheit separat übersetzen) */
export function formatPriceRange(min: number, max: number, lang: 'de' | 'en' = 'de'): string {
  return min === max ? `${formatMoney(min, lang)} €` : `${formatMoney(min, lang)}–${formatMoney(max, lang)} €`;
}

/** Entfernung in km (Haversine) */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export const RADIUS_OPTIONS = [1, 2, 5, 10, 20, 50];
export const DURATIONS = [30, 60, 90, 120, 180, 240];

const EMAIL_RE = /[a-z0-9._%+-]+\s*(@|\(at\)|\[at\])\s*[a-z0-9.-]+\.[a-z]{2,}/i;
const MESSENGER_RE = /(whats\s*app|telegram|snap\s*chat|instagram|insta:|signal\s*:)/i;

/** Spiegelbild von public.contains_contact_data() in der Datenbank. */
export function containsContactData(text: string | null | undefined): boolean {
  if (!text) return false;
  const digits = text.replace(/[\s\-/().]/g, '');
  return EMAIL_RE.test(text) || /(\+|00)?\d{9,}/.test(digits) || MESSENGER_RE.test(text);
}


export type WorkRule = { minHour: number; maxHour: number; maxMinutesPerDay: number } | null;

/**
 * Arbeitszeit-Regeln nach Jugendarbeitsschutzgesetz (vereinfacht, bewusst streng):
 *  - unter 15 oder vollzeitschulpflichtig: 8–18 Uhr, max. 2 Std./Tag
 *  - 15–17 und nicht mehr vollzeitschulpflichtig: 6–20 Uhr, max. 8 Std./Tag
 *  - ab 18: keine Einschränkung
 */
export function workRuleFor(age: number, fullTimeSchool: boolean): WorkRule {
  if (age >= 18) return null;
  if (age < 15 || fullTimeSchool) return { minHour: 8, maxHour: 18, maxMinutesPerDay: 120 };
  return { minHour: 6, maxHour: 20, maxMinutesPerDay: 480 };
}

/** Gibt einen Fehlercode (ERR_…) zurück oder null, wenn der Termin erlaubt ist (deutsche Uhrzeit). */
export function checkWorkTime(rule: WorkRule, start: Date, minutes: number): string | null {
  if (!rule) return null;
  const s = berlinParts(start);
  const e = berlinParts(new Date(start.getTime() + minutes * 60_000));
  const startH = s.hour + s.minute / 60;
  const endH = e.hour + e.minute / 60 + (e.day !== s.day ? 24 : 0);
  if (startH < rule.minHour || endH > rule.maxHour) {
    return `ERR_WORK_HOURS:${rule.minHour}:${rule.maxHour}`;
  }
  if (minutes > rule.maxMinutesPerDay) {
    return `ERR_WORK_MINUTES:${rule.maxMinutesPerDay}:0`;
  }
  return null;
}

// ---- Deutsche Zeit (Europe/Berlin), unabhängig von der Zeitzone des Geräts ----

const berlinFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Berlin', hourCycle: 'h23',
  year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
});

export function berlinParts(d: Date): { year: number; month: number; day: number; hour: number; minute: number } {
  const p = Object.fromEntries(berlinFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour % 24, minute: +p.minute };
}

/** Uhrzeit "wie auf der Uhr in Deutschland" → exakter Zeitpunkt. month: 1–12 */
export function berlinTime(year: number, month: number, day: number, hour: number, minute: number): Date {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  let guess = wall;
  for (let i = 0; i < 2; i++) {
    const p = berlinParts(new Date(guess));
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    guess += wall - shown;
  }
  return new Date(guess);
}

export const JOB_STATUS_COLOR: Record<string, string> = {
  requested: '#B26A00', accepted: '#1B7F3B', declined: '#9A1C1C', cancelled: '#6B6B6B', completed: '#1F4FB2',
};

export const PAYMENT_METHODS = ['paypal', 'bank', 'vivid', 'visa'] as const;
export const REPORT_REASONS = ['belaestigung', 'unangemessen', 'gefahr', 'betrug', 'fake_profil', 'sonstiges'] as const;

/** "2010-05-05" → lokales Datum (ohne Zeitzonen-Verschiebung) */
export function fromIsoDate(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}
