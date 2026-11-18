import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Banner, Button, Chip, ChipRow, ErrorText, Field, H2, Loading, P, Screen } from '@/components/ui';
import { useProfile } from '@/lib/auth';
import {
  CONTACT_WARNING, PAYMENT_METHODS, berlinTime, categoryLabel, checkWorkTime, containsContactData,
  formatPrice, parseGermanDate, parseTime,
} from '@/lib/rules';
import { errorText, supabase } from '@/lib/supabase';
import type { Offer, PublicProfile } from '@/lib/types';

const DURATIONS = [30, 60, 90, 120, 180, 240];

export default function RequestJob() {
  const { studentId, offerId } = useLocalSearchParams<{ studentId: string; offerId?: string }>();
  const me = useProfile();
  const [student, setStudent] = useState<PublicProfile | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offer, setOffer] = useState<string | undefined>(offerId);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [price, setPrice] = useState('');
  const [payment, setPayment] = useState('bar');
  const [street, setStreet] = useState('');
  const [plz, setPlz] = useState(me.postal_code);
  const [city, setCity] = useState(me.city);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: o }] = await Promise.all([
        supabase.from('public_profiles').select('*').eq('id', studentId).maybeSingle(),
        supabase.from('offers').select('*').eq('student_id', studentId),
      ]);
      setStudent(s as PublicProfile);
      setOffers((o ?? []) as Offer[]);
    })();
  }, [studentId]);

  if (!student) return <Loading />;

  const rule = student.work_max_minutes
    ? { minHour: student.work_min_hour!, maxHour: student.work_max_hour!, maxMinutesPerDay: student.work_max_minutes }
    : null;
  const selected = offers.find((o) => o.id === offer);

  async function send() {
    setError(null);
    if (me.verification_status !== 'verified') return setError('Dein Konto muss zuerst verifiziert werden.');
    if (!selected) return setError('Bitte wähle ein Angebot aus.');
    if (description.trim().length < 5) return setError('Bitte beschreibe kurz, was zu tun ist.');
    if (containsContactData(description) || containsContactData(notes)) return setError(CONTACT_WARNING);
    const d = parseGermanDate(date);
    const t = parseTime(time);
    if (!d || !t) return setError('Bitte gib Datum (TT.MM.JJJJ) und Uhrzeit (HH:MM) an.');
    // Termine gelten immer in deutscher Zeit – auch wenn das Handy anders eingestellt ist.
    const start = berlinTime(d.getFullYear(), d.getMonth() + 1, d.getDate(), t[0], t[1]);
    if (start < new Date()) return setError('Der Termin liegt in der Vergangenheit.');
    const ruleError = checkWorkTime(rule, start, duration);
    if (ruleError) return setError(ruleError);
    if (street.trim().length < 3 || !/^\d{5}$/.test(plz) || !city.trim()) return setError('Bitte gib die vollständige Adresse an.');
    const priceNum = price.trim() ? Number(price.replace(',', '.')) : null;
    if (priceNum !== null && (isNaN(priceNum) || priceNum < 0)) return setError('Ungültiger Preis.');

    setBusy(true);
    const { data: job, error: e1 } = await supabase.from('jobs').insert({
      client_id: me.id,
      student_id: studentId,
      offer_id: selected.id,
      category: selected.category,
      description: description.trim(),
      scheduled_start: start.toISOString(),
      duration_minutes: duration,
      agreed_price: priceNum,
      payment_method: payment,
    }).select().single();
    if (e1) { setBusy(false); return setError(errorText(e1)); }

    const { error: e2 } = await supabase.from('job_addresses').insert({
      job_id: job.id, street: street.trim(), postal_code: plz, city: city.trim(), notes: notes.trim() || null,
    });
    setBusy(false);
    if (e2) return setError(errorText(e2));
    router.replace({ pathname: '/job/[id]', params: { id: job.id } });
  }

  return (
    <Screen>
      <H2>Anfrage an {student.display_name}</H2>
      {rule && (
        <Banner>
          🛡️ Jugendschutz: {student.display_name.split(' ')[0]} darf nur zwischen {rule.minHour} und {rule.maxHour} Uhr
          und höchstens {rule.maxMinutesPerDay / 60} Stunden pro Tag arbeiten.
        </Banner>
      )}

      <P style={{ fontWeight: '600' }}>Angebot</P>
      <ChipRow>
        {offers.map((o) => (
          <Chip key={o.id} label={`${categoryLabel(o.category)} – ${o.title}`} selected={offer === o.id} onPress={() => setOffer(o.id)} />
        ))}
      </ChipRow>
      {selected && <P muted>Preisvorstellung: {formatPrice(selected.price_min, selected.price_max, selected.price_unit)}</P>}

      <Field label="Was ist zu tun?" value={description} onChangeText={setDescription} multiline
        placeholder="z. B. Rasen mähen (ca. 150 m²), Rasenmäher ist vorhanden." />
      <Field label="Datum" value={date} onChangeText={setDate} placeholder="TT.MM.JJJJ" keyboardType="numbers-and-punctuation" />
      <Field label="Uhrzeit" value={time} onChangeText={setTime} placeholder="HH:MM" keyboardType="numbers-and-punctuation" />

      <P style={{ fontWeight: '600' }}>Dauer</P>
      <ChipRow>
        {DURATIONS.filter((m) => !rule || m <= rule.maxMinutesPerDay).map((m) => (
          <Chip key={m} label={m < 60 ? `${m} Min.` : `${m / 60} Std.`} selected={duration === m} onPress={() => setDuration(m)} />
        ))}
      </ChipRow>

      <Field label="Vorgeschlagener Preis gesamt in € (optional)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
      <P style={{ fontWeight: '600' }}>Bezahlung</P>
      <ChipRow>
        {PAYMENT_METHODS.map((p) => <Chip key={p.key} label={p.label} selected={payment === p.key} onPress={() => setPayment(p.key)} />)}
      </ChipRow>
      <P muted>Die Bezahlung erfolgt direkt zwischen euch nach dem Auftrag.</P>

      <H2>Adresse</H2>
      <P muted>🔒 Die Adresse sieht der Schüler erst, nachdem er zugesagt hat.</P>
      <Field label="Straße und Hausnummer" value={street} onChangeText={setStreet} autoComplete="street-address" />
      <Field label="PLZ" value={plz} onChangeText={setPlz} keyboardType="number-pad" maxLength={5} />
      <Field label="Stadt" value={city} onChangeText={setCity} />
      <Field label="Hinweise (optional)" value={notes} onChangeText={setNotes} placeholder="z. B. Hintereingang, 2. Stock" />

      <ErrorText>{error}</ErrorText>
      <Button title="Anfrage senden" onPress={send} loading={busy} />
    </Screen>
  );
}
