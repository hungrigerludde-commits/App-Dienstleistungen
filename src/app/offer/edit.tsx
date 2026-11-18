import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, Chip, ChipRow, ErrorText, Field, P, Screen } from '@/components/ui';
import { useProfile } from '@/lib/auth';
import { confirm } from '@/lib/dialog';
import { CATEGORIES, CONTACT_WARNING, containsContactData, type Category } from '@/lib/rules';
import { errorText, supabase } from '@/lib/supabase';

const PLACEHOLDER: Partial<Record<Category, string>> = {
  nachhilfe: 'z. B. Mathe & Englisch bis Klasse 8',
  musik: 'z. B. Gitarre für Anfänger',
  garten: 'z. B. Rasen mähen & Hecke schneiden',
  fenster: 'z. B. Fenster putzen innen & außen',
  einkaufen: 'z. B. Wocheneinkauf für Senioren',
};

export default function EditOffer() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const me = useProfile();
  const [category, setCategory] = useState<Category>('nachhilfe');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [unit, setUnit] = useState<'stunde' | 'auftrag'>('stunde');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase.from('offers').select('*').eq('id', id).single().then(({ data }) => {
      if (!data) return;
      setCategory(data.category);
      setTitle(data.title);
      setDescription(data.description ?? '');
      setMin(String(data.price_min));
      setMax(String(data.price_max));
      setUnit(data.price_unit);
    });
  }, [id]);

  async function save() {
    setError(null);
    const pMin = Number(min.replace(',', '.'));
    const pMax = Number((max || min).replace(',', '.'));
    if (title.trim().length < 3) return setError('Bitte gib einen Titel ein (mind. 3 Zeichen).');
    if (!min || isNaN(pMin) || isNaN(pMax) || pMin < 0) return setError('Bitte gib einen gültigen Preis ein.');
    if (pMax < pMin) return setError('Der Höchstpreis muss größer als der Mindestpreis sein.');
    if (pMax > 200) return setError('Der Preis darf höchstens 200 € betragen.');
    if (containsContactData(title) || containsContactData(description)) return setError(CONTACT_WARNING);

    const row = {
      student_id: me.id, category, title: title.trim(), description: description.trim() || null,
      price_min: pMin, price_max: pMax, price_unit: unit,
    };
    setBusy(true);
    const { error } = id
      ? await supabase.from('offers').update(row).eq('id', id)
      : await supabase.from('offers').insert(row);
    setBusy(false);
    if (error) return setError(errorText(error));
    router.back();
  }

  async function remove() {
    if (!(await confirm('Angebot löschen?', 'Das Angebot wird entfernt.', 'Löschen', true))) return;
    await supabase.from('offers').delete().eq('id', id!);
    router.back();
  }

  return (
    <Screen>
      <P style={{ fontWeight: '600' }}>Kategorie</P>
      <ChipRow>
        {CATEGORIES.map((c) => (
          <Chip key={c.key} label={`${c.icon} ${c.label}`} selected={category === c.key} onPress={() => setCategory(c.key)} />
        ))}
      </ChipRow>
      <Field label="Titel" value={title} onChangeText={setTitle} placeholder={PLACEHOLDER[category] ?? 'Was bietest du an?'} maxLength={80} />
      <Field label="Beschreibung (optional)" value={description} onChangeText={setDescription} multiline
        placeholder="Was kannst du besonders gut? Welche Erfahrung hast du?" />

      <P style={{ fontWeight: '600' }}>Preis</P>
      <ChipRow>
        <Chip label="pro Stunde" selected={unit === 'stunde'} onPress={() => setUnit('stunde')} />
        <Chip label="pro Auftrag" selected={unit === 'auftrag'} onPress={() => setUnit('auftrag')} />
      </ChipRow>
      <Field label="Von (€)" value={min} onChangeText={setMin} keyboardType="decimal-pad" placeholder="z. B. 8" />
      <Field label="Bis (€)" value={max} onChangeText={setMax} keyboardType="decimal-pad" placeholder="z. B. 12" hint="Leer lassen für einen Festpreis." />

      <ErrorText>{error}</ErrorText>
      <Button title="Speichern" onPress={save} loading={busy} />
      {id && <Button title="Angebot löschen" variant="ghost" onPress={remove} />}
    </Screen>
  );
}
