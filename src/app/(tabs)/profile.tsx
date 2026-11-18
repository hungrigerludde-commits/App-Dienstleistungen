import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import PhotoGrid from '@/components/PhotoGrid';
import PriceLight from '@/components/PriceLight';
import StatusBanners from '@/components/StatusBanners';
import { Avatar, Badge, Button, Card, Chip, ChipRow, H2, P, Row, Screen, Stars, colors } from '@/components/ui';
import { useAuth, useProfile } from '@/lib/auth';
import { confirm, notify } from '@/lib/dialog';
import { errorMessage, useI18n } from '@/lib/i18n';
import { pickImage, uploadImage } from '@/lib/photos';
import { SERVICE_ICON, ageOn, formatPriceRange, fromIsoDate, serviceKey, workRuleFor, type Service } from '@/lib/rules';
import { supabase } from '@/lib/supabase';
import type { Offer, Photo, PublicProfile, Review } from '@/lib/types';

export default function ProfileTab() {
  const me = useProfile();
  const { refreshProfile, signOut } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [pub, setPub] = useState<PublicProfile | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const [{ data: p }, { data: o }, { data: ph }, { data: r }] = await Promise.all([
      supabase.from('public_profiles').select('*').eq('id', me.id).maybeSingle(),
      supabase.from('offers').select('*').eq('student_id', me.id).order('created_at'),
      supabase.from('photos').select('*').eq('owner_id', me.id).eq('kind', 'portfolio').order('created_at'),
      supabase.from('reviews').select('*').eq('reviewee_id', me.id).order('created_at', { ascending: false }).limit(10),
    ]);
    setPub(p as PublicProfile | null);
    setOffers((o ?? []) as Offer[]);
    setPhotos((ph ?? []) as Photo[]);
    setReviews((r ?? []) as Review[]);
  }, [me.id]);

  useFocusEffect(useCallback(() => { load(); refreshProfile(); }, [load, refreshProfile]));

  async function addPortfolioPhoto() {
    const uri = await pickImage();
    if (!uri) return;
    setUploading(true);
    try {
      const path = await uploadImage('photos', me.id, uri, 'portfolio-');
      const { error } = await supabase.from('photos').insert({ owner_id: me.id, kind: 'portfolio', storage_path: path });
      if (error) throw error;
      load();
    } catch (e) {
      notify(t('error'), errorMessage(t, e));
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto(path: string) {
    if (!(await confirm(t('delete'), '', t('delete'), true))) return;
    await supabase.storage.from('photos').remove([path]);
    await supabase.from('photos').delete().eq('storage_path', path);
    load();
  }

  async function toggleListed(v: boolean) {
    await supabase.from('profiles').update({ is_listed: v }).eq('id', me.id);
    refreshProfile();
  }

  async function changeLang(l: 'de' | 'en') {
    setLang(l);
    await supabase.from('profiles').update({ language: l }).eq('id', me.id);
  }

  async function deleteAccount() {
    if (!(await confirm(t('delete_account'), t('delete_account_q'), t('delete'), true))) return;
    const { error } = await supabase.rpc('delete_my_account');
    if (error) return notify(t('error'), errorMessage(t, error));
    await signOut();
  }

  const age = ageOn(fromIsoDate(me.birth_date));
  const displayName = `${me.first_name} ${me.last_name[0]}.`;
  const rule = me.role === 'student' ? workRuleFor(age, me.full_time_school) : null;
  const canBeVisible = pub?.can_participate;

  return (
    <Screen>
      <StatusBanners needsLocation={false} />
      <Card>
        <Row>
          <Avatar name={displayName} size={64} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontWeight: '800', fontSize: 20 }}>{me.first_name} {me.last_name}, {age}</Text>
            <P muted>{me.postal_code} {me.city}</P>
            {me.verification_status === 'verified' && <Badge label={`${t('verified')} ✓`} color={colors.success} />}
          </View>
        </Row>
        <Row>
          <Stars value={pub?.avg_rating ?? 0} />
          <Text style={{ color: colors.muted }}>
            {(pub?.review_count ?? 0) === 1 ? t('review_1') : t('reviews_n', { n: pub?.review_count ?? 0 })} · {t('done_jobs_n', { n: pub?.completed_jobs ?? 0 })}
          </Text>
        </Row>
        {me.bio ? <P>{me.bio}</P> : null}
        {me.availability_note ? <P>🕒 {me.availability_note}</P> : null}
        <Button title={t('edit_profile')} variant="secondary" onPress={() => router.push('/profile-edit')} />
      </Card>

      {me.role !== 'parent' && (
        <Card onPress={() => router.push('/location')}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '700' }}>📍 {t('location_title')}</Text>
            <Text style={{ color: me.home_lat != null ? colors.success : colors.danger }}>
              {me.home_lat != null ? `${t('location_set')} · ${me.radius_km} km` : t('location_missing')}
            </Text>
          </Row>
        </Card>
      )}

      {me.role === 'student' && (
        <>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700' }}>
                  {!me.is_listed ? t('visible_off') : canBeVisible ? t('visible_on') : t('visible_not_yet')}
                </Text>
                <P muted>{t('visible_hint')}</P>
              </View>
              <Switch value={me.is_listed} onValueChange={toggleListed} />
            </Row>
          </Card>

          <Row style={{ justifyContent: 'space-between' }}>
            <H2>{t('my_offers')}</H2>
            <Button title={`+ ${t('offer')}`} variant="ghost" onPress={() => router.push('/offer/edit')} />
          </Row>
          {offers.length === 0 && <P muted>{t('banner_no_offers')}</P>}
          {offers.map((o) => (
            <Card key={o.id} onPress={() => router.push({ pathname: '/offer/edit', params: { id: o.id } })}>
              <Text style={{ fontWeight: '700' }}>{SERVICE_ICON[o.service as Service]} {t(serviceKey(o.service))}</Text>
              <P>{o.title}</P>
              <Row style={{ justifyContent: 'space-between' }}>
                <P muted>{formatPriceRange(o.price_min, o.price_max, lang)} {o.price_unit === 'stunde' ? t('per_hour') : t('per_job')}</P>
                <PriceLight service={o.service} min={o.price_min} max={o.price_max} unit={o.price_unit} />
              </Row>
            </Card>
          ))}

          <H2>{t('photos_portfolio')}</H2>
          <P muted>{t('photos_portfolio_hint')}</P>
          <PhotoGrid paths={photos.map((p) => p.storage_path)} onAdd={addPortfolioPhoto} onRemove={removePhoto} busy={uploading} />

          {rule && (
            <Card>
              <Text style={{ fontWeight: '700' }}>🛡️ {t('youth_protection')}</Text>
              <P>{me.full_time_school || age < 15 ? t('youth_school') : t('youth_teen')}</P>
            </Card>
          )}
        </>
      )}

      <H2>{t('reviews')}</H2>
      {reviews.length === 0 ? <P muted>{t('no_reviews')}</P> : reviews.map((r) => (
        <Card key={r.id}>
          <Stars value={r.rating} />
          {r.comment ? <P>{r.comment}</P> : null}
        </Card>
      ))}

      <Card>
        <Text style={{ fontWeight: '700' }}>{t('language')}</Text>
        <ChipRow>
          <Chip label="🇩🇪 Deutsch" selected={lang === 'de'} onPress={() => changeLang('de')} />
          <Chip label="🇬🇧 English" selected={lang === 'en'} onPress={() => changeLang('en')} />
        </ChipRow>
      </Card>

      <Card>
        {me.role === 'client' && <Button title={`♥ ${t('favorites')}`} variant="ghost" onPress={() => router.push('/favorites')} />}
        {me.role !== 'parent' && <Button title={`📋 ${t('my_jobs')}`} variant="ghost" onPress={() => router.push('/jobs')} />}
        {me.verification_status !== 'verified' && !(me.role === 'student' && age < 16) && (
          <Button title={`🪪 ${t('verify_title')}`} variant="ghost" onPress={() => router.push('/verify')} />
        )}
        <Button title={t('safety_tips')} variant="ghost" onPress={() => router.push('/legal/safety')} />
        <Button title={t('blocked_users')} variant="ghost" onPress={() => router.push('/blocked')} />
        <Button title={`📄 ${t('terms')}`} variant="ghost" onPress={() => router.push('/legal/terms')} />
        <Button title={`🔒 ${t('privacy')}`} variant="ghost" onPress={() => router.push('/legal/privacy')} />
        {me.is_admin && <Button title={t('admin')} variant="ghost" onPress={() => router.push('/admin')} />}
      </Card>

      <Button title={t('logout')} variant="secondary" onPress={signOut} />
      <Button title={t('delete_account')} variant="danger" onPress={deleteAccount} />
    </Screen>
  );
}
