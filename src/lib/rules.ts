// Reine Logik ohne Abhängigkeiten – wird auch in Node-Tests verwendet.
// Die gleichen Regeln prüft die Datenbank noch einmal (siehe supabase/migrations).

export type Category =
  | 'nachhilfe' | 'musik' | 'garten' | 'fenster' | 'einkaufen'
  | 'haushalt' | 'haustiere' | 'technik' | 'babysitting' | 'sonstiges';

export const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key: 'nachhilfe', label: 'Nachhilfe', icon: '📚' },
  { key: 'musik', label: 'Musikunterricht', icon: '🎸' },
  { key: 'garten', label: 'Garten (Rasen, Hecke)', icon: '🌿' },
  { key: 'fenster', label: 'Fenster putzen', icon: '🪟' },
  { key: 'einkaufen', label: 'Einkäufe', icon: '🛒' },
  { key: 'haushalt', label: 'Haushaltshilfe', icon: '🧹' },
  { key: 'haustiere', label: 'Haustiere / Gassi', icon: '🐕' },
  { key: 'technik', label: 'Handy- & PC-Hilfe', icon: '💻' },
  { key: 'babysitting', label: 'Babysitting', icon: '🧸' },
  { key: 'sonstiges', label: 'Sonstiges', icon: '✨' },
];

export function categoryLabel(key: string): string {
  const c = CATEGORIES.find((x) => x.key === key);
  return c ? `${c.icon} ${c.label}` : key;
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

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('de-DE', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin',
  });
}

export function formatPrice(min: number, max: number, unit: string): string {
  const f = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
  const range = min === max ? `${f(min)} €` : `${f(min)}–${f(max)} €`;
  return unit === 'stunde' ? `${range} / Std.` : `${range} pro Auftrag`;
}

const EMAIL_RE = /[a-z0-9._%+-]+\s*(@|\(at\)|\[at\])\s*[a-z0-9.-]+\.[a-z]{2,}/i;
const MESSENGER_RE = /(whats\s*app|telegram|snap\s*chat|instagram|insta:|signal\s*:)/i;

/** Spiegelbild von public.contains_contact_data() in der Datenbank. */
export function containsContactData(text: string | null | undefined): boolean {
  if (!text) return false;
  const digits = text.replace(/[\s\-/().]/g, '');
  return EMAIL_RE.test(text) || /(\+|00)?\d{9,}/.test(digits) || MESSENGER_RE.test(text);
}

export const CONTACT_WARNING =
  'Aus Sicherheitsgründen sind Telefonnummern, E-Mail-Adressen und Messenger-Namen nicht erlaubt. Bitte nutzt den Chat in der App.';

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

/** Gibt eine Fehlermeldung zurück oder null, wenn der Termin erlaubt ist (deutsche Uhrzeit). */
export function checkWorkTime(rule: WorkRule, start: Date, minutes: number): string | null {
  if (!rule) return null;
  const s = berlinParts(start);
  const e = berlinParts(new Date(start.getTime() + minutes * 60_000));
  const startH = s.hour + s.minute / 60;
  const endH = e.hour + e.minute / 60 + (e.day !== s.day ? 24 : 0);
  if (startH < rule.minHour || endH > rule.maxHour) {
    return `Jugendschutz: Dieser Schüler darf nur zwischen ${rule.minHour} und ${rule.maxHour} Uhr arbeiten.`;
  }
  if (minutes > rule.maxMinutesPerDay) {
    return `Jugendschutz: Maximal ${rule.maxMinutesPerDay / 60} Stunden pro Tag.`;
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

export const JOB_STATUS: Record<string, { label: string; color: string }> = {
  requested: { label: 'Angefragt', color: '#B26A00' },
  accepted: { label: 'Zugesagt', color: '#1B7F3B' },
  declined: { label: 'Abgelehnt', color: '#9A1C1C' },
  cancelled: { label: 'Abgesagt', color: '#6B6B6B' },
  completed: { label: 'Erledigt', color: '#1F4FB2' },
};

export const PAYMENT_METHODS: { key: string; label: string }[] = [
  { key: 'bar', label: 'Bar' },
  { key: 'paypal', label: 'PayPal' },
  { key: 'ueberweisung', label: 'Überweisung' },
];

export const REPORT_REASONS: { key: string; label: string }[] = [
  { key: 'belaestigung', label: 'Belästigung' },
  { key: 'unangemessen', label: 'Unangemessenes Verhalten' },
  { key: 'gefahr', label: 'Ich fühle mich nicht sicher' },
  { key: 'betrug', label: 'Betrug / nicht bezahlt' },
  { key: 'fake_profil', label: 'Falsches Profil' },
  { key: 'sonstiges', label: 'Sonstiges' },
];

/** "2010-05-05" → lokales Datum (ohne Zeitzonen-Verschiebung) */
export function fromIsoDate(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}
