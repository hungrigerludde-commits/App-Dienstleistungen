import { goBack } from '@/lib/nav';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import PhotoGrid from '@/components/PhotoGrid';
import PriceLight from '@/components/PriceLight';
import { Avatar, Badge, Banner, Button, Card, Chip, ChipRow, Empty, H2, Loading, P, Row, Screen, Stars, colors } from '@/components/ui';
import { useProfile } from '@/lib/auth';
import { confirm, notify } from '@/lib/dialog';
import { errorMessage, useI18n } from '@/lib/i18n';
import { SERVICE_ICON, formatPriceRange, serviceKey, type Service } from '@/lib/rules';
import { supabase } from '@/lib/supabase';
import type { JobPost, Offer, PublicProfile, Review } from '@/lib/types';

export default function StudentProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useProfile();
  const { t, lang } = useI18n();
  const [p, setP] = useState<PublicProfile | null | undefined>(undefined);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [fav, setFav] = useState(false);
  const [myPosts, setMyPosts] = useState<JobPost[]>([]);
  const [choosing, setChoosing] = useState(false);

  const load = useCallback(async () => {
    const [{ data: prof }, { data: o }, { data: ph }, { data: r }, { data: f }] = await Promise.all([
      supabase.from('public_profiles').select('*').eq('id', id).maybeSingle(),
      supabase.from('offers').select('*').eq('student_id', id),
      supabase.from('photos').select('storage_path').eq('owner_id', id).eq('kind', 'portfolio'),
      supabase.from('reviews').select('*').eq('reviewee_id', id).order('created_at', { ascending: false }).limit(20),
      supabase.from('favorites').select('favorite_id').eq('user_id', me.id).eq('favorite_id', id),
    ]);
    setP(prof as PublicProfile | null);
    setOffers((o ?? []) as Offer[]);
    setPhotos((ph ?? []).map((x) => x.storage_path));
    setReviews((r ?? []) as Review[]);
    setFav((f ?? []).length > 0);
    if (me.role === 'client') {
      const { data: posts } = await supabase.from('job_posts').select('*').eq('client_id', me.id).eq('status', 'open');
      setMyPosts((posts ?? []) as JobPost[]);
    }
  }, [id, me.id, me.role]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function toggleFav() {
    if (fav) await supabase.from('favorites').delete().eq('user_id', me.id).eq('favorite_id', id);
    else await supabase.from('favorites').insert({ user_id: me.id, favorite_id: id });
    setFav(!fav);
  }

  async function invite(postId: string) {
    const { data, error } = await supabase.rpc('invite_student', { post: postId, student: id });
    if (error) return notify(t('error'), errorMessage(t, error));
    notify(t('invited'));
    router.push({ pathname: '/job/[id]', params: { id: data as string } });
  }

  async function block() {
    if (!(await confirm(t('block_user'), t('block_q'), t('block_user'), true))) return;
    await supabase.from('blocks').insert({ blocker_id: me.id, blocked_id: id });
    goBack();
  }

  if (p === undefined) return <Loading />;
  if (p === null) return <Screen><Empty title={t('not_found')} /></Screen>;

  const services = new Set(offers.map((o) => o.service));
  const matchingPosts = myPosts.filter((x) => services.has(x.service));

  return (
    <Screen>
      <Card>
        <Row>
          <Avatar name={p.display_name} size={64} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontWeight: '800', fontSize: 20 }}>{p.display_name}, {p.age}</Text>
            <P muted>{p.city} · {t('map_radius')} {p.radius_km} km</P>
            <Row>
              {p.is_verified && <Badge label={`${t('verified')} ✓`} color={colors.success} />}
              {p.age < 18 && p.can_participate && <Badge label={t('parent_approved')} color={colors.success} />}
            </Row>
          </View>
          {me.role === 'client' && (
            <Pressable onPress={toggleFav} hitSlop={10}>
              <Text style={{ fontSize: 30, color: fav ? colors.danger : colors.muted }}>{fav ? '♥' : '♡'}</Text>
            </Pressable>
          )}
        </Row>
        <Row>
          <Stars value={p.avg_rating ?? 0} size={18} />
          <Text style={{ color: colors.muted }}>{p.review_count === 1 ? t('review_1') : t('reviews_n', { n: p.review_count })} · {t('done_jobs_n', { n: p.completed_jobs })}</Text>
        </Row>
        {p.bio ? <P>{p.bio}</P> : null}
        {p.availability_note ? <P>🕒 {p.availability_note}</P> : null}
        {p.work_max_minutes ? <P muted>🛡️ {t('allowed_times', { min: p.work_min_hour!, max: p.work_max_hour!, h: p.work_max_minutes / 60 })}</P> : null}
      </Card>

      {photos.length > 0 && (
        <>
          <H2>{t('photos_portfolio')}</H2>
          <PhotoGrid paths={photos} size={130} />
        </>
      )}

      <H2>{t('offers')}</H2>
      {offers.map((o) => (
        <Card key={o.id}>
          <Text style={{ fontWeight: '700' }}>{SERVICE_ICON[o.service as Service]} {t(serviceKey(o.service))}</Text>
          <P>{o.title}</P>
          {o.description ? <P muted>{o.description}</P> : null}
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '800', color: colors.primaryDark }}>{formatPriceRange(o.price_min, o.price_max, lang)} {o.price_unit === 'stunde' ? t('per_hour') : t('per_job')}</Text>
            <PriceLight service={o.service} min={o.price_min} max={o.price_max} unit={o.price_unit} />
          </Row>
        </Card>
      ))}

      {me.role === 'client' && (choosing ? (
        <Card>
          <H2>{t('choose_post')}</H2>
          {matchingPosts.length === 0 ? <P muted>{t('no_open_posts')}</P> : (
            <ChipRow>
              {matchingPosts.map((x) => <Chip key={x.id} label={`${SERVICE_ICON[x.service as Service]} ${x.title}`} onPress={() => invite(x.id)} />)}
            </ChipRow>
          )}
          <Button title={t('new_post')} variant="ghost" onPress={() => router.push('/post/new')} />
        </Card>
      ) : (
        <Button title={t('invite_to_post')} onPress={() => setChoosing(true)} />
      ))}
      {me.role === 'client' && me.verification_status !== 'verified' && <Banner tone="warning">{t('ERR_VERIFY_FIRST')}</Banner>}

      <H2>{t('reviews')}</H2>
      {reviews.length === 0 ? <P muted>{t('no_reviews')}</P> : reviews.map((r) => (
        <Card key={r.id}>
          <Stars value={r.rating} />
          {r.comment ? <P>{r.comment}</P> : null}
        </Card>
      ))}

      {p.id !== me.id && (
        <Row style={{ justifyContent: 'center' }}>
          <Button title={t('report')} variant="ghost" onPress={() => router.push({ pathname: '/report', params: { userId: p.id } })} />
          <Button title={t('block_user')} variant="ghost" onPress={block} />
        </Row>
      )}
    </Screen>
  );
}
