import { router } from 'expo-router';
import { useState } from 'react';
import { Image, ScrollView } from 'react-native';
import PriceLight from '@/components/PriceLight';
import ServicePicker from '@/components/ServicePicker';
import { Banner, Button, Chip, ChipRow, ErrorText, Field, H2, P, Screen } from '@/components/ui';
import { useProfile } from '@/lib/auth';
import { geocode } from '@/lib/geo';
import { errorMessage, useI18n } from '@/lib/i18n';
import { pickImage, uploadImage } from '@/lib/photos';
import { DURATIONS, berlinTime, containsContactData, parseGermanDate, parseTime, type Service } from '@/lib/rules';
import { supabase } from '@/lib/supabase';

/** Neues Gesuch: was gesucht wird, wann, wo, Fotos und was man zahlen würde. */
export default function NewPost() {
  const me = useProfile();
  const { t, lang } = useI18n();
  const [service, setService] = useState<Service>('rasen');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [unit, setUnit] = useState<'stunde' | 'auftrag'>('stunde');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [street, setStreet] = useState('');
  const [plz, setPlz] = useState(me.postal_code);
  const [city, setCity] = useState(me.city);
  const [notes, setNotes] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pMin = Number(min.replace(',', '.'));
  const pMax = Number((max || min).replace(',', '.'));

  async function addImage() {
    if (images.length >= 5) return;
    const uri = await pickImage();
    if (uri) setImages((i) => [...i, uri]);
  }

  async function publish() {
    setError(null);
    if (title.trim().length < 3) return setError(t('err_title'));
    if (description.trim().length < 5) return setError(t('err_description'));
    if (containsContactData(title) || containsContactData(description) || containsContactData(notes)) return setError(t('ERR_CONTACT_DATA'));
    if (!min || isNaN(pMin) || isNaN(pMax) || pMin < 0) return setError(t('err_price'));
    if (pMax < pMin) return setError(t('err_price_order'));
    const d = parseGermanDate(date);
    const tm = parseTime(time);
    if (!d || !tm) return setError(t('err_date'));
    const start = berlinTime(d.getFullYear(), d.getMonth() + 1, d.getDate(), tm[0], tm[1]);
    if (start < new Date()) return setError(t('err_past'));
    if (street.trim().length < 3 || !/^\d{5}$/.test(plz) || !city.trim()) return setError(t('err_address'));

    setBusy(true);
    try {
      // Adresse → Koordinaten (auf dem iPhone). Fallback: gespeicherter Standort.
      let pos = await geocode(`${street.trim()}, ${plz} ${city.trim()}, Deutschland`);
      if (!pos && me.home_lat != null) pos = { lat: me.home_lat, lng: me.home_lng! };
      if (!pos) throw new Error(t('err_no_location'));

      const { data: post, error: e1 } = await supabase.from('job_posts').insert({
        client_id: me.id, service, title: title.trim(), description: description.trim(),
        price_min: pMin, price_max: pMax, price_unit: unit,
        scheduled_start: start.toISOString(), duration_minutes: duration,
        approx_lat: pos.lat, approx_lng: pos.lng, city: city.trim(), postal_code: plz,
      }).select().single();
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('post_addresses').insert({
        post_id: post.id, street: street.trim(), postal_code: plz, city: city.trim(), notes: notes.trim() || null, lat: pos.lat, lng: pos.lng,
      });
      if (e2) throw e2;
      for (const uri of images) {
        const path = await uploadImage('photos', me.id, uri, 'post-');
        await supabase.from('photos').insert({ owner_id: me.id, kind: 'post', post_id: post.id, storage_path: path });
      }
      router.replace({ pathname: '/post/[id]', params: { id: post.id } });
    } catch (e) {
      setError(errorMessage(t, e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <H2>{t('service')}</H2>
      <ServicePicker value={service} onChange={setService} />
      <Field label={t('title')} value={title} onChangeText={setTitle} placeholder={t('post_title_ph')} maxLength={80} />
      <Field label={t('description')} value={description} onChangeText={setDescription} placeholder={t('post_desc_ph')} multiline />

      <H2>{t('photos')}</H2>
      <P muted>{t('photos_post_hint')}</P>
      <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
        {images.map((u) => <Image key={u} source={{ uri: u }} style={{ width: 90, height: 90, borderRadius: 10 }} />)}
        {images.length < 5 && <Chip label={t('add_photo')} onPress={addImage} />}
      </ScrollView>

      <H2>{t('price_client_label')}</H2>
      <ChipRow>
        <Chip label={t('per_hour_long')} selected={unit === 'stunde'} onPress={() => setUnit('stunde')} />
        <Chip label={t('per_job_long')} selected={unit === 'auftrag'} onPress={() => setUnit('auftrag')} />
      </ChipRow>
      <Field label={t('price_from')} value={min} onChangeText={setMin} keyboardType="decimal-pad" />
      <Field label={t('price_to')} value={max} onChangeText={setMax} keyboardType="decimal-pad" hint={t('price_fixed_hint')} />
      {pMin > 0 && <PriceLight service={service} min={pMin} max={pMax} unit={unit} durationMinutes={duration} showReference />}

      <H2>{t('date')}</H2>
      <Field label={t('date')} value={date} onChangeText={setDate} placeholder={lang === 'de' ? 'TT.MM.JJJJ' : 'DD.MM.YYYY'} keyboardType="numbers-and-punctuation" />
      <Field label={t('time')} value={time} onChangeText={setTime} placeholder="HH:MM" keyboardType="numbers-and-punctuation" />
      <P style={{ fontWeight: '600' }}>{t('duration')}</P>
      <ChipRow>
        {DURATIONS.map((m) => (
          <Chip key={m} label={m < 60 ? `${m} ${t('minutes')}` : `${m / 60} ${t('hours')}`} selected={duration === m} onPress={() => setDuration(m)} />
        ))}
      </ChipRow>

      <H2>{t('address')}</H2>
      <Banner>{t('address_private_hint')}</Banner>
      <Field label={t('street')} value={street} onChangeText={setStreet} autoComplete="street-address" />
      <Field label={t('postal_code')} value={plz} onChangeText={setPlz} keyboardType="number-pad" maxLength={5} />
      <Field label={t('city')} value={city} onChangeText={setCity} />
      <Field label={`${t('notes')} ${t('optional')}`} value={notes} onChangeText={setNotes} placeholder={t('notes_ph')} />

      <ErrorText>{error}</ErrorText>
      <Button title={t('publish_post')} onPress={publish} loading={busy} />
    </Screen>
  );
}
