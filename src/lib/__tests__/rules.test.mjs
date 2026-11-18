// Ausführen mit: npm test   (Node ≥ 22.18, nutzt eingebautes TypeScript-Stripping)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ageOn, berlinTime, berlinParts, parseGermanDate, parseTime, containsContactData, workRuleFor, checkWorkTime, formatPrice,
} from '../rules.ts';

test('Alter', () => {
  assert.equal(ageOn(new Date(2010, 10, 18), new Date(2026, 10, 18)), 16);
  assert.equal(ageOn(new Date(2010, 10, 19), new Date(2026, 10, 18)), 15);
});

test('Datum und Uhrzeit parsen', () => {
  assert.equal(parseGermanDate('31.02.2026'), null);
  assert.equal(parseGermanDate('5.3.2011')?.getMonth(), 2);
  assert.deepEqual(parseTime('9:05'), [9, 5]);
  assert.equal(parseTime('25:00'), null);
});

test('Kontaktdaten erkennen', () => {
  assert.ok(containsContactData('Ruf mich an: 0170 / 123 45 67'));
  assert.ok(containsContactData('+49 170 1234567'));
  assert.ok(containsContactData('lena(at)web.de'));
  assert.ok(containsContactData('schreib mir auf WhatsApp'));
  assert.ok(!containsContactData('Ich komme am 18.11.2026 um 14:00, Preis 10-15 €'));
  assert.ok(!containsContactData('Gartenweg 12, 12345 Musterstadt'));
});

test('Jugendschutz-Regeln', () => {
  const child = workRuleFor(14, true);
  assert.equal(checkWorkTime(child, berlinTime(2026, 11, 20, 10, 0), 90), null);
  assert.match(checkWorkTime(child, berlinTime(2026, 11, 20, 17, 30), 60), /8 und 18/);
  assert.match(checkWorkTime(child, berlinTime(2026, 11, 20, 9, 0), 180), /Maximal 2/);
  const teen = workRuleFor(16, false);
  assert.equal(checkWorkTime(teen, berlinTime(2026, 11, 20, 18, 0), 120), null);
  assert.equal(workRuleFor(18, true), null);
});

test('Preisformat', () => {
  assert.equal(formatPrice(8, 12, 'stunde'), '8–12 € / Std.');
  assert.equal(formatPrice(20, 20, 'auftrag'), '20 € pro Auftrag');
});

test('Deutsche Zeit unabhängig von Gerätezeitzone (Winter- und Sommerzeit)', () => {
  assert.equal(berlinTime(2026, 11, 21, 10, 0).toISOString(), '2026-11-21T09:00:00.000Z');
  assert.equal(berlinTime(2026, 7, 1, 10, 0).toISOString(), '2026-07-01T08:00:00.000Z');
  assert.deepEqual(berlinParts(new Date('2026-11-21T09:00:00Z')), { year: 2026, month: 11, day: 21, hour: 10, minute: 0 });
});
