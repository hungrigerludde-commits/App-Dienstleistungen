import { goBack } from '@/lib/nav';
import { useState } from 'react';
import AppMap from '@/components/AppMap';
import { Banner, Button, Chip, ChipRow, ErrorText, Field, H2, P, Screen } from '@/components/ui';
import { useAuth, useProfile } from '@/lib/auth';
import { currentPosition, geocode } from '@/lib/geo';
import { errorMessage, useI18n } from '@/lib/i18n';
import { RADIUS_OPTIONS } from '@/lib/rules';
import { supabase } from '@/lib/supabase';

/** Standort festlegen (aktueller Ort, Adresse oder Tippen auf die Karte) und Umkreis wählen. */
export default function LocationScreen() {
  const me = useProfile();
  const { refreshProfile } = useAuth();
  const { t } = useI18n();
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(me.home_lat != null ? { lat: me.home_lat, lng: me.home_lng! } : null);
  const [radius, setRadius] = useState(me.radius_km);
  const [address, setAddress] = useState(`${me.postal_code} ${me.city}`);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function useCurrent() {
    setError(null);
    const p = await currentPosition();
    if (p) setPos(p);
    else setError(t('location_denied'));
  }

  async function find() {
    setError(null);
    const p = await geocode(`${address}, Deutschland`);
    if (p) setPos(p);
    else setError(t('err_geocode'));
  }

  async function save() {
    if (!pos) return setError(t('location_missing'));
    setBusy(true);
    const { error } = await supabase.from('profiles').update({ home_lat: pos.lat, home_lng: pos.lng, radius_km: radius }).eq('id', me.id);
    setBusy(false);
    if (error) return setError(errorMessage(t, error));
    await refreshProfile();
    goBack();
  }

  return (
    <Screen>
      <Banner>{t('location_hint')}</Banner>
      <Button title={t('use_current_location')} variant="secondary" onPress={useCurrent} />
      <Field label={t('or_enter_address')} value={address} onChangeText={setAddress} />
      <Button title={t('find_address')} variant="ghost" onPress={find} />
      {pos && <AppMap center={pos} radiusKm={radius} markers={[]} onMapPress={setPos} height={320} />}
      <H2>{t('map_radius')}</H2>
      <P muted>{me.role === 'student' ? t('radius_hint_student') : t('radius_hint_client')}</P>
      <ChipRow>
        {RADIUS_OPTIONS.map((r) => <Chip key={r} label={`${r} km`} selected={radius === r} onPress={() => setRadius(r)} />)}
      </ChipRow>
      <ErrorText>{error}</ErrorText>
      <Button title={t('save')} onPress={save} loading={busy} disabled={!pos} />
    </Screen>
  );
}
