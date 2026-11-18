import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import AdBanner from '@/components/AdBanner';
import PhotoGrid from '@/components/PhotoGrid';
import PriceLight from '@/components/PriceLight';
import StatusBanners from '@/components/StatusBanners';
import SwipeDeck from '@/components/SwipeDeck';
import { Avatar, Badge, Button, Card, Empty, Loading, P, Row, Screen, Stars, colors } from '@/components/ui';
import { useAuth, useProfile } from '@/lib/auth';
import { notify } from '@/lib/dialog';
import { errorMessage, useI18n } from '@/lib/i18n';
import { SERVICE_ICON, formatPriceRange, serviceKey, type Service } from '@/lib/rules';
import { supabase } from '@/lib/supabase';
import type { StudentSuggestion } from '@/lib/types';

type DeckItem = { kind: 'student'; s: StudentSuggestion } | { kind: 'ad'; seed: number };

export default function ClientStart() {
  const me = useProfile();
  const { refreshProfile } = useAuth();
  const { t } = useI18n();
  const [items, setItems] = useState<DeckItem[] | null>(null);
  const [photos, setPhotos] = useState<Record<string, string[]>>({});
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [version, setVersion] = useState(0);

  const load = useCallback(async () => {
    refreshProfile();
    const { data } = await supabase.rpc('client_suggestions');
    const list = (data ?? []) as StudentSuggestion[];
    const ids = [...new Set(list.map((s) => s.student_id))];
    if (ids.length) {
      const { data: ph } = await supabase.from('photos').select('owner_id, storage_path').eq('kind', 'portfolio').in('owner_id', ids);
      const map: Record<string, string[]> = {};
      for (const p of ph ?? []) (map[p.owner_id] ??= []).push(p.storage_path);
      setPhotos(map);
    }
    setFavorites(new Set(list.filter((s) => s.is_favorite).map((s) => s.student_id)));
    const deck: DeckItem[] = [];
    list.forEach((s, i) => {
      deck.push({ kind: 'student', s });
      if ((i + 1) % 4 === 0) deck.push({ kind: 'ad', seed: i + 1 });
    });
    setItems(deck);
    setVersion((v) => v + 1);
  }, [refreshProfile]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function toggleFavorite(id: string) {
    if (favorites.has(id)) {
      await supabase.from('favorites').delete().eq('user_id', me.id).eq('favorite_id', id);
      setFavorites((f) => { const n = new Set(f); n.delete(id); return n; });
    } else {
      await supabase.from('favorites').insert({ user_id: me.id, favorite_id: id });
      setFavorites((f) => new Set(f).add(id));
    }
  }

  async function onSwipe(item: DeckItem, liked: boolean) {
    if (item.kind === 'ad') return;
    if (liked) {
      const { error } = await supabase.rpc('invite_student', { post: item.s.post_id, student: item.s.student_id });
      if (error) notify(t('error'), errorMessage(t, error));
      else notify(t('invited'));
    } else {
      await supabase.from('swipes').insert({
        user_id: me.id, target_kind: 'student', target_id: item.s.student_id, context_id: item.s.post_id, liked: false,
      });
    }
  }

  return (
    <Screen>
      <StatusBanners needsLocation={false} />
      <Button title={t('new_post')} onPress={() => router.push('/post/new')} disabled={me.verification_status !== 'verified'} />
      <Row style={{ justifyContent: 'center', gap: 4 }}>
        <Button title={t('start_mine_client')} variant="ghost" onPress={() => router.push('/posts')} />
        <Button title={t('my_jobs')} variant="ghost" onPress={() => router.push('/jobs')} />
      </Row>
      <Text style={{ fontSize: 20, fontWeight: '800' }}>{t('start_suggestions')}</Text>
      <P muted>{t('swipe_hint')}</P>
      {items === null ? <Loading /> : (
        <SwipeDeck
          key={version}
          items={items}
          keyOf={(i) => (i.kind === 'ad' ? `ad-${i.seed}` : `${i.s.student_id}-${i.s.post_id}`)}
          onSwipe={onSwipe}
          empty={<Empty title={t('no_suggestions')} text={t('no_suggestions_client')} />}
          renderCard={(i) => (i.kind === 'ad' ? (
            <View style={{ height: 430 }}><AdBanner seed={i.seed} large /></View>
          ) : (
            <StudentCard s={i.s} photos={photos[i.s.student_id] ?? []} fav={favorites.has(i.s.student_id)} onFav={() => toggleFavorite(i.s.student_id)} />
          ))}
        />
      )}
      <AdBanner seed={1} />
    </Screen>
  );
}

function StudentCard({ s, photos, fav, onFav }: { s: StudentSuggestion; photos: string[]; fav: boolean; onFav: () => void }) {
  const { t, lang } = useI18n();
  return (
    <Card style={{ minHeight: 430, gap: 10, padding: 18 }}>
      <Row>
        <Avatar name={s.display_name} size={64} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 22, fontWeight: '800' }}>{s.display_name}, {s.age}</Text>
          <Row>
            <Stars value={s.avg_rating ?? 0} />
            <Text style={{ color: colors.muted }}>{s.review_count === 1 ? t('review_1') : t('reviews_n', { n: s.review_count })}</Text>
          </Row>
        </View>
        <Pressable onPress={onFav} hitSlop={10} accessibilityLabel="favorite">
          <Text style={{ fontSize: 28, color: fav ? colors.danger : colors.muted }}>{fav ? '♥' : '♡'}</Text>
        </Pressable>
      </Row>
      <Badge label={`${t('verified')} ✓`} color={colors.success} />
      <Text style={{ color: colors.muted, fontWeight: '700' }}>{SERVICE_ICON[s.service as Service]} {t(serviceKey(s.service))}</Text>
      <Text style={{ fontSize: 18, fontWeight: '700' }}>{s.offer_title}</Text>
      <Text style={{ fontSize: 18, fontWeight: '800', color: colors.primaryDark }}>
        {formatPriceRange(s.price_min, s.price_max, lang)} {s.price_unit === 'stunde' ? t('per_hour') : t('per_job')}
      </Text>
      <PriceLight service={s.service} min={s.price_min} max={s.price_max} unit={s.price_unit} />
      {s.bio ? <P numberOfLines={2}>{s.bio}</P> : null}
      <P>📍 {t('away_km', { n: s.distance_km })} · {t('done_jobs_n', { n: s.completed_jobs })}</P>
      {photos.length > 0 && <PhotoGrid paths={photos.slice(0, 4)} size={70} />}
      <Badge label={t('matches_post', { title: s.post_title })} color={colors.primary} />
      <Button title={t('show_profile')} variant="secondary" onPress={() => router.push({ pathname: '/student/[id]', params: { id: s.student_id } })} />
    </Card>
  );
}
