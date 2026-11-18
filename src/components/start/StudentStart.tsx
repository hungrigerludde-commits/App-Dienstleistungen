import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import AdBanner from '@/components/AdBanner';
import PriceLight from '@/components/PriceLight';
import StatusBanners from '@/components/StatusBanners';
import SwipeDeck from '@/components/SwipeDeck';
import { Button, Card, Empty, Loading, P, Row, Screen, Stars, colors } from '@/components/ui';
import { useAuth, useProfile } from '@/lib/auth';
import { notify } from '@/lib/dialog';
import { errorMessage, useI18n } from '@/lib/i18n';
import { SERVICE_ICON, formatDateTime, formatPriceRange, serviceKey, type Service } from '@/lib/rules';
import { supabase } from '@/lib/supabase';
import type { PostSuggestion } from '@/lib/types';

type DeckItem = { kind: 'post'; post: PostSuggestion } | { kind: 'ad'; seed: number };

export default function StudentStart() {
  const me = useProfile();
  const { refreshProfile } = useAuth();
  const { t, lang } = useI18n();
  const [items, setItems] = useState<DeckItem[] | null>(null);
  const [hasOffers, setHasOffers] = useState<boolean | undefined>(undefined);
  const [version, setVersion] = useState(0);

  const load = useCallback(async () => {
    refreshProfile();
    const [{ data }, { count }] = await Promise.all([
      supabase.rpc('student_suggestions'),
      supabase.from('offers').select('id', { count: 'exact', head: true }).eq('student_id', me.id),
    ]);
    setHasOffers((count ?? 0) > 0);
    const deck: DeckItem[] = [];
    ((data ?? []) as PostSuggestion[]).forEach((p, i) => {
      deck.push({ kind: 'post', post: p });
      if ((i + 1) % 4 === 0) deck.push({ kind: 'ad', seed: i });
    });
    setItems(deck);
    setVersion((v) => v + 1);
  }, [me.id, refreshProfile]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function onSwipe(item: DeckItem, liked: boolean) {
    if (item.kind === 'ad') return;
    if (liked) {
      const { error } = await supabase.rpc('apply_to_post', { post: item.post.post_id });
      if (error) notify(t('error'), errorMessage(t, error));
      else notify(t('applied'));
    } else {
      await supabase.from('swipes').insert({ user_id: me.id, target_kind: 'post', target_id: item.post.post_id, liked: false });
    }
  }

  return (
    <Screen>
      <StatusBanners hasOffers={hasOffers} />
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 20, fontWeight: '800' }}>{t('start_suggestions')}</Text>
        <Button title={t('my_jobs')} variant="ghost" onPress={() => router.push('/jobs')} />
      </Row>
      <P muted>{t('swipe_hint')}</P>
      {items === null ? <Loading /> : (
        <SwipeDeck
          key={version}
          items={items}
          keyOf={(i) => (i.kind === 'ad' ? `ad-${i.seed}` : i.post.post_id)}
          onSwipe={onSwipe}
          empty={<Empty title={t('no_suggestions')} text={t('no_suggestions_student')} />}
          renderCard={(i) => (i.kind === 'ad' ? (
            <View style={{ height: 430 }}><AdBanner seed={i.seed} large /></View>
          ) : (
            <PostCard p={i.post} lang={lang} t={t} />
          ))}
        />
      )}
      <AdBanner seed={2} />
    </Screen>
  );
}

function PostCard({ p, lang, t }: { p: PostSuggestion; lang: 'de' | 'en'; t: ReturnType<typeof useI18n>['t'] }) {
  return (
    <Card style={{ minHeight: 430, gap: 10, padding: 18 }}>
      <Text style={{ fontSize: 44 }}>{SERVICE_ICON[p.service as Service]}</Text>
      <Text style={{ color: colors.muted, fontWeight: '700' }}>{t(serviceKey(p.service))}</Text>
      <Text style={{ fontSize: 22, fontWeight: '800' }}>{p.title}</Text>
      <P numberOfLines={3}>{p.description}</P>
      <View style={{ height: 1, backgroundColor: colors.border }} />
      <Text style={{ fontSize: 18, fontWeight: '800', color: colors.primaryDark }}>
        {formatPriceRange(p.price_min, p.price_max, lang)} {p.price_unit === 'stunde' ? t('per_hour') : t('per_job')}
      </Text>
      <PriceLight service={p.service} min={p.price_min} max={p.price_max} unit={p.price_unit} durationMinutes={p.duration_minutes} />
      <P>📅 {formatDateTime(p.scheduled_start, lang)} · {p.duration_minutes} {t('minutes')}</P>
      <P>📍 {p.city} · {t('away_km', { n: p.distance_km })}</P>
      <Row>
        <Text style={{ fontWeight: '600' }}>{p.client_name}</Text>
        <Stars value={p.client_rating ?? 0} />
        {p.is_favorite && <Text style={{ color: colors.danger }}>♥</Text>}
      </Row>
      {p.photo_count > 0 && <P muted>📷 {p.photo_count} {t('photos')}</P>}
      <Button title={t('show_details')} variant="secondary" onPress={() => router.push({ pathname: '/post/[id]', params: { id: p.post_id } })} />
    </Card>
  );
}
