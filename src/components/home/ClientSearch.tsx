import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import {
  Avatar, Banner, Button, Card, Chip, ChipRow, Empty, Field, Loading, P, Row, Screen, Stars, colors,
} from '@/components/ui';
import { useProfile } from '@/lib/auth';
import { CATEGORIES, categoryLabel, formatPrice } from '@/lib/rules';
import { supabase } from '@/lib/supabase';
import type { Offer, PublicProfile } from '@/lib/types';

type Result = PublicProfile & { offers: Offer[] };

export default function ClientSearch() {
  const me = useProfile();
  const [category, setCategory] = useState<string | null>(null);
  const [place, setPlace] = useState(me.postal_code);
  const [results, setResults] = useState<Result[] | null>(null);

  const search = useCallback(async () => {
    setResults(null);
    let offerQuery = supabase.from('offers').select('*');
    if (category) offerQuery = offerQuery.eq('category', category);
    const { data: offers } = await offerQuery;
    const ids = [...new Set((offers ?? []).map((o) => o.student_id))];
    if (ids.length === 0) return setResults([]);

    let q = supabase.from('public_profiles').select('*').in('id', ids).eq('role', 'student');
    const p = place.trim();
    if (/^\d{5}$/.test(p)) {
      // Gleiche PLZ-Region (erste 3 Ziffern) – einfache Umkreissuche ohne Geodaten.
      q = q.like('postal_code', `${p.slice(0, 3)}%`);
    } else if (p) {
      q = q.ilike('city', `%${p}%`);
    }
    const { data: profiles } = await q;
    const list: Result[] = (profiles ?? []).map((pr) => ({
      ...(pr as PublicProfile),
      offers: (offers ?? []).filter((o) => o.student_id === pr.id) as Offer[],
    }));
    // Exakte PLZ zuerst, dann nach Bewertung
    list.sort((a, b) =>
      Number(b.postal_code === p) - Number(a.postal_code === p) || (b.avg_rating ?? 0) - (a.avg_rating ?? 0));
    setResults(list);
  }, [category, place]);

  useFocusEffect(useCallback(() => { search(); }, [search]));

  return (
    <Screen>
      {me.verification_status !== 'verified' && (
        <Banner tone="warning">
          <P>
            {me.verification_status === 'requested'
              ? '⏳ Deine Verifizierung wird geprüft. Danach kannst du Anfragen senden.'
              : 'Bevor du Schüler anfragen kannst, musst du dein Konto verifizieren lassen.'}
          </P>
          {me.verification_status !== 'requested' && (
            <Button title="Jetzt verifizieren" onPress={() => router.push('/(tabs)/account')} />
          )}
        </Banner>
      )}

      <Field label="PLZ oder Stadt" value={place} onChangeText={setPlace} onSubmitEditing={search} returnKeyType="search" />
      <ChipRow>
        <Chip label="Alle" selected={!category} onPress={() => setCategory(null)} />
        {CATEGORIES.map((c) => (
          <Chip key={c.key} label={`${c.icon} ${c.label}`} selected={category === c.key} onPress={() => setCategory(c.key)} />
        ))}
      </ChipRow>

      {results === null ? <Loading /> : results.length === 0 ? (
        <Empty title="Keine Schüler gefunden" text="Versuche eine andere Kategorie oder einen anderen Ort." />
      ) : (
        results.map((r) => {
          const shown = category ? r.offers.filter((o) => o.category === category) : r.offers;
          const prices = shown.length ? shown : r.offers;
          return (
            <Card key={r.id} onPress={() => router.push({ pathname: '/student/[id]', params: { id: r.id } })}>
              <Row>
                <Avatar name={r.display_name} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', fontSize: 16 }}>{r.display_name}, {r.age}</Text>
                  <P muted>{r.postal_code} {r.city} · {r.completed_jobs} erledigte Aufträge</P>
                </View>
              </Row>
              <Row>
                <Stars value={r.avg_rating ?? 0} />
                <Text style={{ color: colors.muted }}>{r.review_count ? `${r.avg_rating} (${r.review_count})` : 'Noch keine Bewertungen'}</Text>
              </Row>
              {prices.slice(0, 3).map((o) => (
                <P key={o.id}>{categoryLabel(o.category)} – {o.title}: <Text style={{ fontWeight: '600' }}>{formatPrice(o.price_min, o.price_max, o.price_unit)}</Text></P>
              ))}
            </Card>
          );
        })
      )}
    </Screen>
  );
}
