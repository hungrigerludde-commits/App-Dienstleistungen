import { goBack } from '@/lib/nav';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import PriceLight from '@/components/PriceLight';
import ServicePicker from '@/components/ServicePicker';
import { Button, Chip, ChipRow, ErrorText, Field, H2, Screen } from '@/components/ui';
import { useProfile } from '@/lib/auth';
import { confirm } from '@/lib/dialog';
import { errorMessage, useI18n } from '@/lib/i18n';
import { ageOn, containsContactData, fromIsoDate, type Service } from '@/lib/rules';
import { supabase } from '@/lib/supabase';

/** Angebot: was der Schüler macht und was er dafür nehmen würde (Preisspanne + Ampel). */
export default function EditOffer() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const me = useProfile();
  const { t } = useI18n();
  const [service, setService] = useState<Service>('rasen');
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
      setService(data.service);
      setTitle(data.title);
      setDescription(data.description ?? '');
      setMin(String(data.price_min));
      setMax(String(data.price_max));
      setUnit(data.price_unit);
    });
  }, [id]);

  const pMin = Number(min.replace(',', '.'));
  const pMax = Number((max || min).replace(',', '.'));

  async function save() {
    setError(null);
    if (title.trim().length < 3) return setError(t('err_title'));
    if (!min || isNaN(pMin) || isNaN(pMax) || pMin < 0 || pMax > 200) return setError(t('err_price'));
    if (pMax < pMin) return setError(t('err_price_order'));
    if (containsContactData(title) || containsContactData(description)) return setError(t('ERR_CONTACT_DATA'));
    const row = { student_id: me.id, service, title: title.trim(), description: description.trim() || null, price_min: pMin, price_max: pMax, price_unit: unit };
    setBusy(true);
    const { error } = id ? await supabase.from('offers').update(row).eq('id', id) : await supabase.from('offers').insert(row);
    setBusy(false);
    if (error) return setError(errorMessage(t, error));
    goBack();
  }

  async function remove() {
    if (!(await confirm(t('delete_offer_q'), '', t('delete'), true))) return;
    await supabase.from('offers').delete().eq('id', id!);
    goBack();
  }

  return (
    <Screen>
      <H2>{t('service')}</H2>
      <ServicePicker value={service} onChange={setService} hideAdultOnly={ageOn(fromIsoDate(me.birth_date)) < 18} />
      <Field label={t('title')} value={title} onChangeText={setTitle} placeholder={t('offer_title_ph')} maxLength={80} />
      <Field label={`${t('description')} ${t('optional')}`} value={description} onChangeText={setDescription} multiline placeholder={t('offer_desc_ph')} />
      <H2>{t('price_student_label')}</H2>
      <ChipRow>
        <Chip label={t('per_hour_long')} selected={unit === 'stunde'} onPress={() => setUnit('stunde')} />
        <Chip label={t('per_job_long')} selected={unit === 'auftrag'} onPress={() => setUnit('auftrag')} />
      </ChipRow>
      <Field label={t('price_from')} value={min} onChangeText={setMin} keyboardType="decimal-pad" />
      <Field label={t('price_to')} value={max} onChangeText={setMax} keyboardType="decimal-pad" hint={t('price_fixed_hint')} />
      {pMin > 0 && <PriceLight service={service} min={pMin} max={pMax} unit={unit} showReference />}
      <ErrorText>{error}</ErrorText>
      <Button title={t('save')} onPress={save} loading={busy} />
      {id && <Button title={t('delete')} variant="ghost" onPress={remove} />}
    </Screen>
  );
}
