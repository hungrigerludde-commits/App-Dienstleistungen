import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import {
  Avatar, Badge, Banner, Button, Card, Empty, H2, Loading, P, Row, Screen, Stars, colors,
} from '@/components/ui';
import { useProfile } from '@/lib/auth';
import { confirm, notify } from '@/lib/dialog';
import { categoryLabel, formatPrice } from '@/lib/rules';
import { errorText, supabase } from '@/lib/supabase';
import type { Offer, PublicProfile, Review } from '@/lib/types';

export default function StudentProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useProfile();
  const [p, setP] = useState<PublicProfile | null | undefined>(undefined);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: prof }, { data: o }, { data: r }] = await Promise.all([
        supabase.from('public_profiles').select('*').eq('id', id).maybeSingle(),
        supabase.from('offers').select('*').eq('student_id', id).order('category'),
        supabase.from('reviews').select('*').eq('reviewee_id', id).order('created_at', { ascending: false }).limit(20),
      ]);
      setP(prof as PublicProfile | null);
      setOffers((o ?? []) as Offer[]);
      setReviews((r ?? []) as Review[]);
    })();
  }, [id]);

  async function block() {
    const ok = await confirm('Nutzer blockieren?', 'Ihr seht euch dann gegenseitig nicht mehr und könnt euch nicht mehr schreiben.', 'Blockieren', true);
    if (!ok) return;
    const { error } = await supabase.from('blocks').insert({ blocker_id: me.id, blocked_id: id });
    if (error) return notify('Fehler', errorText(error));
    router.back();
  }

  if (p === undefined) return <Loading />;
  if (p === null) return <Screen><Empty title="Profil nicht verfügbar" /></Screen>;

  const canRequest = me.role === 'client' && p.role === 'student';

  return (
    <Screen>
      <Card>
        <Row>
          <Avatar name={p.display_name} size={64} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontWeight: '800', fontSize: 20 }}>{p.display_name}, {p.age}</Text>
            <P muted>{p.postal_code} {p.city} · Umkreis {p.radius_km} km</P>
            {p.has_parent_consent && p.age < 18 && <Badge label="Von Eltern freigegeben ✓" color={colors.success} />}
          </View>
        </Row>
        <Row>
          <Stars value={p.avg_rating ?? 0} size={18} />
          <Text style={{ color: colors.muted }}>
            {p.review_count ? `${p.avg_rating} · ${p.review_count === 1 ? '1 Bewertung' : `${p.review_count} Bewertungen`}` : 'Noch keine Bewertungen'} · {p.completed_jobs} erledigt
          </Text>
        </Row>
        {p.bio ? <P>{p.bio}</P> : null}
        {p.availability_note ? <P>🕒 {p.availability_note}</P> : null}
      </Card>

      <H2>Angebote</H2>
      {offers.map((o) => (
        <Card key={o.id}>
          <Text style={{ fontWeight: '700' }}>{categoryLabel(o.category)}</Text>
          <P>{o.title}</P>
          {o.description ? <P muted>{o.description}</P> : null}
          <Text style={{ fontWeight: '700', color: colors.primaryDark }}>{formatPrice(o.price_min, o.price_max, o.price_unit)}</Text>
          {canRequest && (
            <Button title="Anfragen" onPress={() => router.push({ pathname: '/request/[studentId]', params: { studentId: p.id, offerId: o.id } })} />
          )}
        </Card>
      ))}

      {canRequest && me.verification_status !== 'verified' && (
        <Banner tone="warning">Du kannst Anfragen senden, sobald dein Konto verifiziert ist.</Banner>
      )}

      <H2>Bewertungen</H2>
      {reviews.length === 0 ? <P muted>Noch keine Bewertungen.</P> : reviews.map((r) => (
        <Card key={r.id}>
          <Stars value={r.rating} />
          {r.comment ? <P>{r.comment}</P> : null}
          <P muted>{new Date(r.created_at).toLocaleDateString('de-DE')}</P>
        </Card>
      ))}

      {p.id !== me.id && (
        <Row style={{ justifyContent: 'center' }}>
          <Button title="Melden" variant="ghost" onPress={() => router.push({ pathname: '/report', params: { userId: p.id } })} />
          <Button title="Blockieren" variant="ghost" onPress={block} />
        </Row>
      )}
    </Screen>
  );
}
